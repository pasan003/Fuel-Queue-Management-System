# Quick Start Guide: Estimated Waiting Time API

## 🚀 Setup in 5 Minutes

### Step 1: Update Database Schema
```bash
# Option A: Fresh Installation
mysql -u root -p fqms < database/fqms.sql

# Option B: Existing Installation (Run Migration)
mysql -u root -p fqms < database/migrations/001_add_waiting_time_columns.sql
```

### Step 2: Verify Installation
```bash
# Check that columns exist
mysql -u root -p fqms -e "DESC queue_status;"
# Should show: service_rate (DECIMAL 5,2), active_pumps (INT)
```

### Step 3: Verify API Endpoints
```bash
# Assuming PHP local server running on localhost:8000
curl -X GET "http://localhost/backend/api/station/1/estimated-time" \
  --cookie "PHPSESSID=your_session_id"
```

---

## 📊 Quick Examples

### 1️⃣ Get Estimated Wait Time
**What**: Retrieve how long a customer needs to wait at a station

**cURL**:
```bash
curl -X GET "http://localhost/backend/api/station/1/estimated-time" \
  --cookie "PHPSESSID=your_session_id"
```

**Response** (if station has 12 vehicles, 5 min/vehicle, 3 pumps):
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 12,
  "estimated_time": 20,
  "unit": "minutes"
}
```

**Calculation**: (12 × 5) ÷ 3 = 20 minutes

---

### 2️⃣ Update Station Parameters (Owner Only)
**What**: Owner updates how many pumps are working and service time

**cURL**:
```bash
curl -X PUT "http://localhost/backend/api/station/update-params" \
  --cookie "PHPSESSID=owner_session_id" \
  -H "Content-Type: application/json" \
  -d '{
    "service_rate": 4.5,
    "active_pumps": 4
  }'
```

**Response**:
```json
{
  "ok": true,
  "message": "Station operational parameters updated",
  "station_id": 1,
  "service_rate": 4.5,
  "active_pumps": 4
}
```

---

### 3️⃣ JavaScript Integration
```javascript
// Get estimated time
async function getEstimatedTime(stationId) {
  try {
    const response = await fetch(`/backend/api/station/${stationId}/estimated-time`, {
      method: 'GET',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.status === 'unavailable') {
      return '❌ Fuel Not Available';
    } else if (data.status === 'no_pumps') {
      return '⚠️ Station Not Operational';
    } else if (data.estimated_time === 0) {
      return '✅ Service Available Now';
    } else {
      return `⏱️ Wait ${data.estimated_time} minutes`;
    }
  } catch (error) {
    console.error('Error:', error);
    return '❓ Unable to fetch estimate';
  }
}

// Update pumps (owner only)
async function updateStationPumps(newPumpCount) {
  const response = await fetch('/backend/api/station/update-params', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active_pumps: newPumpCount })
  });
  
  return await response.json();
}
```

---

## 🧮 Calculation Formula

```
Estimated Wait Time = (Queue Length × Service Rate) ÷ Active Pumps
Result is rounded UP using ceil()

Examples:
- 12 vehicles × 5 min/vehicle ÷ 3 pumps = 20 minutes
- 100 vehicles × 2.5 min/vehicle ÷ 5 pumps = 50 minutes
- 10 vehicles × 3.5 min/vehicle ÷ 4 pumps = 8.75 → 9 minutes (rounded up)
```

---

## ⚠️ Special Cases

| Scenario | Result | What It Means |
|----------|--------|---------------|
| 0 vehicles waiting | 0 minutes | ✅ No wait, come now! |
| Fuel out of stock | `status: "unavailable"` | ❌ Can't serve this fuel |
| No pumps working | `status: "no_pumps"` | 🔧 Station maintenance |
| Invalid data | 400 error | 💥 Bad request |

---

## 🔧 API Parameters

### GET /api/station/{id}/estimated-time

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | int | YES | Station ID in URL |
| Session | string | YES | Must be logged in |

---

### PUT/PATCH /api/station/update-params

| Parameter | Type | Required | Min | Max | Description |
|-----------|------|----------|-----|-----|-------------|
| service_rate | float | NO | 0.01 | 1000 | Minutes per vehicle |
| active_pumps | int | NO | 1 | 100 | Number of pumps |
| Session | string | YES | - | - | Must be owner role |

**Notes**:
- At least one parameter required
- Owner must own the station
- New values take effect immediately

---

## 📝 Test Checklist

- [ ] Database columns added: `service_rate`, `active_pumps`
- [ ] GET endpoint returns estimated time
- [ ] Calculation matches: (Q × S) ÷ P
- [ ] Results rounded up with ceil()
- [ ] Empty queue returns 0
- [ ] Unavailable fuel returns "unavailable" status
- [ ] No pumps returns "no_pumps" status
- [ ] Owner can update parameters
- [ ] Non-owners cannot update parameters
- [ ] Session authentication works

---

## 🐛 Troubleshooting

### "Station not found" error
```
→ Check station_id exists in fuel_stations table
→ SQL: SELECT * FROM fuel_stations WHERE station_id = 1;
```

### "Authentication required" error
```
→ User must be logged in (session active)
→ Include: --cookie "PHPSESSID=your_session_id"
```

### "Owner access only" error
```
→ Only station owners can update parameters
→ Check user role: SELECT role FROM users WHERE user_id = 1;
→ Role must be 'owner'
```

### Column doesn't exist error
```
→ Run migration: database/migrations/001_add_waiting_time_columns.sql
→ OR re-import: database/fqms.sql
```

### Wrong wait time calculation
```
→ Verify queue_length, service_rate, active_pumps values
→ SQL: SELECT * FROM queue_status WHERE station_id = 1;
→ Manual calc: (queue_length × service_rate) ÷ active_pumps
```

---

## 📚 Full Documentation

See `docs/ESTIMATED_WAITING_TIME_API.md` for:
- Detailed API reference
- Database schema documentation
- All edge cases explained
- Performance considerations
- Future enhancements

---

## 💡 Real-World Usage

### Customer Dashboard
```javascript
// Update wait time every 10 seconds
setInterval(async () => {
  const waitTime = await getEstimatedTime(currentStationId);
  document.getElementById('wait-display').textContent = waitTime;
}, 10000);
```

### Owner Dashboard
```javascript
// When owner updates pump count
async function setPumps(count) {
  const result = await updateStationPumps(count);
  if (result.ok) {
    alert(`Updated to ${count} pumps`);
    // Queue wait times automatically recalculate
  }
}
```

### Mobile App
```javascript
// Show visual indicator
function getWaitIcon(minutes) {
  if (minutes === 0) return '✅ Go Now';
  if (minutes <= 10) return '🟢 Quick (~' + minutes + ' min)';
  if (minutes <= 30) return '🟡 Normal (~' + minutes + ' min)';
  return '🔴 Long Wait (~' + minutes + ' min)';
}
```

---

## ✅ You're Done!

Your Estimated Waiting Time system is ready to use. Start calling the API endpoints from your frontend applications!

**Need help?** Check the full API documentation or test cases for more details.
