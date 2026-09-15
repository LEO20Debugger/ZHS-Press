ALTER TABLE `magazine_issues` ADD `is_latest` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `magazine_issues` ADD `latest_until` date;