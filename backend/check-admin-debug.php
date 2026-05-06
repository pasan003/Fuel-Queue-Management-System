<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

echo "<h2>Debug: Admin User Check</h2>";

$pdo = db();
if (!$pdo) {
    echo "<p style='color:red;'>Database connection failed!</p>";
    exit;
}

// Check if admin exists
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute(['admin@fqms.lk']);
$admin = $stmt->fetch();

echo "<h3>Admin User Record:</h3>";
if ($admin) {
    echo "<pre>";
    print_r($admin);
    echo "</pre>";
    
    echo "<h3>Password Analysis:</h3>";
    echo "Password field: " . htmlspecialchars($admin['password']) . "<br>";
    echo "Password length: " . strlen($admin['password']) . "<br>";
    echo "Is bcrypt hash (starts with \$2): " . (strpos($admin['password'], '$2') === 0 ? "YES ✓" : "NO ✗") . "<br>";
    
    echo "<h3>Role Analysis:</h3>";
    echo "Role stored: '" . htmlspecialchars($admin['role']) . "'<br>";
    echo "Role === 'admin': " . ($admin['role'] === 'admin' ? "YES ✓" : "NO ✗") . "<br>";
    
    echo "<h3>Test password_verify:</h3>";
    $testPassword = 'admin123';
    $result = password_verify($testPassword, $admin['password']);
    echo "password_verify('admin123', hash): " . ($result ? "TRUE ✓" : "FALSE ✗") . "<br>";
    
} else {
    echo "<p style='color:red;'>Admin user NOT found in database!</p>";
}

echo "<h3>All Users in Database:</h3>";
$stmt = $pdo->prepare('SELECT user_id, name, email, role FROM users ORDER BY user_id');
$stmt->execute();
$all = $stmt->fetchAll();
echo "<pre>";
print_r($all);
echo "</pre>";
?>
