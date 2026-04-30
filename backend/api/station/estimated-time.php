<?php
declare(strict_types=1);

/**
 * GET /api/station/{id}/estimated-time
 *
 * Calculate and return estimated waiting time for a station.
 * 
 * Requires: Authentication (session)
 * Returns: { station_id, queue_length, estimated_time, unit, status?, message? }
 * 
 * Edge cases handled:
 * - Queue empty (0 minutes)
 * - Fuel unavailable ("unavailable" status)
 * - No active pumps ("no_pumps" status)
 * - Invalid data (error response)
 */

require __DIR__ . '/../config.php';
require __DIR__ . '/../services/WaitingTimeService.php';

// Parse URL to extract station ID
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$pathParts = explode('/', $requestUri);
$stationId = null;

// Handle URL: /api/station/123/estimated-time
for ($i = 0; $i < count($pathParts); $i++) {
    if ($pathParts[$i] === 'station' && isset($pathParts[$i + 1])) {
        $stationId = (int)$pathParts[$i + 1];
        break;
    }
}

if ($stationId === null || $stationId <= 0) {
    json_response(400, ['ok' => false, 'message' => 'Invalid or missing station ID']);
}

require_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

session_boot();
if (empty($_SESSION['user_id'])) {
    json_response(401, ['ok' => false, 'message' => 'Authentication required']);
}

try {
    // Fetch station data with queue and fuel info
    $stationStmt = $pdo->prepare(
        'SELECT fs.station_id, fs.station_name, 
                qs.queue_length, qs.service_rate, qs.active_pumps,
                MAX(CASE WHEN fa.fuel_type_id = 1 THEN fa.is_available ELSE 0 END) AS petrol_available,
                MAX(CASE WHEN fa.fuel_type_id = 2 THEN fa.is_available ELSE 0 END) AS diesel_available
         FROM fuel_stations fs
         LEFT JOIN queue_status qs ON qs.station_id = fs.station_id
         LEFT JOIN fuel_availability fa ON fa.station_id = fs.station_id
         WHERE fs.station_id = ?
         GROUP BY fs.station_id, fs.station_name, qs.queue_length, qs.service_rate, qs.active_pumps'
    );
    $stationStmt->execute([$stationId]);
    $station = $stationStmt->fetch();

    if (!$station) {
        json_response(404, ['ok' => false, 'message' => 'Station not found']);
    }

    // Extract data with defaults
    $queueLength = (int)($station['queue_length'] ?? 0);
    $serviceRate = (float)($station['service_rate'] ?? 5.0); // Default: 5 minutes per vehicle
    $activePumps = (int)($station['active_pumps'] ?? 1); // Default: 1 pump
    
    // Determine fuel availability - check if ANY fuel type is available
    $petrolAvailable = (bool)(int)($station['petrol_available'] ?? 0);
    $dieselAvailable = (bool)(int)($station['diesel_available'] ?? 0);
    $fuelAvailable = $petrolAvailable || $dieselAvailable;

    // Calculate estimated time using service
    $result = WaitingTimeService::calculate(
        $queueLength,
        $serviceRate,
        $activePumps,
        $fuelAvailable
    );

    // Format response
    $response = [
        'ok' => true,
        'station_id' => $stationId,
        'queue_length' => $queueLength,
        'unit' => 'minutes',
    ];

    if ($result['estimated_time'] !== null) {
        $response['estimated_time'] = $result['estimated_time'];
    }

    if ($result['status'] !== 'success') {
        $response['status'] = $result['status'];
        if (!$result['success'] && $result['status'] === 'invalid_input') {
            json_response(400, array_merge($response, ['ok' => false, 'message' => $result['message']]));
        } else {
            $response['message'] = $result['message'];
        }
    } else {
        // Success case - add calculation details
        $response['estimated_time'] = $result['estimated_time'];
    }

    // Include operational data for debugging/analytics
    $response['_debug'] = [
        'service_rate_minutes' => $serviceRate,
        'active_pumps' => $activePumps,
        'fuel_available' => $fuelAvailable,
    ];

    json_response(200, $response);

} catch (PDOException $e) {
    json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    json_response(500, ['ok' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
