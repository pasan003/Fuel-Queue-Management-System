<?php
declare(strict_types=1);

/**
 * Admin API: Global search across users, stations, and reports.
 * GET /backend/admin/search.php?q=&limit=5
 */

require __DIR__ . '/../config.php';

require_admin_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

$query = trim((string)($_GET['q'] ?? ''));
$limit = min(10, max(3, (int)($_GET['limit'] ?? 5)));

if ($query === '') {
    json_response(200, [
        'ok' => true,
        'data' => [
            'query' => '',
            'users' => [],
            'stations' => [],
            'reports' => [],
        ],
    ]);
}

if (strlen($query) > 80) {
    $query = substr($query, 0, 80);
}

$like = '%' . $query . '%';

$userStmt = $pdo->prepare(
    "SELECT user_id, name, email, role, is_active
     FROM users
     WHERE name LIKE ? OR email LIKE ? OR national_id LIKE ?
     ORDER BY created_at DESC
     LIMIT {$limit}"
);
$userStmt->execute([$like, $like, $like]);

$stationStmt = $pdo->prepare(
    "SELECT fs.station_id, fs.station_name, fs.location, fs.approval_status, u.name AS owner_name
     FROM fuel_stations fs
     LEFT JOIN users u ON u.user_id = fs.owner_user_id
     WHERE fs.station_name LIKE ? OR fs.location LIKE ? OR u.name LIKE ? OR u.email LIKE ?
     ORDER BY
       CASE WHEN fs.approval_status = 'pending' THEN 0 ELSE 1 END,
       fs.created_at DESC
     LIMIT {$limit}"
);
$stationStmt->execute([$like, $like, $like, $like]);

$reportStmt = $pdo->prepare(
    "SELECT r.report_id, r.comment, r.report_status, r.created_at, u.name AS reporter_name, fs.station_name
     FROM reports r
     LEFT JOIN users u ON u.user_id = r.user_id
     LEFT JOIN fuel_stations fs ON fs.station_id = r.station_id
     WHERE r.comment LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR fs.station_name LIKE ?
     ORDER BY
       CASE WHEN r.report_status = 'pending' THEN 0 ELSE 1 END,
       r.created_at DESC
     LIMIT {$limit}"
);
$reportStmt->execute([$like, $like, $like, $like]);

$users = [];
foreach ($userStmt->fetchAll() as $row) {
    $users[] = [
        'id' => (int)$row['user_id'],
        'title' => (string)$row['name'],
        'subtitle' => (string)$row['email'],
        'meta' => (string)$row['role'],
        'status' => (int)$row['is_active'] === 1 ? 'active' : 'suspended',
    ];
}

$stations = [];
foreach ($stationStmt->fetchAll() as $row) {
    $stations[] = [
        'id' => (int)$row['station_id'],
        'title' => (string)$row['station_name'],
        'subtitle' => (string)($row['location'] ?? ''),
        'meta' => (string)($row['owner_name'] ?? 'No owner'),
        'status' => (string)$row['approval_status'],
    ];
}

$reports = [];
foreach ($reportStmt->fetchAll() as $row) {
    $comment = trim((string)($row['comment'] ?? ''));
    $reports[] = [
        'id' => (int)$row['report_id'],
        'title' => 'Report #' . (int)$row['report_id'],
        'subtitle' => strlen($comment) > 90 ? substr($comment, 0, 90) . '...' : $comment,
        'meta' => trim((string)($row['reporter_name'] ?? 'Unknown') . ' / ' . (string)($row['station_name'] ?? 'No station')),
        'status' => (string)$row['report_status'],
        'created_at' => $row['created_at'],
    ];
}

json_response(200, [
    'ok' => true,
    'data' => [
        'query' => $query,
        'users' => $users,
        'stations' => $stations,
        'reports' => $reports,
    ],
]);
