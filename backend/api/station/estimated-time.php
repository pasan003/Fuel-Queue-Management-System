<?php
declare(strict_types=1);

/**
 * GET /api/station/{id}/estimated-time
 *
 * Calculate and return estimated waiting time for a station.
 * 
 * FORMULA: Estimated Waiting Time = Queue Length × 2 minutes per vehicle
 * 
 * Authentication: Required (user must be logged in)
 * Returns: JSON with estimated_time or status message
 * 
 * Examples:
 * - Queue: 5 vehicles → Estimated Wait: 10 minutes
 * - Queue: 12 vehicles → Estimated Wait: 24 minutes
 * - Queue: 0 vehicles → Estimated Wait: 0 minutes (Available now)
 */

require __DIR__ . '/../config.php';

// Parse URL to extract station ID from: /api/station/{id}/estimated-time
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$pathParts = explode('/', $requestUri);
$stationId = null;

for ($i = 0; $i < count($pathParts); $i++) {
    if ($pathParts[$i] === 'station' && isset($pathParts[$i + 1])) {
        $stationId = (int)$pathParts[$i + 1];
        break;
    }
}

// Validate station ID
if ($stationId === null || $stationId <= 0) {
    json_response(400, ['ok' => false, 'message' => 'Invalid or missing station ID']);
}

require_get();

// Check database connection
$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

// Verify user is authenticated
session_boot();
if (empty($_SESSION['user_id'])) {
    json_response(401, ['ok' => false, 'message' => 'Authentication required']);
}

try {
    // Fetch station data: queue length and fuel availability
    // Query joins with fuel_availability table to check both petrol and diesel
    $stationStmt = $pdo->prepare(
        'SELECT fs.station_id, fs.station_name, 
                COALESCE(qs.queue_length, 0) AS queue_length,
                MAX(CASE WHEN fa.fuel_type_id = 1 THEN fa.is_available ELSE 0 END) AS petrol_available,
                MAX(CASE WHEN fa.fuel_type_id = 2 THEN fa.is_available ELSE 0 END) AS diesel_available
         FROM fuel_stations fs
         LEFT JOIN queue_status qs ON qs.station_id = fs.station_id
         LEFT JOIN fuel_availability fa ON fa.station_id = fs.station_id
         WHERE fs.station_id = ?
         GROUP BY fs.station_id, fs.station_name, qs.queue_length'
    );
    $stationStmt->execute([$stationId]);
    $station = $stationStmt->fetch();

    // Return 404 if station doesn't exist
    if (!$station) {
        json_response(404, ['ok' => false, 'message' => 'Station not found']);
    }

    // Extract queue length (default 0 if no queue_status row exists yet)
    $queueLength = (int)$station['queue_length'];
    
    // Check fuel availability (station must have at least petrol OR diesel)
    $petrolAvailable = (bool)(int)($station['petrol_available'] ?? 0);
    $dieselAvailable = (bool)(int)($station['diesel_available'] ?? 0);
    $fuelAvailable = $petrolAvailable || $dieselAvailable;

    // EDGE CASE: If fuel is unavailable, cannot serve any customer
    if (!$fuelAvailable) {
        json_response(200, [
            'ok' => true,
            'station_id' => $stationId,
            'queue_length' => $queueLength,
            'unit' => 'minutes',
            'status' => 'unavailable',
            'message' => 'Requested fuel type is unavailable',
        ]);
    }

    // MAIN CALCULATION: estimated_time = queue_length × 2
    // This assumes 2 minutes average service time per vehicle
    $estimatedTime = $queueLength * 2;

    // Build and return successful response
    $response = [
        'ok' => true,
        'station_id' => $stationId,
        'queue_length' => $queueLength,
        'estimated_time' => $estimatedTime,
        'unit' => 'minutes',
    ];

    json_response(200, $response);

} catch (PDOException $e) {
    json_response(500, ['ok' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    json_response(500, ['ok' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
