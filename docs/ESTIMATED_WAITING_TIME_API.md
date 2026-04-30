# Estimated Waiting Time Implementation Guide

## Overview

The Estimated Waiting Time feature calculates real-time queue wait times based on:
- **Queue Length**: Number of vehicles currently waiting
- **Service Rate**: Average time (in minutes) to serve one vehicle  
- **Active Pumps**: Number of operational fuel pumps
- **Fuel Availability**: Whether requested fuel type is in stock

## Core Formula

```
estimated_time (minutes) = (queue_length × service_rate) ÷ active_pumps
```

Result is rounded up using `ceil()` to provide conservative estimates.

---

## API Endpoints

### 1. GET /api/station/{id}/estimated-time

**Calculate estimated waiting time for a station.**

#### Authentication
- **Required**: User must be authenticated (session)

#### URL Parameters
- `id` (int): Station ID

#### Response (Success)
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 12,
  "estimated_time": 24,
  "unit": "minutes",
  "_debug": {
    "service_rate_minutes": 5.0,
    "active_pumps": 3,
    "fuel_available": true
  }
}
```

#### Response (Edge Cases)

**No queue:**
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 0,
  "estimated_time": 0,
  "unit": "minutes"
}
```

**Fuel unavailable:**
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 15,
  "unit": "minutes",
  "status": "unavailable",
  "message": "Requested fuel type is unavailable"
}
```

**No active pumps:**
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 20,
  "unit": "minutes",
  "status": "no_pumps",
  "message": "No active pumps available"
}
```

#### Error Responses

**Invalid station ID:**
```json
{
  "ok": false,
  "message": "Station not found"
}
```
Status: 404

**Not authenticated:**
```json
{
  "ok": false,
  "message": "Authentication required"
}
```
Status: 401

---

### 2. PUT/PATCH /api/station/update-params

**Update station operational parameters (service rate, active pumps).**

#### Authentication
- **Required**: Owner role only
- Station owner must be logged in and linked to the station

#### Request Body (JSON)
```json
{
  "service_rate": 5.5,
  "active_pumps": 4
}
```

**Note**: At least one parameter is required.

#### Request Parameters
- `service_rate` (float, optional): Average minutes to serve one vehicle (> 0, max 1000)
- `active_pumps` (int, optional): Number of working pumps (> 0, max 100)

#### Response (Success)
```json
{
  "ok": true,
  "message": "Station operational parameters updated",
  "station_id": 1,
  "service_rate": 5.5,
  "active_pumps": 4
}
```
Status: 200

#### Error Responses

**Invalid service rate:**
```json
{
  "ok": false,
  "message": "service_rate must be greater than 0"
}
```
Status: 400

**Not owner:**
```json
{
  "ok": false,
  "message": "Owner access only"
}
```
Status: 403

---

## Business Logic

### Edge Case Handling

#### 1. Empty Queue (`queue_length == 0`)
- **Result**: `estimated_time = 0`
- **Status**: `immediate`
- **Interpretation**: Service available now

#### 2. Fuel Unavailable (`fuel_available == false`)
- **Result**: `estimated_time = null`
- **Status**: `unavailable`
- **Interpretation**: Cannot serve regardless of queue

#### 3. No Active Pumps (`active_pumps == 0`)
- **Result**: `estimated_time = null`
- **Status**: `no_pumps`
- **Interpretation**: Station is not operational

#### 4. Invalid Inputs
- Negative queue length → Error (400)
- Negative/zero service rate → Error (400)
- Negative/zero active pumps → Error (400)

### Calculation Examples

**Example 1: Standard Queue**
```
Queue: 12 vehicles
Service Rate: 5 minutes/vehicle  
Pumps: 3

Calculation: (12 × 5) ÷ 3 = 60 ÷ 3 = 20 minutes
```

**Example 2: Single Vehicle, Multiple Pumps**
```
Queue: 1 vehicle
Service Rate: 4 minutes/vehicle
Pumps: 2

Calculation: (1 × 4) ÷ 2 = 4 ÷ 2 = 2 minutes
```

**Example 3: Large Queue, High Service Rate**
```
Queue: 50 vehicles
Service Rate: 3 minutes/vehicle
Pumps: 5

Calculation: (50 × 3) ÷ 5 = 150 ÷ 5 = 30 minutes
Rounded: ceil(30.0) = 30 minutes
```

---

## Database Schema

### queue_status Table Extensions

```sql
CREATE TABLE `queue_status` (
  `queue_id` int NOT NULL AUTO_INCREMENT,
  `station_id` int NOT NULL,
  `queue_length` int NOT NULL DEFAULT '0',
  `waiting_time` int NOT NULL DEFAULT '0',
  `service_rate` decimal(5,2) NOT NULL DEFAULT '5.00' 
    COMMENT 'Average minutes to serve one vehicle',
  `active_pumps` int NOT NULL DEFAULT '1' 
    COMMENT 'Number of active/working fuel pumps',
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`queue_id`),
  UNIQUE KEY `uq_queue_station` (`station_id`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_service_active` (`service_rate`, `active_pumps`),
  ...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Default Values
- `service_rate`: 5.00 minutes per vehicle
- `active_pumps`: 1 pump
- Can be updated per station

---

## Service Class: WaitingTimeService

Located in: `/backend/services/WaitingTimeService.php`

### Public Methods

#### `calculate(int $queueLength, float $serviceRate, int $activePumps, bool $fuelAvailable): array`

**Purpose**: Calculate estimated waiting time with comprehensive validation and edge case handling.

**Parameters**:
- `$queueLength`: Number of vehicles waiting (≥ 0)
- `$serviceRate`: Minutes per vehicle (> 0)
- `$activePumps`: Number of pumps (> 0)
- `$fuelAvailable`: Fuel availability flag

**Returns**: 
```php
[
  'success' => bool,              // Calculation succeeded
  'estimated_time' => int|null,   // Result in minutes or null
  'status' => string,             // 'success', 'immediate', 'unavailable', 'no_pumps', 'invalid_*'
  'message' => string             // Human-readable explanation
]
```

#### `validate(array $stationData, ?string $requiredKey = null): array`

**Purpose**: Validate presence of required station data fields.

**Returns**:
```php
[
  'valid' => bool,
  'errors' => string[]
]
```

#### `formatResponse(int $stationId, int $queueLength, array $calcResult): array`

**Purpose**: Format calculation result for API response.

---

## Implementation Checklist

- ✅ Created `WaitingTimeService` class
- ✅ Implemented core calculation formula
- ✅ Added edge case handling (empty queue, no fuel, no pumps)
- ✅ Created GET endpoint for estimated time retrieval
- ✅ Created PUT/PATCH endpoint for parameter updates
- ✅ Updated database schema with new columns
- ✅ Added comprehensive input validation
- ✅ Prevented negative/invalid values
- ✅ Kept business logic separate from controllers
- ✅ Made code reusable and clean

---

## Recalculation Strategy

The estimated waiting time is **calculated dynamically** on each request (not pre-stored). This ensures:

1. **Accuracy**: Always reflects current station state
2. **Consistency**: Single source of truth for calculation logic
3. **Flexibility**: Easy to adjust calculation formula
4. **Performance**: Lightweight calculation (one database query + arithmetic)

### When Recalculation Occurs

Automatically triggered by:
- **Queue update**: Any change to `queue_length` triggers new estimate
- **Pump status change**: Updating `active_pumps` triggers new estimate
- **Fuel availability change**: Fuel status affects estimate eligibility
- **API request**: Each GET request recalculates based on current data

---

## Usage Examples

### cURL Examples

**Get estimated time:**
```bash
curl -X GET "http://localhost/backend/api/station/1/estimated-time" \
  -H "Cookie: PHPSESSID=your_session_id"
```

**Update station parameters:**
```bash
curl -X PUT "http://localhost/backend/api/station/update-params" \
  -H "Content-Type: application/json" \
  -H "Cookie: PHPSESSID=owner_session_id" \
  -d '{"service_rate": 5.5, "active_pumps": 4}'
```

### JavaScript/Fetch Examples

```javascript
// Get estimated time
const response = await fetch('/api/station/1/estimated-time', {
  method: 'GET',
  credentials: 'include'
});
const data = await response.json();
console.log(`Estimated wait: ${data.estimated_time} minutes`);

// Update parameters
const updateResponse = await fetch('/api/station/update-params', {
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service_rate: 5.5,
    active_pumps: 4
  })
});
const updateData = await updateResponse.json();
console.log(`Updated: ${updateData.message}`);
```

---

## Performance Considerations

- **Single query**: One prepared statement retrieves all necessary data
- **Indexed columns**: `service_rate`, `active_pumps` indexed for fast lookups
- **Lightweight calculation**: Simple arithmetic operation (no loops/recursion)
- **Reusable service**: Can be imported and used across multiple endpoints
- **No redundant calculations**: Formula computed only when needed

---

## Maintenance & Future Enhancements

### Potential Improvements
1. Add caching layer for frequently accessed stations
2. Store calculation history for analytics
3. Implement predictive wait time (ML-based)
4. Add station-specific service rate profiles
5. Support dynamic service rates by fuel type
6. Implement queue forecasting

### Known Limitations
- Assumes uniform service rate for all vehicles
- Does not account for peak hour variations
- Does not consider fuel type-specific service times
- Linear calculation (no queue dynamics)

---

## Support & Debugging

### Verify Installation

1. **Check database migration:**
```sql
DESC queue_status;  -- Should show service_rate and active_pumps columns
```

2. **Test API endpoint:**
```bash
curl http://localhost/backend/api/station/1/estimated-time
```

3. **Check service class:**
```php
require 'backend/services/WaitingTimeService.php';
echo class_exists('WaitingTimeService') ? 'OK' : 'MISSING';
```

### Common Issues

**404 on estimated-time endpoint**
- Check URL routing configuration
- Ensure API file exists at `/backend/api/station/estimated-time.php`

**Missing columns error**
- Run migration: `/database/migrations/001_add_waiting_time_columns.sql`
- Or reimport schema: `/database/fqms.sql`

**Calculation returns "unavailable"**
- Verify fuel_availability table has correct `is_available` values
- Check that fuel_type_id 1 (Petrol) or 2 (Diesel) exists

---

## Version History

- **v1.0** (Apr 2026): Initial implementation
  - Core calculation formula
  - Edge case handling
  - API endpoints
  - Database schema updates
