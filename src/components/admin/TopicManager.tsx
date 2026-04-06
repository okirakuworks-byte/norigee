import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSupabaseBrowser } from '../../lib/supabase';

const supabase = createSupabaseBrowser();
import type { DailyTopic } from '../../lib/types';

export default function TopicManager() {
  const [topics, setTopics] = useState<DailyTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<DailyTopic | null>(null);

  const fetchTopics = useCallback(async () => {
    const { data, error } = await supabase
      .from('daily_topics')
      .select('*')
      .order('scheduled_date', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTopics(data as DailyTopic[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('daily_topics').delete().eq('id', id);
    if (!error) {
      setTopics(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleSave = async (topic: Partial<DailyTopic> & { id?: number }) => {
    if (topic.id) {
      const { error } = await supabase
        .from('daily_topics')
        .update({
          title: topic.title,
          description: topic.description,
          difficulty: topic.difficulty,
          time_limit_seconds: topic.time_limit_seconds,
          scheduled_date: topic.scheduled_date,
          status: topic.scheduled_date ? 'scheduled' : 'draft',
          tags: topic.tags,
        })
        .eq('id', topic.id);

      if (!error) await fetchTopics();
    } else {
      const { error } = await supabase
        .from('daily_topics')
        .insert({
          title: topic.title,
          description: topic.description,
          difficulty: topic.difficulty ?? 3,
          time_limit_seconds: topic.time_limit_seconds ?? 180,
          scheduled_date: topic.scheduled_date,
          status: topic.scheduled_date ? 'scheduled' : 'draft',
          tags: topic.tags ?? [],
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (!error) await fetchTopics();
    }
    setShowForm(false);
    setEditingTopic(null);
  };

  const statusColors: Record<string, string> = {
    draft: 'text-text-muted border-text-muted',
    scheduled: 'text-neon-yellow border-neon-yellow',
    active: 'text-neon-cyan border-neon-cyan',
    archived: 'text-text-muted border-bg-raised',
  };

  const stockCount = topics.filter(t => t.status === 'draft').length;
  const scheduledCount = topics.filter(t => t.status === 'scheduled').length;

  if (loading) {
    return <p className="text-text-muted text-center py-12 font-['Orbitron'] text-sm">LOADING...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="STOCK" value={stockCount} color={stockCount < 7 ? 'text-neon-pink' : 'text-neon-cyan'} />
        <StatCard label="SCHEDULED" value={scheduledCount} color="text-neon-yellow" />
        <StatCard label="TOTAL" value={topics.length} color="text-text-primary" />
      </div>

      {stockCount < 7 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-4 py-3 text-neon-pink text-sm"
        >
          ⚠ お題ストックが{stockCount}日分です。7日分以上を維持してください。
        </motion.div>
      )}

      <button
        onClick={() => { setShowForm(true); setEditingTopic(null); }}
        className="px-4 py-2 bg-neon-yellow text-bg-deep font-['Orbitron'] text-xs font-bold rounded hover:shadow-[0_0_15px_rgba(255,230,0,0.4)] transition-shadow"
      >
        + NEW TOPIC
      </button>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <TopicForm
              topic={editingTopic}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingTopic(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {topics.map((topic) => (
          <div key={topic.id} className="bg-bg-surface border border-bg-raised rounded-lg p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 border rounded font-['Orbitron'] ${statusColors[topic.status]}`}>
                  {topic.status.toUpperCase()}
                </span>
                <span className="text-neon-pink text-xs">
                  {'★'.repeat(Math.min(Math.max(topic.difficulty, 0), 5))}
                  {'☆'.repeat(5 - Math.min(Math.max(topic.difficulty, 0), 5))}
                </span>
              </div>
              <h3 className="text-text-primary font-medium text-sm truncate">{topic.title}</h3>
              <p className="text-text-muted text-xs mt-1 truncate">{topic.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                <span>⏱ {formatTime(topic.time_limit_seconds)}</span>
                {topic.scheduled_date && <span>📅 {topic.scheduled_date}</span>}
                {topic.tags?.map(tag => (
                  <span key={tag} className="bg-bg-raised px-1.5 py-0.5 rounded text-text-secondary">{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingTopic(topic); setShowForm(true); }}
                className="text-text-muted hover:text-neon-yellow text-xs transition-colors"
              >
                EDIT
              </button>
              <button
                onClick={() => handleDelete(topic.id)}
                className="text-text-muted hover:text-neon-pink text-xs transition-colors"
              >
                DEL
              </button>
            </div>
          </div>
        ))}

        {topics.length === 0 && (
          <p className="text-text-muted text-center py-8 text-sm">お題がまだありません。「+ NEW TOPIC」で作成してください。</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-surface border border-bg-raised rounded-lg p-4 text-center">
      <p className={`font-['Orbitron'] text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-text-muted text-xs mt-1 font-['Orbitron']">{label}</p>
    </div>
  );
}

function TopicForm({
  topic,
  onSave,
  onCancel,
}: {
  topic: DailyTopic | null;
  onSave: (topic: Partial<DailyTopic> & { id?: number }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(topic?.title ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [difficulty, setDifficulty] = useState(topic?.difficulty ?? 3);
  const [timeLimit, setTimeLimit] = useState(topic?.time_limit_seconds ?? 180);
  const [scheduledDate, setScheduledDate] = useState(topic?.scheduled_date ?? '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      id: topic?.id,
      title,
      description,
      difficulty,
      time_limit_seconds: timeLimit,
      scheduled_date: scheduledDate || null,
      tags: topic?.tags ?? [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg-surface border border-bg-raised rounded-lg p-6 space-y-4">
      <h3 className="font-['Orbitron'] text-sm text-neon-yellow">
        {topic ? 'EDIT TOPIC' : 'NEW TOPIC'}
      </h3>

      <div>
        <label className="text-text-muted text-xs block mb-1">タイトル</label>
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="利き手じゃない方で自画像を描け"
          required minLength={5} maxLength={100}
          className="w-full bg-bg-raised border border-bg-raised rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-yellow/50"
        />
      </div>

      <div>
        <label className="text-text-muted text-xs block mb-1">説明</label>
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="お題の詳細ルール" maxLength={500} rows={3}
          className="w-full bg-bg-raised border border-bg-raised rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-yellow/50 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-text-muted text-xs block mb-1">難易度</label>
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}
            className="w-full bg-bg-raised border border-bg-raised rounded px-3 py-2 text-text-primary text-sm focus:outline-none">
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-text-muted text-xs block mb-1">制限時間（秒）</label>
          <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}
            min={10} max={86400}
            className="w-full bg-bg-raised border border-bg-raised rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-yellow/50"
          />
        </div>
        <div>
          <label className="text-text-muted text-xs block mb-1">配信日</label>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full bg-bg-raised border border-bg-raised rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-neon-yellow/50"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit"
          className="px-6 py-2 bg-neon-yellow text-bg-deep font-['Orbitron'] text-xs font-bold rounded hover:shadow-[0_0_15px_rgba(255,230,0,0.4)] transition-shadow">
          SAVE
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2 border border-bg-raised text-text-muted rounded text-xs hover:text-text-primary transition-colors">
          CANCEL
        </button>
      </div>
    </form>
  );
}

function formatTime(seconds: number): string {
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}min`;
  return `${seconds}sec`;
}
