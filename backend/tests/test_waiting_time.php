<?php
declare(strict_types=1);

/**
 * Test/Example: Estimated Waiting Time Calculation
 * 
 * This file demonstrates usage of the WaitingTimeService class.
 * NOT meant for production — use API endpoints instead.
 * 
 * Run from command line:
 *   php backend/tests/test_waiting_time.php
 */

require_once __DIR__ . '/../services/WaitingTimeService.php';

echo "=== Estimated Waiting Time Service Tests ===\n\n";

// Test Case 1: Standard calculation
echo "TEST 1: Standard Queue Calculation\n";
echo "Queue: 12 vehicles, Service: 5 min/vehicle, Pumps: 3\n";
$result1 = WaitingTimeService::calculate(12, 5.0, 3, true);
echo "Result: " . ($result1['estimated_time'] ?? 'null') . " minutes\n";
echo "Status: {$result1['status']}\n";
echo "---\n\n";

// Test Case 2: Empty queue
echo "TEST 2: Empty Queue\n";
echo "Queue: 0 vehicles, Service: 5 min/vehicle, Pumps: 2\n";
$result2 = WaitingTimeService::calculate(0, 5.0, 2, true);
echo "Result: " . ($result2['estimated_time'] ?? 'null') . " minutes\n";
echo "Status: {$result2['status']}\n";
echo "---\n\n";

// Test Case 3: Fuel unavailable
echo "TEST 3: Fuel Unavailable\n";
echo "Queue: 20 vehicles, Service: 4 min/vehicle, Pumps: 4, Fuel: NO\n";
$result3 = WaitingTimeService::calculate(20, 4.0, 4, false);
echo "Result: " . ($result3['estimated_time'] ?? 'null') . " minutes\n";
echo "Status: {$result3['status']}\n";
echo "Message: {$result3['message']}\n";
echo "---\n\n";

// Test Case 4: No active pumps
echo "TEST 4: No Active Pumps\n";
echo "Queue: 15 vehicles, Service: 5 min/vehicle, Pumps: 0, Fuel: YES\n";
$result4 = WaitingTimeService::calculate(15, 5.0, 0, true);
echo "Result: " . ($result4['estimated_time'] ?? 'null') . " minutes\n";
echo "Status: {$result4['status']}\n";
echo "Message: {$result4['message']}\n";
echo "---\n\n";

// Test Case 5: Rounding up (ceil)
echo "TEST 5: Rounding Up Test\n";
echo "Queue: 10 vehicles, Service: 3.5 min/vehicle, Pumps: 4\n";
echo "Calculation: (10 × 3.5) ÷ 4 = 35 ÷ 4 = 8.75 → ceil = 9 minutes\n";
$result5 = WaitingTimeService::calculate(10, 3.5, 4, true);
echo "Result: " . ($result5['estimated_time'] ?? 'null') . " minutes\n";
echo "---\n\n";

// Test Case 6: Large queue
echo "TEST 6: Large Queue\n";
echo "Queue: 100 vehicles, Service: 2.5 min/vehicle, Pumps: 5\n";
echo "Calculation: (100 × 2.5) ÷ 5 = 250 ÷ 5 = 50 minutes\n";
$result6 = WaitingTimeService::calculate(100, 2.5, 5, true);
echo "Result: " . ($result6['estimated_time'] ?? 'null') . " minutes\n";
echo "---\n\n";

// Test Case 7: Single pump
echo "TEST 7: Single Pump (Default)\n";
echo "Queue: 8 vehicles, Service: 4 min/vehicle, Pumps: 1\n";
echo "Calculation: (8 × 4) ÷ 1 = 32 minutes\n";
$result7 = WaitingTimeService::calculate(8, 4.0, 1, true);
echo "Result: " . ($result7['estimated_time'] ?? 'null') . " minutes\n";
echo "---\n\n";

// Test Case 8: High efficiency (many pumps)
echo "TEST 8: High Efficiency (Many Pumps)\n";
echo "Queue: 30 vehicles, Service: 3 min/vehicle, Pumps: 10\n";
echo "Calculation: (30 × 3) ÷ 10 = 90 ÷ 10 = 9 minutes\n";
$result8 = WaitingTimeService::calculate(30, 3.0, 10, true);
echo "Result: " . ($result8['estimated_time'] ?? 'null') . " minutes\n";
echo "---\n\n";

// Test Case 9: Invalid input - negative queue
echo "TEST 9: Invalid Input - Negative Queue\n";
echo "Queue: -5 vehicles (INVALID)\n";
$result9 = WaitingTimeService::calculate(-5, 5.0, 2, true);
echo "Success: " . ($result9['success'] ? 'true' : 'false') . "\n";
echo "Status: {$result9['status']}\n";
echo "Message: {$result9['message']}\n";
echo "---\n\n";

// Test Case 10: Invalid input - zero service rate
echo "TEST 10: Invalid Input - Zero Service Rate\n";
echo "Queue: 10 vehicles, Service: 0 min/vehicle (INVALID)\n";
$result10 = WaitingTimeService::calculate(10, 0.0, 3, true);
echo "Success: " . ($result10['success'] ? 'true' : 'false') . "\n";
echo "Status: {$result10['status']}\n";
echo "Message: {$result10['message']}\n";
echo "---\n\n";

// Summary Table
echo "=== SUMMARY TABLE ===\n";
echo sprintf(
    "%-45s | %-10s | %-8s | %-15s\n",
    "Test Case",
    "Wait Time",
    "Status",
    "Success"
);
echo str_repeat("-", 85) . "\n";

$tests = [
    ["Standard Queue", $result1],
    ["Empty Queue", $result2],
    ["Fuel Unavailable", $result3],
    ["No Pumps", $result4],
    ["Rounding Up", $result5],
    ["Large Queue", $result6],
    ["Single Pump", $result7],
    ["Many Pumps", $result8],
    ["Negative Queue", $result9],
    ["Zero Service Rate", $result10],
];

foreach ($tests as [$name, $result]) {
    $waitTime = $result['estimated_time'] !== null ? $result['estimated_time'] . ' min' : 'N/A';
    $success = $result['success'] ? 'Yes' : 'No';
    echo sprintf(
        "%-45s | %-10s | %-8s | %-15s\n",
        $name,
        $waitTime,
        $result['status'],
        $success
    );
}

echo "\n=== All Tests Complete ===\n";
