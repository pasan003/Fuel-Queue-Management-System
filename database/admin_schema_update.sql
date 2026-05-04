-- ============================================================================
-- Fuel Queue Management System — ADMIN DASHBOARD SCHEMA UPDATES
-- ============================================================================
-- This file extends the existing schema to support admin features.
-- Run this AFTER importing fqms.sql
-- ============================================================================

USE `fqms`;

-- ---------------------------------------------------------------------------
-- Step 1: Update users table to support admin role and account status
-- ---------------------------------------------------------------------------
ALTER TABLE `users` 
  MODIFY `role` enum('customer','owner','admin') NOT NULL DEFAULT 'customer',
  ADD COLUMN `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = active, 0 = suspended' AFTER `role`,
  ADD COLUMN `suspension_reason` varchar(255) DEFAULT NULL AFTER `is_active`,
  ADD COLUMN `suspended_at` timestamp NULL AFTER `suspension_reason`,
  ADD COLUMN `suspended_by` int DEFAULT NULL AFTER `suspended_at`,
  ADD KEY `idx_role_active` (`role`, `is_active`),
  ADD KEY `idx_suspended_by` (`suspended_by`);

ALTER TABLE `users`
  ADD CONSTRAINT `fk_user_suspended_by` FOREIGN KEY (`suspended_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Step 2: Add approval workflow to fuel_stations table
-- ---------------------------------------------------------------------------
ALTER TABLE `fuel_stations`
  ADD COLUMN `approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER `longitude`,
  ADD COLUMN `rejection_reason` text AFTER `approval_status`,
  ADD COLUMN `approved_by` int DEFAULT NULL AFTER `rejection_reason`,
  ADD COLUMN `approved_at` timestamp NULL AFTER `approved_by`,
  ADD KEY `idx_approval_status` (`approval_status`),
  ADD KEY `idx_approved_by` (`approved_by`);

ALTER TABLE `fuel_stations`
  ADD CONSTRAINT `fk_station_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Step 3: Add status tracking to reports table
-- ---------------------------------------------------------------------------
ALTER TABLE `reports`
  ADD COLUMN `report_status` enum('pending','reviewed','resolved','spam') NOT NULL DEFAULT 'pending' AFTER `image_path`,
  ADD COLUMN `admin_notes` text AFTER `report_status`,
  ADD COLUMN `reviewed_by` int DEFAULT NULL AFTER `admin_notes`,
  ADD COLUMN `reviewed_at` timestamp NULL AFTER `reviewed_by`,
  ADD KEY `idx_report_status` (`report_status`),
  ADD KEY `idx_reviewed_by` (`reviewed_by`);

ALTER TABLE `reports`
  ADD CONSTRAINT `fk_report_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Step 4: Create audit_logs table for tracking admin actions
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;

CREATE TABLE `audit_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `admin_user_id` int DEFAULT NULL,
  `action_type` varchar(50) NOT NULL COMMENT 'e.g., user_suspended, station_approved, report_resolved, user_deleted',
  `entity_type` varchar(50) NOT NULL COMMENT 'user, station, report, etc.',
  `entity_id` int DEFAULT NULL,
  `description` text,
  `old_value` text COMMENT 'JSON or serialized old data',
  `new_value` text COMMENT 'JSON or serialized new data',
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_admin_user` (`admin_user_id`),
  KEY `idx_action_type` (`action_type`),
  KEY `idx_entity` (`entity_type`, `entity_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_audit_admin` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 5: Create admin_alerts table for real-time admin notifications
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `admin_alerts`;

CREATE TABLE `admin_alerts` (
  `alert_id` int NOT NULL AUTO_INCREMENT,
  `alert_type` varchar(50) NOT NULL COMMENT 'suspicious_activity, queue_spike, spam_report, etc.',
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `title` varchar(255) NOT NULL,
  `message` text,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `is_acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `acknowledged_by` int DEFAULT NULL,
  `acknowledged_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`alert_id`),
  KEY `idx_alert_type` (`alert_type`),
  KEY `idx_severity` (`severity`),
  KEY `idx_is_acknowledged` (`is_acknowledged`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_alert_acknowledged_by` FOREIGN KEY (`acknowledged_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Step 6: Create system_settings table for admin configurations
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `system_settings`;

CREATE TABLE `system_settings` (
  `setting_id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `setting_type` enum('string','integer','boolean','json') NOT NULL DEFAULT 'string',
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `uq_setting_key` (`setting_key`),
  KEY `idx_updated_by` (`updated_by`),
  CONSTRAINT `fk_setting_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default system settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`) VALUES
('max_queue_length_warning', '30', 'integer'),
('spam_report_threshold', '3', 'integer'),
('station_approval_required', 'true', 'boolean'),
('admin_email_notifications', 'true', 'boolean'),
('system_status', 'active', 'string');

-- ---------------------------------------------------------------------------
-- Create a default admin account (CHANGE PASSWORD IMMEDIATELY!)
-- ---------------------------------------------------------------------------
-- Admin email: admin@fqms.local | Password: admin123 (hashed with PASSWORD_DEFAULT in PHP)
-- Hash: $2y$10$zr7F6p7L.p7p7p7p7p7p7uYx7p7p7p7p7p7p7p7p7p7p7p7p7
-- NOTE: For production, use: php -r "echo password_hash('YourSecurePassword', PASSWORD_DEFAULT);"
-- Then INSERT below

-- Uncomment and run to create default admin (change password first!):
-- INSERT INTO `users` (`name`, `national_id`, `email`, `password`, `role`, `is_active`, `created_at`) 
-- VALUES ('System Admin', '000000000', 'admin@fqms.local', '$2y$10$zr7F6p7L.p7p7p7p7p7p7uYx7p7p7p7p7p7p7p7p7p7p7p7p7p7p', 'admin', 1, CURRENT_TIMESTAMP);

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify the updates)
-- ============================================================================
-- SELECT * FROM users WHERE role = 'admin';
-- SELECT * FROM fuel_stations WHERE approval_status != 'approved';
-- SELECT * FROM reports WHERE report_status = 'pending';
-- SELECT COUNT(*) as total_logs FROM audit_logs;
-- SELECT COUNT(*) as pending_alerts FROM admin_alerts WHERE is_acknowledged = 0;
