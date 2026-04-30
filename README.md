# Fuel Queue Management System

Web application for checking fuel availability and queue status at fuel stations. Customers browse stations on a dashboard; station owners manage fuel availability for their own station through an owner dashboard.

---

## Features (current)

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

### Estimated Waiting Time 🆕

- **Real-time calculation** of queue wait times using: `(queue_length × service_rate) ÷ active_pumps`
- **Dynamic recalculation** when queue, pumps, or fuel status changes
- **API endpoints**:
  - `GET /api/station/{id}/estimated-time` — retrieve estimated wait time for a station
  - `PUT/PATCH /api/station/update-params` — owners update pump count and service rate
- **Edge case handling**: empty queues, unavailable fuel, no operational pumps
- **Full documentation** in `docs/ESTIMATED_WAITING_TIME_API.md` and `docs/QUICK_START.md`
- See **Implementation Summary** in `docs/IMPLEMENTATION_SUMMARY.md` for architecture details

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Frontend | HTML5, CSS3, Bootstrap 5, vanilla JavaScript |
| Backend | PHP 8.x (PDO, sessions, JSON APIs) |
| Database | MySQL 8.x (InnoDB), schema in `database/fqms.sql` |

---

## Folder structure

```text
Fuel-Queue-Management-System/
├── frontend/
│   ├── css/           # main, auth, dashboard, owner-dashboard
│   ├── js/            # auth.js, dashboard.js, owner-dashboard.js
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html       # Customer view
│   ├── owner-dashboard.html # Owner view
│   └── user_dashboard.html  # Redirects to dashboard.html
├── backend/
│   ├── services/
│   │   └── WaitingTimeService.php  # Estimated waiting time calculations
│   ├── api/
│   │   └── station/
│   │       ├── estimated-time.php  # GET estimated wait time
│   │       └── update-params.php   # PUT/PATCH pump and service rate updates
│   ├── tests/
│   │   └── test_waiting_time.php   # Test suite for waiting time calculations
│   ├── config.php           # PDO, helpers, optional legacy JSON paths
│   ├── login.php
│   ├── register.php
│   ├── logout.php
│   ├── stations.php         # GET — station list (requires login)
│   ├── owner_station.php    # GET/POST — owner station + fuel save
│   ├── update_queue.php     # POST/PATCH/PUT — update queue length
│   └── [other files]
├── database/
│   ├── fqms.sql             # Schema + demo seed row (includes waiting time columns)
│   └── migrations/
│       └── 001_add_waiting_time_columns.sql  # Migration for existing installations
├── docs/
│   ├── ESTIMATED_WAITING_TIME_API.md   # Complete API reference
│   ├── QUICK_START.md                  # Quick setup and usage guide
│   ├── IMPLEMENTATION_SUMMARY.md       # Implementation details and architecture
│   └── Rules                           # Team guidelines
└── README.md
```

Legacy JSON helpers remain in `config.php` for compatibility; **authentication and dashboards use MySQL**.

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
