CREATE TABLE `section_items` (
	`id` text PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`posted_at` text DEFAULT '' NOT NULL,
	`actor_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);
