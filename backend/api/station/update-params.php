<?php
declare(strict_types=1);

/**
 * PUT/PATCH — Update station operational parameters (pumps, service rate).
 * 
 * Owner access only. Updates service_rate and active_pumps in queue_status.
 * 
 * Request:
 *   service_rate: float (minutes to serve one vehicle, e.g., 3.5)
 *   active_pumps: int (number of working pumps, e.g., 4)
 * 
 * Response:
 *   { ok: true, station_id, service_rate, active_pumps }
 */

require __DIR__ . '/../config.php';

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

session_boot();

if (empty($_SESSION['user_id'])) {
    json_response(401, ['ok' => false, 'message' => 'Authentication required']);
}

if (($_SESSION['role'] ?? '') !== 'owner') {
    json_response(403, ['ok' => false, 'message' => 'Owner access only']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'PUT' || $method === 'PATCH') {
    require_post();

    $uid = (int)$_SESSION['user_id'];

    // Get owner's station
    $stationStmt = $pdo->prepare(
        'SELECT station_id FROM fuel_stations WHERE owner_user_id = ? LIMIT 1'
    );
    $stationStmt->execute([$uid]);
    $stationRow = $stationStmt->fetch();

    if (!$stationRow) {
        json_response(404, ['ok' => false, 'message' => 'No station linked to this account']);
    }

    $stationId = (int)$stationRow['station_id'];

    // Parse input
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    $serviceRateIn = $_POST['service_rate'] ?? null;
    $activePumpsIn = $_POST['active_pumps'] ?? null;

    if (
        ($serviceRateIn === null || $activePumpsIn === null)
        && stripos($ct, 'application/json') !== false
    ) {
        $raw = file_get_contents('php://input');
        $j = $raw ? json_decode($raw, true) : null;
        if (is_array($j)) {
            $serviceRateIn = $j['service_rate'] ?? $serviceRateIn;
            $activePumpsIn = $j['active_pumps'] ?? $activePumpsIn;
        }
    }

    // Validate input
    if ($serviceRateIn === null && $activePumpsIn === null) {
        json_response(400, ['ok' => false, 'message' => 'At least one of service_rate or active_pumps must be provided']);
    }

    // Validate and convert values
    $serviceRate = null;
    $activePumps = null;

    if ($serviceRateIn !== null) {
        $serviceRate = (float)$serviceRateIn;
        if ($serviceRate <= 0) {
            json_response(400, ['ok' => false, 'message' => 'service_rate must be greater than 0']);
        }
        if ($serviceRate > 1000) {
            json_response(400, ['ok' => false, 'message' => 'service_rate is unreasonably large']);
        }
    }

    if ($activePumpsIn !== null) {
        $activePumps = (int)$activePumpsIn;
        if ($activePumps <= 0) {
            json_response(400, ['ok' => false, 'message' => 'active_pumps must be greater than 0']);
        }
        if ($activePumps > 100) {
            json_response(400, ['ok' => false, 'message' => 'active_pumps is unreasonably large']);
        }
    }

    try {
        // Ensure queue_status row exists
        $checkQueue = $pdo->prepare('SELECT queue_id FROM queue_status WHERE station_id = ? LIMIT 1');
        $checkQueue->execute([$stationId]);
        $queueExists = $checkQueue->fetch();

        if (!$queueExists) {
            // Create queue entry with defaults
            $insStmt = $pdo->prepare(
                'INSERT INTO queue_status (station_id, queue_length, service_rate, active_pumps, updated_by, updated_at) 
                 VALUES (?, 0, ?, ?, ?, NOW())'
            );
            $insStmt->execute([$stationId, $serviceRate ?? 5.0, $activePumps ?? 1, $uid]);
        }

        // Update service_rate and/or active_pumps
        if ($serviceRate !== null && $activePumps !== null) {
            $upStmt = $pdo->prepare(
                'UPDATE queue_status SET service_rate = ?, active_pumps = ?, updated_by = ?, updated_at = NOW() WHERE station_id = ?'
            );
            $upStmt->execute([$serviceRate, $activePumps, $uid, $stationId]);
        } elseif ($serviceRate !== null) {
            $upStmt = $pdo->prepare(
                'UPDATE queue_status SET service_rate = ?, updated_by = ?, updated_at = NOW() WHERE station_id = ?'
            );
            $upStmt->execute([$serviceRate, $uid, $stationId]);
        } elseif ($activePumps !== null) {
            $upStmt = $pdo->prepare(
                'UPDATE queue_status SET active_pumps = ?, updated_by = ?, updated_at = NOW() WHERE station_id = ?'
            );
            $upStmt->execute([$activePumps, $uid, $stationId]);
        }

        // Fetch updated values
        $getStmt = $pdo->prepare(
            'SELECT service_rate, active_pumps FROM queue_status WHERE station_id = ? LIMIT 1'
        );
        $getStmt->execute([$stationId]);
        $updated = $getStmt->fetch();

        json_response(200, [
            'ok' => true,
            'message' => 'Station operational parameters updated',
            'station_id' => $stationId,
            'service_rate' => (float)($updated['service_rate'] ?? 5.0),
            'active_pumps' => (int)($updated['active_pumps'] ?? 1),
        ]);

    } catch (PDOException $e) {
        json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

json_response(405, ['ok' => false, 'message' => 'Method not allowed. Use PUT or PATCH.']);
