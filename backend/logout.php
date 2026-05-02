<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

require_post();

session_boot();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

json_response(200, ['ok' => true, 'message' => 'Logged out']);
