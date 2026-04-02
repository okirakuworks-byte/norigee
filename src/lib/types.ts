// NORIGEE shared type definitions

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface DailyTopic {
  id: number;
  title: string;
  description: string;
  difficulty: number;
  time_limit_seconds: number;
  status: 'draft' | 'scheduled' | 'active' | 'archived';
  scheduled_date: string | null;
  tags: string[];
}

export interface MyChallenge {
  id: number;
  owner_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  tags: string[];
  created_at: string;
}

export interface Participation {
  id: number;
  user_id: string;
  challenge_type: 'daily' | 'my';
  daily_topic_id: number | null;
  my_challenge_id: number | null;
  day_count: number;
  status: 'active' | 'completed' | 'quit';
  joined_at: string;
  last_posted_at: string | null;
}

export interface FeedPost {
  id: number;
  content: string;
  result: 'success' | 'failure';
  day_number: number;
  posted_at: string;
  resonance_count: number;
  comment_count: number;
  image_keys: string[];
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  challenge_title?: string;
  challenge_type?: 'daily' | 'my';
}

export type ResonanceType = 'wakaru' | 'donmai' | 'oremoda';

export interface Resonance {
  id: number;
  post_id: number;
  user_id: string;
  type: ResonanceType;
  created_at: string;
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}
