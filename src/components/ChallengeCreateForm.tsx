import { useState } from 'react';
import { motion } from 'framer-motion';
import { createMyChallenge, joinChallenge } from '../lib/api';

export default function ChallengeCreateForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    setError(null);

    const result = await createMyChallenge(title, description || null, isPublic);
    if (result.error || !result.data) {
      setError(result.error ?? '作成に失敗しました');
      setSaving(false);
      return;
    }

    // Auto-join the challenge
    await joinChallenge('my', undefined, result.data.id);

    // Redirect to post form with the new challenge
    window.location.href = `/posts/new?my=${result.data.id}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="font-['Orbitron'] text-xl font-bold text-neon-cyan mb-2">
          NEW CHALLENGE
        </h2>
        <p className="text-text-secondary text-sm">
          自分だけの無理ゲーを作ろう
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-4 py-2 text-neon-pink text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block font-['Orbitron'] text-xs text-text-muted tracking-widest mb-2">
            TITLE
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 完璧なだし巻き卵への道"
            maxLength={100}
            required
            className="w-full px-4 py-3 bg-bg-raised border border-bg-raised rounded-lg text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block font-['Orbitron'] text-xs text-text-muted tracking-widest mb-2">
            DESCRIPTION <span className="font-sans text-text-muted">(任意)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="どんなチャレンジか、ルールがあれば書こう"
            maxLength={500}
            rows={3}
            className="w-full px-4 py-3 bg-bg-raised border border-bg-raised rounded-lg text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block font-['Orbitron'] text-xs text-text-muted tracking-widest mb-3">
            VISIBILITY
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex-1 py-3 rounded-lg text-sm border-2 transition-all ${
                isPublic
                  ? 'border-neon-cyan text-neon-cyan font-bold'
                  : 'border-bg-raised text-text-muted'
              }`}
            >
              🌐 公開
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex-1 py-3 rounded-lg text-sm border-2 transition-all ${
                !isPublic
                  ? 'border-neon-yellow text-neon-yellow font-bold'
                  : 'border-bg-raised text-text-muted'
              }`}
            >
              🔒 非公開
            </button>
          </div>
          <p className="text-text-muted text-[10px] mt-1">
            {isPublic ? '他のプレイヤーがあなたのチャレンジを見つけて参加できます' : 'あなただけのチャレンジです'}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="w-full py-4 bg-neon-cyan text-bg-deep font-['Orbitron'] font-bold text-lg rounded-lg hover:shadow-[0_0_30px_rgba(0,245,212,0.5)] transition-shadow disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'CREATING...' : 'START CHALLENGE'}
        </button>
      </form>
    </motion.div>
  );
}
