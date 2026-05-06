-- Admin Account Setup SQL
-- Email: admin@fqms.lk
-- Password: admin123
-- Role: admin
-- Status: Active

INSERT INTO users (name, national_id, email, password, role, is_active)
VALUES (
  'Admin',
  '000000000',
  'admin@fqms.lk',
  '$2y$10$OtQOb4H8iKlpH6/L5pLQwOZW6QmPc5Yj8.5tMDJKqT3vN2pLyWmqO',
  'admin',
  1
);

-- Verify the insert
SELECT * FROM users WHERE email = 'admin@fqms.lk';
