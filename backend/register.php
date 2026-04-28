<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

require_post();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable. Import database/fqms.sql and start MySQL.']);
}

$fullName = str_post('fullName');
$nationalId = str_post('nationalId');
$email = strtolower(str_post('email'));
$password = (string)($_POST['password'] ?? '');
$userType = str_post('userType') ?: 'customer';

if ($fullName === '') {
    json_response(400, ['ok' => false, 'message' => 'Full name is required']);
}
if ($nationalId === '') {
    json_response(400, ['ok' => false, 'message' => 'National ID is required']);
}
if ($email === '') {
    json_response(400, ['ok' => false, 'message' => 'Email is required']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ['ok' => false, 'message' => 'Enter a valid email address']);
}
if ($password === '' || strlen($password) < 6) {
    json_response(400, ['ok' => false, 'message' => 'Password must be at least 6 characters']);
}

$roleDb = ($userType === 'owner') ? 'owner' : 'customer';

$stationName = str_post('stationName');
$stationLocation = str_post('stationLocation');
$fuelTypes = $_POST['fuelTypes'] ?? [];
if (!is_array($fuelTypes)) {
    $fuelTypes = [$fuelTypes];
}

if ($roleDb === 'owner') {
    if ($stationName === '') {
        json_response(400, ['ok' => false, 'message' => 'Station name is required']);
    }
    if ($stationLocation === '') {
        json_response(400, ['ok' => false, 'message' => 'Station location is required']);
    }
    if (count($fuelTypes) === 0) {
        json_response(400, ['ok' => false, 'message' => 'Select at least one fuel type']);
    }
}

$stmt = $pdo->prepare('SELECT user_id FROM users WHERE email = ? OR national_id = ? LIMIT 1');
$stmt->execute([$email, $nationalId]);
if ($stmt->fetch()) {
    json_response(409, ['ok' => false, 'message' => 'An account with this email or National ID already exists']);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

try {
    $pdo->beginTransaction();

    $ins = $pdo->prepare(
        'INSERT INTO users (name, national_id, email, password, role) VALUES (?, ?, ?, ?, ?)'
    );
    $ins->execute([$fullName, $nationalId, $email, $hash, $roleDb]);
    $newUserId = (int)$pdo->lastInsertId();

    if ($roleDb === 'owner') {
        $wantPetrol = false;
        $wantDiesel = false;
        foreach ($fuelTypes as $ft) {
            $ft = strtolower((string)$ft);
            if ($ft === 'petrol') {
                $wantPetrol = true;
            }
            if ($ft === 'diesel') {
                $wantDiesel = true;
            }
        }

        $st = $pdo->prepare(
            'INSERT INTO fuel_stations (owner_user_id, station_name, location) VALUES (?, ?, ?)'
        );
        $st->execute([$newUserId, $stationName, $stationLocation]);
        $stationId = (int)$pdo->lastInsertId();

        $upAvail = $pdo->prepare(
            'INSERT INTO fuel_availability (station_id, fuel_type_id, is_available) VALUES (?, ?, ?)'
        );
        $upAvail->execute([$stationId, 1, $wantPetrol ? 1 : 0]);
        $upAvail->execute([$stationId, 2, $wantDiesel ? 1 : 0]);

        $qins = $pdo->prepare(
            'INSERT INTO queue_status (station_id, queue_length, waiting_time, updated_by) VALUES (?, 0, 0, NULL)'
        );
        $qins->execute([$stationId]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(500, ['ok' => false, 'message' => 'Registration failed. Please try again.']);
}

json_response(200, ['ok' => true, 'message' => 'Registration successful']);
