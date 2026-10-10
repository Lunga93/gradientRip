-- Up: crews (Phase C Task 1) — channel profile fields, member roles, crew post audience + helper + RLS
-- Consumes the current_user_id()/is_friend() session idiom from 20240910000002_social.up.sql;
-- mirrors the is_friend() body and the posts_read shape from 20261004000001_posts.up.sql.
-- posts table + kudos trigger untouched.

-- channels profile fields (spec §4 verbatim)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_about_check;
ALTER TABLE channels ADD CONSTRAINT channels_about_check CHECK (char_length(about) <= 500);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS avatar_key TEXT;
-- NULL = no active invite link (minted/rotated/revoked by the invites API, Task 2)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS invite_token TEXT;

-- channel_members.joined_at (new rows default now(); pre-existing memberships have
-- unknown join dates, so backfill with the migration date and document it as such)
ALTER TABLE channel_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();
UPDATE channel_members SET joined_at = now() WHERE joined_at IS NULL;
ALTER TABLE channel_members ALTER COLUMN joined_at SET NOT NULL;
ALTER TABLE channel_members ALTER COLUMN joined_at SET DEFAULT now();

-- channel_members.role: normalize-then-constrain (constraint AFTER update matters)
UPDATE channel_members SET role = 'member' WHERE role NOT IN ('admin', 'member');
ALTER TABLE channel_members DROP CONSTRAINT IF EXISTS channel_members_role_check;
ALTER TABLE channel_members ADD CONSTRAINT channel_members_role_check CHECK (role IN ('admin', 'member'));

-- posts crew audience (spec §4 verbatim: visibility gains 'crew' + crew_id, exactly-one CHECK)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES channels(id) ON DELETE CASCADE;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE posts ADD CONSTRAINT posts_visibility_check CHECK (visibility IN ('public', 'friends', 'crew'));
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_crew_check;
ALTER TABLE posts ADD CONSTRAINT posts_crew_check CHECK (
	(visibility = 'crew' AND crew_id IS NOT NULL)
	OR (visibility IN ('public', 'friends') AND crew_id IS NULL)
);

-- helper mirroring is_friend() (active membership row for the session user)
CREATE OR REPLACE FUNCTION is_crew_member(crew_id UUID) RETURNS BOOLEAN AS $$
BEGIN
	RETURN EXISTS (
		SELECT 1 FROM channel_members
		WHERE channel_id = crew_id AND user_id = current_user_id() AND status = 'active'
	);
END;
$$ LANGUAGE plpgsql STABLE;

-- posts RLS read extended with the crew branch (writes stay author-only)
DROP POLICY IF EXISTS posts_read ON posts;
CREATE POLICY posts_read ON posts FOR SELECT TO PUBLIC USING (
	visibility = 'public' OR author = current_user_id() OR (visibility = 'friends' AND is_friend(author)) OR (visibility = 'crew' AND is_crew_member(crew_id))
);
