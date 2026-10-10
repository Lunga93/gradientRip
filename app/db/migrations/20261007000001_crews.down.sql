-- Down: crews (Phase C Task 1) — exact reverse of 20261007000001_crews.up.sql
-- Order: policy → helper → posts columns → member columns → channel columns (reverse dependency).

-- Restore original posts read policy (drop the crew branch)
DROP POLICY IF EXISTS posts_read ON posts;
CREATE POLICY posts_read ON posts FOR SELECT TO PUBLIC USING (
	visibility = 'public' OR author = current_user_id() OR (visibility = 'friends' AND is_friend(author))
);

-- Drop helper
DROP FUNCTION IF EXISTS is_crew_member(UUID);

-- posts crew audience (drop exactly-one CHECK, restore visibility, drop crew_id + FK)
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_crew_check;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE posts ADD CONSTRAINT posts_visibility_check CHECK (visibility IN ('public', 'friends'));
ALTER TABLE posts DROP COLUMN IF EXISTS crew_id;

-- channel_members (drop role CHECK, drop joined_at; role normalization is not un-done)
ALTER TABLE channel_members DROP CONSTRAINT IF EXISTS channel_members_role_check;
ALTER TABLE channel_members DROP COLUMN IF EXISTS joined_at;

-- channels profile fields
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_about_check;
ALTER TABLE channels DROP COLUMN IF EXISTS about;
ALTER TABLE channels DROP COLUMN IF EXISTS avatar_key;
ALTER TABLE channels DROP COLUMN IF EXISTS invite_token;
