<?php
declare(strict_types=1);

/**
 * POST/PATCH/PUT — Update queue length for a station
 *
 * This endpoint updates the queue length and automatically calculates the estimated waiting time.
 * 
 * FORMULA: waiting_time = queue_length × 2 (in minutes per vehicle)
 * 
 * Authentication: Required (any logged-in user can update queue)
 * 
 * Request Body (JSON or form data):
 *   - station_id (int): The station to update
 *   - queue_length (int): New queue length (0-10000)
 * 
 * Response: { ok: true, station_id, queue_length, waiting_time, updated_at }
 * 
 * Examples:
 * Request: {"station_id": 1, "queue_length": 8}
 * Response: {"ok": true, "queue_length": 8, "waiting_time": 16, ...}
 */

require __DIR__ . '/config.php';

// Check database connection
$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

function table_exists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare('SHOW TABLES LIKE ?');
    $stmt->execute([$table]);
    return (bool)$stmt->fetchColumn();
}

// Verify user is authenticated
session_boot();
if (empty($_SESSION['user_id'])) {
    json_response(401, ['ok' => false, 'message' => 'Authentication required']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Handle PUT, PATCH, or POST requests
if ($method === 'POST' || $method === 'PATCH' || $method === 'PUT') {
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    $stationIdIn = null;
    $queueLengthIn = null;

    // Support both JSON body and form data for flexibility
    if (stripos($ct, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $j = $raw ? json_decode($raw, true) : null;
        if (is_array($j)) {
            $stationIdIn = $j['station_id'] ?? $stationIdIn;
            $queueLengthIn = $j['queue_length'] ?? $queueLengthIn;
        }
    } else {
        // Form data fallback
        $stationIdIn = $_POST['station_id'] ?? $stationIdIn;
        $queueLengthIn = $_POST['queue_length'] ?? $queueLengthIn;
    }

    // Validate required parameters exist
    if ($stationIdIn === null || $queueLengthIn === null) {
        json_response(400, ['ok' => false, 'message' => 'station_id and queue_length are required']);
    }

    // Convert and validate types
    $stationId = (int)$stationIdIn;
    $queueLength = (int)$queueLengthIn;

    // Validation: queue length must be non-negative and reasonable
    if ($queueLength < 0) {
        json_response(400, ['ok' => false, 'message' => 'Queue length cannot be negative']);
    }
    if ($queueLength > 10000) {
        json_response(400, ['ok' => false, 'message' => 'Queue length exceeds reasonable limit (max 10000)']);
    }

    // Verify station exists in database
    $checkStmt = $pdo->prepare('SELECT station_id FROM fuel_stations WHERE station_id = ? LIMIT 1');
    $checkStmt->execute([$stationId]);
    if (!$checkStmt->fetch()) {
        json_response(404, ['ok' => false, 'message' => 'Station not found']);
    }

    // MAIN CALCULATION: waiting_time = queue_length × 2
    // This is automatically calculated whenever queue is updated
    $waitingTime = $queueLength * 2;

    try {
        $uid = (int)$_SESSION['user_id'];

        // Check if queue entry already exists for this station
        $checkQueue = $pdo->prepare('SELECT queue_id FROM queue_status WHERE station_id = ? LIMIT 1');
        $checkQueue->execute([$stationId]);
        $queueExists = $checkQueue->fetch();

        if ($queueExists) {
            // UPDATE existing queue entry with new queue_length and calculated waiting_time
            $upStmt = $pdo->prepare(
                'UPDATE queue_status SET queue_length = ?, waiting_time = ?, updated_by = ?, updated_at = NOW() WHERE station_id = ?'
            );
            $upStmt->execute([$queueLength, $waitingTime, $uid, $stationId]);
        } else {
            // INSERT new queue entry for this station
            $insStmt = $pdo->prepare(
                'INSERT INTO queue_status (station_id, queue_length, waiting_time, updated_by, updated_at) VALUES (?, ?, ?, ?, NOW())'
            );
            $insStmt->execute([$stationId, $queueLength, $waitingTime, $uid]);
        }

        if (table_exists($pdo, 'queue_history')) {
            $historyStmt = $pdo->prepare(
                'INSERT INTO queue_history (station_id, queue_length, waiting_time, updated_by) VALUES (?, ?, ?, ?)'
            );
            $historyStmt->execute([$stationId, $queueLength, $waitingTime, $uid]);
        }

        // Fetch and return updated queue status
        $getStmt = $pdo->prepare(
            'SELECT queue_length, waiting_time, updated_at FROM queue_status WHERE station_id = ? LIMIT 1'
        );
        $getStmt->execute([$stationId]);
        $row = $getStmt->fetch();

        // Return success response with updated values
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

// Return error for non-POST/PATCH/PUT methods
json_response(405, ['ok' => false, 'message' => 'Method not allowed']);


