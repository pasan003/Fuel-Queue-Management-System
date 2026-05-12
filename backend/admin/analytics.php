<?php
declare(strict_types=1);

/**
 * Admin API: Aggregated analytics for Chart.js.
 * GET /backend/admin/analytics.php
 */

require __DIR__ . '/../config.php';

require_admin_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

function admin_table_exists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare('SHOW TABLES LIKE ?');
    $stmt->execute([$table]);
    return (bool)$stmt->fetchColumn();
}

$hasQueueHistory = admin_table_exists($pdo, 'queue_history');

if ($hasQueueHistory) {
    $queueTrendSql = <<<SQL
SELECT DATE_FORMAT(created_at, '%H:00') AS label,
       ROUND(AVG(queue_length), 1) AS avg_queue,
       ROUND(AVG(waiting_time), 1) AS avg_wait,
       COUNT(*) AS updates
FROM queue_history
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H'), label
ORDER BY MIN(created_at)
SQL;

    $peakHoursSql = <<<SQL
SELECT HOUR(created_at) AS hour,
       ROUND(AVG(queue_length), 1) AS avg_queue,
       COUNT(*) AS updates
FROM queue_history
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY HOUR(created_at)
ORDER BY hour
SQL;
} else {
    $queueTrendSql = <<<SQL
SELECT DATE_FORMAT(updated_at, '%H:00') AS label,
       ROUND(AVG(queue_length), 1) AS avg_queue,
       ROUND(AVG(waiting_time), 1) AS avg_wait,
       COUNT(*) AS updates
FROM queue_status
WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(updated_at, '%Y-%m-%d %H'), label
ORDER BY MIN(updated_at)
SQL;

    $peakHoursSql = <<<SQL
SELECT HOUR(updated_at) AS hour,
       ROUND(AVG(queue_length), 1) AS avg_queue,
       COUNT(*) AS updates
FROM queue_status
GROUP BY HOUR(updated_at)
ORDER BY hour
SQL;
}

$queueTrends = $pdo->query($queueTrendSql)->fetchAll();
$peakHours = $pdo->query($peakHoursSql)->fetchAll();

$fuelAvailability = $pdo->query(
    'SELECT ft.fuel_name AS fuel,
            COUNT(fa.availability_id) AS total_stations,
            COALESCE(SUM(fa.is_available), 0) AS available_stations,
            COUNT(fa.availability_id) - COALESCE(SUM(fa.is_available), 0) AS unavailable_stations
     FROM fuel_types ft
     LEFT JOIN fuel_availability fa ON fa.fuel_type_id = ft.fuel_type_id
     GROUP BY ft.fuel_type_id, ft.fuel_name
     ORDER BY ft.fuel_type_id'
)->fetchAll();

$userDistribution = $pdo->query(
    'SELECT role, COUNT(*) AS count
     FROM users
     GROUP BY role
     ORDER BY FIELD(role, "customer", "owner", "admin")'
)->fetchAll();

$reportsOverview = $pdo->query(
    'SELECT report_status AS status, COUNT(*) AS count
     FROM reports
     GROUP BY report_status
     ORDER BY FIELD(report_status, "pending", "reviewed", "resolved", "spam")'
)->fetchAll();

$stationStatus = $pdo->query(
    'SELECT
        SUM(CASE WHEN COALESCE(p.is_available, 0) = 1 AND COALESCE(d.is_available, 0) = 1 AND COALESCE(q.queue_length, 0) < 10 THEN 1 ELSE 0 END) AS available,
        SUM(CASE WHEN (COALESCE(p.is_available, 0) = 1 OR COALESCE(d.is_available, 0) = 1)
             AND NOT (COALESCE(p.is_available, 0) = 1 AND COALESCE(d.is_available, 0) = 1 AND COALESCE(q.queue_length, 0) < 10) THEN 1 ELSE 0 END) AS limited,
        SUM(CASE WHEN COALESCE(p.is_available, 0) = 0 AND COALESCE(d.is_available, 0) = 0 THEN 1 ELSE 0 END) AS no_fuel
     FROM fuel_stations fs
     LEFT JOIN queue_status q ON q.station_id = fs.station_id
     LEFT JOIN fuel_availability p ON p.station_id = fs.station_id AND p.fuel_type_id = 1
     LEFT JOIN fuel_availability d ON d.station_id = fs.station_id AND d.fuel_type_id = 2
     WHERE fs.approval_status = "approved"'
)->fetch();

json_response(200, [
    'ok' => true,
    'data' => [
        'queue_trends' => $queueTrends,
        'fuel_availability' => $fuelAvailability,
        'active_users' => $userDistribution,
        'peak_queue_hours' => $peakHours,
        'reports_overview' => $reportsOverview,
        'station_status' => [
            'available' => (int)($stationStatus['available'] ?? 0),
            'limited' => (int)($stationStatus['limited'] ?? 0),
            'no_fuel' => (int)($stationStatus['no_fuel'] ?? 0),
        ],
        'source' => [
            'queue_history_enabled' => $hasQueueHistory,
        ],
        'generated_at' => date('c'),
    ],
]);
