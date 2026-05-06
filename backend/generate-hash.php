<?php
// Generate a secure password hash for "admin123"
$password = 'admin123';
$hash = password_hash($password, PASSWORD_DEFAULT);
echo $hash;
?>
