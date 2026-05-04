<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

require_post();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable. Check MySQL and backend/config credentials.']);
}

session_boot();

$username = str_post('username'); // accepts email (label may say Username)
$password = (string)($_POST['password'] ?? '');

if ($username === '') {
    json_response(400, ['ok' => false, 'message' => 'Email is required']);
}
if ($password === '' || strlen($password) < 6) {
    json_response(400, ['ok' => false, 'message' => 'Password must be at least 6 characters']);
}

$emailGuess = strtolower($username);
$stmt = $pdo->prepare(
    'SELECT user_id, name, email, password, role, is_active, suspension_reason FROM users WHERE LOWER(email) = ? LIMIT 1'
);
$stmt->execute([$emailGuess]);
$row = $stmt->fetch();

if (!$row || !password_verify($password, (string)$row['password'])) {
    json_response(401, ['ok' => false, 'message' => 'Invalid credentials']);
}

// Check if account is suspended
if ((int)$row['is_active'] === 0) {
    json_response(403, [
        'ok' => false,
        'message' => 'Your account has been suspended',
        'reason' => $row['suspension_reason'] ?? 'No reason provided',
    ]);
}

$role = (string)$row['role'];
$userType = $role === 'owner' ? 'owner' : ($role === 'admin' ? 'admin' : 'customer');

$_SESSION['user_id'] = (int)$row['user_id'];
$_SESSION['role'] = $role;
$_SESSION['name'] = (string)$row['name'];
$_SESSION['email'] = (string)$row['email'];

json_response(200, [
    'ok' => true,
    'message' => 'Login successful',
    'user' => [
        'id' => (int)$row['user_id'],
        'fullName' => (string)$row['name'],
        'email' => (string)$row['email'],
        'userType' => $userType,
        'role' => $role,
    ],
]);
