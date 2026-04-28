<?php
declare(strict_types=1);

/**
 * Owner station: GET current data (session owner), POST fuel availability updates.
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

if (($_SESSION['role'] ?? '') !== 'owner') {
    json_response(403, ['ok' => false, 'message' => 'Owner access only']);
}

$uid = (int)$_SESSION['user_id'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT station_id, station_name, location FROM fuel_stations WHERE owner_user_id = ? LIMIT 1'
    );
    $stmt->execute([$uid]);
    $station = $stmt->fetch();
    if (!$station) {
        json_response(404, ['ok' => false, 'message' => 'No station linked to this account']);
    }
    $sid = (int)$station['station_id'];

    $stmt = $pdo->prepare(
        'SELECT queue_length, waiting_time, updated_at FROM queue_status WHERE station_id = ? LIMIT 1'
    );
    $stmt->execute([$sid]);
    $queue = $stmt->fetch() ?: ['queue_length' => 0, 'waiting_time' => 0, 'updated_at' => null];

    $stmt = $pdo->prepare(
        'SELECT fuel_type_id, is_available, last_updated FROM fuel_availability WHERE station_id = ?'
    );
    $stmt->execute([$sid]);
    $fuels = $stmt->fetchAll();

    $petrol = false;
    $diesel = false;
    $petrolUpdated = null;
    $dieselUpdated = null;
    foreach ($fuels as $f) {
        $ft = (int)$f['fuel_type_id'];
        if ($ft === 1) {
            $petrol = (bool)(int)$f['is_available'];
            $petrolUpdated = $f['last_updated'] ?? null;
        }
        if ($ft === 2) {
            $diesel = (bool)(int)$f['is_available'];
            $dieselUpdated = $f['last_updated'] ?? null;
        }
    }

    json_response(200, [
        'ok' => true,
        'station' => [
            'station_id' => $sid,
            'station_name' => (string)$station['station_name'],
            'location' => (string)($station['location'] ?? ''),
            'petrol' => $petrol,
            'diesel' => $diesel,
            'queue_length' => (int)($queue['queue_length'] ?? 0),
            'waiting_time' => (int)($queue['waiting_time'] ?? 0),
            'petrol_updated' => $petrolUpdated,
            'diesel_updated' => $dieselUpdated,
            'queue_updated_at' => $queue['updated_at'] ?? null,
        ],
    ]);
}

if ($method === 'POST') {
    require_post();

    $stmt = $pdo->prepare(
        'SELECT station_id FROM fuel_stations WHERE owner_user_id = ? LIMIT 1'
    );
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    if (!$row) {
        json_response(404, ['ok' => false, 'message' => 'No station linked to this account']);
    }
    $sid = (int)$row['station_id'];

    $petrolIn = $_POST['petrol'] ?? null;
    $dieselIn = $_POST['diesel'] ?? null;
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (
        ($petrolIn === null || $dieselIn === null)
        && stripos($ct, 'application/json') !== false
    ) {
        $raw = file_get_contents('php://input');
        $j = $raw ? json_decode($raw, true) : null;
        if (is_array($j)) {
            $petrolIn = $j['petrol'] ?? $petrolIn;
            $dieselIn = $j['diesel'] ?? $dieselIn;
        }
    }

    if ($petrolIn === null || $dieselIn === null) {
        json_response(400, ['ok' => false, 'message' => 'petrol and diesel flags required']);
    }

    $petrol = bool_from_client($petrolIn);
    $diesel = bool_from_client($dieselIn);

    $up = $pdo->prepare(
        'UPDATE fuel_availability SET is_available = ? WHERE station_id = ? AND fuel_type_id = ?'
    );
    $up->execute([$petrol ? 1 : 0, $sid, 1]);
    $up->execute([$diesel ? 1 : 0, $sid, 2]);

    json_response(200, [
        'ok' => true,
        'message' => 'Fuel availability saved',
        'station_id' => $sid,
        'petrol' => $petrol,
        'diesel' => $diesel,
    ]);
}

json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
