<?php
declare(strict_types=1);

/**
 * Admin API: Alert actions (acknowledge, clear)
 * POST /backend/admin/alert-actions.php
 */

require __DIR__ . '/../config.php';

require_admin_post();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

$action = trim((string)($_POST['action'] ?? ''));
$alertId = (int)($_POST['alert_id'] ?? 0);
$adminId = get_current_user_id();

if (!$action) {
    json_response(400, ['ok' => false, 'message' => 'Action is required']);
}

if ($action === 'acknowledge') {
    if ($alertId <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Valid alert ID is required']);
    }

    // Get alert
    $alertStmt = $pdo->prepare(
        'SELECT alert_id, is_acknowledged FROM admin_alerts WHERE alert_id = ?'
    );
    $alertStmt->execute([$alertId]);
    $alert = $alertStmt->fetch();

    if (!$alert) {
        json_response(404, ['ok' => false, 'message' => 'Alert not found']);
    }

    if ((int)$alert['is_acknowledged'] === 1) {
        json_response(400, ['ok' => false, 'message' => 'Alert is already acknowledged']);
    }

    try {
        $updateStmt = $pdo->prepare(
            'UPDATE admin_alerts SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW() WHERE alert_id = ?'
        );
        $updateStmt->execute([$adminId, $alertId]);

        json_response(200, ['ok' => true, 'message' => 'Alert acknowledged']);
    } catch (Exception $e) {
        json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }

} elseif ($action === 'acknowledge_all') {
    try {
        $updateStmt = $pdo->prepare(
            'UPDATE admin_alerts SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW() WHERE is_acknowledged = 0'
        );
        $updateStmt->execute([$adminId]);
        $affectedRows = $updateStmt->rowCount();

        json_response(200, [
            'ok' => true,
            'message' => "Acknowledged {$affectedRows} alert(s)",
            'count' => $affectedRows,
        ]);
    } catch (Exception $e) {
        json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }

} elseif ($action === 'delete') {
    if ($alertId <= 0) {
        json_response(400, ['ok' => false, 'message' => 'Valid alert ID is required']);
    }

    try {
        $delStmt = $pdo->prepare('DELETE FROM admin_alerts WHERE alert_id = ?');
        $delStmt->execute([$alertId]);

        json_response(200, ['ok' => true, 'message' => 'Alert deleted']);
    } catch (Exception $e) {
        json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }

} else {
    json_response(400, ['ok' => false, 'message' => 'Invalid action']);
}
