-- Add Admin User to FQMS Database
-- Email: admin@fqms.lk
-- Password: admin123
-- Import: mysql -u root -p fqms < database/add-admin-user.sql

USE `fqms`;

-- Insert admin user with correct bcrypt password hash for "admin123"
INSERT INTO `users` (`user_id`, `name`, `national_id`, `email`, `password`, `role`, `is_active`, `created_at`) 
VALUES 
(1, 'System Admin', 'ADMIN-001', 'admin@fqms.lk', '$2y$10$nzy120yMvhNHT5aO6qXnSeRb8jmsT9HlIoydTRgtIgW5rZH.ptQmC', 'admin', 1, NOW())
ON DUPLICATE KEY UPDATE 
  `password` = '$2y$10$nzy120yMvhNHT5aO6qXnSeRb8jmsT9HlIoydTRgtIgW5rZH.ptQmC',
  `role` = 'admin',
  `is_active` = 1;

-- Verify insertion
SELECT user_id, name, email, role, is_active FROM `users` WHERE email = 'admin@fqms.lk';
