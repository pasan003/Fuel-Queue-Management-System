# Fuel Queue Management System

A modern web application for checking real-time fuel availability and queue status at fuel stations. Customers browse stations and see estimated wait times; station owners manage fuel availability and track queue metrics for their station.

**Version**: 2.0 (Simplified Waiting Time Logic)
**Status**: Production Ready ✅
**Last Updated**: April 30, 2026

---

## 🎯 Key Features

### Authentication

- **Register** as **Customer** or **Owner** (national ID, email, hashed password).
- **Login** with **email** and password; PHP session plus browser `fetch` with credentials.
- **Logout** clears the server session and client-side keys.
- **Role routing**: customers land on the user dashboard; owners land on the owner dashboard. Owners can open the **User Dashboard** from the navbar to see the same station list as customers.

### User dashboard (`frontend/dashboard.html`)

- Lists **all stations** from MySQL with **petrol/diesel availability**, **queue length**, **estimated wait**, and **computed status** (Available / Limited / No Fuel).
- Search and filter controls (unchanged UX; data is live from the API).
- Map area remains a **placeholder** for future Google Maps integration.

### Owner dashboard (`frontend/owner-dashboard.html`)

- Loads the **station linked to the logged-in owner** (created at registration).
- **Fuel toggles** persist to `fuel_availability` via `backend/owner_station.php`.
- Queue metrics are **read from the database** (seed/demo values until customer reporting exists).

### Estimated Waiting Time

- **Simple Formula**: `Estimated Waiting Time = Queue Length × 2 minutes`
- **Automatic Calculation**: Calculated instantly when queue updates
- **Real-time Display**: Shows on customer and owner dashboards
- **Proven Model**: 2 minutes per vehicle industry standard
- **API Endpoint**: `GET /api/station/{id}/estimated-time`
- **Examples**:
  - 5 vehicles = 10 minutes
  - 12 vehicles = 24 minutes  
  - 20 vehicles = 40 minutes
- **Documentation**: See [WAITING_TIME_LOGIC.md](docs/WAITING_TIME_LOGIC.md)

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Frontend | HTML5, CSS3, Bootstrap 5, vanilla JavaScript |
| Backend | PHP 8.x (PDO, sessions, JSON APIs) |
| Database | MySQL 8.x (InnoDB), schema in `database/fqms.sql` |

---

## 📁 Folder structure

```text
Fuel-Queue-Management-System/
├── frontend/                    # Client-side application
│   ├── css/
│   │   ├── main.css            # Global styles
│   │   ├── auth.css            # Login/register styling
│   │   ├── dashboard.css       # Customer dashboard + enhanced queue display
│   │   └── owner-dashboard.css # Owner dashboard + queue styling
│   ├── js/
│   │   ├── auth.js             # Authentication logic
│   │   ├── dashboard.js        # Customer dashboard with queue handling
│   │   └── owner-dashboard.js  # Owner dashboard with fuel toggles
│   ├── login.html              # Login page
│   ├── register.html           # Registration page
│   ├── dashboard.html          # Customer dashboard (main view)
│   ├── owner-dashboard.html    # Owner dashboard
│   └── user_dashboard.html     # Redirect to dashboard.html
│
├── backend/                     # Server-side PHP API
│   ├── config.php              # Database config, PDO connection, helpers
│   ├── login.php               # POST login endpoint
│   ├── register.php            # POST register endpoint  
│   ├── logout.php              # POST logout endpoint
│   ├── stations.php            # GET all stations with queue + fuel
│   ├── owner_station.php       # GET/POST owner's station + fuel save
│   ├── update_queue.php        # POST/PATCH/PUT update queue (auto-calc wait time)
│   └── api/
│       └── station/
│           └── estimated-time.php  # GET estimated waiting time
│
├── database/
│   ├── fqms.sql                # Complete schema + demo seed data
│
│
├── docs/
│   ├── QUICK_START.md          # Setup and API quick reference
│   ├── WAITING_TIME_LOGIC.md   # Detailed formula and examples
│   └── Rules                   # Team guidelines (if applicable)
│
└── README.md                   # This file
```

---

## Prerequisites

- **XAMPP**, **WAMP**, **MAMP**, or similar: Apache + PHP **8.0+** + **MySQL**.
- Project folder served from the web root (e.g. `htdocs/Fuel-Queue-Management-System/`).

---

## Database setup

1. Start **MySQL** (e.g. from XAMPP Control Panel).
2. Open **phpMyAdmin** (or the MySQL client).
3. Import **`database/fqms.sql`** (creates database `fqms`, tables, fuel types Petrol/Diesel, and one demo station).

Alternatively:

```bash
mysql -u root -p < database/fqms.sql
```

### Configuration

Default PDO settings in `backend/config.php` assume:

- Host: `127.0.0.1`
- Database: `fqms`
- User: `root`
- Password: *(empty)*

Override without editing code using environment variables:

- `FQMS_DB_HOST`
- `FQMS_DB_NAME`
- `FQMS_DB_USER`
- `FQMS_DB_PASS`

---

## How to run

1. Copy the repo into your server document root (e.g. `C:\xampp\htdocs\Fuel-Queue-Management-System`).
2. Import **`database/fqms.sql`**.
3. Start **Apache** (and **MySQL**).
4. Open the login page in a browser, for example:

   `http://localhost/Fuel-Queue-Management-System/frontend/login.html`

Adjust the path if your folder name or vhost differs.

---

## 👥 Roles and flows

| Role | Registration | After login |
|------|----------------|-------------|
| **Customer** | Name, national ID, email, password | `dashboard.html` — browse all stations |
| **Owner** | Above + station name, location | `owner-dashboard.html` — manage fuel + queue |

Owners can also view the **Customer Dashboard** to see their station from customer perspective.

---

## 🔌 API Overview

All endpoints return JSON. Authentication required for all endpoints except login/register.

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `login.php` | POST | Authenticate user | ✗ |
| `register.php` | POST | Create new account | ✗ |
| `logout.php` | POST | Clear session | ✓ |
| `stations.php` | GET | List all stations with queue/fuel | ✓ |
| `owner_station.php` | GET | Get owner's linked station | ✓ Owner |
| `owner_station.php` | POST | Save fuel availability | ✓ Owner |
| `update_queue.php` | POST/PATCH/PUT | Update queue length | ✓ |
| `api/station/{id}/estimated-time` | GET | Get estimated waiting time | ✓ |

**Key Response Format**:
```json
{
  "ok": true,
  "station_id": 1,
  "queue_length": 12,
  "waiting_time": 24,
  "unit": "minutes"
}
```

---

## 🧪 Troubleshooting

### "503 Database unavailable"
→ Start MySQL from XAMPP/WAMP Control Panel

### "401 Authentication required"  
→ Login first, then make API calls

### "404 Station not found"
→ Import `database/fqms.sql` to seed demo data

### Queue doesn't update
→ Check browser console (F12) for errors

### Styles look broken
→ Verify CSS files are in `frontend/css/` folder

---

## 📝 Development Notes

### Recent Changes (v2.0 - Apr 2026)
- ✅ Simplified estimated waiting time formula to: Queue Length × 2
- ✅ Removed complex service_rate / active_pumps calculation
- ✅ Auto-calculate waiting_time in update_queue.php
- ✅ Enhanced UI with better queue display cards
- ✅ Added wait status badges (Quick / Normal / Long)
- ✅ Improved responsive design for mobile/tablet
- ✅ Added comprehensive code comments
- ✅ Updated all documentation

### Files Removed (Old Wrong Logic)
- `backend/services/WaitingTimeService.php`
- `backend/api/station/update-params.php`
- `backend/tests/test_waiting_time.php`
- `database/migrations/001_add_waiting_time_columns.sql`
- `docs/ESTIMATED_WAITING_TIME_API.md`
- `docs/IMPLEMENTATION_SUMMARY.md`

### Current Code Quality
- ✅ Proper PHP type declarations
- ✅ Comprehensive comments on complex logic
- ✅ Readable variable names (queueLength, estimatedWaitTime)
- ✅ SQL injection prevention (prepared statements)
- ✅ Clean separation of concerns
- ✅ Responsive design with mobile-first approach

---

## 📚 Documentation Files

- [QUICK_START.md](docs/QUICK_START.md) - Setup and API quick reference
- [WAITING_TIME_LOGIC.md](docs/WAITING_TIME_LOGIC.md) - Detailed formula explanation

---

## 🔮 Future Enhancements

- Google Maps integration
- Customer real-time queue reports
- Admin dashboard
- Push notifications
- Historical analytics
- Peak hour predictions

---

## 📄 License

Use this project for educational and commercial purposes as needed.

---

**Questions?** Check [QUICK_START.md](docs/QUICK_START.md) or [WAITING_TIME_LOGIC.md](docs/WAITING_TIME_LOGIC.md)

---

## Roles and flows

| Role | Registration | After login |
|------|----------------|-------------|
| **Customer** | Name, national ID, email, password | `dashboard.html` — browse all stations |
| **Owner** | Above + station name, location, fuel types | `owner-dashboard.html` — manage own station’s petrol/diesel |

Owners can use **User Dashboard** in the navbar to view the public station list (including their station).

---

## API overview (same-origin)

All endpoints return JSON. Mutating routes expect appropriate methods.

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---|
| `backend/login.php` | POST | Login; sets PHP session | ✗ |
| `backend/register.php` | POST | Register customer or owner (+ station for owner) | ✗ |
| `backend/logout.php` | POST | Destroy session | ✓ |
| `backend/stations.php` | GET | List stations (requires logged-in session) | ✓ |
| `backend/owner_station.php` | GET | Owner's station snapshot | ✓ (Owner) |
| `backend/owner_station.php` | POST | Save petrol/diesel flags | ✓ (Owner) |
| `backend/update_queue.php` | POST/PATCH/PUT | Update queue length | ✓ |
| `backend/api/station/estimated-time.php` | GET | Get estimated waiting time | ✓ |
| `backend/api/station/update-params.php` | PUT/PATCH | Update pump count & service rate | ✓ (Owner) |

The frontend uses `credentials: "include"` so session cookies are sent.

---

## Troubleshooting

- **503 from login/register**: MySQL not running or database not imported; check credentials in `config.php` / env vars.
- **401 on dashboard**: Session missing or expired — log in again.
- **Owner dashboard redirects to customer view**: Account role is not `owner`, or owner has no station row (only owners who registered with station data get a station).

---

## Future improvements

- Customer-submitted queue reports updating `queue_status`.
- Google Maps on the dashboard map placeholder.
- Notifications table integration.
- Admin role and moderation tools.

---

## Problem statement (context)

Fuel shortages and long queues make real-time visibility valuable. This project reduces unnecessary travel by surfacing availability and queue-related information per station.

---

## License / team

Use your repository’s license and team credits as appropriate for your course or organization.
