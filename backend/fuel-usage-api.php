<?php
declare(strict_types=1);

/**
 * Fuel Usage API - User fuel log management
 * GET: List user's fuel logs (with filters)
 * POST: Create new fuel log
 * PUT: Update existing fuel log
 * DELETE: Delete fuel log
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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user_id = (int)$_SESSION['user_id'];

/**
 * Normalize optional station_id from form/JSON (null, "", 0 -> null).
 */
function parse_optional_station_id(mixed $value): ?int {
    if ($value === null || $value === '' || $value === false) {
        return null;
    }
    $id = (int)$value;
    return $id > 0 ? $id : null;
}

/**
 * Map PDO errors to safe client messages (full detail in server log).
 */
function fuel_log_pdo_message(PDOException $e, string $fallback): string {
    error_log('fuel-usage-api: ' . $e->getMessage());
    $sqlState = $e->errorInfo[0] ?? '';
    if ($sqlState === '23000') {
        $detail = $e->getMessage();
        if (stripos($detail, 'fk_fuel_log_station') !== false) {
            return 'Invalid or unknown station';
        }
        if (stripos($detail, 'fk_fuel_log_fuel_type') !== false) {
            return 'Invalid fuel type';
        }
        if (stripos($detail, 'fk_fuel_log_user') !== false) {
            return 'Invalid user session';
        }
        return 'Database constraint failed';
    }
    return $fallback;
}

// ===================================================================
// GET: Retrieve user's fuel logs
// ===================================================================
if ($method === 'GET') {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $month = !empty($_GET['month']) ? (int)$_GET['month'] : null;
    $year = !empty($_GET['year']) ? (int)$_GET['year'] : null;
    $fuel_type_id = !empty($_GET['fuel_type_id']) ? (int)$_GET['fuel_type_id'] : null;
    $station_id = !empty($_GET['station_id']) ? (int)$_GET['station_id'] : null;

    // Build query
    $where = ['ffl.user_id = ?'];
    $params = [$user_id];

    if ($month !== null) {
        $filterYear = $year ?? (int)date('Y');
        $where[] = 'YEAR(ffl.created_at) = ? AND MONTH(ffl.created_at) = ?';
        $params[] = $filterYear;
        $params[] = $month;
    }

    if ($fuel_type_id !== null) {
        $where[] = 'ffl.fuel_type_id = ?';
        $params[] = $fuel_type_id;
    }

    if ($station_id !== null) {
        $where[] = 'ffl.station_id = ?';
        $params[] = $station_id;
    }

    $whereClause = implode(' AND ', $where);

    // Count total
    $countSql = "SELECT COUNT(*) as total FROM fuel_usage_logs ffl WHERE {$whereClause}";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalCount = (int)$countStmt->fetch()['total'];
    $totalPages = ceil($totalCount / $limit);

    // Get paginated results
    $sql = <<<SQL
SELECT
  ffl.log_id,
  ffl.user_id,
  ffl.station_id,
  ffl.fuel_type_id,
  ft.fuel_name,
  ffl.liters,
  ffl.price_per_liter,
  ffl.total_cost,
  ffl.odometer_reading,
  ffl.previous_odometer,
  ffl.distance_traveled,
  ffl.fuel_efficiency,
  ffl.notes,
  ffl.created_at,
  ffl.updated_at,
  fs.station_name
FROM fuel_usage_logs ffl
LEFT JOIN fuel_types ft ON ft.fuel_type_id = ffl.fuel_type_id
LEFT JOIN fuel_stations fs ON fs.station_id = ffl.station_id
WHERE {$whereClause}
ORDER BY ffl.created_at DESC
LIMIT {$limit} OFFSET {$offset}
SQL;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();

    $out = [];
    foreach ($logs as $log) {
        $out[] = [
            'log_id' => (int)$log['log_id'],
            'fuel_type_id' => (int)$log['fuel_type_id'],
            'fuel_name' => (string)($log['fuel_name'] ?? ''),
            'liters' => (float)$log['liters'],
            'price_per_liter' => (float)$log['price_per_liter'],
            'total_cost' => (float)$log['total_cost'],
            'odometer_reading' => $log['odometer_reading'] !== null ? (int)$log['odometer_reading'] : null,
            'previous_odometer' => $log['previous_odometer'] !== null ? (int)$log['previous_odometer'] : null,
            'distance_traveled' => $log['distance_traveled'] !== null ? (int)$log['distance_traveled'] : null,
            'fuel_efficiency' => $log['fuel_efficiency'] !== null ? (float)$log['fuel_efficiency'] : null,
            'notes' => (string)($log['notes'] ?? ''),
            'station_name' => $log['station_name'] !== null ? (string)$log['station_name'] : null,
            'created_at' => (string)$log['created_at'],
            'updated_at' => (string)$log['updated_at'],
        ];
    }

    json_response(200, [
        'ok' => true,
        'logs' => $out,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $totalCount,
            'total_pages' => $totalPages,
        ],
    ]);
}

// ===================================================================
// POST: Create new fuel log
// ===================================================================
if ($method === 'POST') {
    require_post();

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $json = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($json)) {
            $_POST = array_merge($_POST, $json);
        }
    }

    $fuel_type_id = isset($_POST['fuel_type_id']) ? (int)$_POST['fuel_type_id'] : 0;
    $liters = isset($_POST['liters']) ? (float)$_POST['liters'] : 0;
    $price_per_liter = isset($_POST['price_per_liter']) ? (float)$_POST['price_per_liter'] : 0;
    $odometer_raw = $_POST['odometer_reading'] ?? null;
    $odometer_reading = ($odometer_raw !== null && $odometer_raw !== '')
        ? (int)$odometer_raw
        : null;
    $station_id = parse_optional_station_id($_POST['station_id'] ?? null);
    $notes = isset($_POST['notes']) ? trim((string)$_POST['notes']) : '';

    if ($fuel_type_id <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Please select a valid fuel type']);
    }
    if ($liters <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Liters must be greater than 0']);
    }
    if ($price_per_liter <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Price per liter must be greater than 0']);
    }
    if ($odometer_reading !== null && $odometer_reading < 0) {
        json_response(400, ['ok' => false, 'message' => 'Odometer reading cannot be negative']);
    }

    $typeStmt = $pdo->prepare('SELECT fuel_type_id FROM fuel_types WHERE fuel_type_id = ? LIMIT 1');
    $typeStmt->execute([$fuel_type_id]);
    if (!$typeStmt->fetch()) {
        json_response(400, ['ok' => false, 'message' => 'Invalid fuel type']);
    }

    if ($station_id !== null) {
        $stationStmt = $pdo->prepare('SELECT station_id FROM fuel_stations WHERE station_id = ? LIMIT 1');
        $stationStmt->execute([$station_id]);
        if (!$stationStmt->fetch()) {
            json_response(400, ['ok' => false, 'message' => 'Station not found']);
        }
    }

    // Calculate total cost
    $total_cost = round($liters * $price_per_liter, 2);

    // Get previous odometer reading for efficiency calculation
    $previous_odometer = null;
    $distance_traveled = null;
    $fuel_efficiency = null;

    if ($odometer_reading !== null && $odometer_reading > 0) {
        // Find previous fuel log
        $prevStmt = $pdo->prepare(
            'SELECT odometer_reading FROM fuel_usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
        );
        $prevStmt->execute([$user_id]);
        $prevLog = $prevStmt->fetch();

        if ($prevLog && $prevLog['odometer_reading'] !== null) {
            $previous_odometer = (int)$prevLog['odometer_reading'];
            $distance_traveled = $odometer_reading - $previous_odometer;

            // Calculate fuel efficiency (only if distance is positive)
            if ($distance_traveled > 0 && $liters > 0) {
                $fuel_efficiency = round($distance_traveled / $liters, 2);
            }
        }
    }

    // Insert log
    $stmt = $pdo->prepare(
        'INSERT INTO fuel_usage_logs (user_id, station_id, fuel_type_id, liters, price_per_liter, total_cost, odometer_reading, previous_odometer, distance_traveled, fuel_efficiency, notes, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    );

    try {
        $stmt->execute([
            $user_id,
            $station_id,
            $fuel_type_id,
            $liters,
            $price_per_liter,
            $total_cost,
            $odometer_reading,
            $previous_odometer,
            $distance_traveled,
            $fuel_efficiency,
            $notes,
        ]);

        $log_id = (int)$pdo->lastInsertId();

        json_response(201, [
            'ok' => true,
            'message' => 'Fuel log created',
            'log_id' => $log_id,
            'total_cost' => $total_cost,
            'fuel_efficiency' => $fuel_efficiency,
            'distance_traveled' => $distance_traveled,
        ]);
    } catch (PDOException $e) {
        json_response(500, [
            'ok' => false,
            'message' => fuel_log_pdo_message($e, 'Failed to create fuel log'),
        ]);
    }
}

// ===================================================================
// PUT: Update fuel log
// ===================================================================
if ($method === 'PUT') {
    parse_str(file_get_contents('php://input'), $_PUT);

    $log_id = isset($_PUT['log_id']) ? (int)$_PUT['log_id'] : 0;

    if ($log_id <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Invalid log ID']);
    }

    // Verify ownership
    $checkStmt = $pdo->prepare('SELECT user_id FROM fuel_usage_logs WHERE log_id = ? LIMIT 1');
    $checkStmt->execute([$log_id]);
    $log = $checkStmt->fetch();

    if (!$log || (int)$log['user_id'] !== $user_id) {
        json_response(403, ['ok' => false, 'message' => 'Unauthorized']);
    }

    $liters = isset($_PUT['liters']) ? (float)$_PUT['liters'] : null;
    $price_per_liter = isset($_PUT['price_per_liter']) ? (float)$_PUT['price_per_liter'] : null;
    $odometer_reading = isset($_PUT['odometer_reading']) ? (int)$_PUT['odometer_reading'] : null;
    $notes = isset($_PUT['notes']) ? trim((string)$_PUT['notes']) : null;

    $updates = [];
    $params = [];

    if ($liters !== null) {
        if ($liters <= 0) {
            json_response(400, ['ok' => false, 'message' => 'Liters must be positive']);
        }
        $updates[] = 'liters = ?';
        $params[] = $liters;
    }

    if ($price_per_liter !== null) {
        if ($price_per_liter <= 0) {
            json_response(400, ['ok' => false, 'message' => 'Price per liter must be positive']);
        }
        $updates[] = 'price_per_liter = ?';
        $params[] = $price_per_liter;
    }

    if ($notes !== null) {
        $updates[] = 'notes = ?';
        $params[] = $notes;
    }

    if ($odometer_reading !== null && $odometer_reading > 0) {
        $updates[] = 'odometer_reading = ?';
        $params[] = $odometer_reading;

        // Recalculate efficiency
        $prevStmt = $pdo->prepare(
            'SELECT odometer_reading FROM fuel_usage_logs WHERE user_id = ? AND log_id != ? ORDER BY created_at DESC LIMIT 1'
        );
        $prevStmt->execute([$user_id, $log_id]);
        $prevLog = $prevStmt->fetch();

        if ($prevLog && $prevLog['odometer_reading'] !== null) {
            $previous_odometer = (int)$prevLog['odometer_reading'];
            $distance = $odometer_reading - $previous_odometer;
            if ($distance > 0) {
                $updates[] = 'distance_traveled = ?';
                $params[] = $distance;
            }
        }
    }

    // Recalculate total cost if needed
    if (in_array('liters = ?', $updates) || in_array('price_per_liter = ?', $updates)) {
        // Get current values for calculation
        $getStmt = $pdo->prepare('SELECT liters, price_per_liter FROM fuel_usage_logs WHERE log_id = ?');
        $getStmt->execute([$log_id]);
        $current = $getStmt->fetch();

        $calcLiters = $liters ?? (float)$current['liters'];
        $calcPrice = $price_per_liter ?? (float)$current['price_per_liter'];
        $newTotal = round($calcLiters * $calcPrice, 2);

        $updates[] = 'total_cost = ?';
        $params[] = $newTotal;
    }

    if (empty($updates)) {
        json_response(400, ['ok' => false, 'message' => 'No updates provided']);
    }

    $params[] = $log_id;
    $updateClause = implode(', ', $updates);
    $updateSql = "UPDATE fuel_usage_logs SET {$updateClause}, updated_at = NOW() WHERE log_id = ?";

    try {
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute($params);

        json_response(200, ['ok' => true, 'message' => 'Fuel log updated']);
    } catch (PDOException $e) {
        json_response(500, [
            'ok' => false,
            'message' => fuel_log_pdo_message($e, 'Failed to update fuel log'),
        ]);
    }
}

// ===================================================================
// DELETE: Remove fuel log
// ===================================================================
if ($method === 'DELETE') {
    parse_str(file_get_contents('php://input'), $_DELETE);

    $log_id = isset($_DELETE['log_id']) ? (int)$_DELETE['log_id'] : 0;

    if ($log_id <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Invalid log ID']);
    }

    // Verify ownership
    $checkStmt = $pdo->prepare('SELECT user_id FROM fuel_usage_logs WHERE log_id = ? LIMIT 1');
    $checkStmt->execute([$log_id]);
    $log = $checkStmt->fetch();

    if (!$log || (int)$log['user_id'] !== $user_id) {
        json_response(403, ['ok' => false, 'message' => 'Unauthorized']);
    }

    $delStmt = $pdo->prepare('DELETE FROM fuel_usage_logs WHERE log_id = ?');

    try {
        $delStmt->execute([$log_id]);
        json_response(200, ['ok' => true, 'message' => 'Fuel log deleted']);
    } catch (PDOException $e) {
        json_response(500, [
            'ok' => false,
            'message' => fuel_log_pdo_message($e, 'Failed to delete fuel log'),
        ]);
    }
}

json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
