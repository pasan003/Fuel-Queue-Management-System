<?php
declare(strict_types=1);

/**
 * Admin API: Station actions (approve, reject)
 * POST /backend/admin/station-actions.php
 * 
 * Actions:
 * - approve: approve a pending station
 * - reject: reject a pending station
 */

require __DIR__ . '/../config.php';

require_admin_post();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

$action = trim((string)($_POST['action'] ?? ''));
$stationId = (int)($_POST['station_id'] ?? 0);
$reason = trim((string)($_POST['reason'] ?? '')); // For rejection
$adminId = get_current_user_id();

if (!$action) {
    json_response(400, ['ok' => false, 'message' => 'Action is required']);
}
if ($stationId <= 0) {
    json_response(400, ['ok' => false, 'message' => 'Valid station ID is required']);
}

// Get station details
$stationStmt = $pdo->prepare(
    'SELECT fs.station_id, fs.station_name, fs.approval_status, u.user_id, u.name, u.email 
     FROM fuel_stations fs LEFT JOIN users u ON u.user_id = fs.owner_user_id 
     WHERE fs.station_id = ?'
);
$stationStmt->execute([$stationId]);
$station = $stationStmt->fetch();

if (!$station) {
    json_response(404, ['ok' => false, 'message' => 'Station not found']);
}

try {
    $pdo->beginTransaction();

    if ($action === 'approve') {
        if ($station['approval_status'] !== 'pending') {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'Only pending stations can be approved']);
        }

        $updateStmt = $pdo->prepare(
            'UPDATE fuel_stations SET approval_status = ?, approved_by = ?, approved_at = NOW() WHERE station_id = ?'
        );
        $updateStmt->execute(['approved', $adminId, $stationId]);

        log_admin_action(
            $pdo,
            $adminId,
            'station_approved',
            'station',
            $stationId,
            "Approved station: {$station['station_name']} (Owner: {$station['email']})",
            ['approval_status' => 'pending'],
            ['approval_status' => 'approved']
        );

        // Notify owner
        if ($station['user_id']) {
            $notifyStmt = $pdo->prepare(
                'INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)'
            );
            $notifyStmt->execute([
                $station['user_id'],
                "Your station '{$station['station_name']}' has been approved by admin!"
            ]);
        }

        create_admin_alert(
            $pdo,
            'station_approved',
            'low',
            'Station Approved',
            "Admin approved station {$station['station_name']}",
            'station',
            $stationId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'Station approved successfully']);

    } elseif ($action === 'reject') {
        if ($station['approval_status'] !== 'pending') {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'Only pending stations can be rejected']);
        }

        if (!$reason) {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'Rejection reason is required']);
        }

        $updateStmt = $pdo->prepare(
            'UPDATE fuel_stations SET approval_status = ?, rejection_reason = ?, approved_by = ?, approved_at = NOW() WHERE station_id = ?'
        );
        $updateStmt->execute(['rejected', $reason, $adminId, $stationId]);

        log_admin_action(
            $pdo,
            $adminId,
            'station_rejected',
            'station',
            $stationId,
            "Rejected station: {$station['station_name']} (Reason: {$reason})",
            ['approval_status' => 'pending'],
            ['approval_status' => 'rejected', 'rejection_reason' => $reason]
        );

        // Notify owner
        if ($station['user_id']) {
            $notifyStmt = $pdo->prepare(
                'INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)'
            );
            $notifyStmt->execute([
                $station['user_id'],
                "Your station '{$station['station_name']}' was rejected. Reason: {$reason}"
            ]);
        }

        create_admin_alert(
            $pdo,
            'station_rejected',
            'medium',
            'Station Rejected',
            "Admin rejected station {$station['station_name']}. Reason: {$reason}",
            'station',
            $stationId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'Station rejected successfully']);

    } else {
        $pdo->rollBack();
        json_response(400, ['ok' => false, 'message' => 'Invalid action']);
    }

} catch (Exception $e) {
    $pdo->rollBack();
    json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
