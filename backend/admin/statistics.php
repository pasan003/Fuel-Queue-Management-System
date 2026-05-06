<?php
declare(strict_types=1);

/**
 * Admin API: System statistics and dashboard metrics
 * GET /backend/admin/statistics.php
 * 
 * Returns:
 * - Total users, active users, suspended users
 * - User distribution by role
 * - Station stats (pending, approved, rejected)
 * - Reports stats (by status)
 * - Active queues (stations with queues > 0)
 * - Fuel availability trends
 * - Recent activity counts
 */

require __DIR__ . '/../config.php';

require_admin_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

// Get user statistics
$userStats = $pdo->query(
    'SELECT role, is_active, COUNT(*) as count FROM users GROUP BY role, is_active'
)->fetchAll();

$userSummary = [
    'total' => 0,
    'active' => 0,
    'suspended' => 0,
    'by_role' => [
        'customer' => 0,
        'owner' => 0,
        'admin' => 0,
    ],
];

foreach ($userStats as $row) {
    $role = (string)$row['role'];
    $count = (int)$row['count'];
    $userSummary['total'] += $count;

    if ((int)$row['is_active'] === 1) {
        $userSummary['active'] += $count;
    } else {
        $userSummary['suspended'] += $count;
    }

    if (isset($userSummary['by_role'][$role])) {
        $userSummary['by_role'][$role] += $count;
    }
}

// Get station statistics
$stationStats = $pdo->query(
    'SELECT approval_status, COUNT(*) as count FROM fuel_stations GROUP BY approval_status'
)->fetchAll();

$stationSummary = [
    'total' => 0,
    'pending' => 0,
    'approved' => 0,
    'rejected' => 0,
];

foreach ($stationStats as $row) {
    $count = (int)$row['count'];
    $stationSummary['total'] += $count;
    $status = (string)$row['approval_status'];
    if (isset($stationSummary[$status])) {
        $stationSummary[$status] = $count;
    }
}

// Get report statistics
$reportStats = $pdo->query(
    'SELECT report_status, COUNT(*) as count FROM reports GROUP BY report_status'
)->fetchAll();

$reportSummary = [
    'total' => 0,
    'pending' => 0,
    'reviewed' => 0,
    'resolved' => 0,
    'spam' => 0,
];

foreach ($reportStats as $row) {
    $count = (int)$row['count'];
    $reportSummary['total'] += $count;
    $status = (string)$row['report_status'];
    if (isset($reportSummary[$status])) {
        $reportSummary[$status] = $count;
    }
}

// Get active queues count (stations with queue_length > 0)
$activeQueues = $pdo->query(
    'SELECT COUNT(*) as count FROM queue_status WHERE queue_length > 0'
)->fetch();
$activeQueuesCount = (int)($activeQueues['count'] ?? 0);

// Get fuel availability summary
$fuelAvail = $pdo->query(
    'SELECT ft.fuel_name, COUNT(*) as total, SUM(fa.is_available) as available 
     FROM fuel_availability fa 
     JOIN fuel_types ft ON ft.fuel_type_id = fa.fuel_type_id 
     GROUP BY fa.fuel_type_id, ft.fuel_name'
)->fetchAll();

$fuelSummary = [];
foreach ($fuelAvail as $row) {
    $fuelSummary[(string)$row['fuel_name']] = [
        'total_stations' => (int)$row['total'],
        'available_stations' => (int)$row['available'],
        'availability_percentage' => (int)$row['total'] > 0 
            ? (int)(((int)$row['available'] / (int)$row['total']) * 100)
            : 0,
    ];
}

// Get audit logs summary (last 7 days)
$auditLogs = $pdo->query(
    'SELECT action_type, COUNT(*) as count 
     FROM audit_logs 
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY action_type'
)->fetchAll();

$auditSummary = [];
foreach ($auditLogs as $row) {
    $auditSummary[(string)$row['action_type']] = (int)$row['count'];
}

// Get alerts summary (unacknowledged)
$alertStats = $pdo->query(
    'SELECT alert_type, severity, COUNT(*) as count 
     FROM admin_alerts 
     WHERE is_acknowledged = 0 
     GROUP BY alert_type, severity'
)->fetchAll();

$alertSummary = [
    'total_unacknowledged' => 0,
    'by_type' => [],
    'by_severity' => [
        'critical' => 0,
        'high' => 0,
        'medium' => 0,
        'low' => 0,
    ],
];

foreach ($alertStats as $row) {
    $count = (int)$row['count'];
    $alertSummary['total_unacknowledged'] += $count;
    
    $type = (string)$row['alert_type'];
    if (!isset($alertSummary['by_type'][$type])) {
        $alertSummary['by_type'][$type] = 0;
    }
    $alertSummary['by_type'][$type] += $count;

    $severity = (string)$row['severity'];
    if (isset($alertSummary['by_severity'][$severity])) {
        $alertSummary['by_severity'][$severity] += $count;
    }
}

// Get queue statistics
$queueStats = $pdo->query(
    'SELECT 
       COUNT(*) as total_stations,
       AVG(queue_length) as avg_queue,
       MAX(queue_length) as max_queue,
       MIN(queue_length) as min_queue,
       AVG(waiting_time) as avg_wait
     FROM queue_status'
)->fetch();

$queueSummary = [
    'total_stations_tracked' => (int)($queueStats['total_stations'] ?? 0),
    'average_queue_length' => round((float)($queueStats['avg_queue'] ?? 0), 2),
    'max_queue_length' => (int)($queueStats['max_queue'] ?? 0),
    'min_queue_length' => (int)($queueStats['min_queue'] ?? 0),
    'average_wait_time_minutes' => (int)($queueStats['avg_wait'] ?? 0),
];

// Get recent activity (last 24 hours)
$recentActivity = $pdo->query(
    'SELECT 
       (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as new_users,
       (SELECT COUNT(*) FROM fuel_stations WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as new_stations,
       (SELECT COUNT(*) FROM reports WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as new_reports,
       (SELECT COUNT(*) FROM audit_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as admin_actions'
)->fetch();

$activitySummary = [
    'new_users_24h' => (int)($recentActivity['new_users'] ?? 0),
    'new_stations_24h' => (int)($recentActivity['new_stations'] ?? 0),
    'new_reports_24h' => (int)($recentActivity['new_reports'] ?? 0),
    'admin_actions_24h' => (int)($recentActivity['admin_actions'] ?? 0),
];

json_response(200, [
    'ok' => true,
    'users' => $userSummary,
    'stations' => $stationSummary,
    'reports' => $reportSummary,
    'queues' => $queueSummary,
    'fuel_availability' => $fuelSummary,
    'active_queues_count' => $activeQueuesCount,
    'alerts' => $alertSummary,
    'recent_activity' => $activitySummary,
    'audit_logs_summary' => $auditSummary,
]);
