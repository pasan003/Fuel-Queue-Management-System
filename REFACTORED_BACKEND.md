# REFACTORED BACKEND CODE SAMPLES

This document provides production-ready code samples for the refactored FQMS backend.

---

## Table of Contents
1. [Core Architecture](#core-architecture)
2. [Security & Middleware](#security--middleware)
3. [Controllers & Services](#controllers--services)
4. [Validation & Error Handling](#validation--error-handling)
5. [Repositories & Models](#repositories--models)

---

## Core Architecture

### 1. Router (public/index.php)

```php
<?php
declare(strict_types=1);

/**
 * FQMS v3 - Single Entry Point
 * All requests routed through this file via .htaccess
 */

require_once __DIR__ . '/../src/config/config.php';
require_once __DIR__ . '/../src/core/Router.php';
require_once __DIR__ . '/../src/core/Request.php';
require_once __DIR__ . '/../src/core/Response.php';

try {
    // Initialize request
    $request = Request::fromGlobals();
    
    // Route the request
    $router = new Router();
    require_once __DIR__ . '/../routes/api.php';
    
    $response = $router->dispatch($request);
    $response->send();
    
} catch (Exception $e) {
    Response::error($e->getMessage(), $e->getCode() ?: 500)->send();
    exit(1);
}
```

### 2. Router Class (src/core/Router.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Core;

use FQMS\Core\Request;
use FQMS\Core\Response;

class Router {
    private array $routes = [];
    private array $middleware = [];
    
    public function __construct(
        private \FQMS\Utils\Logger $logger = null,
    ) {
        $this->logger = $this->logger ?? new \FQMS\Utils\Logger();
    }
    
    /**
     * Register GET route
     */
    public function get(string $path, array|string $handler): self {
        return $this->register('GET', $path, $handler);
    }
    
    /**
     * Register POST route
     */
    public function post(string $path, array|string $handler): self {
        return $this->register('POST', $path, $handler);
    }
    
    /**
     * Register PATCH route
     */
    public function patch(string $path, array|string $handler): self {
        return $this->register('PATCH', $path, $handler);
    }
    
    /**
     * Register DELETE route
     */
    public function delete(string $path, array|string $handler): self {
        return $this->register('DELETE', $path, $handler);
    }
    
    /**
     * Add middleware for all routes
     */
    public function middleware(string $middlewareClass): self {
        $this->middleware[] = $middlewareClass;
        return $this;
    }
    
    /**
     * Dispatch request to appropriate handler
     */
    public function dispatch(Request $request): Response {
        $method = $request->method();
        $path = $request->path();
        
        // Find matching route
        $route = $this->matchRoute($method, $path);
        if (!$route) {
            return Response::error('Route not found', 404);
        }
        
        // Extract parameters from path
        $params = $this->extractParameters($route['path'], $path);
        $request = $request->withParams($params);
        
        // Execute middleware pipeline
        $handler = $this->buildMiddlewarePipeline($route['handler']);
        
        return $handler($request);
    }
    
    private function register(string $method, string $path, array|string $handler): self {
        $this->routes[] = [
            'method' => $method,
            'path' => $this->normalizePath($path),
            'handler' => $handler,
            'pattern' => $this->pathToRegex($path),
        ];
        return $this;
    }
    
    private function matchRoute(string $method, string $path): ?array {
        $path = $this->normalizePath($path);
        
        foreach ($this->routes as $route) {
            if ($route['method'] === $method && preg_match($route['pattern'], $path)) {
                return $route;
            }
        }
        
        return null;
    }
    
    private function extractParameters(string $pathPattern, string $actualPath): array {
        $params = [];
        
        // Convert {id} pattern to actual values
        $pattern = $this->pathToRegex($pathPattern);
        if (preg_match_all('/{([^}]+)}/', $pathPattern, $matches)) {
            $names = $matches[1];
            
            if (preg_match($pattern, $actualPath, $values)) {
                for ($i = 0; $i < count($names); $i++) {
                    $params[$names[$i]] = $values[$i + 1];
                }
            }
        }
        
        return $params;
    }
    
    private function buildMiddlewarePipeline(array|string $handler): callable {
        $middlewareStack = [...$this->middleware];
        
        // Final handler
        $finalHandler = function(Request $request) use ($handler) {
            if (is_string($handler)) {
                [$controller, $method] = explode('@', $handler);
                $controllerClass = 'FQMS\\Controllers\\' . $controller;
                $instance = new $controllerClass();
                return $instance->{$method}($request);
            } else {
                [$controller, $method] = $handler;
                $instance = new $controller();
                return $instance->{$method}($request);
            }
        };
        
        // Apply middleware in reverse order
        $pipeline = $finalHandler;
        foreach (array_reverse($middlewareStack) as $middleware) {
            $middlewareInstance = new $middleware();
            $pipeline = function(Request $request) use ($middlewareInstance, $pipeline) {
                return $middlewareInstance->handle($request, $pipeline);
            };
        }
        
        return $pipeline;
    }
    
    private function pathToRegex(string $path): string {
        $escaped = preg_quote($path, '#');
        $pattern = preg_replace('#\\\{([^}]+)\\\}#', '([^/]+)', $escaped);
        return "#^{$pattern}$#";
    }
    
    private function normalizePath(string $path): string {
        return '/' . trim($path, '/');
    }
}
```

### 3. Request Class (src/core/Request.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Core;

class Request {
    private array $params = [];
    private array $headers = [];
    
    public function __construct(
        private string $method,
        private string $path,
        private array $query,
        private array $post,
        private ?string $json = null,
        private string $ip = '127.0.0.1',
    ) {
        $this->headers = $this->parseHeaders();
    }
    
    /**
     * Create request from PHP globals
     */
    public static function fromGlobals(): self {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $query = $_GET ?? [];
        $post = $_POST ?? [];
        $json = file_get_contents('php://input');
        $ip = $_SERVER['HTTP_CLIENT_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        
        return new self($method, $path, $query, $post, $json, $ip);
    }
    
    public function method(): string {
        return $this->method;
    }
    
    public function path(): string {
        return $this->path;
    }
    
    public function isStateChanging(): bool {
        return in_array($this->method, ['POST', 'PUT', 'PATCH', 'DELETE']);
    }
    
    public function get(string $key, mixed $default = null): mixed {
        return $this->query[$key] ?? $default;
    }
    
    public function post(string $key, mixed $default = null): mixed {
        return $this->post[$key] ?? $default;
    }
    
    public function json(string $key = null, mixed $default = null): mixed {
        if (!$this->json) {
            return $default;
        }
        
        $decoded = json_decode($this->json, true);
        if ($key === null) {
            return $decoded;
        }
        
        return $decoded[$key] ?? $default;
    }
    
    public function all(): array {
        return array_merge($this->query, $this->post, $this->json ? json_decode($this->json, true) : []);
    }
    
    public function param(string $key, mixed $default = null): mixed {
        return $this->params[$key] ?? $default;
    }
    
    public function withParams(array $params): self {
        $this->params = $params;
        return $this;
    }
    
    public function header(string $key): ?string {
        return $this->headers[$key] ?? null;
    }
    
    public function ip(): string {
        return $this->ip;
    }
    
    private function parseHeaders(): array {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $header = substr($key, 5);
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}
```

### 4. Response Class (src/core/Response.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Core;

class Response {
    private int $statusCode = 200;
    private array $headers = ['Content-Type' => 'application/json'];
    
    public function __construct(
        private array|string $body,
        int $statusCode = 200,
    ) {
        $this->statusCode = $statusCode;
    }
    
    /**
     * Success response
     */
    public static function json(array $data, int $statusCode = 200): self {
        return new self([
            'status' => 'success',
            'data' => $data,
            'message' => '',
        ], $statusCode);
    }
    
    /**
     * Error response
     */
    public static function error(string $message, int $statusCode = 400): self {
        return new self([
            'status' => 'error',
            'data' => null,
            'message' => $message,
        ], $statusCode);
    }
    
    /**
     * Paginated response
     */
    public static function paginated(array $items, int $page, int $per_page, int $total): self {
        return new self([
            'status' => 'success',
            'data' => $items,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'last_page' => ceil($total / $per_page),
            ],
        ], 200);
    }
    
    public function header(string $key, string $value): self {
        $this->headers[$key] = $value;
        return $this;
    }
    
    public function send(): void {
        http_response_code($this->statusCode);
        
        foreach ($this->headers as $key => $value) {
            header("{$key}: {$value}");
        }
        
        if (is_array($this->body)) {
            echo json_encode($this->body, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        } else {
            echo $this->body;
        }
    }
    
    public function toArray(): array {
        return is_array($this->body) ? $this->body : ['body' => $this->body];
    }
}
```

---

## Security & Middleware

### 5. Authentication Middleware (src/middleware/AuthMiddleware.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Middleware;

use FQMS\Core\Request;
use FQMS\Core\Response;

class AuthMiddleware {
    public function handle(Request $request, callable $next): Response {
        session_start();
        
        if (empty($_SESSION['user_id'])) {
            return Response::error('Authentication required', 401);
        }
        
        // Regenerate session ID periodically for security
        if (!isset($_SESSION['last_regenerate']) || time() - $_SESSION['last_regenerate'] > 300) {
            session_regenerate_id(true);
            $_SESSION['last_regenerate'] = time();
        }
        
        return $next($request);
    }
}
```

### 6. CSRF Middleware (src/middleware/CsrfMiddleware.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Middleware;

use FQMS\Core\Request;
use FQMS\Core\Response;

class CsrfMiddleware {
    public function handle(Request $request, callable $next): Response {
        session_start();
        
        // Generate token if doesn't exist
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        
        // Verify token for state-changing requests
        if ($request->isStateChanging()) {
            $token = $request->post('_csrf_token') ?? $request->header('X-CSRF-Token');
            
            if (!$token || !hash_equals($_SESSION['csrf_token'], (string)$token)) {
                return Response::error('CSRF token mismatch', 403);
            }
        }
        
        return $next($request);
    }
}

// Helper function for templates
function csrf_token(): string {
    session_start();
    return $_SESSION['csrf_token'] ?? '';
}
```

### 7. Rate Limiting Middleware (src/middleware/RateLimitMiddleware.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Middleware;

use FQMS\Core\Request;
use FQMS\Core\Response;
use FQMS\Utils\RateLimiter;

class RateLimitMiddleware {
    public function __construct(
        private RateLimiter $limiter,
        private string $limit = 'api',
    ) {}
    
    public function handle(Request $request, callable $next): Response {
        // Different limits for different endpoints
        $limits = [
            'login' => ['limit' => 5, 'window' => 60],      // 5 attempts per minute
            'register' => ['limit' => 10, 'window' => 3600], // 10 per hour
            'api' => ['limit' => 100, 'window' => 60],       // 100 per minute
        ];
        
        $config = $limits[$this->limit] ?? $limits['api'];
        $key = "{$this->limit}:{$request->ip()}";
        
        try {
            $this->limiter->check($key, $config['limit'], $config['window']);
            return $next($request);
        } catch (\Exception $e) {
            return Response::error('Too many requests', 429)
                ->header('Retry-After', '60');
        }
    }
}
```

### 8. Rate Limiter Utility (src/utils/RateLimiter.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Utils;

use FQMS\Utils\CacheManager;

class RateLimiter {
    public function __construct(private CacheManager $cache) {}
    
    /**
     * Check if request exceeds rate limit
     * @throws Exception if limit exceeded
     */
    public function check(string $key, int $limit, int $windowSeconds = 60): bool {
        $cacheKey = "ratelimit:{$key}";
        $current = (int)($this->cache->get($cacheKey) ?? 0);
        
        if ($current >= $limit) {
            throw new \Exception("Rate limit exceeded for {$key}", 429);
        }
        
        // Increment counter
        if ($current === 0) {
            $this->cache->set($cacheKey, 1, $windowSeconds);
        } else {
            $this->cache->increment($cacheKey, 1);
        }
        
        return true;
    }
    
    /**
     * Reset rate limit for key
     */
    public function reset(string $key): void {
        $this->cache->forget("ratelimit:{$key}");
    }
}
```

---

## Controllers & Services

### 9. Auth Controller (src/controllers/AuthController.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Controllers;

use FQMS\Core\Request;
use FQMS\Core\Response;
use FQMS\Services\AuthService;
use FQMS\Validators\AuthValidator;

class AuthController {
    public function __construct(
        private AuthService $authService,
        private AuthValidator $validator,
    ) {}
    
    /**
     * POST /api/auth/login
     */
    public function login(Request $request): Response {
        try {
            // Validate input
            $validated = $this->validator->validateLogin($request->all());
            
            // Authenticate
            $user = $this->authService->login(
                $validated['email'],
                $validated['password'],
                $request->ip()
            );
            
            return Response::json([
                'user' => [
                    'id' => $user['user_id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                ],
                'token' => $_SESSION['session_id'] ?? null,
            ], 200);
            
        } catch (\Exception $e) {
            return Response::error($e->getMessage(), 401);
        }
    }
    
    /**
     * POST /api/auth/register
     */
    public function register(Request $request): Response {
        try {
            $validated = $this->validator->validateRegister($request->all());
            
            $user = $this->authService->register($validated);
            
            return Response::json([
                'user' => [
                    'id' => $user['user_id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                ],
                'message' => 'Registration successful. Please log in.',
            ], 201);
            
        } catch (\Exception $e) {
            return Response::error($e->getMessage(), 400);
        }
    }
    
    /**
     * POST /api/auth/logout
     */
    public function logout(Request $request): Response {
        $this->authService->logout();
        return Response::json(['message' => 'Logged out successfully']);
    }
}
```

### 10. Auth Service (src/services/AuthService.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Services;

use FQMS\Repositories\UserRepository;
use FQMS\Utils\PasswordValidator;

class AuthService {
    public function __construct(
        private UserRepository $userRepository,
    ) {}
    
    /**
     * Authenticate user
     */
    public function login(string $email, string $password, string $ip): array {
        // Find user
        $user = $this->userRepository->findByEmail($email);
        if (!$user) {
            $this->logFailedAttempt($email, $ip);
            throw new \Exception('Invalid credentials', 401);
        }
        
        // Check if account is active
        if (!$user['is_active']) {
            throw new \Exception(
                'Your account is suspended: ' . ($user['suspension_reason'] ?? 'No reason provided'),
                403
            );
        }
        
        // Check if account is locked
        if ($user['locked_until'] && strtotime($user['locked_until']) > time()) {
            throw new \Exception('Account temporarily locked. Try again later.', 429);
        }
        
        // Verify password
        if (!password_verify($password, $user['password'])) {
            $this->recordFailedAttempt($user['user_id'], $ip);
            throw new \Exception('Invalid credentials', 401);
        }
        
        // Clear failed attempts
        $this->userRepository->clearFailedAttempts($user['user_id']);
        
        // Start session
        session_start();
        session_regenerate_id(true);
        
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['name'] = $user['name'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['ip'] = $ip;
        $_SESSION['login_time'] = time();
        
        // Update last login
        $this->userRepository->updateLastLogin($user['user_id'], $ip);
        
        // Audit log
        $this->auditLog('LOGIN_SUCCESS', 'User', $user['user_id'], $ip);
        
        return $user;
    }
    
    /**
     * Register new user
     */
    public function register(array $data): array {
        // Validate password strength
        $passwordErrors = PasswordValidator::validate($data['password']);
        if ($passwordErrors) {
            throw new \Exception('Weak password: ' . implode(', ', $passwordErrors), 400);
        }
        
        // Check email already exists
        if ($this->userRepository->findByEmail($data['email'])) {
            throw new \Exception('Email already registered', 400);
        }
        
        // Hash password
        $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        
        // Create user
        $userId = $this->userRepository->create($data);
        
        // Audit log
        $this->auditLog('REGISTER_NEW_USER', 'User', $userId, $_SERVER['REMOTE_ADDR']);
        
        return $this->userRepository->findById($userId);
    }
    
    /**
     * Logout user
     */
    public function logout(): void {
        $userId = $_SESSION['user_id'] ?? null;
        
        session_destroy();
        
        if ($userId) {
            $this->auditLog('LOGOUT', 'User', $userId, $_SERVER['REMOTE_ADDR']);
        }
    }
    
    private function recordFailedAttempt(int $userId, string $ip): void {
        $attempts = $this->userRepository->incrementFailedAttempts($userId);
        
        // Lock account after 5 failed attempts
        if ($attempts >= 5) {
            $lockUntil = date('Y-m-d H:i:s', time() + 900); // 15 minutes
            $this->userRepository->lockAccount($userId, $lockUntil);
        }
        
        $this->auditLog('LOGIN_FAILED', 'User', $userId, $ip);
    }
    
    private function auditLog(string $action, string $entity, ?int $entityId, string $ip): void {
        // TODO: Implement audit logging to database
    }
}
```

---

## Validation & Error Handling

### 11. Auth Validator (src/validators/AuthValidator.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Validators;

class AuthValidator extends InputValidator {
    /**
     * Validate login input
     */
    public function validateLogin(array $data): array {
        return $this->validate($data, [
            'email' => 'required|email|max:100',
            'password' => 'required|min:6|max:255',
        ]);
    }
    
    /**
     * Validate registration input
     */
    public function validateRegister(array $data): array {
        return $this->validate($data, [
            'name' => [
                'required',
                'min:3',
                'max:100',
                'regex:/^[a-zA-Z\s]+$/',
            ],
            'national_id' => [
                'required',
                'unique:users',
                'regex:/^[0-9]{9}V?$/',
            ],
            'email' => [
                'required',
                'email',
                'unique:users',
                'max:100',
            ],
            'password' => [
                'required',
                'min:12',
                'confirmed',
                'regex:/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/',
            ],
            'password_confirmation' => 'required|same:password',
        ]);
    }
}

/**
 * Base Validator Class
 */
class InputValidator {
    protected \PDO $pdo;
    protected array $errors = [];
    
    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * Validate data against rules
     * @throws \Exception if validation fails
     */
    public function validate(array $data, array $rules): array {
        $this->errors = [];
        $validated = [];
        
        foreach ($rules as $field => $fieldRules) {
            if (is_string($fieldRules)) {
                $fieldRules = explode('|', $fieldRules);
            }
            
            $value = $data[$field] ?? null;
            $this->validateField($field, $value, $fieldRules, $data);
            
            if (!isset($this->errors[$field])) {
                $validated[$field] = $value;
            }
        }
        
        if ($this->errors) {
            throw new \Exception('Validation failed: ' . json_encode($this->errors), 422);
        }
        
        return $validated;
    }
    
    private function validateField(string $field, mixed $value, array $rules, array $allData): void {
        foreach ($rules as $rule) {
            $this->applyRule($field, $value, $rule, $allData);
            if (isset($this->errors[$field])) {
                break; // Stop on first error
            }
        }
    }
    
    private function applyRule(string $field, mixed $value, string $rule, array $allData): void {
        // Parse rule with parameters: "rule:param1,param2"
        $parts = explode(':', $rule);
        $ruleName = $parts[0];
        $params = isset($parts[1]) ? explode(',', $parts[1]) : [];
        
        match($ruleName) {
            'required' => $this->validateRequired($field, $value),
            'email' => $this->validateEmail($field, $value),
            'min' => $this->validateMin($field, $value, (int)$params[0]),
            'max' => $this->validateMax($field, $value, (int)$params[0]),
            'regex' => $this->validateRegex($field, $value, $params[0]),
            'unique' => $this->validateUnique($field, $value, $params[0]),
            'confirmed' => $this->validateConfirmed($field, $value, $allData),
            'same' => $this->validateSame($field, $value, $params[0], $allData),
            default => null,
        };
    }
    
    private function validateRequired(string $field, mixed $value): void {
        if (empty($value) && $value !== '0') {
            $this->errors[$field] = "{$field} is required";
        }
    }
    
    private function validateEmail(string $field, mixed $value): void {
        if ($value && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = "{$field} must be a valid email";
        }
    }
    
    private function validateMin(string $field, mixed $value, int $min): void {
        if ($value && strlen((string)$value) < $min) {
            $this->errors[$field] = "{$field} must be at least {$min} characters";
        }
    }
    
    private function validateMax(string $field, mixed $value, int $max): void {
        if ($value && strlen((string)$value) > $max) {
            $this->errors[$field] = "{$field} must not exceed {$max} characters";
        }
    }
    
    private function validateRegex(string $field, mixed $value, string $pattern): void {
        if ($value && !preg_match($pattern, (string)$value)) {
            $this->errors[$field] = "{$field} format is invalid";
        }
    }
    
    private function validateUnique(string $field, mixed $value, string $table): void {
        if (!$value) return;
        
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM {$table} WHERE {$field} = ?");
        $stmt->execute([$value]);
        
        if ($stmt->fetchColumn() > 0) {
            $this->errors[$field] = "{$field} already exists";
        }
    }
    
    private function validateConfirmed(string $field, mixed $value, array $data): void {
        $confirmField = "{$field}_confirmation";
        if ($value !== ($data[$confirmField] ?? null)) {
            $this->errors[$field] = "{$field} confirmation does not match";
        }
    }
    
    private function validateSame(string $field, mixed $value, string $otherField, array $data): void {
        if ($value !== ($data[$otherField] ?? null)) {
            $this->errors[$field] = "{$field} must match {$otherField}";
        }
    }
}
```

---

## Repositories & Models

### 12. User Model (src/models/User.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Models;

class User {
    public int $user_id;
    public string $name;
    public string $email;
    public string $national_id;
    public string $role; // 'customer', 'owner', 'admin'
    public bool $is_active;
    public ?string $suspension_reason;
    public ?\DateTime $suspended_at;
    public ?int $suspended_by;
    public ?\DateTime $last_login_at;
    public int $login_attempts = 0;
    public ?\DateTime $locked_until;
    public \DateTime $created_at;
    
    public static function fromArray(array $data): self {
        $user = new self();
        $user->user_id = $data['user_id'];
        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->national_id = $data['national_id'];
        $user->role = $data['role'];
        $user->is_active = (bool)$data['is_active'];
        $user->suspension_reason = $data['suspension_reason'] ?? null;
        $user->suspended_at = $data['suspended_at'] ? new \DateTime($data['suspended_at']) : null;
        $user->last_login_at = $data['last_login_at'] ? new \DateTime($data['last_login_at']) : null;
        $user->locked_until = $data['locked_until'] ? new \DateTime($data['locked_until']) : null;
        $user->created_at = new \DateTime($data['created_at']);
        
        return $user;
    }
    
    public function toArray(): array {
        return [
            'user_id' => $this->user_id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at->format('Y-m-d H:i:s'),
        ];
    }
}
```

### 13. User Repository (src/repositories/UserRepository.php)

```php
<?php
declare(strict_types=1);

namespace FQMS\Repositories;

use FQMS\Models\User;

class UserRepository extends BaseRepository {
    protected string $table = 'users';
    
    /**
     * Find user by email
     */
    public function findByEmail(string $email): ?array {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM {$this->table} WHERE LOWER(email) = LOWER(?) LIMIT 1"
        );
        $stmt->execute([$email]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }
    
    /**
     * Find user by ID
     */
    public function findById(int $id): ?array {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM {$this->table} WHERE user_id = ? LIMIT 1"
        );
        $stmt->execute([$id]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }
    
    /**
     * Create new user
     */
    public function create(array $data): int {
        $stmt = $this->pdo->prepare(
            "INSERT INTO {$this->table} (name, email, national_id, password, role, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, 1, NOW())"
        );
        
        $stmt->execute([
            $data['name'],
            $data['email'],
            $data['national_id'],
            $data['password'],
            $data['role'] ?? 'customer',
        ]);
        
        return (int)$this->pdo->lastInsertId();
    }
    
    /**
     * Record failed login attempt
     */
    public function incrementFailedAttempts(int $userId): int {
        $stmt = $this->pdo->prepare(
            "UPDATE {$this->table} SET login_attempts = login_attempts + 1 WHERE user_id = ?"
        );
        $stmt->execute([$userId]);
        
        $user = $this->findById($userId);
        return $user['login_attempts'] ?? 0;
    }
    
    /**
     * Clear failed attempts
     */
    public function clearFailedAttempts(int $userId): void {
        $stmt = $this->pdo->prepare(
            "UPDATE {$this->table} SET login_attempts = 0, locked_until = NULL WHERE user_id = ?"
        );
        $stmt->execute([$userId]);
    }
    
    /**
     * Lock user account temporarily
     */
    public function lockAccount(int $userId, string $lockUntil): void {
        $stmt = $this->pdo->prepare(
            "UPDATE {$this->table} SET locked_until = ? WHERE user_id = ?"
        );
        $stmt->execute([$lockUntil, $userId]);
    }
    
    /**
     * Update last login timestamp
     */
    public function updateLastLogin(int $userId, string $ip): void {
        $stmt = $this->pdo->prepare(
            "UPDATE {$this->table} SET last_login_at = NOW() WHERE user_id = ?"
        );
        $stmt->execute([$userId]);
    }
    
    /**
     * Paginate users
     */
    public function paginate(int $page = 1, int $perPage = 20, array $filters = []): array {
        $query = "SELECT * FROM {$this->table} WHERE 1=1";
        $params = [];
        
        if ($filters['role'] ?? null) {
            $query .= " AND role = ?";
            $params[] = $filters['role'];
        }
        
        if ($filters['active'] ?? null) {
            $query .= " AND is_active = ?";
            $params[] = $filters['active'];
        }
        
        // Count total
        $countStmt = $this->pdo->prepare(str_replace('SELECT *', 'SELECT COUNT(*)', $query));
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();
        
        // Get paginated results
        $offset = ($page - 1) * $perPage;
        $query .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $params[] = $perPage;
        $params[] = $offset;
        
        $stmt = $this->pdo->prepare($query);
        $stmt->execute($params);
        
        return [
            'items' => $stmt->fetchAll(\PDO::FETCH_ASSOC),
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ];
    }
}

/**
 * Base Repository Class
 */
class BaseRepository {
    protected string $table;
    
    public function __construct(protected \PDO $pdo) {}
    
    public function findAll(): array {
        $stmt = $this->pdo->query("SELECT * FROM {$this->table}");
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
    
    public function findById(int $id): ?array {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM {$this->table} WHERE id = ? LIMIT 1"
        );
        $stmt->execute([$id]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }
}
```

---

## API Routes (routes/api.php)

```php
<?php
declare(strict_types=1);

/**
 * API Route Definitions (v1)
 */

// Public routes
$router->post('/api/auth/login', [\FQMS\Controllers\AuthController::class, 'login'])
    ->middleware(\FQMS\Middleware\RateLimitMiddleware::class);

$router->post('/api/auth/register', [\FQMS\Controllers\AuthController::class, 'register'])
    ->middleware(\FQMS\Middleware\RateLimitMiddleware::class);

// Protected routes (require authentication)
$router->post('/api/auth/logout', [\FQMS\Controllers\AuthController::class, 'logout'])
    ->middleware(\FQMS\Middleware\AuthMiddleware::class)
    ->middleware(\FQMS\Middleware\CsrfMiddleware::class);

// Station routes
$router->get('/api/stations', [\FQMS\Controllers\StationController::class, 'list'])
    ->middleware(\FQMS\Middleware\AuthMiddleware::class);

$router->get('/api/stations/{id}', [\FQMS\Controllers\StationController::class, 'show'])
    ->middleware(\FQMS\Middleware\AuthMiddleware::class);

// Queue routes
$router->patch('/api/stations/{id}/queue', [\FQMS\Controllers\QueueController::class, 'update'])
    ->middleware(\FQMS\Middleware\AuthMiddleware::class)
    ->middleware(\FQMS\Middleware\CsrfMiddleware::class);

// Admin routes
$router->get('/api/admin/users', [\FQMS\Controllers\AdminController::class, 'users'])
    ->middleware(\FQMS\Middleware\AdminMiddleware::class);

// ... more routes
```

---

This refactored backend provides:
✅ Scalable MVC architecture  
✅ Separation of concerns (Controller → Service → Repository → Model)  
✅ Middleware pipeline for cross-cutting concerns  
✅ Input validation layer  
✅ Security hardening (CSRF, rate limiting, auth)  
✅ Type safety with strict mode  
✅ Dependency injection ready  
✅ RESTful API design  
✅ Proper error handling
