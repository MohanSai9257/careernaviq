CREATE TABLE IF NOT EXISTS ask_attachments (
 id text PRIMARY KEY,
 message_id text NOT NULL,
 user_email text NOT NULL,
 file_key text NOT NULL,
 file_name text NOT NULL,
 file_size integer NOT NULL
);
CREATE INDEX IF NOT EXISTS ask_attachments_message ON ask_attachments(message_id);
CREATE TABLE IF NOT EXISTS credential_vault (
 user_email text NOT NULL,
 provider text NOT NULL,
 encrypted_value text NOT NULL,
 updated_at text NOT NULL,
 PRIMARY KEY(user_email, provider)
);
