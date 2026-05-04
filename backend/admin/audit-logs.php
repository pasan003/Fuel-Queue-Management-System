<?php
declare(strict_types=1);

/**
 * Admin API: Audit logs - track all admin actions
 * GET /backend/admin/audit-logs.php?page=1&limit=20&action=&user=
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
$actionType = trim((string)($_GET['action'] ?? ''));
$adminUserId = (int)($_GET['user'] ?? 0);

$where = [];
$params = [];

if ($actionType !== '') {
    $where[] = "al.action_type = ?";
    $params[] = $actionType;
}

if ($adminUserId > 0) {
    $where[] = "al.admin_user_id = ?";
    $params[] = $adminUserId;
}

$whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

// Get total count
$countSql = "SELECT COUNT(*) as total FROM audit_logs al {$whereClause}";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$totalCount = (int)$countStmt->fetch()['total'];
$totalPages = ceil($totalCount / $limit);

// Get paginated results
$sql = <<<SQL
SELECT
  al.log_id,
  al.admin_user_id,
  al.action_type,
  al.entity_type,
  al.entity_id,
  al.description,
  al.old_value,
  al.new_value,
  al.ip_address,
  al.created_at,
  u.name as admin_name,
  u.email as admin_email
FROM audit_logs al
LEFT JOIN users u ON u.user_id = al.admin_user_id
{$whereClause}
ORDER BY al.created_at DESC
LIMIT {$limit} OFFSET {$offset}
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$logs = $stmt->fetchAll();

$out = [];
foreach ($logs as $log) {
    $out[] = [
        'log_id' => (int)$log['log_id'],
        'action_type' => (string)$log['action_type'],
        'entity_type' => (string)$log['entity_type'],
        'entity_id' => $log['entity_id'],
        'description' => (string)$log['description'],
        'old_value' => $log['old_value'] ? json_decode($log['old_value'], true) : null,
        'new_value' => $log['new_value'] ? json_decode($log['new_value'], true) : null,
        'ip_address' => $log['ip_address'],
        'created_at' => (string)$log['created_at'],
        'admin' => [
            'user_id' => (int)$log['admin_user_id'],
            'name' => (string)$log['admin_name'],
            'email' => (string)$log['admin_email'],
        ],
    ];
}

json_response(200, [
    'ok' => true,
    'logs' => $out,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total_count' => $totalCount,
        'total_pages' => $totalPages,
        'has_next' => $page < $totalPages,
        'has_prev' => $page > 1,
    ],
]);
