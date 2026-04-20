<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

require_post();

$fullName = str_post('fullName');
$nationalId = str_post('nationalId');
$email = str_post('email');
$password = (string)($_POST['password'] ?? '');
$userType = str_post('userType') ?: 'customer';

if ($fullName === '') json_response(400, ['ok' => false, 'message' => 'Full name is required']);
if ($nationalId === '') json_response(400, ['ok' => false, 'message' => 'National ID is required']);
if ($email === '') json_response(400, ['ok' => false, 'message' => 'Email is required']);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_response(400, ['ok' => false, 'message' => 'Enter a valid email address']);
if ($password === '' || strlen($password) < 6) json_response(400, ['ok' => false, 'message' => 'Password must be at least 6 characters']);
if ($userType !== 'customer' && $userType !== 'owner') json_response(400, ['ok' => false, 'message' => 'Invalid user type']);

$stationName = str_post('stationName');
$stationLocation = str_post('stationLocation');
$fuelTypes = $_POST['fuelTypes'] ?? [];
if (!is_array($fuelTypes)) $fuelTypes = [$fuelTypes];

if ($userType === 'owner') {
    if ($stationName === '') json_response(400, ['ok' => false, 'message' => 'Station name is required']);
    if ($stationLocation === '') json_response(400, ['ok' => false, 'message' => 'Station location is required']);
    if (count($fuelTypes) === 0) json_response(400, ['ok' => false, 'message' => 'Select at least one fuel type']);
}

$users = read_users();
foreach ($users as $u) {
    if (isset($u['email']) && strtolower((string)$u['email']) === strtolower($email)) {
        json_response(409, ['ok' => false, 'message' => 'An account with this email already exists']);
    }
    if (isset($u['nationalId']) && (string)$u['nationalId'] === $nationalId) {
        json_response(409, ['ok' => false, 'message' => 'An account with this National ID already exists']);
    }
}

$id = (int)(microtime(true) * 1000);
$users[] = [
    'id' => $id,
    'fullName' => $fullName,
    'nationalId' => $nationalId,
    'email' => $email,
    'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
    'userType' => $userType,
    'station' => $userType === 'owner' ? [
        'stationName' => $stationName,
        'stationLocation' => $stationLocation,
        'fuelTypes' => array_values($fuelTypes),
    ] : null,
    'createdAt' => gmdate('c'),
];

write_users($users);

json_response(200, ['ok' => true, 'message' => 'Registration successful']);

