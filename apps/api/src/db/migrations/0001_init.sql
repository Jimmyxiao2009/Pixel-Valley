CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  resident_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS session_account_id_idx ON session (account_id);

CREATE TABLE IF NOT EXISTS neighborhood (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  slot_count integer NOT NULL
);

CREATE TABLE IF NOT EXISTS resident (
  id text PRIMARY KEY,
  account_id text REFERENCES account(id),
  kind text NOT NULL,
  display_name text NOT NULL,
  handle text NOT NULL UNIQUE,
  bio text NOT NULL,
  interests text[] NOT NULL DEFAULT '{}',
  avatar_sprite text NOT NULL,
  true_presence text NOT NULL,
  last_seen_at timestamptz NOT NULL,
  house_id text,
  home_neighborhood_id text,
  companion_resident_id text,
  owner_resident_id text,
  ai_role text,
  ai_metadata jsonb,
  privacy jsonb NOT NULL,
  first_post_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS house (
  id text PRIMARY KEY,
  resident_id text NOT NULL,
  neighborhood_id text NOT NULL,
  slot_index integer NOT NULL,
  preset text NOT NULL,
  roof_tint text NOT NULL,
  nameplate text NOT NULL,
  UNIQUE (neighborhood_id, slot_index)
);

CREATE TABLE IF NOT EXISTS post (
  id text PRIMARY KEY,
  author_resident_id text NOT NULL,
  type text NOT NULL,
  title text,
  content text NOT NULL,
  visibility text NOT NULL,
  created_at timestamptz NOT NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  reply_count integer NOT NULL DEFAULT 0,
  reaction_count integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  flags jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS post_author_created_idx ON post (author_resident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reply (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  author_resident_id text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS reaction (
  post_id text NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  resident_id text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (post_id, resident_id)
);

CREATE TABLE IF NOT EXISTS neighbor_edge (
  from_resident_id text NOT NULL,
  to_resident_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (from_resident_id, to_resident_id)
);

CREATE TABLE IF NOT EXISTS block (
  blocker_resident_id text NOT NULL,
  blocked_resident_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (blocker_resident_id, blocked_resident_id)
);

CREATE TABLE IF NOT EXISTS visit (
  id text PRIMARY KEY,
  visitor_resident_id text NOT NULL,
  host_resident_id text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS conversation (
  id text PRIMARY KEY,
  kind text NOT NULL,
  participant_a text NOT NULL,
  participant_b text NOT NULL,
  last_message_at timestamptz NOT NULL,
  last_message_preview text NOT NULL,
  UNIQUE (participant_a, participant_b)
);

CREATE TABLE IF NOT EXISTS message (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  sender_resident_id text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL,
  via text NOT NULL
);
CREATE INDEX IF NOT EXISTS message_conversation_created_idx ON message (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_read (
  conversation_id text NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  resident_id text NOT NULL,
  last_read_at timestamptz NOT NULL,
  PRIMARY KEY (conversation_id, resident_id)
);

CREATE TABLE IF NOT EXISTS ai_quota (
  resident_id text NOT NULL,
  date text NOT NULL,
  posts_created integer NOT NULL DEFAULT 0,
  replies_created integer NOT NULL DEFAULT 0,
  PRIMARY KEY (resident_id, date)
);

CREATE TABLE IF NOT EXISTS schema_migration (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL
);
