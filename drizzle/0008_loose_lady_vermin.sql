CREATE TABLE `tab_access` (
	`tab` text PRIMARY KEY NOT NULL,
	`allowed` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
