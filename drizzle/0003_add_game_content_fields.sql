ALTER TABLE `games` ADD COLUMN `rules` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `games` ADD COLUMN `tips` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `games` ADD COLUMN `features` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `games` ADD COLUMN `faqs` text DEFAULT '[]' NOT NULL;
