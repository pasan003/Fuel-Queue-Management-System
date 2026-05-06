<?php
declare(strict_types=1);

/**
 * Admin API: Export data as CSV
 * GET /backend/admin/export.php?type=users|stations|reports
 */

require __DIR__ . '/../config.php';

require_admin_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

$exportType = trim((string)($_GET['type'] ?? ''));

if (!in_array($exportType, ['users', 'stations', 'reports'], true)) {
    json_response(400, ['ok' => false, 'message' => 'Invalid export type']);
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="export_' . $exportType . '_' . date('Y-m-d_His') . '.csv"');

$output = fopen('php://output', 'w');

if ($exportType === 'users') {
    fputcsv($output, [
        'User ID',
        'Name',
        'Email',
        'National ID',
        'Role',
        'Status',
        'Stations Managed',
        'Created At',
        'Suspended At',
        'Suspension Reason',
    ]);

    $stmt = $pdo->query(
        'SELECT 
           u.user_id, u.name, u.email, u.national_id, u.role, 
           CASE WHEN u.is_active = 1 THEN "Active" ELSE "Suspended" END as status,
           COUNT(DISTINCT fs.station_id) as station_count,
           u.created_at, u.suspended_at, u.suspension_reason
         FROM users u
         LEFT JOIN fuel_stations fs ON fs.owner_user_id = u.user_id
         GROUP BY u.user_id
         ORDER BY u.created_at DESC'
    );

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        fputcsv($output, [
            $row['user_id'],
            $row['name'],
            $row['email'],
            $row['national_id'],
            $row['role'],
            $row['status'],
            $row['station_count'],
            $row['created_at'],
            $row['suspended_at'],
            $row['suspension_reason'],
        ]);
    }

} elseif ($exportType === 'stations') {
    fputcsv($output, [
        'Station ID',
        'Station Name',
        'Location',
        'Owner Name',
        'Owner Email',
        'Approval Status',
        'Queue Length',
        'Waiting Time',
        'Petrol Available',
        'Diesel Available',
        'Created At',
        'Approved At',
    ]);

    $stmt = $pdo->query(
        'SELECT 
           fs.station_id, fs.station_name, fs.location, u.name, u.email,
           fs.approval_status,
           COALESCE(qs.queue_length, 0) as queue_length,
           COALESCE(qs.waiting_time, 0) as waiting_time,
           COALESCE(petrol.is_available, 0) as petrol,
           COALESCE(diesel.is_available, 0) as diesel,
           fs.created_at, fs.approved_at
         FROM fuel_stations fs
         LEFT JOIN users u ON u.user_id = fs.owner_user_id
         LEFT JOIN queue_status qs ON qs.station_id = fs.station_id
         LEFT JOIN fuel_availability petrol ON petrol.station_id = fs.station_id AND petrol.fuel_type_id = 1
         LEFT JOIN fuel_availability diesel ON diesel.station_id = fs.station_id AND diesel.fuel_type_id = 2
         ORDER BY fs.created_at DESC'
    );

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        fputcsv($output, [
            $row['station_id'],
            $row['station_name'],
            $row['location'],
            $row['name'],
            $row['email'],
            $row['approval_status'],
            $row['queue_length'],
            $row['waiting_time'],
            $row['petrol'] ? 'Yes' : 'No',
            $row['diesel'] ? 'Yes' : 'No',
            $row['created_at'],
            $row['approved_at'],
        ]);
    }

} elseif ($exportType === 'reports') {
    fputcsv($output, [
        'Report ID',
        'Reporter Name',
        'Reporter Email',
        'Station Name',
        'Comment',
        'Queue Length',
        'Waiting Time',
        'Fuel Type',
        'Status',
        'Admin Notes',
        'Created At',
        'Reviewed At',
    ]);

    $stmt = $pdo->query(
        'SELECT 
           r.report_id, u.name, u.email, fs.station_name,
           r.comment, r.queue_length, r.waiting_time, ft.fuel_name,
           r.report_status, r.admin_notes, r.created_at, r.reviewed_at
         FROM reports r
         LEFT JOIN users u ON u.user_id = r.user_id
         LEFT JOIN fuel_stations fs ON fs.station_id = r.station_id
         LEFT JOIN fuel_types ft ON ft.fuel_type_id = r.fuel_type_id
         ORDER BY r.created_at DESC'
    );

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        fputcsv($output, [
            $row['report_id'],
            $row['name'],
            $row['email'],
            $row['station_name'],
            $row['comment'],
            $row['queue_length'],
            $row['waiting_time'],
            $row['fuel_name'],
            $row['report_status'],
            $row['admin_notes'],
            $row['created_at'],
            $row['reviewed_at'],
        ]);
    }
}

fclose($output);
exit;
