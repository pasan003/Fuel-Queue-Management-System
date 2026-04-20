<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

require_post();

$username = str_post('username'); // for now we treat username as email or name
$password = (string)($_POST['password'] ?? '');

if ($username === '') json_response(400, ['ok' => false, 'message' => 'Username is required']);
if ($password === '' || strlen($password) < 6) json_response(400, ['ok' => false, 'message' => 'Password must be at least 6 characters']);

$users = read_users();
$found = null;
foreach ($users as $u) {
    $email = strtolower((string)($u['email'] ?? ''));
    $fullName = strtolower((string)($u['fullName'] ?? ''));
    if ($email === strtolower($username) || $fullName === strtolower($username)) {
        $found = $u;
        break;
    }
}

if (!$found) {
    json_response(401, ['ok' => false, 'message' => 'Invalid credentials']);
}

$hash = (string)($found['passwordHash'] ?? '');
if (!password_verify($password, $hash)) {
    json_response(401, ['ok' => false, 'message' => 'Invalid credentials']);
}

// Session can be added later; keeping response simple for frontend demo
json_response(200, [
    'ok' => true,
    'message' => 'Login successful',
    'user' => [
        'id' => $found['id'] ?? null,
        'fullName' => $found['fullName'] ?? null,
        'email' => $found['email'] ?? null,
        'userType' => $found['userType'] ?? null,
    ]
]);

