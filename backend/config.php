<?php
declare(strict_types=1);

// Simple, file-based backend storage to keep the project runnable
// without requiring a database server during early development.

header('X-Content-Type-Options: nosniff');

define('DATA_DIR', __DIR__ . DIRECTORY_SEPARATOR . 'data');
define('USERS_FILE', DATA_DIR . DIRECTORY_SEPARATOR . 'users.json');

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

function str_post(string $key): string {
    $v = $_POST[$key] ?? '';
    return trim((string)$v);
}

