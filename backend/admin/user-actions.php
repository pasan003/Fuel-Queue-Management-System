<?php
declare(strict_types=1);

/**
 * Admin API: User actions (suspend, activate, delete)
 * POST /backend/admin/user-actions.php
 * 
 * Actions:
 * - suspend: suspend a user account
 * - activate: activate a suspended user
 * - delete: delete a user account
 */

require __DIR__ . '/../config.php';

require_admin_post();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

$action = trim((string)($_POST['action'] ?? ''));
$userId = (int)($_POST['user_id'] ?? 0);
$reason = trim((string)($_POST['reason'] ?? ''));
$adminId = get_current_user_id();

if (!$action) {
    json_response(400, ['ok' => false, 'message' => 'Action is required']);
}
if ($userId <= 0) {
    json_response(400, ['ok' => false, 'message' => 'Valid user ID is required']);
}
if ($userId === $adminId) {
    json_response(400, ['ok' => false, 'message' => 'Cannot perform action on your own account']);
}

// Get user details for audit log
$userStmt = $pdo->prepare('SELECT user_id, name, email, is_active, role FROM users WHERE user_id = ?');
$userStmt->execute([$userId]);
$user = $userStmt->fetch();

if (!$user) {
    json_response(404, ['ok' => false, 'message' => 'User not found']);
}

try {
    $pdo->beginTransaction();

    if ($action === 'suspend') {
        if ($user['is_active'] == 0) {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'User is already suspended']);
        }

        if (!$reason) {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'Suspension reason is required']);
        }

        $updateStmt = $pdo->prepare(
            'UPDATE users SET is_active = 0, suspension_reason = ?, suspended_at = NOW(), suspended_by = ? WHERE user_id = ?'
        );
        $updateStmt->execute([$reason, $adminId, $userId]);

        log_admin_action(
            $pdo,
            $adminId,
            'user_suspended',
            'user',
            $userId,
            "Suspended user: {$user['email']} (Reason: {$reason})",
            ['is_active' => 1],
            ['is_active' => 0, 'suspension_reason' => $reason]
        );

        // Create alert
        create_admin_alert(
            $pdo,
            'user_suspended',
            'medium',
            'User Suspended',
            "Admin suspended user {$user['name']} ({$user['email']}). Reason: {$reason}",
            'user',
            $userId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'User suspended successfully']);

    } elseif ($action === 'activate') {
        if ($user['is_active'] == 1) {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'User is already active']);
        }

        $updateStmt = $pdo->prepare(
            'UPDATE users SET is_active = 1, suspension_reason = NULL, suspended_at = NULL, suspended_by = NULL WHERE user_id = ?'
        );
        $updateStmt->execute([$userId]);

        log_admin_action(
            $pdo,
            $adminId,
            'user_activated',
            'user',
            $userId,
            "Activated user: {$user['email']}",
            ['is_active' => 0],
            ['is_active' => 1]
        );

        create_admin_alert(
            $pdo,
            'user_activated',
            'low',
            'User Activated',
            "Admin activated user {$user['name']} ({$user['email']})",
            'user',
            $userId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'User activated successfully']);

    } elseif ($action === 'delete') {
        if (!$reason) {
            $pdo->rollBack();
            json_response(400, ['ok' => false, 'message' => 'Deletion reason is required']);
        }

        // Prevent deletion of admin users by other admins (only super-admins should do this)
        if ($user['role'] === 'admin') {
            $pdo->rollBack();
            json_response(403, ['ok' => false, 'message' => 'Cannot delete admin users']);
        }

        // Store user data for audit log before deletion
        $oldData = [
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ];

        // Delete user (cascades to related records)
        $delStmt = $pdo->prepare('DELETE FROM users WHERE user_id = ?');
        $delStmt->execute([$userId]);

        log_admin_action(
            $pdo,
            $adminId,
            'user_deleted',
            'user',
            $userId,
            "Deleted user: {$user['email']} (Reason: {$reason})",
            $oldData,
            null
        );

        create_admin_alert(
            $pdo,
            'user_deleted',
            'high',
            'User Deleted',
            "Admin deleted user {$user['name']} ({$user['email']}). Reason: {$reason}",
            'user',
            $userId
        );

        $pdo->commit();
        json_response(200, ['ok' => true, 'message' => 'User deleted successfully']);

    } else {
        $pdo->rollBack();
        json_response(400, ['ok' => false, 'message' => 'Invalid action']);
    }

} catch (Exception $e) {
    $pdo->rollBack();
    json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
