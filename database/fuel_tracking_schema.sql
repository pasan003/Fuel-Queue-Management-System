-- Fuel Usage Tracking & Expense Management System
-- SQL migration to add fuel tracking tables to FQMS database
-- Run this AFTER fqms.sql is imported

-- Drop if exists (for dev/testing)
DROP TABLE IF EXISTS `fuel_usage_logs`;
DROP TABLE IF EXISTS `fuel_prices`;

-- -----------------------------------------------------------------------
-- Fuel Prices (admin-managed global prices by fuel type)
-- -----------------------------------------------------------------------
CREATE TABLE `fuel_prices` (
  `price_id` int NOT NULL AUTO_INCREMENT,
  `fuel_type_id` int NOT NULL,
  `current_price` decimal(10,2) NOT NULL COMMENT 'Price per liter in local currency',
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`price_id`),
  UNIQUE KEY `uq_fuel_price_type` (`fuel_type_id`),
  KEY `idx_fuel_price_updated` (`updated_at`),
  CONSTRAINT `fk_fuel_price_type` FOREIGN KEY (`fuel_type_id`) REFERENCES `fuel_types` (`fuel_type_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_fuel_price_admin` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- Fuel Usage Logs (user-tracked fuel purchases and efficiency)
-- -----------------------------------------------------------------------
CREATE TABLE `fuel_usage_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `station_id` int DEFAULT NULL COMMENT 'Optional: which station user refueled at',
  `fuel_type_id` int NOT NULL,
  `liters` decimal(8,2) NOT NULL COMMENT 'Amount of fuel purchased',
  `price_per_liter` decimal(10,2) NOT NULL COMMENT 'Price per liter at time of purchase',
  `total_cost` decimal(10,2) NOT NULL COMMENT 'liters * price_per_liter',
  `odometer_reading` int DEFAULT NULL COMMENT 'Current vehicle odometer/mileage',
  `previous_odometer` int DEFAULT NULL COMMENT 'Previous odometer reading (calculated/set)',
  `distance_traveled` int DEFAULT NULL COMMENT 'current_odometer - previous_odometer',
  `fuel_efficiency` decimal(8,2) DEFAULT NULL COMMENT 'distance_traveled / liters (km/liter or miles/liter)',
  `notes` text COMMENT 'User notes about the fuel purchase',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_user_fuel_logs` (`user_id`, `created_at`),
  KEY `idx_fuel_log_fuel_type` (`fuel_type_id`),
  KEY `idx_fuel_log_station` (`station_id`),
  KEY `idx_fuel_log_date` (`created_at`),
  CONSTRAINT `fk_fuel_log_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fuel_log_station` FOREIGN KEY (`station_id`) REFERENCES `fuel_stations` (`station_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fuel_log_fuel_type` FOREIGN KEY (`fuel_type_id`) REFERENCES `fuel_types` (`fuel_type_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------
-- Sample fuel prices (Petrol and Diesel)
-- Update these values based on your location/currency
-- -----------------------------------------------------------------------
INSERT INTO `fuel_prices` (`fuel_type_id`, `current_price`, `updated_by`, `updated_at`) VALUES
(1, 120.00, NULL, CURRENT_TIMESTAMP),  -- Petrol: 120 per liter (sample)
(2, 115.00, NULL, CURRENT_TIMESTAMP);  -- Diesel: 115 per liter (sample)
