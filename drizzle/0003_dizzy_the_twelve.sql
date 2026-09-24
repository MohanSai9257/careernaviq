CREATE TABLE `change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`company_id` text NOT NULL,
	`company_name` text NOT NULL,
	`kind` text NOT NULL,
	`before_payload` text NOT NULL,
	`after_payload` text NOT NULL,
	`base_version` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);
--> statement-breakpoint
CREATE TABLE `coadmins` (
	`email` text PRIMARY KEY NOT NULL,
	`granted_at` text NOT NULL
);
