<?php
declare(strict_types=1);

/**
 * Admin Fuel Prices API - Manage global fuel prices
 * GET: List all fuel prices
 * POST: Create/Update fuel price
 * Requires admin role
 */

require __DIR__ . '/config.php';

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

session_boot();

if (empty($_SESSION['user_id'])) {
    json_response(401, ['ok' => false, 'message' => 'Authentication required']);
}

$user_id = (int)$_SESSION['user_id'];
$admin_user_id = $user_id;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    if (($_SESSION['role'] ?? '') !== 'admin') {
        json_response(403, ['ok' => false, 'message' => 'Admin access only']);
    }
}


// ===================================================================
// GET: List all fuel prices
// ===================================================================
if ($method === 'GET') {
    $sql = "SELECT
      fp.price_id,
      fp.fuel_type_id,
      ft.fuel_name,
      fp.current_price,
      fp.updated_by,
      u.name as updated_by_name,
      fp.updated_at
    FROM fuel_prices fp
    JOIN fuel_types ft ON ft.fuel_type_id = fp.fuel_type_id
    LEFT JOIN users u ON u.user_id = fp.updated_by
    ORDER BY ft.fuel_type_id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $prices = [];

    foreach ($stmt->fetchAll() as $row) {
        $prices[] = [
            'price_id' => (int)$row['price_id'],
            'fuel_type_id' => (int)$row['fuel_type_id'],
            'fuel_name' => (string)$row['fuel_name'],
            'current_price' => (float)$row['current_price'],
            'updated_by' => $row['updated_by'] !== null ? (int)$row['updated_by'] : null,
            'updated_by_name' => $row['updated_by_name'] !== null ? (string)$row['updated_by_name'] : null,
            'updated_at' => (string)$row['updated_at'],
        ];
    }

    json_response(200, [
        'ok' => true,
        'prices' => $prices,
    ]);
}

// ===================================================================
// POST: Update fuel price
// ===================================================================
if ($method === 'POST') {
    require_post();

    $fuel_type_id = isset($_POST['fuel_type_id']) ? (int)$_POST['fuel_type_id'] : 0;
    $current_price = isset($_POST['current_price']) ? (float)$_POST['current_price'] : 0;

    // Validation
    if ($fuel_type_id <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Invalid fuel type']);
    }
    if ($current_price <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Price must be positive']);
    }

    // Verify fuel type exists
    $typeStmt = $pdo->prepare('SELECT fuel_name FROM fuel_types WHERE fuel_type_id = ?');
    $typeStmt->execute([$fuel_type_id]);
    $fuelType = $typeStmt->fetch();

    if (!$fuelType) {
        json_response(400, ['ok' => false, 'message' => 'Invalid fuel type']);
    }

    try {
        // Try to update existing price
        $checkStmt = $pdo->prepare('SELECT price_id FROM fuel_prices WHERE fuel_type_id = ?');
        $checkStmt->execute([$fuel_type_id]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            // Update existing
            $updateStmt = $pdo->prepare(
                'UPDATE fuel_prices SET current_price = ?, updated_by = ?, updated_at = NOW() WHERE fuel_type_id = ?'
            );
            $updateStmt->execute([$current_price, $admin_user_id, $fuel_type_id]);

            json_response(200, [
                'ok' => true,
                'message' => 'Fuel price updated',
                'fuel_type_id' => $fuel_type_id,
                'current_price' => $current_price,
            ]);
        } else {
            // Insert new
            $insertStmt = $pdo->prepare(
                'INSERT INTO fuel_prices (fuel_type_id, current_price, updated_by, updated_at) VALUES (?, ?, ?, NOW())'
            );
            $insertStmt->execute([$fuel_type_id, $current_price, $admin_user_id]);

            json_response(201, [
                'ok' => true,
                'message' => 'Fuel price created',
                'price_id' => (int)$pdo->lastInsertId(),
                'fuel_type_id' => $fuel_type_id,
                'current_price' => $current_price,
            ]);
        }
    } catch (PDOException $e) {
        json_response(500, ['ok' => false, 'message' => 'Failed to save fuel price']);
    }
}

json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
