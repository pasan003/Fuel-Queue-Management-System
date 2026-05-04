<?php
/**
 * Test Admin Login - Debug Script
 * Verify password_verify() works correctly with the admin account
 */

require __DIR__ . '/config.php';

session_boot();
$pdo = db();

if (!$pdo) {
    die('Database connection failed');
}

// Test 1: Retrieve admin user
echo "=== Test 1: Retrieve Admin User ===\n";
$stmt = $pdo->prepare('SELECT user_id, name, email, password, role, is_active FROM users WHERE email = ? LIMIT 1');
$stmt->execute(['admin@fqms.lk']);
$admin = $stmt->fetch();

if (!$admin) {
    die('❌ Admin user not found!\n');
}

echo "✓ Admin user found:\n";
echo "  - ID: " . $admin['user_id'] . "\n";
echo "  - Name: " . $admin['name'] . "\n";
echo "  - Email: " . $admin['email'] . "\n";
echo "  - Role: " . $admin['role'] . "\n";
echo "  - Active: " . ($admin['is_active'] ? 'Yes' : 'No') . "\n";
echo "  - Hash: " . substr($admin['password'], 0, 20) . "...\n\n";

// Test 2: Verify password
echo "=== Test 2: Verify Password ===\n";
$password_plain = 'admin123';
$password_hash = $admin['password'];

$verified = password_verify($password_plain, $password_hash);

echo "Password: {$password_plain}\n";
echo "Hash: {$password_hash}\n";
echo "Verified: " . ($verified ? '✓ YES' : '❌ NO') . "\n\n";

if (!$verified) {
    echo "❌ Password verification FAILED!\n";
    echo "Attempting to generate a new hash...\n";
    $new_hash = password_hash($password_plain, PASSWORD_DEFAULT);
    echo "New hash: {$new_hash}\n";
    echo "You may need to update the database with: UPDATE users SET password = '{$new_hash}' WHERE user_id = {$admin['user_id']};\n";
    exit(1);
}

// Test 3: Check account status
echo "=== Test 3: Check Account Status ===\n";
if ((int)$admin['is_active'] === 0) {
    echo "❌ Account is SUSPENDED!\n";
    exit(1);
} else {
    echo "✓ Account is ACTIVE\n\n";
}

// Test 4: Simulate login
echo "=== Test 4: Simulate Login ===\n";
echo "Simulating login with email: admin@fqms.lk and password: admin123\n";

$username = 'admin@fqms.lk';
$password = 'admin123';
$emailGuess = strtolower($username);

$stmt = $pdo->prepare(
    'SELECT user_id, name, email, password, role, is_active, suspension_reason FROM users WHERE LOWER(email) = ? LIMIT 1'
);
$stmt->execute([$emailGuess]);
$row = $stmt->fetch();

if (!$row) {
    echo "❌ User not found\n";
    exit(1);
}

if (!password_verify($password, (string)$row['password'])) {
    echo "❌ Invalid credentials\n";
    exit(1);
}

if ((int)$row['is_active'] === 0) {
    echo "❌ Account is suspended\n";
    exit(1);
}

$role = (string)$row['role'];
$userType = $role === 'owner' ? 'owner' : ($role === 'admin' ? 'admin' : 'customer');

echo "✓ Login successful!\n";
echo "  - User ID: " . $row['user_id'] . "\n";
echo "  - Name: " . $row['name'] . "\n";
echo "  - Role: " . $role . "\n";
echo "  - User Type: " . $userType . "\n\n";

echo "=== ALL TESTS PASSED ===\n";
echo "Admin can login successfully!\n";
?>
