<?php
declare(strict_types=1);

/**
 * Admin API: Alerts - suspicious activity and system alerts
 * GET /backend/admin/alerts.php?page=1&limit=20&acknowledged=
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

// Filters - default to unacknowledged only
$acknowledged = trim((string)($_GET['acknowledged'] ?? ''));

$where = [];
$params = [];

if ($acknowledged === '' || $acknowledged === 'false' || $acknowledged === '0') {
    $where[] = "aa.is_acknowledged = 0";
} elseif ($acknowledged === 'true' || $acknowledged === '1') {
    $where[] = "aa.is_acknowledged = 1";
}
// else: show all if explicitly requested

$whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

// Get total count
$countSql = "SELECT COUNT(*) as total FROM admin_alerts aa {$whereClause}";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$totalCount = (int)$countStmt->fetch()['total'];
$totalPages = ceil($totalCount / $limit);

// Get paginated results
$sql = <<<SQL
SELECT
  aa.alert_id,
  aa.alert_type,
  aa.severity,
  aa.title,
  aa.message,
  aa.entity_type,
  aa.entity_id,
  aa.is_acknowledged,
  aa.created_at,
  u.user_id,
  u.name as acknowledged_by_name,
  u.email as acknowledged_by_email,
  aa.acknowledged_at
FROM admin_alerts aa
LEFT JOIN users u ON u.user_id = aa.acknowledged_by
{$whereClause}
ORDER BY 
  CASE WHEN aa.is_acknowledged = 0 THEN 0 ELSE 1 END,
  CASE WHEN aa.severity = 'critical' THEN 0 WHEN aa.severity = 'high' THEN 1 WHEN aa.severity = 'medium' THEN 2 ELSE 3 END,
  aa.created_at DESC
LIMIT {$limit} OFFSET {$offset}
SQL;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$alerts = $stmt->fetchAll();

$out = [];
foreach ($alerts as $a) {
    $out[] = [
        'alert_id' => (int)$a['alert_id'],
        'alert_type' => (string)$a['alert_type'],
        'severity' => (string)$a['severity'],
        'title' => (string)$a['title'],
        'message' => (string)$a['message'],
        'entity_type' => $a['entity_type'],
        'entity_id' => $a['entity_id'],
        'is_acknowledged' => (bool)(int)$a['is_acknowledged'],
        'created_at' => (string)$a['created_at'],
        'acknowledged_by' => $a['user_id'] ? [
            'user_id' => (int)$a['user_id'],
            'name' => (string)$a['acknowledged_by_name'],
            'email' => (string)$a['acknowledged_by_email'],
        ] : null,
        'acknowledged_at' => $a['acknowledged_at'],
    ];
}

json_response(200, [
    'ok' => true,
    'alerts' => $out,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total_count' => $totalCount,
        'total_pages' => $totalPages,
        'has_next' => $page < $totalPages,
        'has_prev' => $page > 1,
    ],
]);
