# Estimated Waiting Time Logic

## Overview

The Fuel Queue Management System calculates estimated waiting time based on a simple, proven formula:

**Estimated Waiting Time (minutes) = Queue Length × 2**

This assumes an average service time of **2 minutes per vehicle**.

---

## Formula

```
waiting_time_minutes = queue_length × 2
```

### Examples

| Queue Length | Estimated Wait |
|------|---|
| 0 vehicles | 0 minutes |
| 5 vehicles | 10 minutes |
| 10 vehicles | 20 minutes |
| 12 vehicles | 24 minutes |
| 20 vehicles | 40 minutes |

---

## Implementation Details

### Database

The `queue_status` table stores:
- `queue_length` (INT): Current number of vehicles in queue
- `waiting_time` (INT): Pre-calculated estimated wait time in minutes

### Backend Calculation

When queue length is updated via `backend/update_queue.php`:
1. Queue length is validated (0 to 10000)
2. Waiting time is calculated: `waiting_time = queue_length × 2`
3. Both values are stored in the database
4. Updated values are returned to the client

### Frontend Display

The user dashboard and owner dashboard display:
- **Queue Length**: Number of vehicles waiting
- **Estimated Wait Time**: Auto-calculated waiting time in minutes

Updates happen in real-time when queue length changes.

---

## API Endpoints

### GET `/api/station/{id}/estimated-time`

Returns calculated waiting time for a station.

**Authentication**: Required (logged-in user)

**Response**:
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 12,
  "estimated_time": 24,
  "unit": "minutes"
}
```

**Edge Cases**:
- Empty queue: returns `estimated_time: 0`
- No fuel available: returns `status: "unavailable"` with `estimated_time: null`
- Invalid station: returns 404 error

### POST/PATCH/PUT `/backend/update_queue.php`

Updates queue length and auto-calculates waiting time.

**Authentication**: Required (any logged-in user)

**Request Body**:
```json
{
  "station_id": 1,
  "queue_length": 12
}
```

**Response**:
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 12,
  "waiting_time": 24,
  "updated_at": "2026-04-30T10:30:45Z"
}
```

---

## Benefits of This Approach

✅ **Simple & Predictable**: Easy to understand and communicate to users
✅ **Consistent**: Same calculation everywhere in the system
✅ **Fast**: Minimal overhead, no complex formulas
✅ **Reliable**: Based on proven average service time of 2 min/vehicle
✅ **Maintainable**: Easy to update if average service time changes
✅ **Real-time**: Updates instantly when queue changes

---

## Future Enhancements

- Track actual service times and adjust formula based on real data
- Account for different fuel types (petrol vs. diesel) with different service times
- Time-based adjustments (peak hours vs. off-peak)
- Per-pump efficiency metrics
