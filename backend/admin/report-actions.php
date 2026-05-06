<?php
declare(strict_types=1);

/**
 * Admin API: Report actions (review, resolve, mark as spam, delete)
 * POST /backend/admin/report-actions.php
 * 
 * Actions:
 * - review: mark as reviewed
 * - resolve: mark as resolved
 * - spam: mark as spam
 * - delete: delete report
 */

require __DIR__ . '/../config.php';

require_admin_post();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

$action = trim((string)($_POST['action'] ?? ''));
$reportId = (int)($_POST['report_id'] ?? 0);
$notes = trim((string)($_POST['notes'] ?? ''));
$adminId = get_current_user_id();

if (!$action) {
    json_response(400, ['ok' => false, 'message' => 'Action is required']);
}
if ($reportId <= 0) {
    json_response(400, ['ok' => false, 'message' => 'Valid report ID is required']);
}

// Get report details
$reportStmt = $pdo->prepare(
    'SELECT r.report_id, r.report_status, r.comment, r.user_id, u.email 
     FROM reports r LEFT JOIN users u ON u.user_id = r.user_id 
     WHERE r.report_id = ?'
);
$reportStmt->execute([$reportId]);
$report = $reportStmt->fetch();

if (!$report) {
    json_response(404, ['ok' => false, 'message' => 'Report not found']);
}

try {
    $pdo->beginTransaction();

    if ($action === 'review') {
        if ($report['report_status'] !== 'pending') {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'Only pending reports can be reviewed']);
        }

        $updateStmt = $pdo->prepare(
            'UPDATE reports SET report_status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE report_id = ?'
        );
        $updateStmt->execute(['reviewed', $adminId, $notes, $reportId]);

        log_admin_action(
            $pdo,
            $adminId,
            'report_reviewed',
            'report',
            $reportId,
            "Reviewed report #{$reportId}",
            ['report_status' => 'pending'],
            ['report_status' => 'reviewed']
        );

        create_admin_alert(
            $pdo,
            'report_reviewed',
            'low',
            'Report Reviewed',
            "Admin reviewed report #{$reportId}",
            'report',
            $reportId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'Report marked as reviewed']);

    } elseif ($action === 'resolve') {
        if ($report['report_status'] === 'spam') {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'Spam reports cannot be resolved']);
        }

        $updateStmt = $pdo->prepare(
            'UPDATE reports SET report_status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE report_id = ?'
        );
        $updateStmt->execute(['resolved', $adminId, $notes, $reportId]);

        log_admin_action(
            $pdo,
            $adminId,
            'report_resolved',
            'report',
            $reportId,
            "Resolved report #{$reportId}",
            ['report_status' => $report['report_status']],
            ['report_status' => 'resolved']
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'Report marked as resolved']);

    } elseif ($action === 'spam') {
        $updateStmt = $pdo->prepare(
            'UPDATE reports SET report_status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE report_id = ?'
        );
        $updateStmt->execute(['spam', $adminId, $notes ?: 'Marked as spam', $reportId]);

        log_admin_action(
            $pdo,
            $adminId,
            'report_spam',
            'report',
            $reportId,
            "Marked report #{$reportId} as spam",
            ['report_status' => $report['report_status']],
            ['report_status' => 'spam']
        );

        // Create alert for spam detection
        create_admin_alert(
            $pdo,
            'report_spam',
            'medium',
            'Report Flagged as Spam',
            "Admin flagged report #{$reportId} as spam by user {$report['email']}",
            'report',
            $reportId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'Report marked as spam']);

    } elseif ($action === 'delete') {
        $oldComment = $report['comment'];

        $delStmt = $pdo->prepare('DELETE FROM reports WHERE report_id = ?');
        $delStmt->execute([$reportId]);

        log_admin_action(
            $pdo,
            $adminId,
            'report_deleted',
            'report',
            $reportId,
            "Deleted report #{$reportId}",
            ['comment' => $oldComment],
            null
        );

        create_admin_alert(
            $pdo,
            'report_deleted',
            'high',
            'Report Deleted',
            "Admin deleted report #{$reportId}",
            'report',
            $reportId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'Report deleted successfully']);

    } else {
        $pdo->rollBack();
        json_response(400, ['ok' => false, 'message' => 'Invalid action']);
    }

} catch (Exception $e) {
    $pdo->rollBack();
    json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
