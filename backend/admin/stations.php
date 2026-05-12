<?php
declare(strict_types=1);

/**
 * Admin API: List all fuel stations with approval workflow
 * GET /backend/admin/stations.php?page=1&limit=10&search=&approval_status=
 */

require __DIR__ . '/../config.php';

require_admin_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

// Pagination
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

// Filters
$search = trim((string)($_GET['search'] ?? ''));
$approvalStatus = trim((string)($_GET['approval_status'] ?? '')); // pending, approved, rejected or empty

$where = [];
$params = [];

if ($search !== '') {
    $where[] = "(fs.station_name LIKE ? OR fs.location LIKE ?)";
    $searchTerm = "%{$search}%";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
}

if ($approvalStatus !== '' && in_array($approvalStatus, ['pending', 'approved', 'rejected'], true)) {
    $where[] = "fs.approval_status = ?";
    $params[] = $approvalStatus;
}

$whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

// Get total count
$countSql = "SELECT COUNT(*) as total FROM fuel_stations fs {$whereClause}";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$totalCount = (int)$countStmt->fetch()['total'];
$totalPages = ceil($totalCount / $limit);

// Get paginated results with owner and fuel info
$sql = <<<SQL
SELECT
  fs.station_id,
  fs.station_name,
  fs.location,
  fs.approval_status,
  fs.created_at,
  fs.approved_at,
  u.user_id,
  u.name as owner_name,
  u.email as owner_email,
  COALESCE(qs.queue_length, 0) as queue_length,
  COALESCE(qs.waiting_time, 0) as waiting_time,
  COALESCE(petrol.is_available, 0) as petrol_available,
  COALESCE(diesel.is_available, 0) as diesel_available
FROM fuel_stations fs
LEFT JOIN users u ON u.user_id = fs.owner_user_id
LEFT JOIN queue_status qs ON qs.station_id = fs.station_id
LEFT JOIN fuel_availability petrol ON petrol.station_id = fs.station_id AND petrol.fuel_type_id = 1
LEFT JOIN fuel_availability diesel ON diesel.station_id = fs.station_id AND diesel.fuel_type_id = 2
{$whereClause}
ORDER BY 
  CASE WHEN fs.approval_status = 'pending' THEN 0 ELSE 1 END,
  fs.created_at DESC
LIMIT {$limit} OFFSET {$offset}
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$stations = $stmt->fetchAll();

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

$out = [];
foreach ($stations as $s) {
    $petrol = (bool)(int)$s['petrol_available'];
    $diesel = (bool)(int)$s['diesel_available'];
    $queueLength = (int)$s['queue_length'];
    $waitingTime = (int)$s['waiting_time'];

    $out[] = [
        'station_id' => (int)$s['station_id'],
        'station_name' => (string)$s['station_name'],
        'location' => (string)$s['location'],
        'approval_status' => (string)$s['approval_status'],
        'status' => admin_station_status($petrol, $diesel, $queueLength),
        'created_at' => (string)$s['created_at'],
        'approved_at' => $s['approved_at'],
        'owner' => $s['user_id'] ? [
            'user_id' => (int)$s['user_id'],
            'name' => (string)$s['owner_name'],
            'email' => (string)$s['owner_email'],
        ] : null,
        'queue_length' => $queueLength,
        'waiting_time' => $waitingTime,
        'wait_badge' => admin_wait_badge($waitingTime),
        'fuel_availability' => [
            'petrol' => $petrol,
            'diesel' => $diesel,
        ],
    ];
}

json_response(200, [
    'ok' => true,
    'stations' => $out,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total_count' => $totalCount,
        'total_pages' => $totalPages,
        'has_next' => $page < $totalPages,
        'has_prev' => $page > 1,
    ],
]);
