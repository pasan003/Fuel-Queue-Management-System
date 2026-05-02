<?php
declare(strict_types=1);

/**
 * Shared backend bootstrap: JSON helpers, PDO connection, sessions, HTTP helpers.
 * Set DB credentials via environment variables or edit defaults below for XAMPP.
 */

header('X-Content-Type-Options: nosniff');

// --- Optional JSON fallback storage (legacy / offline dev); auth uses MySQL when available ---
define('DATA_DIR', __DIR__ . DIRECTORY_SEPARATOR . 'data');
define('USERS_FILE', DATA_DIR . DIRECTORY_SEPARATOR . 'users.json');

/** @var PDO|null */
$pdoSingleton = null;

/** Database configuration (override with FQMS_DB_* environment variables). */
function db_config(): array {
    return [
        'host' => getenv('FQMS_DB_HOST') ?: '127.0.0.1',
        'name' => getenv('FQMS_DB_NAME') ?: 'fqms',
        'user' => getenv('FQMS_DB_USER') ?: 'root',
        'pass' => getenv('FQMS_DB_PASS') !== false ? (string)getenv('FQMS_DB_PASS') : '',
        'charset' => 'utf8mb4',
    ];
}

/**
 * Returns a shared PDO instance, or null if the database is unreachable.
 */
function db(): ?PDO {
    global $pdoSingleton;
    if ($pdoSingleton instanceof PDO) {
        return $pdoSingleton;
    }
    $c = db_config();
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $c['host'],
        $c['name'],
        $c['charset']
    );
    try {
        $pdoSingleton = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdoSingleton;
    } catch (PDOException $e) {
        return null;
    }
}

function db_available(): bool {
    return db() !== null;
}

/** Start session once per request (for auth endpoints). */
function session_boot(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function json_response(int $status, array $payload): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function require_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
    }
}

function require_get(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
    }
}

function str_post(string $key): string {
    $v = $_POST[$key] ?? '';
    return trim((string)$v);
}

/** Normalize checkbox / JSON / string booleans from client input. */
function bool_from_client($v): bool {
    if (is_bool($v)) {
        return $v;
    }
    $s = strtolower(trim((string)$v));
    return in_array($s, ['1', 'true', 'yes', 'on'], true);
}

function require_login_json(): void {
    session_boot();
    if (empty($_SESSION['user_id'])) {
        json_response(401, ['ok' => false, 'message' => 'Authentication required']);
    }
}

/** ---------- Legacy JSON user storage (used only if DB auth ever falls back) ---------- */

function ensure_data_dir(): void {
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0777, true);
    }
    if (!file_exists(USERS_FILE)) {
        file_put_contents(USERS_FILE, json_encode([]));
    }
}

function read_users(): array {
    ensure_data_dir();
    $raw = file_get_contents(USERS_FILE);
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

function write_users(array $users): void {
    ensure_data_dir();
    file_put_contents(USERS_FILE, json_encode($users, JSON_PRETTY_PRINT));
}
