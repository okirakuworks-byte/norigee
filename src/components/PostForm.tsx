import { useState, useRef, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPost, createFreePost, joinChallenge, uploadImage } from '../lib/api';

interface Props {
  challengeTitle?: string;
  dailyId?: number;
  myChallengeId?: number;
}

export default function PostForm({ challengeTitle, dailyId, myChallengeId }: Props) {
  const [content, setContent] = useState('');
  const [result, setResult] = useState<'success' | 'failure'>('failure');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coinInserted, setCoinInserted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dayNumber, setDayNumber] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('画像は5MB以下にしてください');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCoinInsert = () => {
    setCoinInserted(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    // Upload image if selected
    let imageKeys: string[] = [];
    if (imageFile) {
      const uploadResult = await uploadImage(imageFile);
      if (uploadResult.error) {
        setError(`画像アップロード失敗: ${uploadResult.error}`);
        setIsSubmitting(false);
        return;
      }
      if (uploadResult.url) imageKeys = [uploadResult.url];
    }

    let participationId: number | null = null;

    // Only join a challenge if one is specified
    if (dailyId || myChallengeId) {
      const challengeType = dailyId ? 'daily' : 'my';
      const joinResult = await joinChallenge(
        challengeType,
        dailyId ?? undefined,
        myChallengeId ?? undefined
      );

      if (joinResult.error || !joinResult.data) {
        setError(joinResult.error ?? 'チャレンジへの参加に失敗しました');
        setIsSubmitting(false);
        return;
      }
      participationId = joinResult.data.id;
    }

    // Create post (with or without participation)
    const postResult = participationId
      ? await createPost(participationId, content.trim(), result, imageKeys)
      : await createFreePost(content.trim(), result, imageKeys);

    if (postResult.error) {
      setError(postResult.error);
      setIsSubmitting(false);
      return;
    }

    setDayNumber(postResult.data?.day_number ?? 0);
    setSubmitted(true);
    setIsSubmitting(false);
  };

  // Post-submit screen
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <AnimatePresence>
          {result === 'failure' ? (
            <motion.div
              key="failed"
              initial={{ scale: 3, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: -3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <p
                className="font-['Orbitron'] text-5xl font-black text-neon-pink mb-4"
                style={{ textShadow: '0 0 30px rgba(255,45,120,0.6)' }}
              >
                FAILED
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="clear"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <p
                className="font-['Orbitron'] text-5xl font-black text-neon-cyan mb-4"
                style={{ textShadow: '0 0 30px rgba(0,245,212,0.6)' }}
              >
                CLEAR!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {dayNumber > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="font-['Orbitron'] text-neon-cyan text-lg"
          >
            DAY {dayNumber}
          </motion.p>
        )}

        <p className="text-text-secondary mt-6 mb-8">RECORD SAVED!</p>

        <a
          href="/home"
          className="inline-block px-6 py-2 border border-bg-raised text-text-secondary rounded-lg hover:border-neon-yellow hover:text-neon-yellow transition-colors text-sm"
        >
          BACK TO ARCADE
        </a>
      </div>
    );
  }

  // Coin insert screen
  if (!coinInserted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        {challengeTitle && (
          <p className="text-text-secondary text-sm mb-6">{challengeTitle}</p>
        )}

        <motion.button
          onClick={handleCoinInsert}
          className="relative px-12 py-6 bg-bg-surface border-2 border-neon-yellow rounded-2xl font-['Orbitron'] text-xl font-bold text-neon-yellow hover:shadow-[0_0_40px_rgba(255,230,0,0.4)] transition-shadow"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            INSERT COIN
          </motion.span>
          <span className="block text-xs text-text-muted mt-1">FREE</span>
        </motion.button>

        <p className="text-text-muted text-xs mt-4">
          コインを入れてチャレンジ開始
        </p>
      </div>
    );
  }

  // Post form
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-4 py-3 text-neon-pink text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Result selector */}
        <div>
          <label className="text-text-muted text-xs block mb-3 font-['Orbitron']">RESULT</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setResult('failure')}
              className={`flex-1 py-3 rounded-lg font-['Orbitron'] text-sm font-bold border-2 transition-all ${
                result === 'failure'
                  ? 'border-neon-pink text-neon-pink shadow-[0_0_20px_rgba(255,45,120,0.3)]'
                  : 'border-bg-raised text-text-muted hover:border-bg-raised/50'
              }`}
            >
              ✕ FAILED
            </button>
            <button
              type="button"
              onClick={() => setResult('success')}
              className={`flex-1 py-3 rounded-lg font-['Orbitron'] text-sm font-bold border-2 transition-all ${
                result === 'success'
                  ? 'border-neon-cyan text-neon-cyan shadow-[0_0_20px_rgba(0,245,212,0.3)]'
                  : 'border-bg-raised text-text-muted hover:border-bg-raised/50'
              }`}
            >
              ○ CLEAR
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="text-text-muted text-xs block mb-2 font-['Orbitron']">COMMENT</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="今日の奮闘を記録せよ..."
            maxLength={1000}
            rows={4}
            className="w-full bg-bg-raised border border-bg-raised rounded-lg px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-neon-yellow/50 resize-none transition-colors"
          />
          <p className="text-text-muted text-xs text-right mt-1">
            {content.length} / 1000
          </p>
        </div>

        {/* Image upload placeholder */}
        <div>
          <label className="text-text-muted text-xs block mb-2 font-['Orbitron']">EVIDENCE</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
          />
          <div
            className="border-2 border-dashed border-bg-raised rounded-lg p-6 text-center hover:border-text-muted transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.files[0] && handleImageSelect(e.dataTransfer.files[0]); }}
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="preview" className="max-h-40 mx-auto rounded-lg" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                  className="absolute top-1 right-1 bg-bg-deep/80 text-neon-pink rounded-full w-6 h-6 text-xs"
                >✕</button>
              </div>
            ) : (
              <>
                <p className="text-text-muted text-sm">📷 写真をドラッグ or クリック</p>
                <p className="text-text-muted text-xs mt-1">最大 5MB</p>
              </>
            )}
          </div>
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="w-full py-4 bg-neon-yellow text-bg-deep font-['Orbitron'] font-bold text-lg rounded-lg hover:shadow-[0_0_30px_rgba(255,230,0,0.5)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: content.trim() ? 1.01 : 1 }}
          whileTap={{ scale: content.trim() ? 0.99 : 1 }}
        >
          {isSubmitting ? 'SAVING...' : 'SUBMIT!'}
        </motion.button>
      </form>
    </motion.div>
  );
}
