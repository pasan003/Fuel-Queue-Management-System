-- Fix admin password hash
-- Password: admin123
-- Email: admin@fqms.lk

UPDATE fqms.users 
SET password = '$2y$10$nzy120yMvhNHT5aO6qXnSeRb8jmsT9HlIoydTRgtIgW5rZH.ptQmC'
WHERE user_id = 3;

-- Verify the update
SELECT user_id, name, email, role, is_active FROM fqms.users WHERE user_id = 3;
