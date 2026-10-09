CREATE TABLE `auto_resumes` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `name` text NOT NULL,
  `file_key` text NOT NULL,
  `file_name` text NOT NULL,
  `file_type` text NOT NULL,
  `file_size` integer NOT NULL,
  `extracted_text` text DEFAULT '' NOT NULL,
  `extraction_status` text DEFAULT 'pending_worker' NOT NULL,
  `is_default` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auto_connected_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `provider` text NOT NULL,
  `status` text NOT NULL,
  `auth_type` text DEFAULT 'interactive_browser' NOT NULL,
  `last_verified_at` text,
  `metadata` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_connected_accounts_user_provider` ON `auto_connected_accounts` (`user_email`,`provider`);
--> statement-breakpoint
CREATE TABLE `auto_agent_settings` (
  `user_email` text PRIMARY KEY NOT NULL,
  `daily_limit` integer DEFAULT 10 NOT NULL,
  `minimum_score` integer DEFAULT 70 NOT NULL,
  `require_review` integer DEFAULT 1 NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auto_applications` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `imported_job_id` text,
  `company_name` text NOT NULL,
  `job_title` text NOT NULL,
  `job_url` text NOT NULL,
  `resume_id` text,
  `match_score` integer,
  `match_reasons` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'MATCHED' NOT NULL,
  `blocker_status` text DEFAULT '' NOT NULL,
  `worker_task_id` text DEFAULT '' NOT NULL,
  `last_activity_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_applications_user_job` ON `auto_applications` (`user_email`,`job_url`);
--> statement-breakpoint
CREATE TABLE `auto_blockers` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `application_id` text NOT NULL,
  `company_name` text NOT NULL,
  `job_title` text NOT NULL,
  `question` text DEFAULT '' NOT NULL,
  `reason` text NOT NULL,
  `status` text DEFAULT 'OPEN' NOT NULL,
  `answer` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auto_saved_answers` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `normalized_question` text NOT NULL,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `answer_type` text DEFAULT 'general' NOT NULL,
  `source` text DEFAULT 'user' NOT NULL,
  `approved_at` text NOT NULL,
  `expires_at` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_saved_answers_user_question` ON `auto_saved_answers` (`user_email`,`normalized_question`);
--> statement-breakpoint
CREATE TABLE `auto_activity_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `application_id` text,
  `event_type` text NOT NULL,
  `message` text NOT NULL,
  `metadata` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL
);

--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `location` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `education` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `experience` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `skills` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `certifications` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `work_authorization` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `sponsorship_needs` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `salary_expectations` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `job_preferences` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `relocation_preferences` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `approved_screening_answers` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `mobile_country_code` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `legal_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `address` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `city` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `zip` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `linkedin_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `portfolio_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `github_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `start_date` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `employment_type_preferences` text DEFAULT '' NOT NULL;
