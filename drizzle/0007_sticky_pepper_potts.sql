CREATE TABLE `deleted_users` (
	`email` text PRIMARY KEY NOT NULL,
	`deleted_at` text NOT NULL,
	`deleted_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `section_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`kind` text NOT NULL,
	`before_payload` text NOT NULL,
	`after_payload` text NOT NULL,
	`base_version` integer NOT NULL,
	`pending_file_key` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);
--> statement-breakpoint
ALTER TABLE `section_items` ADD `version` integer DEFAULT 1 NOT NULL;