<?php
declare(strict_types=1);

/**
 * Admin API: List all reports with filtering and status
 * GET /backend/admin/reports.php?page=1&limit=10&search=&status=&severity=
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
$status = trim((string)($_GET['status'] ?? '')); // pending, reviewed, resolved, spam
$station = trim((string)($_GET['station'] ?? ''));

$where = [];
$params = [];

if ($search !== '') {
    $where[] = "(r.comment LIKE ? OR u.name LIKE ? OR u.email LIKE ?)";
    $searchTerm = "%{$search}%";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
}

if ($status !== '' && in_array($status, ['pending', 'reviewed', 'resolved', 'spam'], true)) {
    $where[] = "r.report_status = ?";
    $params[] = $status;
}

if ($station !== '') {
    $where[] = "r.station_id = ?";
    $params[] = (int)$station;
}

$whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

// Get total count
$countSql = "SELECT COUNT(*) as total FROM reports r {$whereClause}";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$totalCount = (int)$countStmt->fetch()['total'];
$totalPages = ceil($totalCount / $limit);

// Get paginated results
$sql = <<<SQL
SELECT
  r.report_id,
  r.comment,
  r.queue_length,
  r.waiting_time,
  r.image_path,
  r.report_status,
  r.admin_notes,
  r.created_at,
  r.reviewed_at,
  u.user_id,
  u.name as reporter_name,
  u.email as reporter_email,
  fs.station_id,
  fs.station_name,
  ft.fuel_name,
  admin.name as reviewer_name
FROM reports r
LEFT JOIN users u ON u.user_id = r.user_id
LEFT JOIN fuel_stations fs ON fs.station_id = r.station_id
LEFT JOIN fuel_types ft ON ft.fuel_type_id = r.fuel_type_id
LEFT JOIN users admin ON admin.user_id = r.reviewed_by
{$whereClause}
ORDER BY 
  CASE WHEN r.report_status = 'pending' THEN 0 WHEN r.report_status = 'spam' THEN 1 ELSE 2 END,
  r.created_at DESC
LIMIT {$limit} OFFSET {$offset}
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$reports = $stmt->fetchAll();

$out = [];
foreach ($reports as $r) {
    $out[] = [
        'report_id' => (int)$r['report_id'],
        'comment' => (string)$r['comment'],
        'queue_length' => $r['queue_length'],
        'waiting_time' => $r['waiting_time'],
        'image_path' => $r['image_path'],
        'fuel_type' => $r['fuel_name'],
        'status' => (string)$r['report_status'],
        'admin_notes' => $r['admin_notes'],
        'created_at' => (string)$r['created_at'],
        'reviewed_at' => $r['reviewed_at'],
        'reporter' => [
            'user_id' => (int)$r['user_id'],
            'name' => (string)$r['reporter_name'],
            'email' => (string)$r['reporter_email'],
        ],
        'station' => $r['station_id'] ? [
            'station_id' => (int)$r['station_id'],
            'station_name' => (string)$r['station_name'],
        ] : null,
        'reviewed_by' => $r['reviewer_name'],
    ];
}

json_response(200, [
    'ok' => true,
    'reports' => $out,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total_count' => $totalCount,
        'total_pages' => $totalPages,
        'has_next' => $page < $totalPages,
        'has_prev' => $page > 1,
    ],
]);
