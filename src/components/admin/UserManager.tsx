import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowser } from '../../lib/supabase';

const supabase = createSupabaseBrowser();

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  flee_count: number;
  judge_rating: number;
  isAdmin: boolean;
}

export default function UserManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    setLoading(true);

    const { data: admins } = await supabase.from('admin_users').select('user_id');
    const adminSet = new Set((admins ?? []).map((a) => a.user_id));
    setAdminIds(adminSet);

    let query = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, created_at, flee_count, judge_rating')
      .order('created_at', { ascending: false })
      .limit(100);

    if (search.trim()) {
      query = query.or(`display_name.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data } = await query;
    if (data) {
      setUsers(data.map((u) => ({ ...u, isAdmin: adminSet.has(u.id) })));
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin) {
      await supabase.from('admin_users').delete().eq('user_id', userId);
    } else {
      await supabase.from('admin_users').insert({ user_id: userId, reason: 'granted by admin' });
    }
    fetchUsers();
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ユーザー名で検索..."
          className="w-full px-4 py-2 bg-bg-deep border border-bg-raised rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:border-neon-yellow focus:outline-none"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="text-text-muted">Total: <span className="text-neon-cyan">{users.length}</span></span>
        <span className="text-text-muted">Admins: <span className="text-neon-yellow">{adminIds.size}</span></span>
      </div>

      {loading ? (
        <p className="text-text-muted text-sm animate-pulse">LOADING...</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                user.isAdmin ? 'bg-neon-yellow/5 border-neon-yellow/30' : 'bg-bg-surface border-bg-raised'
              }`}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-bg-raised flex items-center justify-center text-xs text-text-muted">?</div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-sm font-medium truncate">{user.display_name}</span>
                  {user.isAdmin && <span className="text-neon-yellow text-[10px] font-['Orbitron']">ADMIN</span>}
                </div>
                <span className="text-text-muted text-xs">@{user.username}</span>
              </div>

              <div className="text-right text-[10px] text-text-muted space-y-0.5">
                <p>{new Date(user.created_at).toLocaleDateString('ja-JP')}</p>
                {user.flee_count > 0 && <p className="text-neon-pink">逃亡: {user.flee_count}</p>}
              </div>

              <button
                onClick={() => toggleAdmin(user.id, user.isAdmin)}
                className={`px-3 py-1 text-[10px] font-['Orbitron'] rounded ${
                  user.isAdmin
                    ? 'bg-bg-raised text-neon-pink hover:bg-neon-pink/10'
                    : 'bg-bg-raised text-text-muted hover:bg-neon-yellow/10 hover:text-neon-yellow'
                } transition-colors`}
              >
                {user.isAdmin ? 'REVOKE' : 'GRANT'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
