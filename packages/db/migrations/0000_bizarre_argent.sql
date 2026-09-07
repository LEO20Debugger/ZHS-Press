CREATE TABLE `book_details` (
	`product_id` int NOT NULL,
	`author_name` varchar(255) NOT NULL,
	`illustrator_name` varchar(255),
	`isbn` varchar(20),
	`page_count` int unsigned,
	`format` varchar(60),
	`age_range` varchar(40),
	CONSTRAINT `book_details_product_id` PRIMARY KEY(`product_id`)
);
--> statement-breakpoint
CREATE TABLE `contributors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(255) NOT NULL,
	`bio` text,
	`photo_url` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contributors_id` PRIMARY KEY(`id`),
	CONSTRAINT `contributors_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`product_id` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`track_inventory` boolean NOT NULL DEFAULT true,
	`allow_backorder` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_product_id` PRIMARY KEY(`product_id`)
);
--> statement-breakpoint
CREATE TABLE `magazine_issues` (
	`product_id` int NOT NULL,
	`issue_number` int unsigned NOT NULL,
	`theme` varchar(255),
	`editor_note` text,
	`published_date` date,
	CONSTRAINT `magazine_issues_product_id` PRIMARY KEY(`product_id`),
	CONSTRAINT `magazine_issues_number_idx` UNIQUE(`issue_number`)
);
--> statement-breakpoint
CREATE TABLE `product_contributors` (
	`product_id` int NOT NULL,
	`contributor_id` int NOT NULL,
	`role` enum('author','illustrator','editor','contributor') NOT NULL DEFAULT 'contributor',
	`piece_title` varchar(255),
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_contributors_product_id_contributor_id_role_pk` PRIMARY KEY(`product_id`,`contributor_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`url` varchar(512) NOT NULL,
	`alt` varchar(320) NOT NULL,
	`width` int unsigned,
	`height` int unsigned,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`type` enum('book','magazine','stationery') NOT NULL,
	`status` enum('draft','coming_soon','available','sold_out','archived') NOT NULL DEFAULT 'draft',
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(255),
	`blurb` text,
	`description` text,
	`price_cents` int unsigned NOT NULL,
	`compare_at_cents` int unsigned,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`release_date` date,
	`amazon_url` varchar(512),
	`accent_hex` varchar(7),
	`accent_tint_hex` varchar(7),
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`seo_title` varchar(255),
	`seo_description` varchar(320),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `stationery_details` (
	`product_id` int NOT NULL,
	`dimensions` varchar(120),
	`material` varchar(160),
	`page_count` int unsigned,
	`cover_artist` varchar(255),
	CONSTRAINT `stationery_details_product_id` PRIMARY KEY(`product_id`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cart_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int unsigned NOT NULL DEFAULT 1,
	`unit_price_cents` int unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_items_cart_product_idx` UNIQUE(`cart_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_token` varchar(64) NOT NULL,
	`email` varchar(320),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `carts_session_token_idx` UNIQUE(`session_token`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int,
	`title_snapshot` varchar(255) NOT NULL,
	`slug_snapshot` varchar(160) NOT NULL,
	`unit_price_cents` int unsigned NOT NULL,
	`quantity` int unsigned NOT NULL,
	`line_total_cents` int unsigned NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_number` varchar(24) NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('pending','paid','failed','fulfilled','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`subtotal_cents` int unsigned NOT NULL,
	`shipping_cents` int unsigned NOT NULL DEFAULT 0,
	`tax_cents` int unsigned NOT NULL DEFAULT 0,
	`total_cents` int unsigned NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`shipping_address` json,
	`billing_address` json,
	`customer_note` text,
	`internal_note` text,
	`paid_at` timestamp,
	`fulfilled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_idx` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`provider` varchar(40) NOT NULL DEFAULT 'flutterwave',
	`tx_ref` varchar(64) NOT NULL,
	`provider_tx_id` varchar(64),
	`amount_cents` int unsigned NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('initiated','successful','failed','cancelled') NOT NULL DEFAULT 'initiated',
	`raw_payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_tx_ref_idx` UNIQUE(`tx_ref`)
);
--> statement-breakpoint
CREATE TABLE `shipping_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zone_name` varchar(120) NOT NULL,
	`country_codes` json NOT NULL,
	`rate_cents` int unsigned NOT NULL,
	`free_over_cents` int unsigned,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipping_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`url` varchar(512) NOT NULL,
	`alt` varchar(320),
	`mime_type` varchar(100) NOT NULL,
	`width` int unsigned,
	`height` int unsigned,
	`size_bytes` int unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_storage_key_idx` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('pending','confirmed','unsubscribed') NOT NULL DEFAULT 'pending',
	`confirm_token` varchar(64),
	`unsubscribe_token` varchar(64) NOT NULL,
	`source` varchar(40),
	`confirmed_at` timestamp,
	`unsubscribed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_email_idx` UNIQUE(`email`),
	CONSTRAINT `newsletter_unsub_token_idx` UNIQUE(`unsubscribe_token`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body_mdx` text NOT NULL,
	`seo_title` varchar(255),
	`seo_description` varchar(320),
	`published_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_path` varchar(512) NOT NULL,
	`to_path` varchar(512) NOT NULL,
	`status_code` int NOT NULL DEFAULT 301,
	`note` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `redirects_from_path_idx` UNIQUE(`from_path`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`genre` enum('fiction','non_fiction','children','poetry','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`synopsis` text NOT NULL,
	`manuscript_file_key` varchar(512),
	`manuscript_file_name` varchar(255),
	`status` enum('new','reviewing','accepted','declined') NOT NULL DEFAULT 'new',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waitlist_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`notified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `waitlist_product_email_idx` UNIQUE(`product_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`user_agent` varchar(320),
	`ip_address` varchar(45),
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_sessions_token_hash_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('admin','editor') NOT NULL DEFAULT 'editor',
	`last_login_at` timestamp,
	`disabled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_users_email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_id` int,
	`action` varchar(80) NOT NULL,
	`entity_type` varchar(60) NOT NULL,
	`entity_id` varchar(64) NOT NULL,
	`changes` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `book_details` ADD CONSTRAINT `book_details_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `magazine_issues` ADD CONSTRAINT `magazine_issues_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_contributors` ADD CONSTRAINT `product_contributors_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_contributors` ADD CONSTRAINT `product_contributors_contributor_id_contributors_id_fk` FOREIGN KEY (`contributor_id`) REFERENCES `contributors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stationery_details` ADD CONSTRAINT `stationery_details_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_carts_id_fk` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `waitlist_entries_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_user_id_admin_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_id_admin_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`,`position`);--> statement-breakpoint
CREATE INDEX `products_type_status_idx` ON `products` (`type`,`status`);--> statement-breakpoint
CREATE INDEX `products_featured_idx` ON `products` (`featured`);--> statement-breakpoint
CREATE INDEX `carts_expires_at_idx` ON `carts` (`expires_at`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `shipping_rates_default_idx` ON `shipping_rates` (`is_default`);--> statement-breakpoint
CREATE INDEX `newsletter_status_idx` ON `newsletter_subscribers` (`status`);--> statement-breakpoint
CREATE INDEX `submissions_status_created_idx` ON `submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `waitlist_notified_idx` ON `waitlist_entries` (`product_id`,`notified_at`);--> statement-breakpoint
CREATE INDEX `admin_sessions_user_idx` ON `admin_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);