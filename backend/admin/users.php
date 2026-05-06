<?php
declare(strict_types=1);

/**
 * Admin API: List all users with filtering, searching, and pagination
 * GET /backend/admin/users.php?page=1&limit=10&search=&role=&status=
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
$role = trim((string)($_GET['role'] ?? '')); // customer, owner, admin or empty for all
$status = trim((string)($_GET['status'] ?? '')); // active, suspended or empty for all

// Build query with filters
$where = [];
$params = [];

if ($search !== '') {
    $where[] = "(u.name LIKE ? OR u.email LIKE ? OR u.national_id LIKE ?)";
    $searchTerm = "%{$search}%";
    $params[] = $searchTerm;
    $params[] = $searchTerm;
    $params[] = $searchTerm;
}

if ($role !== '' && in_array($role, ['customer', 'owner', 'admin'], true)) {
    $where[] = "u.role = ?";
    $params[] = $role;
}

if ($status === 'active') {
    $where[] = "u.is_active = 1";
} elseif ($status === 'suspended') {
    $where[] = "u.is_active = 0";
}

$whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

// Get total count
$countSql = "SELECT COUNT(*) as total FROM users u {$whereClause}";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$totalCount = (int)$countStmt->fetch()['total'];
$totalPages = ceil($totalCount / $limit);

// Get paginated results
$sql = <<<SQL
SELECT
  u.user_id,
  u.name,
  u.email,
  u.national_id,
  u.role,
  u.is_active,
  u.created_at,
  u.suspension_reason,
  u.suspended_at,
  COUNT(DISTINCT fs.station_id) as station_count
FROM users u
LEFT JOIN fuel_stations fs ON fs.owner_user_id = u.user_id
{$whereClause}
GROUP BY u.user_id
ORDER BY u.created_at DESC
LIMIT {$limit} OFFSET {$offset}
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$users = $stmt->fetchAll();

$out = [];
foreach ($users as $u) {
    $out[] = [
        'user_id' => (int)$u['user_id'],
        'name' => (string)$u['name'],
        'email' => (string)$u['email'],
        'national_id' => (string)$u['national_id'],
        'role' => (string)$u['role'],
        'is_active' => (bool)(int)$u['is_active'],
        'status' => (int)$u['is_active'] === 1 ? 'active' : 'suspended',
        'station_count' => (int)$u['station_count'],
        'created_at' => (string)$u['created_at'],
        'suspension_reason' => $u['suspension_reason'],
        'suspended_at' => $u['suspended_at'],
    ];
}

json_response(200, [
    'ok' => true,
    'users' => $out,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total_count' => $totalCount,
        'total_pages' => $totalPages,
        'has_next' => $page < $totalPages,
        'has_prev' => $page > 1,
    ],
]);
