# Quick Start: Estimated Waiting Time

## 🚀 Formula

**Estimated Waiting Time (minutes) = Queue Length × 2**

This uses an average service time of **2 minutes per vehicle**.

---

## Setup (Already Done!)

The system is ready to use. No additional setup needed. Database already has:
- `queue_status.queue_length` — Number of vehicles waiting
- `queue_status.waiting_time` — Pre-calculated wait time in minutes

---

## 📊 Quick Examples

### Example 1: Queue with 5 Vehicles
```
Queue Length: 5 vehicles
Waiting Time: 5 × 2 = 10 minutes
```

### Example 2: Queue with 12 Vehicles  
```
Queue Length: 12 vehicles
Waiting Time: 12 × 2 = 24 minutes
```

### Example 3: Queue with 20 Vehicles
```
Queue Length: 20 vehicles
Waiting Time: 20 × 2 = 40 minutes
```

---

## 🔌 API Endpoint: Get Estimated Time

**Endpoint**: `GET /api/station/{id}/estimated-time`

**Authentication**: Required (must be logged in)

**Example Request**:
```bash
curl -X GET "http://localhost/Fuel-Queue-Management-System/backend/api/station/1/estimated-time" \
  --cookie "PHPSESSID=your_session_id"
```

**Example Response**:
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 12,
  "estimated_time": 24,
  "unit": "minutes"
}
```

---

## 🖥️ Frontend Display

### User Dashboard Shows
- **Queue Length**: 12 vehicles
- **Estimated Wait**: 24 minutes

### Owner Dashboard Shows
- **Queue Length**: 12 vehicles
- **Estimated Wait**: 24 minutes

Both update automatically when queue changes.

---

## 📝 Update Queue Length

**Endpoint**: `POST /backend/update_queue.php`

**Authentication**: Required (any logged-in user)

**Request Body**:
```json
{
  "station_id": 1,
  "queue_length": 15
}
```

**Response**:
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 15,
  "waiting_time": 30,
  "updated_at": "2026-04-30T10:30:45Z"
}
```

**What Happens**:
1. Queue length updated to 15
2. Waiting time auto-calculated: 15 × 2 = 30 minutes
3. Both values stored and returned

---

## ⚠️ Special Cases

| Scenario | Result |
|----------|--------|
| 0 vehicles | 0 minutes (Service available now) |
| Fuel unavailable | `status: "unavailable"` (Can't serve) |
| Negative queue | 400 error (Invalid) |
| Queue > 10000 | 400 error (Unrealistic) |

---

## 🧪 Test the API

### Step 1: Login
```bash
# Register or login first to get a session
# See main README.md for auth flow
```

### Step 2: Get List of Stations
```bash
curl -X GET "http://localhost/Fuel-Queue-Management-System/backend/stations.php" \
  --cookie "PHPSESSID=your_session_id"
```

### Step 3: Get Estimated Wait Time
```bash
curl -X GET "http://localhost/Fuel-Queue-Management-System/backend/api/station/1/estimated-time" \
  --cookie "PHPSESSID=your_session_id"
```

### Step 4: Update Queue Length
```bash
curl -X POST "http://localhost/Fuel-Queue-Management-System/backend/update_queue.php" \
  --cookie "PHPSESSID=your_session_id" \
  -H "Content-Type: application/json" \
  -d '{"station_id": 1, "queue_length": 8}'
```

---

## 💻 JavaScript Integration

### Get Wait Time
```javascript
async function getWaitTime(stationId) {
  const response = await fetch(`backend/api/station/${stationId}/estimated-time`, {
    method: 'GET',
    credentials: 'include'  // Include session cookie
  });
  
  const data = await response.json();
  
  if (!data.ok) {
    console.error(data.message);
    return null;
  }
  
  return data.estimated_time;  // Returns minutes
}

// Use it
const waitMinutes = await getWaitTime(1);
console.log(`Wait time: ${waitMinutes} minutes`);
```

### Update Queue Length
```javascript
async function updateQueue(stationId, newQueueLength) {
  const response = await fetch('backend/update_queue.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      station_id: stationId,
      queue_length: newQueueLength
    })
  });
  
  const data = await response.json();
  
  if (!data.ok) {
    console.error(data.message);
    return null;
  }
  
  return {
    queueLength: data.queue_length,
    waitingTime: data.waiting_time
  };
}

// Use it
const result = await updateQueue(1, 8);
console.log(`Queue: ${result.queueLength}, Wait: ${result.waitingTime} min`);
```

---

## 🎯 Implementation Checklist

- ✅ Formula: `waiting_time = queue_length × 2`
- ✅ Database stores `queue_length` and `waiting_time`
- ✅ Backend calculates waiting time on queue update
- ✅ Frontend displays both values
- ✅ Owner dashboard shows metrics
- ✅ User dashboard shows metrics
- ✅ Real-time updates when queue changes

---

## 📚 More Documentation

- [Waiting Time Logic Details](WAITING_TIME_LOGIC.md)
- [Main README](../README.md)
- [Database Schema](../database/fqms.sql)

---

## 🐛 Common Issues

### "Authentication required" error
→ Login first, then make API calls with session

### "Station not found"
→ Check station ID exists in database

### "Queue length exceeds limit"
→ Maximum queue length is 10,000 vehicles

### Wait time doesn't update
→ Check database connection
→ Verify `update_queue.php` is being called

---

**Ready to use!** The system is production-ready. Update queue lengths as needed, and estimated times calculate automatically.
