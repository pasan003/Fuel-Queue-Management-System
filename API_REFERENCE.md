# API REFERENCE - RESTful Endpoints

Complete production-ready API documentation with standardized response formats.

---

## Table of Contents
1. [API Overview](#api-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Station Endpoints](#station-endpoints)
4. [Queue Endpoints](#queue-endpoints)
5. [Owner Endpoints](#owner-endpoints)
6. [Admin Endpoints](#admin-endpoints)
7. [Response Formats](#response-formats)
8. [Error Handling](#error-handling)

---

## API Overview

### Base URL
```
Production: https://api.fqms.example.com/api/v1
Development: http://localhost:8000/api/v1
```

### API Versioning
All endpoints support versioning via URL path:
- `/api/v1/` - Current stable version
- `/api/v2/` - New experimental features (optional)

### Authentication
All protected endpoints require a valid session or bearer token:
```
Authorization: Bearer <session_token>
Cookie: PHPSESSID=<session_id>
```

### Rate Limiting
- **Unauthenticated**: 30 requests/minute per IP
- **Authenticated**: 300 requests/minute per user
- **Admin**: 1000 requests/minute
- **Login Endpoint**: 5 attempts/minute per IP

Response headers include:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1714022400
```

---

## Authentication Endpoints

### POST /api/v1/auth/login

Login with email and password.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword@123"
  }'
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password (min 8 chars) |

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer"
    },
    "session_token": "abc123xyz789",
    "expires_at": "2024-05-07T12:34:56Z"
  },
  "message": "Login successful"
}
```

**Response (401 Unauthorized):**
```json
{
  "status": "error",
  "data": null,
  "message": "Invalid credentials"
}
```

**Response (429 Too Many Requests):**
```json
{
  "status": "error",
  "data": null,
  "message": "Too many login attempts. Please try again in 5 minutes."
}
```

---

### POST /api/v1/auth/register

Register a new user account.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "national_id": "123456789V",
    "password": "SecurePassword@123",
    "password_confirmation": "SecurePassword@123",
    "role": "customer"
  }'
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Full name (3-100 chars, letters & spaces only) |
| email | string | Yes | Email address (must be unique) |
| national_id | string | Yes | National ID (must be unique, format: 9 digits + optional V) |
| password | string | Yes | Password (min 12 chars: uppercase, lowercase, number, special char) |
| password_confirmation | string | Yes | Password confirmation (must match) |
| role | string | No | 'customer' (default) or 'owner' |

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 42,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "customer"
    }
  },
  "message": "Registration successful. Please log in."
}
```

**Response (422 Validation Failed):**
```json
{
  "status": "error",
  "data": null,
  "message": "Validation failed",
  "errors": {
    "email": ["Email already registered"],
    "password": ["Password must contain at least one special character (!@#$%^&*)"]
  }
}
```

---

### POST /api/v1/auth/logout

Logout current user.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf_token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": null,
  "message": "Logout successful"
}
```

---

### POST /api/v1/auth/refresh-token

Refresh authentication token.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh-token \
  -H "Authorization: Bearer <old_token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "token": "new_token_xyz",
    "expires_at": "2024-05-08T12:34:56Z"
  },
  "message": "Token refreshed"
}
```

---

## Station Endpoints

### GET /api/v1/stations

List all fuel stations with filters and pagination.

**Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/stations?page=1&per_page=20&status=available&sort=-queue_length" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| page | integer | Page number | 1 |
| per_page | integer | Results per page (1-100) | 20 |
| status | string | Filter by status | available, limited, nofuel |
| sort | string | Sort field (prefix - for desc) | -queue_length, name |
| search | string | Search by name/location | "Downtown" |
| latitude | decimal | Filter by location radius | 6.9271 |
| longitude | decimal | Filter by location radius | 80.7789 |
| radius_km | decimal | Search radius in km | 5 |

**Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Central Fuel Station",
      "location": "Downtown",
      "status": "available",
      "queue_length": 5,
      "waiting_time": 15,
      "fuel_status": {
        "petrol": {
          "available": true,
          "price": 120.50
        },
        "diesel": {
          "available": true,
          "price": 105.75
        }
      },
      "latitude": 6.9271,
      "longitude": 80.7789,
      "last_updated": "2024-05-06T12:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 156,
    "last_page": 8
  },
  "message": ""
}
```

---

### GET /api/v1/stations/{id}

Get detailed station information.

**Request:**
```bash
curl -X GET http://localhost:8000/api/v1/stations/1 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Central Fuel Station",
    "location": "Downtown",
    "latitude": 6.9271,
    "longitude": 80.7789,
    "phone": "+94701234567",
    "email": "central@station.com",
    "status": "available",
    "owner": {
      "id": 5,
      "name": "Station Owner Ltd"
    },
    "queue_info": {
      "queue_length": 5,
      "waiting_time": 15,
      "active_pumps": 2,
      "service_rate": 5.0,
      "peak_hours": ["07:00-09:00", "12:00-13:00", "17:00-19:00"]
    },
    "fuel_availability": [
      {
        "fuel_type": "petrol",
        "available": true,
        "price": 120.50,
        "stock_level": 500.0,
        "last_restocked": "2024-05-06T06:00:00Z"
      },
      {
        "fuel_type": "diesel",
        "available": true,
        "price": 105.75,
        "stock_level": 300.0,
        "last_restocked": "2024-05-06T08:00:00Z"
      }
    ],
    "features": {
      "accepts_card_payment": true,
      "has_convenience_store": true,
      "total_pumps": 4
    },
    "operating_hours": {
      "opening_time": "06:00",
      "closing_time": "22:00",
      "operating_days": "MON-SUN"
    }
  },
  "message": ""
}
```

---

## Queue Endpoints

### GET /api/v1/stations/{id}/queue

Get current queue status.

**Request:**
```bash
curl -X GET http://localhost:8000/api/v1/stations/1/queue \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "station_id": 1,
    "queue_length": 5,
    "waiting_time": 15,
    "confidence": "high",
    "active_pumps": 2,
    "service_rate": 5.0,
    "trend": "increasing",
    "prediction_next_hour": {
      "predicted_queue": 8,
      "confidence_lower": 6,
      "confidence_upper": 10
    },
    "updated_at": "2024-05-06T12:30:00Z"
  },
  "message": ""
}
```

---

### PATCH /api/v1/stations/{id}/queue

Update queue status (owner/admin only).

**Request:**
```bash
curl -X PATCH http://localhost:8000/api/v1/stations/1/queue \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "queue_length": 8,
    "active_pumps": 3,
    "service_rate": 4.5
  }'
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| queue_length | integer | Yes | Number of vehicles in queue |
| active_pumps | integer | No | Number of working pumps |
| service_rate | decimal | No | Minutes per vehicle |

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "queue_id": 1,
    "station_id": 1,
    "queue_length": 8,
    "waiting_time": 12,
    "updated_at": "2024-05-06T12:35:00Z"
  },
  "message": "Queue updated successfully"
}
```

---

## Owner Endpoints

### GET /api/v1/owner/station

Get owner's station details (owner only).

**Request:**
```bash
curl -X GET http://localhost:8000/api/v1/owner/station \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "station_id": 5,
    "station_name": "Downtown Fuel Hub",
    "location": "Main Street",
    "queue_length": 12,
    "waiting_time": 24,
    "fuel_status": {
      "petrol": true,
      "diesel": false
    }
  },
  "message": ""
}
```

---

### PUT /api/v1/owner/station

Update owner's station details.

**Request:**
```bash
curl -X PUT http://localhost:8000/api/v1/owner/station \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "station_name": "Updated Station Name",
    "location": "New Location",
    "phone": "+94701234567"
  }'
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "station_id": 5,
    "station_name": "Updated Station Name",
    "updated_at": "2024-05-06T12:40:00Z"
  },
  "message": "Station updated successfully"
}
```

---

### PATCH /api/v1/owner/station/fuel

Update fuel availability (owner only).

**Request:**
```bash
curl -X PATCH http://localhost:8000/api/v1/owner/station/fuel \
  -H "Authorization: Bearer <token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "petrol": true,
    "diesel": false
  }'
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "fuel_availability": {
      "petrol": true,
      "diesel": false
    },
    "updated_at": "2024-05-06T12:42:00Z"
  },
  "message": "Fuel availability updated"
}
```

---

## Admin Endpoints

### GET /api/v1/admin/users

List all users (admin only).

**Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/admin/users?page=1&role=customer&active=1" \
  -H "Authorization: Bearer <admin_token>"
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number |
| per_page | integer | Results per page (default 20) |
| role | string | Filter by role: customer, owner, admin |
| active | boolean | Filter by active status |
| search | string | Search by name or email |

**Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "is_active": true,
      "last_login": "2024-05-06T10:30:00Z",
      "created_at": "2024-01-15T08:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 2543,
    "last_page": 128
  }
}
```

---

### POST /api/v1/admin/users/{id}/suspend

Suspend a user account.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/admin/users/42/suspend \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Violation of terms of service",
    "duration_days": 30
  }'
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "user_id": 42,
    "is_suspended": true,
    "suspension_reason": "Violation of terms of service",
    "suspended_until": "2024-06-05T00:00:00Z"
  },
  "message": "User suspended successfully"
}
```

---

### GET /api/v1/admin/stations

List all stations (admin only).

**Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/admin/stations?status=pending" \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": 10,
      "name": "New Station",
      "owner": { "id": 25, "name": "Owner Name" },
      "location": "New Location",
      "approval_status": "pending",
      "created_at": "2024-05-01T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 5,
    "last_page": 1
  }
}
```

---

### POST /api/v1/admin/stations/{id}/approve

Approve a station.

**Request:**
```bash
curl -X POST http://localhost:8000/api/v1/admin/stations/10/approve \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-CSRF-Token: <csrf_token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "station_id": 10,
    "is_approved": true,
    "approved_at": "2024-05-06T13:00:00Z"
  },
  "message": "Station approved successfully"
}
```

---

### GET /api/v1/admin/reports

List user reports (admin only).

**Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/admin/reports?status=open&priority=high" \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "title": "Inaccurate queue length",
      "status": "open",
      "priority": "high",
      "reporter": { "id": 5, "name": "Reporter Name" },
      "station": { "id": 1, "name": "Central Station" },
      "created_at": "2024-05-06T11:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 47,
    "last_page": 3
  }
}
```

---

### PATCH /api/v1/admin/reports/{id}

Update report status.

**Request:**
```bash
curl -X PATCH http://localhost:8000/api/v1/admin/reports/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolution_comment": "Queue length is now accurate. Issue was with manual input."
  }'
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "report_id": 1,
    "status": "resolved",
    "updated_at": "2024-05-06T13:15:00Z"
  },
  "message": "Report updated successfully"
}
```

---

### GET /api/v1/admin/audit-logs

Get audit logs.

**Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/admin/audit-logs?action=LOGIN&date_from=2024-05-01" \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "log_id": 1,
      "user_id": 1,
      "action": "LOGIN",
      "entity_type": "User",
      "entity_id": 1,
      "changes": {
        "old": {},
        "new": {}
      },
      "ip_address": "192.168.1.1",
      "timestamp": "2024-05-06T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 5432,
    "last_page": 109
  }
}
```

---

### GET /api/v1/admin/dashboard/stats

Get dashboard statistics.

**Request:**
```bash
curl -X GET http://localhost:8000/api/v1/admin/dashboard/stats \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "active_users": 2543,
    "total_stations": 156,
    "pending_reports": 47,
    "avg_queue_length": 8.2,
    "avg_waiting_time": 18,
    "growth": {
      "new_users_today": 12,
      "new_users_week": 89,
      "new_users_month": 342
    }
  }
}
```

---

## Response Formats

### Success Response

```json
{
  "status": "success",
  "data": {
    // Actual response data
  },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "status": "error",
  "data": null,
  "message": "Human-readable error message",
  "errors": {
    // Field-specific errors (validation only)
  }
}
```

### Paginated Response

```json
{
  "status": "success",
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 156,
    "last_page": 8
  },
  "message": ""
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET/PATCH/PUT/DELETE |
| 201 | Created | Successful POST (new resource) |
| 400 | Bad Request | Invalid input parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource or state conflict |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |
| 503 | Service Unavailable | Database or service down |

### Error Response Examples

**400 Bad Request:**
```json
{
  "status": "error",
  "data": null,
  "message": "Invalid request parameters",
  "errors": {
    "email": ["Email is required"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

**401 Unauthorized:**
```json
{
  "status": "error",
  "data": null,
  "message": "Authentication required"
}
```

**429 Too Many Requests:**
```json
{
  "status": "error",
  "data": null,
  "message": "Too many requests. Please try again in 60 seconds."
}
```

---

## CSRF Protection

All POST, PATCH, PUT, DELETE requests require CSRF token:

```bash
# Get CSRF token (in form meta tag or response header)
X-CSRF-Token: abc123xyz...

# Include in request header or form data
curl -X POST http://localhost:8000/api/v1/resource \
  -H "X-CSRF-Token: abc123xyz..." \
  -d '{...}'
```

---

## Webhooks (Future Feature)

Post-implementation, consider webhooks for real-time events:

```bash
POST https://client.example.com/webhooks/fqms
Headers:
  X-FQMS-Signature: sha256=...
Body:
{
  "event": "queue.updated",
  "timestamp": "2024-05-06T12:30:00Z",
  "data": {
    "station_id": 1,
    "queue_length": 5,
    "waiting_time": 15
  }
}
```

---

This API reference provides:
✅ Complete endpoint documentation  
✅ Request/response examples  
✅ Parameter validation rules  
✅ Error handling patterns  
✅ Rate limiting details  
✅ CSRF protection  
✅ Pagination support  
✅ RESTful design principles  
✅ Production-ready standards
