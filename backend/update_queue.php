<?php
declare(strict_types=1);

/**
 * POST/PATCH/PUT — update queue length for a station (any logged-in user).
 * Method: POST, PATCH, or PUT
 * Data: station_id, queue_length (validated)
 * Response: updated queue_length or error
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

if ($method === 'POST' || $method === 'PATCH' || $method === 'PUT') {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    $stationIdIn = null;
    $queueLengthIn = null;

    // Support JSON body or form data
    if (stripos($ct, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $j = $raw ? json_decode($raw, true) : null;
        if (is_array($j)) {
            $stationIdIn = $j['station_id'] ?? $stationIdIn;
            $queueLengthIn = $j['queue_length'] ?? $queueLengthIn;
        }
    } else {
        $stationIdIn = $_POST['station_id'] ?? $stationIdIn;
        $queueLengthIn = $_POST['queue_length'] ?? $queueLengthIn;
    }

    if ($stationIdIn === null || $queueLengthIn === null) {
        json_response(400, ['ok' => false, 'message' => 'station_id and queue_length are required']);
    }

    $stationId = (int)$stationIdIn;
    $queueLength = (int)$queueLengthIn;

    // Validation: no negative, reasonable max (e.g., 10000)
    if ($queueLength < 0) {
        json_response(400, ['ok' => false, 'message' => 'Queue length cannot be negative']);
    }
    if ($queueLength > 10000) {
        json_response(400, ['ok' => false, 'message' => 'Queue length exceeds reasonable limit (max 10000)']);
    }

    // Verify station exists
    $checkStmt = $pdo->prepare('SELECT station_id FROM fuel_stations WHERE station_id = ? LIMIT 1');
    $checkStmt->execute([$stationId]);
    if (!$checkStmt->fetch()) {
        json_response(404, ['ok' => false, 'message' => 'Station not found']);
    }

    // Update queue_status
    try {
        $uid = (int)$_SESSION['user_id'];

        // Check if queue entry exists
        $checkQueue = $pdo->prepare('SELECT queue_id FROM queue_status WHERE station_id = ? LIMIT 1');
        $checkQueue->execute([$stationId]);
        $queueExists = $checkQueue->fetch();

        if ($queueExists) {
            // Update existing entry
            $upStmt = $pdo->prepare(
                'UPDATE queue_status SET queue_length = ?, updated_by = ?, updated_at = NOW() WHERE station_id = ?'
            );
            $upStmt->execute([$queueLength, $uid, $stationId]);
        } else {
            // Insert new entry
            $insStmt = $pdo->prepare(
                'INSERT INTO queue_status (station_id, queue_length, waiting_time, updated_by, updated_at) VALUES (?, ?, 0, ?, NOW())'
            );
            $insStmt->execute([$stationId, $queueLength, $uid]);
        }

        // Return updated queue status
        $getStmt = $pdo->prepare(
            'SELECT queue_length, waiting_time, updated_at FROM queue_status WHERE station_id = ? LIMIT 1'
        );
        $getStmt->execute([$stationId]);
        $row = $getStmt->fetch();

        json_response(200, [
            'ok' => true,
            'message' => 'Queue length updated',
            'station_id' => $stationId,
            'queue_length' => (int)($row['queue_length'] ?? 0),
            'waiting_time' => (int)($row['waiting_time'] ?? 0),
            'updated_at' => $row['updated_at'] ?? null,
        ]);
    } catch (PDOException $e) {
        json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
}

json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
