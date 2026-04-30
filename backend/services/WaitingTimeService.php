<?php
declare(strict_types=1);

/**
 * WaitingTimeService: Calculate estimated waiting time for fuel stations.
 * 
 * Formula: estimated_time = (queue_length × service_rate) ÷ active_pumps
 * 
 * Handles all edge cases and validates input.
 */

class WaitingTimeService
{
    /**
     * Calculate estimated waiting time in minutes.
     *
     * @param int $queueLength    Number of vehicles waiting (must be >= 0)
     * @param float $serviceRate  Average time to serve one vehicle in minutes (must be > 0)
     * @param int $activePumps    Number of working fuel pumps (must be > 0)
     * @param bool $fuelAvailable Whether requested fuel type is available
     *
     * @return array Result with keys: 'success' (bool), 'estimated_time' (int|null), 'status' (string), 'message' (string)
     */
    public static function calculate(
        int $queueLength,
        float $serviceRate,
        int $activePumps,
        bool $fuelAvailable
    ): array {
        // Validate inputs - prevent negative values
        if ($queueLength < 0) {
            return [
                'success' => false,
                'estimated_time' => null,
                'status' => 'invalid_input',
                'message' => 'Queue length cannot be negative',
            ];
        }

        if ($serviceRate < 0) {
            return [
                'success' => false,
                'estimated_time' => null,
                'status' => 'invalid_input',
                'message' => 'Service rate cannot be negative',
            ];
        }

        if ($activePumps < 0) {
            return [
                'success' => false,
                'estimated_time' => null,
                'status' => 'invalid_input',
                'message' => 'Active pumps cannot be negative',
            ];
        }

        // Edge case: No fuel available
        if (!$fuelAvailable) {
            return [
                'success' => true,
                'estimated_time' => null,
                'status' => 'unavailable',
                'message' => 'Requested fuel type is unavailable',
            ];
        }

        // Edge case: No active pumps
        if ($activePumps === 0) {
            return [
                'success' => true,
                'estimated_time' => null,
                'status' => 'no_pumps',
                'message' => 'No active pumps available',
            ];
        }

        // Edge case: No service rate defined
        if ($serviceRate <= 0) {
            return [
                'success' => false,
                'estimated_time' => null,
                'status' => 'invalid_service_rate',
                'message' => 'Service rate must be greater than zero',
            ];
        }

        // Edge case: Empty queue
        if ($queueLength === 0) {
            return [
                'success' => true,
                'estimated_time' => 0,
                'status' => 'immediate',
                'message' => 'Station has no queue, service available immediately',
            ];
        }

        // Core calculation: (queue_length × service_rate) ÷ active_pumps
        $estimatedTimeFloat = ($queueLength * $serviceRate) / $activePumps;

        // Round up using ceil() to get conservative estimate
        $estimatedTime = (int)ceil($estimatedTimeFloat);

        return [
            'success' => true,
            'estimated_time' => $estimatedTime,
            'status' => 'success',
            'message' => sprintf(
                'Estimated waiting time calculated: %d vehicle(s) × %.2f min/vehicle ÷ %d pump(s) = %d minute(s)',
                $queueLength,
                $serviceRate,
                $activePumps,
                $estimatedTime
            ),
        ];
    }

    /**
     * Validate that all required station data fields are present and valid.
     *
     * @param array $stationData  Array with keys: queue_length, service_rate, active_pumps, fuel_available
     * @param string $requiredKey Optional specific key to validate
     *
     * @return array ['valid' => bool, 'errors' => string[]]
     */
    public static function validate(array $stationData, ?string $requiredKey = null): array
    {
        $errors = [];
        $requiredKeys = ['queue_length', 'service_rate', 'active_pumps', 'fuel_available'];

        if ($requiredKey !== null) {
            $requiredKeys = [$requiredKey];
        }

        foreach ($requiredKeys as $key) {
            if (!isset($stationData[$key])) {
                $errors[] = "Missing required field: {$key}";
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Format result for API response.
     *
     * @param int $stationId      Station identifier
     * @param int $queueLength    Current queue length
     * @param array $calcResult   Result from calculate() method
     *
     * @return array API response object
     */
    public static function formatResponse(
        int $stationId,
        int $queueLength,
        array $calcResult
    ): array {
        $response = [
            'station_id' => $stationId,
            'queue_length' => $queueLength,
            'unit' => 'minutes',
        ];

        if ($calcResult['estimated_time'] !== null) {
            $response['estimated_time'] = $calcResult['estimated_time'];
        }

        if ($calcResult['status'] !== 'success') {
            $response['status'] = $calcResult['status'];
            $response['message'] = $calcResult['message'];
        } else {
            $response['estimated_time'] = $calcResult['estimated_time'];
        }

        return $response;
    }
}
