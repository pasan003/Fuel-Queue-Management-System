-- Fuel Queue Management System — MySQL schema (aligned with PHP app, Apr 2026)
-- Import into phpMyAdmin or: mysql -u root -p < database/fqms.sql
-- Database: create manually as `fqms` or uncomment below:

CREATE DATABASE IF NOT EXISTS `fqms` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fqms`;

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- ---------------------------------------------------------------------------
-- Users: customers and station owners (roles drive dashboard routing)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `reports`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `queue_status`;
DROP TABLE IF EXISTS `fuel_availability`;
DROP TABLE IF EXISTS `fuel_stations`;
DROP TABLE IF EXISTS `fuel_types`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `national_id` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('customer','owner') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_national_id` (`national_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Fuel types (Petrol = 1, Diesel = 2) — fixed seed IDs used by the app
-- ---------------------------------------------------------------------------
CREATE TABLE `fuel_types` (
  `fuel_type_id` int NOT NULL AUTO_INCREMENT,
  `fuel_name` varchar(50) NOT NULL,
  PRIMARY KEY (`fuel_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `fuel_types` (`fuel_type_id`, `fuel_name`) VALUES
(1, 'Petrol'),
(2, 'Diesel');

-- ---------------------------------------------------------------------------
-- Stations (owners get one station row linked via owner_user_id)
-- ---------------------------------------------------------------------------
CREATE TABLE `fuel_stations` (
  `station_id` int NOT NULL AUTO_INCREMENT,
  `owner_user_id` int DEFAULT NULL,
  `station_name` varchar(150) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`station_id`),
  KEY `idx_owner` (`owner_user_id`),
  CONSTRAINT `fk_station_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One availability row per (station, fuel type)
CREATE TABLE `fuel_availability` (
  `availability_id` int NOT NULL AUTO_INCREMENT,
  `station_id` int NOT NULL,
  `fuel_type_id` int NOT NULL,
  `is_available` tinyint(1) NOT NULL DEFAULT '0',
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`availability_id`),
  UNIQUE KEY `uq_station_fuel` (`station_id`,`fuel_type_id`),
  KEY `fuel_type_id` (`fuel_type_id`),
  CONSTRAINT `fk_avail_station` FOREIGN KEY (`station_id`) REFERENCES `fuel_stations` (`station_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_avail_fuel_type` FOREIGN KEY (`fuel_type_id`) REFERENCES `fuel_types` (`fuel_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One queue row per station (app updates this row)
CREATE TABLE `queue_status` (
  `queue_id` int NOT NULL AUTO_INCREMENT,
  `station_id` int NOT NULL,
  `queue_length` int NOT NULL DEFAULT '0',
  `waiting_time` int NOT NULL DEFAULT '0',
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`queue_id`),
  UNIQUE KEY `uq_queue_station` (`station_id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `fk_queue_station` FOREIGN KEY (`station_id`) REFERENCES `fuel_stations` (`station_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_queue_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `message` text,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `station_id` int DEFAULT NULL,
  `queue_length` int DEFAULT NULL,
  `waiting_time` int DEFAULT NULL,
  `fuel_type_id` int DEFAULT NULL,
  `comment` text,
  `image_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  KEY `user_id` (`user_id`),
  KEY `station_id` (`station_id`),
  KEY `fuel_type_id` (`fuel_type_id`),
  CONSTRAINT `fk_rep_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rep_station` FOREIGN KEY (`station_id`) REFERENCES `fuel_stations` (`station_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rep_fuel` FOREIGN KEY (`fuel_type_id`) REFERENCES `fuel_types` (`fuel_type_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Demo station (no owner) — queue + availability for user dashboard smoke test
-- ---------------------------------------------------------------------------
INSERT INTO `fuel_stations` (`station_id`, `owner_user_id`, `station_name`, `location`, `latitude`, `longitude`, `created_at`) VALUES
(1, NULL, 'Ceypetco — Colombo', 'Colombo', NULL, NULL, CURRENT_TIMESTAMP);

INSERT INTO `fuel_availability` (`station_id`, `fuel_type_id`, `is_available`, `last_updated`) VALUES
(1, 1, 1, CURRENT_TIMESTAMP),
(1, 2, 0, CURRENT_TIMESTAMP);

INSERT INTO `queue_status` (`station_id`, `queue_length`, `waiting_time`, `updated_at`) VALUES
(1, 24, 18, CURRENT_TIMESTAMP);
