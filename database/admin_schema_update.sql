-- Admin dashboard and analytics schema update for existing FQMS databases.
-- Safe to import more than once.

USE `fqms`;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN table_name_in VARCHAR(64),
  IN column_name_in VARCHAR(64),
  IN column_definition_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND COLUMN_NAME = column_name_in
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_in, '` ADD COLUMN `', column_name_in, '` ', column_definition_in);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

ALTER TABLE `users`
  MODIFY `role` enum('customer','owner','admin') NOT NULL DEFAULT 'customer';

CALL add_column_if_missing('users', 'is_active', "tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = active, 0 = suspended'");
CALL add_column_if_missing('users', 'suspension_reason', 'varchar(255) DEFAULT NULL');
CALL add_column_if_missing('users', 'suspended_at', 'timestamp NULL');
CALL add_column_if_missing('users', 'suspended_by', 'int DEFAULT NULL');

CALL add_column_if_missing('fuel_stations', 'approval_status', "enum('pending','approved','rejected') NOT NULL DEFAULT 'pending'");
CALL add_column_if_missing('fuel_stations', 'rejection_reason', 'varchar(255) DEFAULT NULL');
CALL add_column_if_missing('fuel_stations', 'approved_by', 'int DEFAULT NULL');
CALL add_column_if_missing('fuel_stations', 'approved_at', 'timestamp NULL');

CALL add_column_if_missing('reports', 'report_status', "enum('pending','reviewed','resolved','spam') NOT NULL DEFAULT 'pending'");
CALL add_column_if_missing('reports', 'admin_notes', 'text DEFAULT NULL');
CALL add_column_if_missing('reports', 'reviewed_by', 'int DEFAULT NULL');
CALL add_column_if_missing('reports', 'reviewed_at', 'timestamp NULL');

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `admin_user_id` int DEFAULT NULL,
  `action_type` varchar(80) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int DEFAULT NULL,
  `description` text,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_admin_action` (`admin_user_id`, `action_type`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_admin` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_alerts` (
  `alert_id` int NOT NULL AUTO_INCREMENT,
  `alert_type` varchar(80) NOT NULL,
  `severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `is_acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `acknowledged_by` int DEFAULT NULL,
  `acknowledged_at` timestamp NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`alert_id`),
  KEY `idx_alert_status` (`is_acknowledged`, `severity`, `created_at`),
  KEY `idx_alert_ack_by` (`acknowledged_by`),
  CONSTRAINT `fk_alert_ack_by` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `queue_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `station_id` int NOT NULL,
  `queue_length` int NOT NULL DEFAULT '0',
  `waiting_time` int NOT NULL DEFAULT '0',
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `idx_queue_history_station_time` (`station_id`, `created_at`),
  KEY `idx_queue_history_time` (`created_at`),
  CONSTRAINT `fk_queue_history_station` FOREIGN KEY (`station_id`) REFERENCES `fuel_stations` (`station_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_queue_history_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `statistics_cache` (
  `cache_key` varchar(80) NOT NULL,
  `cache_value` json NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cache_key`),
  KEY `idx_statistics_cache_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` varchar(80) NOT NULL,
  `setting_value` text,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`),
  KEY `idx_system_settings_updated_by` (`updated_by`),
  CONSTRAINT `fk_system_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS add_column_if_missing;
