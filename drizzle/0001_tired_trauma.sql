CREATE TABLE `added_companies` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`normalized_name` text NOT NULL,
	`name` text NOT NULL,
	`linkedin` text DEFAULT '' NOT NULL,
	`careers` text DEFAULT '' NOT NULL,
	`category` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `added_companies_id_unique` ON `added_companies` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `added_companies_normalized_name_unique` ON `added_companies` (`normalized_name`);