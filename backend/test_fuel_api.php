<?php
require __DIR__ . '/config.php';

$pdo = db();
if (!$pdo) {
    echo "DB FAIL\n";
    exit(1);
}
echo "DB OK\n";

// Check fuel_usage_logs table
$stmt = $pdo->query("SHOW TABLES LIKE 'fuel_usage_logs'");
echo $stmt->rowCount() > 0 ? "fuel_usage_logs: EXISTS\n" : "fuel_usage_logs: MISSING\n";

// Check fuel_prices table
$stmt = $pdo->query("SHOW TABLES LIKE 'fuel_prices'");
echo $stmt->rowCount() > 0 ? "fuel_prices: EXISTS\n" : "fuel_prices: MISSING\n";

// Check fuel_types table
$stmt = $pdo->query("SHOW TABLES LIKE 'fuel_types'");
echo $stmt->rowCount() > 0 ? "fuel_types: EXISTS\n" : "fuel_types: MISSING\n";

// Check user exists
$stmt = $pdo->prepare("SELECT user_id, email, role FROM users WHERE email = ?");
$stmt->execute(['user@gmail.com']);
$user = $stmt->fetch();
echo $user ? "Customer user: EXISTS (id={$user['user_id']}, role={$user['role']})\n" : "Customer user: MISSING\n";

// Check fuel_types content
$stmt = $pdo->query("SELECT fuel_type_id, fuel_name FROM fuel_types");
$types = $stmt->fetchAll();
echo "Fuel types (" . count($types) . "):\n";
foreach ($types as $t) {
    echo "  - {$t['fuel_type_id']}: {$t['fuel_name']}\n";
}

// Check fuel_usage_logs columns
$stmt = $pdo->query("DESCRIBE fuel_usage_logs");
echo "fuel_usage_logs columns:\n";
foreach ($stmt->fetchAll() as $col) {
    echo "  - {$col['Field']} ({$col['Type']})\n";
}

echo "\nAll checks done.\n";
