-- Database schema updates for Estimated Waiting Time feature
-- Run this migration to add service_rate and active_pumps to queue_status
-- Safe for MySQL 8.0.13+ (IF NOT EXISTS supported)

USE `fqms`;

-- Add columns to queue_status table if they don't exist (MySQL 8.0.13+)
ALTER TABLE `queue_status` ADD COLUMN IF NOT EXISTS `service_rate` DECIMAL(5,2) NOT NULL DEFAULT 5.00 COMMENT 'Average minutes to serve one vehicle' AFTER `waiting_time`;
ALTER TABLE `queue_status` ADD COLUMN IF NOT EXISTS `active_pumps` INT NOT NULL DEFAULT 1 COMMENT 'Number of active/working fuel pumps' AFTER `service_rate`;

-- Create index for faster lookups (if not exists)
ALTER TABLE `queue_status` ADD INDEX IF NOT EXISTS `idx_service_active` (`service_rate`, `active_pumps`);

-- Set default values for any existing rows that may have NULL values
UPDATE `queue_status` SET `service_rate` = 5.00 WHERE `service_rate` IS NULL OR `service_rate` = 0;
UPDATE `queue_status` SET `active_pumps` = 1 WHERE `active_pumps` IS NULL OR `active_pumps` = 0;
