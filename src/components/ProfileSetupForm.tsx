import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createSupabaseBrowser } from '../lib/supabase';

const supabase = createSupabaseBrowser();

/** Random default avatars */
const AVATAR_OPTIONS = [
  '🐱', '🐶', '🐸', '🦊', '🐼',
  '🐧', '🐙', '🦄', '🐲', '🎃',
  '👾', '🤖', '👻', '🎮', '🕹️',
  '🌟',
];

interface ProfileSetupFormProps {
  /** Google display name from auth metadata (used as suggestion, not default) */
  googleName?: string;
  userId: string;
  /** true = editing existing profile, false = first-time setup */
  isEdit?: boolean;
  existingProfile?: {
    username: string;
    display_name: string;
    avatar_emoji: string | null;
    bio: string | null;
  };
}

export default function ProfileSetupForm({
  googleName: initialGoogleName,
  userId: initialUserId,
  isEdit = false,
  existingProfile,
}: ProfileSetupFormProps) {
  const [resolvedUserId, setResolvedUserId] = useState(initialUserId);
  const [googleName, setGoogleName] = useState(initialGoogleName);

  const [resolvedProfile, setResolvedProfile] = useState(existingProfile);

  // Listen for client-side user data (static build fallback)
  useEffect(() => {
    if (resolvedUserId) return;
    function handleSetupUser(e: Event) {
      const detail = (e as CustomEvent).detail;
      setResolvedUserId(detail.userId);
      setGoogleName(detail.googleName);
    }
    function handleEditProfile(e: Event) {
      const detail = (e as CustomEvent).detail;
      setResolvedUserId(detail.userId);
      if (detail.existingProfile) {
        setResolvedProfile(detail.existingProfile);
        setUsername(detail.existingProfile.username);
        setDisplayName(detail.existingProfile.display_name);
        setAvatarEmoji(detail.existingProfile.avatar_emoji ?? '👾');
        setBio(detail.existingProfile.bio ?? '');
      }
    }
    window.addEventListener('norigee:setup-user', handleSetupUser);
    window.addEventListener('norigee:edit-profile', handleEditProfile);
    return () => {
      window.removeEventListener('norigee:setup-user', handleSetupUser);
      window.removeEventListener('norigee:edit-profile', handleEditProfile);
    };
  }, [resolvedUserId]);

  // Also try to resolve from auth if no userId prop
  useEffect(() => {
    if (resolvedUserId) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setResolvedUserId(user.id);
        setGoogleName(user.user_metadata?.full_name as string | undefined);
      }
    });
  }, [resolvedUserId]);

  const userId = resolvedUserId;
  const [username, setUsername] = useState(existingProfile?.username ?? '');
  const [displayName, setDisplayName] = useState(existingProfile?.display_name ?? '');
  const [avatarEmoji, setAvatarEmoji] = useState(existingProfile?.avatar_emoji ?? '👾');
  const [bio, setBio] = useState(existingProfile?.bio ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUsername = useCallback(async (value: string) => {
    if (value.length < 3) {
      setUsernameError('3文字以上で入力してください');
      return false;
    }
    if (value.length > 20) {
      setUsernameError('20文字以内で入力してください');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameError('英数字とアンダースコアのみ使えます');
      return false;
    }

    // Check uniqueness (skip if editing and unchanged)
    if (isEdit && (existingProfile?.username === value || resolvedProfile?.username === value)) {
      setUsernameError(null);
      return true;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', value)
      .neq('id', userId)
      .maybeSingle();

    if (data) {
      setUsernameError('このユーザー名は既に使われています');
      return false;
    }

    setUsernameError(null);
    return true;
  }, [userId, isEdit, existingProfile?.username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const trimmedDisplay = displayName.trim();
    if (!trimmedDisplay) {
      setError('ニックネームを入力してください');
      setSaving(false);
      return;
    }

    const isValid = await validateUsername(username);
    if (!isValid) {
      setSaving(false);
      return;
    }

    const profileData = {
      id: userId,
      username,
      display_name: trimmedDisplay,
      avatar_url: null,
      avatar_emoji: avatarEmoji,
      bio: bio.trim() || null,
    };

    const { error: dbError } = isEdit
      ? await supabase.from('profiles').update(profileData).eq('id', userId)
      : await supabase.from('profiles').upsert(profileData);

    if (dbError) {
      setError(`保存に失敗しました: ${dbError.message}`);
      setSaving(false);
      return;
    }

    window.location.replace(isEdit ? '/home' : '/home');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="font-['Orbitron'] text-2xl font-bold text-neon-yellow mb-2">
            {isEdit ? 'EDIT PROFILE' : 'PLAYER SETUP'}
          </h1>
          <p className="text-text-secondary text-sm">
            {isEdit
              ? 'プロフィールを編集できます'
              : 'アーケードで使うプレイヤー名を設定しよう'}
          </p>
          {!isEdit && googleName && (
            <p className="text-text-muted text-xs mt-2">
              ※ Googleアカウントの本名は公開されません
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar selection */}
          <div>
            <label className="block font-['Orbitron'] text-xs text-text-muted tracking-widest mb-3">
              AVATAR
            </label>
            <div className="flex justify-center mb-4">
              <motion.div
                key={avatarEmoji}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 rounded-full bg-bg-raised border-2 border-neon-cyan flex items-center justify-center text-4xl"
              >
                {avatarEmoji}
              </motion.div>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatarEmoji(emoji)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
                    avatarEmoji === emoji
                      ? 'bg-neon-cyan/20 border border-neon-cyan scale-110'
                      : 'bg-bg-raised border border-bg-raised hover:border-text-muted'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Nickname / Display Name */}
          <div>
            <label className="block font-['Orbitron'] text-xs text-text-muted tracking-widest mb-2">
              NICKNAME
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示されるニックネーム"
              maxLength={50}
              required
              className="w-full px-4 py-3 bg-bg-raised border border-bg-raised rounded-lg text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors"
            />
            <p className="text-text-muted text-[10px] mt-1">
              他のプレイヤーに表示される名前です（1〜50文字）
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block font-['Orbitron'] text-xs text-text-muted tracking-widest mb-2">
              USERNAME
            </label>
            <div className={`flex items-center bg-bg-raised border rounded-lg overflow-hidden transition-colors focus-within:border-neon-cyan ${
              usernameError ? 'border-neon-pink' : 'border-bg-raised'
            }`}>
              <span className="text-text-muted text-sm px-3 border-r border-bg-deep/30 select-none">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  setUsername(val);
                  if (usernameError) setUsernameError(null);
                }}
                onBlur={() => { if (username) validateUsername(username); }}
                placeholder="user_name"
                maxLength={20}
                required
                className="flex-1 px-3 py-3 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            {usernameError && (
              <p className="text-neon-pink text-[10px] mt-1">{usernameError}</p>
            )}
            <p className="text-text-muted text-[10px] mt-1">
              英数字とアンダースコアのみ（3〜20文字）
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block font-['Orbitron'] text-xs text-text-muted tracking-widest mb-2">
              BIO <span className="text-text-muted font-sans">(任意)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="ひとこと自己紹介..."
              maxLength={200}
              rows={3}
              className="w-full px-4 py-3 bg-bg-raised border border-bg-raised rounded-lg text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors resize-none"
            />
            <p className="text-text-muted text-[10px] mt-1 text-right">
              {bio.length}/200
            </p>
          </div>

          {/* Privacy notice */}
          {!isEdit && (
            <div className="bg-bg-raised/50 border border-bg-raised rounded-lg px-4 py-3">
              <p className="font-['Orbitron'] text-[10px] text-neon-cyan tracking-widest mb-1">
                PRIVACY
              </p>
              <ul className="text-text-secondary text-xs space-y-1">
                <li>- Googleアカウントの本名・メールアドレスは公開されません</li>
                <li>- 他のプレイヤーにはニックネームとアバターのみ表示されます</li>
                <li>- 設定は後からいつでも変更できます</li>
              </ul>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-4 py-2">
              <p className="text-neon-pink text-xs">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !displayName.trim() || !username}
            className="w-full py-4 bg-neon-yellow text-bg-deep font-['Orbitron'] font-bold text-lg rounded-lg hover:shadow-[0_0_30px_rgba(255,230,0,0.5)] transition-shadow disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? 'SAVING...' : isEdit ? 'UPDATE' : 'START GAME'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
