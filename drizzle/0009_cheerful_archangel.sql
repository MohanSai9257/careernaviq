CREATE TABLE `imported_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`company_name` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`apply_url` text NOT NULL,
	`source_id` text NOT NULL,
	`posted_at` text DEFAULT '' NOT NULL,
	`discovered_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`min_years` integer,
	`max_years` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imported_jobs_company_source` ON `imported_jobs` (`company_id`,`source_id`);--> statement-breakpoint
CREATE TABLE `job_source_checks` (
	`company_id` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`status` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`jobs_found` integer DEFAULT 0 NOT NULL
);
