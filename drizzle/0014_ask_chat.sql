CREATE TABLE IF NOT EXISTS `ask_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `user_name` text DEFAULT '' NOT NULL,
  `body` text NOT NULL,
  `sender` text NOT NULL,
  `admin_email` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL,
  `read_by_admin_at` text,
  `read_by_user_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ask_messages_user_created` ON `ask_messages` (`user_email`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ask_messages_created` ON `ask_messages` (`created_at`);
