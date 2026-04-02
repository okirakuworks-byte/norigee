import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface PostRow {
  id: number;
  content: string;
  result: string;
  is_hidden: boolean;
  posted_at: string;
  user_id: string;
  resonance_count: number;
  comment_count: number;
  profiles: { display_name: string; avatar_url: string | null };
}

type Filter = 'all' | 'visible' | 'hidden';

export default function ModerationPanel() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [actionLog, setActionLog] = useState<string[]>([]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('posts')
      .select('id, content, result, is_hidden, posted_at, user_id, resonance_count, comment_count, profiles!posts_user_id_fkey(display_name, avatar_url)')
      .order('id', { ascending: false })
      .limit(50);

    if (filter === 'visible') query = query.eq('is_hidden', false);
    if (filter === 'hidden') query = query.eq('is_hidden', true);

    const { data } = await query;
    if (data) setPosts(data as unknown as PostRow[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const toggleHidden = async (postId: number, currentlyHidden: boolean) => {
    const newHidden = !currentlyHidden;
    const { error } = await supabase
      .from('posts')
      .update({ is_hidden: newHidden })
      .eq('id', postId);

    if (!error) {
      const action = newHidden ? `Post #${postId} を非表示にしました` : `Post #${postId} を表示に戻しました`;
      setActionLog((prev) => [action, ...prev.slice(0, 19)]);
      fetchPosts();
    }
  };

  const deletePost = async (postId: number) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setActionLog((prev) => [`Post #${postId} を削除しました`, ...prev.slice(0, 19)]);
      fetchPosts();
    }
  };

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'visible', 'hidden'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded text-xs font-['Orbitron'] transition-colors ${
              filter === f
                ? 'bg-neon-yellow text-bg-deep'
                : 'bg-bg-raised text-text-muted hover:text-text-primary'
            }`}
          >
            {f === 'all' ? 'ALL' : f === 'visible' ? 'VISIBLE' : 'HIDDEN'}
          </button>
        ))}
        <span className="ml-auto text-text-muted text-xs self-center">{posts.length} posts</span>
      </div>

      {loading ? (
        <p className="text-text-muted text-sm animate-pulse">LOADING...</p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className={`rounded-xl border px-4 py-3 ${
                post.is_hidden ? 'bg-neon-pink/5 border-neon-pink/30 opacity-60' : 'bg-bg-surface border-bg-raised'
              }`}
            >
              <div className="flex items-start gap-3">
                {post.profiles?.avatar_url ? (
                  <img src={post.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full mt-0.5" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-bg-raised mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text-secondary text-xs">{post.profiles?.display_name ?? '?'}</span>
                    <span className="text-text-muted text-[10px]">#{post.id}</span>
                    <span className={`text-[10px] font-['Orbitron'] ${post.result === 'failure' ? 'text-neon-pink' : 'text-neon-cyan'}`}>
                      {post.result === 'failure' ? 'FAILED' : 'CLEAR'}
                    </span>
                    {post.is_hidden && <span className="text-neon-pink text-[10px] font-bold">HIDDEN</span>}
                  </div>
                  <p className="text-text-primary text-sm line-clamp-3 whitespace-pre-wrap">{post.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                    <span>{new Date(post.posted_at).toLocaleString('ja-JP')}</span>
                    <span>🤝 {post.resonance_count}</span>
                    <span>💬 {post.comment_count}</span>
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleHidden(post.id, post.is_hidden)}
                    className={`px-2 py-1 text-[10px] rounded ${
                      post.is_hidden
                        ? 'bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20'
                        : 'bg-neon-pink/10 text-neon-pink hover:bg-neon-pink/20'
                    } transition-colors`}
                    title={post.is_hidden ? '表示に戻す' : '非表示にする'}
                  >
                    {post.is_hidden ? 'SHOW' : 'HIDE'}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Post #${post.id} を削除しますか？`)) deletePost(post.id); }}
                    className="px-2 py-1 text-[10px] rounded bg-bg-raised text-text-muted hover:text-neon-pink hover:bg-neon-pink/10 transition-colors"
                    title="削除"
                  >
                    DEL
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action log */}
      {actionLog.length > 0 && (
        <div className="mt-6 border-t border-bg-raised pt-4">
          <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest mb-2">ACTION LOG</p>
          <div className="space-y-1">
            {actionLog.map((log, i) => (
              <p key={i} className="text-text-muted text-[10px] font-['Share_Tech_Mono']">
                {log}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
