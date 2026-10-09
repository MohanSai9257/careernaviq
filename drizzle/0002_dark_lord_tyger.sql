CREATE TABLE `access_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `access_users` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text NOT NULL,
	`updated_at` text NOT NULL
);
