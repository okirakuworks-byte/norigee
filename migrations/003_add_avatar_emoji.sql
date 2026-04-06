-- Add avatar_emoji column to profiles table
-- This allows users to select an emoji as their avatar instead of uploading an image
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT '👾';

-- Update existing profiles that have no avatar_emoji
UPDATE profiles SET avatar_emoji = '👾' WHERE avatar_emoji IS NULL;
