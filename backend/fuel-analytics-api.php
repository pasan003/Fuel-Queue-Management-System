<?php
declare(strict_types=1);

/**
 * Fuel Analytics API - User fuel statistics and trends
 * GET: Returns comprehensive fuel analytics for the logged-in user
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

$user_id = (int)$_SESSION['user_id'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'GET') {
    json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
}

// Get filter parameters
$month = isset($_GET['month']) ? (int)$_GET['month'] : null;
$year = isset($_GET['year']) ? (int)$_GET['year'] : null;

// Build date filter clause
$dateFilter = '';
$dateParams = [];

if ($month !== null && $year !== null) {
    $dateFilter = 'WHERE YEAR(ffl.created_at) = ? AND MONTH(ffl.created_at) = ?';
    $dateParams = [$year, $month];
    $periodLabel = sprintf('%02d/%d', $month, $year);
} else {
    $dateFilter = '';
    $dateParams = [];
    $periodLabel = 'All Time';
}

// ===================================================================
// TOTAL METRICS
// ===================================================================
$sql = "SELECT
  COUNT(*) as total_logs,
  SUM(ffl.liters) as total_liters,
  SUM(ffl.total_cost) as total_spent,
  AVG(ffl.fuel_efficiency) as avg_efficiency,
  SUM(ffl.distance_traveled) as total_distance,
  MAX(ffl.fuel_efficiency) as max_efficiency,
  MIN(ffl.fuel_efficiency) as min_efficiency
FROM fuel_usage_logs ffl
WHERE ffl.user_id = ? {$dateFilter}";

$params = array_merge([$user_id], $dateParams);
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$metrics = $stmt->fetch();

// ===================================================================
// FUEL TYPE BREAKDOWN
// ===================================================================
$fuelSql = "SELECT
  ft.fuel_type_id,
  ft.fuel_name,
  COUNT(*) as count,
  SUM(ffl.liters) as total_liters,
  SUM(ffl.total_cost) as total_cost,
  AVG(ffl.price_per_liter) as avg_price
FROM fuel_usage_logs ffl
JOIN fuel_types ft ON ft.fuel_type_id = ffl.fuel_type_id
WHERE ffl.user_id = ? {$dateFilter}
GROUP BY ft.fuel_type_id, ft.fuel_name
ORDER BY total_liters DESC";

$fuelStmt = $pdo->prepare($fuelSql);
$fuelStmt->execute($params);
$fuelBreakdown = [];

foreach ($fuelStmt->fetchAll() as $row) {
    $fuelBreakdown[] = [
        'fuel_type_id' => (int)$row['fuel_type_id'],
        'fuel_name' => (string)$row['fuel_name'],
        'count' => (int)$row['count'],
        'total_liters' => (float)$row['total_liters'],
        'total_cost' => (float)$row['total_cost'],
        'avg_price' => (float)($row['avg_price'] ?? 0),
    ];
}

// ===================================================================
// MONTHLY TREND (last 12 months)
// ===================================================================
$monthlySql = "SELECT
  DATE_TRUNC('month', ffl.created_at) as month,
  YEAR(ffl.created_at) as year,
  COUNT(*) as logs,
  SUM(ffl.liters) as liters,
  SUM(ffl.total_cost) as cost,
  AVG(ffl.fuel_efficiency) as avg_efficiency
FROM fuel_usage_logs ffl
WHERE ffl.user_id = ? AND ffl.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY YEAR(ffl.created_at), MONTH(ffl.created_at)
ORDER BY ffl.created_at DESC";

// MySQL doesn't have DATE_TRUNC, use date formatting instead
$monthlySql = "SELECT
  DATE_FORMAT(ffl.created_at, '%Y-%m') as month,
  YEAR(ffl.created_at) as year,
  MONTH(ffl.created_at) as month_num,
  COUNT(*) as logs,
  SUM(ffl.liters) as liters,
  SUM(ffl.total_cost) as cost,
  AVG(ffl.fuel_efficiency) as avg_efficiency
FROM fuel_usage_logs ffl
WHERE ffl.user_id = ? AND ffl.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY YEAR(ffl.created_at), MONTH(ffl.created_at)
ORDER BY year DESC, month_num DESC";

$monthlyStmt = $pdo->prepare($monthlySql);
$monthlyStmt->execute([$user_id]);
$monthlyTrend = [];

foreach ($monthlyStmt->fetchAll() as $row) {
    $monthlyTrend[] = [
        'month' => (string)$row['month'],
        'year' => (int)$row['year'],
        'month_num' => (int)$row['month_num'],
        'logs' => (int)$row['logs'],
        'liters' => (float)$row['liters'],
        'cost' => (float)$row['cost'],
        'avg_efficiency' => $row['avg_efficiency'] !== null ? (float)$row['avg_efficiency'] : null,
    ];
}

// Reverse to ascending order for charting
$monthlyTrend = array_reverse($monthlyTrend);

// ===================================================================
// RECENT LOGS (latest 5)
// ===================================================================
$recentSql = "SELECT
  ffl.log_id,
  ffl.fuel_type_id,
  ft.fuel_name,
  ffl.liters,
  ffl.price_per_liter,
  ffl.total_cost,
  ffl.fuel_efficiency,
  ffl.created_at,
  fs.station_name
FROM fuel_usage_logs ffl
LEFT JOIN fuel_types ft ON ft.fuel_type_id = ffl.fuel_type_id
LEFT JOIN fuel_stations fs ON fs.station_id = ffl.station_id
WHERE ffl.user_id = ?
ORDER BY ffl.created_at DESC
LIMIT 5";

$recentStmt = $pdo->prepare($recentSql);
$recentStmt->execute([$user_id]);
$recentLogs = [];

foreach ($recentStmt->fetchAll() as $row) {
    $recentLogs[] = [
        'log_id' => (int)$row['log_id'],
        'fuel_type_id' => (int)$row['fuel_type_id'],
        'fuel_name' => (string)($row['fuel_name'] ?? ''),
        'liters' => (float)$row['liters'],
        'price_per_liter' => (float)$row['price_per_liter'],
        'total_cost' => (float)$row['total_cost'],
        'fuel_efficiency' => $row['fuel_efficiency'] !== null ? (float)$row['fuel_efficiency'] : null,
        'station_name' => $row['station_name'] !== null ? (string)$row['station_name'] : null,
        'created_at' => (string)$row['created_at'],
    ];
}

// ===================================================================
// RESPONSE
// ===================================================================
json_response(200, [
    'ok' => true,
    'period' => $periodLabel,
    'metrics' => [
        'total_logs' => $metrics['total_logs'] !== null ? (int)$metrics['total_logs'] : 0,
        'total_liters' => $metrics['total_liters'] !== null ? (float)$metrics['total_liters'] : 0,
        'total_spent' => $metrics['total_spent'] !== null ? (float)$metrics['total_spent'] : 0,
        'avg_efficiency' => $metrics['avg_efficiency'] !== null ? round((float)$metrics['avg_efficiency'], 2) : null,
        'total_distance' => $metrics['total_distance'] !== null ? (int)$metrics['total_distance'] : 0,
        'max_efficiency' => $metrics['max_efficiency'] !== null ? (float)$metrics['max_efficiency'] : null,
        'min_efficiency' => $metrics['min_efficiency'] !== null ? (float)$metrics['min_efficiency'] : null,
        'avg_cost_per_liter' => $metrics['total_liters'] > 0 && $metrics['total_spent'] > 0
            ? round((float)$metrics['total_spent'] / (float)$metrics['total_liters'], 2)
            : null,
    ],
    'fuel_breakdown' => $fuelBreakdown,
    'monthly_trend' => $monthlyTrend,
    'recent_logs' => $recentLogs,
]);
