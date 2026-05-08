-- Seed users for Fuel Queue Management System (FQMS)
-- Safe to import multiple times (won't duplicate due to unique email/national_id)
-- Usage:
--   mysql -u root -p fqms < database/users_seed.sql

USE `fqms`;

INSERT INTO `users`
(`user_id`, `name`, `national_id`, `email`, `password`, `role`, `is_active`, `suspension_reason`, `suspended_at`, `suspended_by`, `created_at`)
VALUES
(1, 'System Admin', 'ADMIN-001', 'admin@fqms.lk', '$2y$10$nzy120yMvhNHT5aO6qXnSeRb8jmsT9HlIoydTRgtIgW5rZH.ptQmC', 'admin', 1, NULL, NULL, NULL, '2026-05-08 14:52:31'),
(3, 'pasan', '2000000000', 'user@gmail.com', '$2y$10$9ZIluN0gCu2sLj2FLCHbcujIkLsyFf3SnoA2QlM9J1jDGpiLJeuWa', 'customer', 1, NULL, NULL, NULL, '2026-05-08 14:57:34'),
(4, 'anupama', '200000001', 'owner@gmail.com', '$2y$10$zLKECzpkGNXrkqtvAk01Yemd7xMOFUvZZy.YCtsA.WeBqfPVD9FjK', 'owner', 1, NULL, NULL, NULL, '2026-05-08 14:58:59')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `password` = VALUES(`password`),
  `role` = VALUES(`role`),
  `is_active` = VALUES(`is_active`);

