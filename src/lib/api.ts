import { supabase } from './supabase';
import type { FeedPost, DailyTopic, ResonanceType, Participation } from './types';

// ===== Image Upload =====

export async function uploadImage(file: File): Promise<{ url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated' };

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('post-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) return { error: error.message };

  const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(path);
  return { url: urlData.publicUrl };
}

// ===== Comments =====

export interface Comment {
  id: number;
  content: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null };
}

export async function fetchComments(postId: number): Promise<Comment[]> {
  const { data } = await supabase
    .from('comments')
    .select('id, content, created_at, profiles!comments_user_id_fkey(display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(50);

  return (data ?? []) as unknown as Comment[];
}

export type { FeedPost, DailyTopic };

export async function fetchFeed(cursor?: number, limit = 20): Promise<{ posts: FeedPost[]; nextCursor: number | null }> {
  let query = supabase
    .from('posts')
    .select(`
      id, content, result, day_number, posted_at,
      resonance_count, comment_count, image_keys, is_hidden,
      profiles!posts_user_id_fkey (username, display_name, avatar_url),
      participations!posts_participation_id_fkey (
        challenge_type,
        daily_topics (title),
        my_challenges (title)
      )
    `)
    .eq('is_hidden', false)
    .order('id', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('id', cursor);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { posts: [], nextCursor: null };
  }

  const posts: FeedPost[] = (data as Record<string, unknown>[]).map((row) => {
    const participation = row.participations as Record<string, unknown> | null;
    const dailyTopics = participation?.daily_topics as Record<string, unknown> | null;
    const myChallenges = participation?.my_challenges as Record<string, unknown> | null;
    const profiles = row.profiles as Record<string, unknown>;

    return {
      id: row.id as number,
      content: row.content as string,
      result: row.result as 'success' | 'failure',
      day_number: row.day_number as number,
      posted_at: row.posted_at as string,
      resonance_count: row.resonance_count as number,
      comment_count: row.comment_count as number,
      image_keys: (row.image_keys as string[]) ?? [],
      profiles: {
        username: profiles.username as string,
        display_name: profiles.display_name as string,
        avatar_url: profiles.avatar_url as string | null,
      },
      challenge_type: participation?.challenge_type as 'daily' | 'my' | undefined,
      challenge_title:
        participation?.challenge_type === 'daily'
          ? (dailyTopics?.title as string)
          : (myChallenges?.title as string),
    };
  });

  const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;
  return { posts, nextCursor };
}

export async function fetchDailyTopic(): Promise<DailyTopic | null> {
  const { data, error } = await supabase
    .from('daily_topics')
    .select('id, title, description, difficulty, time_limit_seconds, status')
    .eq('status', 'active')
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data as DailyTopic | null;
}

export async function toggleResonance(postId: number, type: ResonanceType) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated' };

  const { data: existing } = await supabase
    .from('resonances')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('resonances').delete().eq('id', existing.id);
    if (error) return { error: error.message };
    return { action: 'removed' as const };
  }

  const { error } = await supabase
    .from('resonances')
    .insert({ post_id: postId, user_id: user.id, type });

  if (error) return { error: error.message };
  return { action: 'added' as const };
}

export async function fetchResonancesForPost(postId: number) {
  const { data } = await supabase
    .from('resonances')
    .select('type, user_id')
    .eq('post_id', postId);

  const counts = { wakaru: 0, donmai: 0, oremoda: 0 };
  const userTypes = new Set<string>();

  if (data) {
    for (const r of data) {
      counts[r.type as ResonanceType]++;
      userTypes.add(`${r.user_id}:${r.type}`);
    }
  }

  return { counts, userTypes };
}

export async function addComment(postId: number, content: string) {
  if (!content.trim()) return { error: 'comment cannot be empty' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated' };

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: user.id, content: content.trim() })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function createPost(
  participationId: number,
  content: string,
  result: 'success' | 'failure',
  imageKeys: string[] = []
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated' };

  // Increment day_count
  const { data: participation, error: partErr } = await supabase
    .from('participations')
    .select('day_count')
    .eq('id', participationId)
    .eq('user_id', user.id)
    .single();

  if (partErr || !participation) return { error: 'participation not found' };

  const newDayCount = participation.day_count + 1;

  // Update participation
  const { error: updateErr } = await supabase
    .from('participations')
    .update({ day_count: newDayCount, last_posted_at: new Date().toISOString() })
    .eq('id', participationId);

  if (updateErr) return { error: updateErr.message };

  // Create post
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      participation_id: participationId,
      day_number: newDayCount,
      content: content.trim(),
      image_keys: imageKeys,
      result,
    })
    .select('id, day_number, result')
    .single();

  if (error) return { error: error.message };
  return { data };
}

/** Free post without a specific challenge/participation */
export async function createFreePost(
  content: string,
  result: 'success' | 'failure',
  imageKeys: string[] = []
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated' };

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      content: content.trim(),
      image_keys: imageKeys,
      result,
      day_number: 1,
    })
    .select('id, day_number, result')
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function joinChallenge(
  challengeType: 'daily' | 'my',
  dailyTopicId?: number,
  myChallengeId?: number
): Promise<{ data?: Participation; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated' };

  // Check if already joined
  let existingQuery = supabase
    .from('participations')
    .select('*')
    .eq('user_id', user.id)
    .eq('challenge_type', challengeType);

  if (challengeType === 'daily' && dailyTopicId) {
    existingQuery = existingQuery.eq('daily_topic_id', dailyTopicId);
  } else if (challengeType === 'my' && myChallengeId) {
    existingQuery = existingQuery.eq('my_challenge_id', myChallengeId);
  }

  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) return { data: existing as Participation };

  // Create new participation
  const insertData: Record<string, unknown> = {
    user_id: user.id,
    challenge_type: challengeType,
  };
  if (challengeType === 'daily') insertData.daily_topic_id = dailyTopicId;
  if (challengeType === 'my') insertData.my_challenge_id = myChallengeId;

  const { data, error } = await supabase
    .from('participations')
    .insert(insertData)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as Participation };
}

// ===== Game Score =====

export interface GameScoreResult {
  score: number;
  rank?: number;
  isHighScore?: boolean;
}

/** Post game score to leaderboard + feed */
export async function postGameScore(
  gameId: string,
  gameName: string,
  score: number,
  level: number,
  deathReason?: string,
  scream?: string
): Promise<{ data?: GameScoreResult; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'not authenticated' };

  // Save to game_scores
  const { error: scoreErr } = await supabase.from('game_scores').insert({
    user_id: user.id,
    game_id: gameId,
    score,
    level,
    death_reason: deathReason ?? null,
  });
  if (scoreErr) return { error: scoreErr.message };

  // Check if high score
  const { data: best } = await supabase
    .from('game_scores')
    .select('score')
    .eq('user_id', user.id)
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isHighScore = best?.score === score;

  // Post to feed with scream
  const emoji = deathReason ? '💀' : '🏆';
  const screamLine = scream ? `\n\n「${scream}」` : '';
  const feedContent = `${emoji} ${gameName} — Score: ${score} | Lv.${level}${deathReason ? `\n${deathReason}` : '\nCLEAR!'}${screamLine}`;

  await supabase.from('posts').insert({
    user_id: user.id,
    content: feedContent,
    result: deathReason ? 'failure' : 'success',
    day_number: 1,
    image_keys: [],
  });

  // Get rank
  const { count } = await supabase
    .from('game_scores')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .gt('score', score);

  return {
    data: {
      score,
      rank: (count ?? 0) + 1,
      isHighScore,
    },
  };
}

/** Fetch leaderboard for a game */
export async function fetchLeaderboard(gameId: string, limit = 10) {
  const { data, error } = await supabase
    .from('game_scores')
    .select('score, level, death_reason, created_at, user_id, profiles!game_scores_user_id_fkey(display_name, avatar_url)')
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(limit);

  if (error) return { scores: [] };
  return { scores: data ?? [] };
}

/** Fetch user's best score for a game */
export async function fetchMyBestScore(gameId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('game_scores')
    .select('score, level')
    .eq('user_id', user.id)
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
