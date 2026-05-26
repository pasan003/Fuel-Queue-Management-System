<?php
declare(strict_types=1);

/**
 * Admin API: Lightweight live dashboard stats for polling.
 * GET /backend/admin/live-stats.php
 */

require __DIR__ . '/../config.php';

require_admin_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

function admin_station_status(bool $petrol, bool $diesel, int $queueLength): string {
    if (!$petrol && !$diesel) {
        return 'no_fuel';
    }
    if ($petrol && $diesel && $queueLength < 10) {
        return 'available';
    }
    return 'limited';
}

function admin_wait_badge(int $waitingTime): string {
    if ($waitingTime <= 15) {
        return 'quick';
    }
    if ($waitingTime <= 45) {
        return 'normal';
    }
    return 'long';
}

$summary = $pdo->query(
    'SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM fuel_stations) AS total_stations,
        (SELECT COUNT(*) FROM reports) AS total_reports,
        (SELECT COUNT(*) FROM queue_status WHERE queue_length > 0) AS active_queues,
        (SELECT COUNT(*) FROM fuel_stations WHERE approval_status = "pending") AS pending_stations,
        (SELECT COUNT(*) FROM reports WHERE report_status = "pending") AS pending_reports,
        (SELECT COUNT(*) FROM admin_alerts WHERE is_acknowledged = 0) AS open_alerts'
)->fetch();

$fuelRows = $pdo->query(
    'SELECT ft.fuel_name, COUNT(*) AS total, COALESCE(SUM(fa.is_available), 0) AS available
     FROM fuel_types ft
     LEFT JOIN fuel_availability fa ON fa.fuel_type_id = ft.fuel_type_id
     GROUP BY ft.fuel_type_id, ft.fuel_name
     ORDER BY ft.fuel_type_id'
)->fetchAll();

$fuelAvailability = [];
foreach ($fuelRows as $row) {
    $total = (int)$row['total'];
    $available = (int)$row['available'];
    $fuelAvailability[] = [
        'fuel' => (string)$row['fuel_name'],
        'total_stations' => $total,
        'available_stations' => $available,
        'availability_percentage' => $total > 0 ? (int)round(($available / $total) * 100) : 0,
    ];
}

$stationStmt = $pdo->query(
    'SELECT
        fs.station_id,
        fs.station_name,
        fs.location,
        fs.approval_status,
        COALESCE(qs.queue_length, 0) AS queue_length,
        COALESCE(qs.waiting_time, 0) AS waiting_time,
        qs.updated_at AS queue_updated_at,
        COALESCE(petrol.is_available, 0) AS petrol_available,
        COALESCE(diesel.is_available, 0) AS diesel_available
     FROM fuel_stations fs
     LEFT JOIN queue_status qs ON qs.station_id = fs.station_id
     LEFT JOIN fuel_availability petrol ON petrol.station_id = fs.station_id AND petrol.fuel_type_id = 1
     LEFT JOIN fuel_availability diesel ON diesel.station_id = fs.station_id AND diesel.fuel_type_id = 2
     WHERE fs.approval_status = "approved"
     ORDER BY qs.queue_length DESC, qs.updated_at DESC
     LIMIT 12'
);

$activeStations = [];
foreach ($stationStmt->fetchAll() as $row) {
    $petrol = (bool)(int)$row['petrol_available'];
    $diesel = (bool)(int)$row['diesel_available'];
    $queueLength = (int)$row['queue_length'];
    $waitingTime = (int)$row['waiting_time'];

    $activeStations[] = [
        'station_id' => (int)$row['station_id'],
        'station_name' => (string)$row['station_name'],
        'location' => (string)($row['location'] ?? ''),
        'approval_status' => (string)$row['approval_status'],
        'queue_length' => $queueLength,
        'waiting_time' => $waitingTime,
        'status' => admin_station_status($petrol, $diesel, $queueLength),
        'wait_badge' => admin_wait_badge($waitingTime),
        'fuel_availability' => [
            'petrol' => $petrol,
            'diesel' => $diesel,
        ],
        'queue_updated_at' => $row['queue_updated_at'],
    ];
}

json_response(200, [
    'ok' => true,
    'data' => [
        'summary' => [
            'total_users' => (int)($summary['total_users'] ?? 0),
            'total_stations' => (int)($summary['total_stations'] ?? 0),
            'total_reports' => (int)($summary['total_reports'] ?? 0),
            'active_queues' => (int)($summary['active_queues'] ?? 0),
        ],
        'badges' => [
            'pending_stations' => (int)($summary['pending_stations'] ?? 0),
            'pending_reports' => (int)($summary['pending_reports'] ?? 0),
            'open_alerts' => (int)($summary['open_alerts'] ?? 0),
        ],
        'fuel_availability' => $fuelAvailability,
        'active_stations' => $activeStations,
        'generated_at' => date('c'),
    ],
]);
