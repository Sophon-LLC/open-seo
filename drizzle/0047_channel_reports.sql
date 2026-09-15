CREATE TABLE `channel_reports` (
	`project_id` text NOT NULL,
	`channel` text NOT NULL,
	`item_key` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`count` integer,
	`source` text NOT NULL,
	`observed_at` text NOT NULL,
	`source_updated_at` text,
	`imported_at` text NOT NULL,
	`period_start` text,
	`period_end` text,
	`scope` text,
	`configuration` text,
	PRIMARY KEY(`project_id`, `channel`, `item_key`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
