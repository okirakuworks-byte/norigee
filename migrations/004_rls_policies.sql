-- ============================================
-- NORIGEE RLS (Row Level Security) Policies
-- セキュリティ企業として全テーブルにRLSを適用
-- ============================================

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.user_id = $1
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- profiles
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (public display names)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (signup)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- posts
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-hidden posts; admins can read all
CREATE POLICY "posts_select" ON posts
  FOR SELECT USING (
    is_hidden = FALSE OR is_admin(auth.uid())
  );

-- Users can insert their own posts
CREATE POLICY "posts_insert_own" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts (edit content)
CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE USING (
    auth.uid() = user_id OR is_admin(auth.uid())
  );

-- Only admins can delete posts
CREATE POLICY "posts_delete_admin" ON posts
  FOR DELETE USING (is_admin(auth.uid()));

-- ============================================
-- admin_users
-- ============================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can read admin list
CREATE POLICY "admin_users_select" ON admin_users
  FOR SELECT USING (is_admin(auth.uid()));

-- Only admins can grant admin
CREATE POLICY "admin_users_insert" ON admin_users
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Only admins can revoke admin
CREATE POLICY "admin_users_delete" ON admin_users
  FOR DELETE USING (is_admin(auth.uid()));

-- ============================================
-- daily_topics
-- ============================================
ALTER TABLE daily_topics ENABLE ROW LEVEL SECURITY;

-- Anyone can read topics
CREATE POLICY "daily_topics_select" ON daily_topics
  FOR SELECT USING (true);

-- Only admins can create/update/delete topics
CREATE POLICY "daily_topics_insert" ON daily_topics
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "daily_topics_update" ON daily_topics
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "daily_topics_delete" ON daily_topics
  FOR DELETE USING (is_admin(auth.uid()));

-- ============================================
-- resonances
-- ============================================
ALTER TABLE resonances ENABLE ROW LEVEL SECURITY;

-- Anyone can read resonances
CREATE POLICY "resonances_select" ON resonances
  FOR SELECT USING (true);

-- Users can insert their own resonances
CREATE POLICY "resonances_insert_own" ON resonances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own resonances (un-react)
CREATE POLICY "resonances_delete_own" ON resonances
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- comments
-- ============================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (true);

-- Users can insert their own comments
CREATE POLICY "comments_insert_own" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments; admins can delete any
CREATE POLICY "comments_delete" ON comments
  FOR DELETE USING (
    auth.uid() = user_id OR is_admin(auth.uid())
  );

-- ============================================
-- participations
-- ============================================
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;

-- Anyone can read participations (for stats)
CREATE POLICY "participations_select" ON participations
  FOR SELECT USING (true);

-- Users can insert their own participations
CREATE POLICY "participations_insert_own" ON participations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own participations
CREATE POLICY "participations_update_own" ON participations
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- wallets
-- ============================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Users can only read their own wallet
CREATE POLICY "wallets_select_own" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own wallet
CREATE POLICY "wallets_update_own" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- System inserts wallet on signup (service role only)
CREATE POLICY "wallets_insert" ON wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- notifications
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = recipient_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

-- System inserts notifications
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- ============================================
-- game_scores
-- ============================================
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- Anyone can read scores (leaderboard)
CREATE POLICY "game_scores_select" ON game_scores
  FOR SELECT USING (true);

-- Users can insert their own scores
CREATE POLICY "game_scores_insert_own" ON game_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- daily_action_counters
-- ============================================
ALTER TABLE daily_action_counters ENABLE ROW LEVEL SECURITY;

-- Users can only access their own counters
CREATE POLICY "daily_action_counters_select_own" ON daily_action_counters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_action_counters_insert_own" ON daily_action_counters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_action_counters_update_own" ON daily_action_counters
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- coin_transactions
-- ============================================
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own transactions
CREATE POLICY "coin_transactions_select_own" ON coin_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own transactions
CREATE POLICY "coin_transactions_insert_own" ON coin_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
