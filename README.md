# ⛽ Fuel Queue Management System (FQMS)

A modern web application for checking real-time fuel availability and queue status at fuel stations. Customers can browse stations and see estimated wait times, while station owners can manage fuel availability and track queue metrics for their station.

**Version**: 2.0
**Status**: Production Ready ✅

---

## 📖 Problem Statement

Fuel shortages and long queues make real-time visibility valuable. This project reduces unnecessary travel by surfacing availability and queue-related information per station, helping users make informed decisions and saving time.

---

## 🎯 Key Features

### Authentication & Authorization
- **Role-based Access**: Register and log in as either a **Customer** or an **Owner**.
- **Secure Sessions**: PHP session management with client-side credential persistence.

### Customer Dashboard
- **Real-Time Station Data**: View all stations with current petrol/diesel availability, queue lengths, and computed status (Available / Limited / No Fuel).
- **Smart Estimated Wait Times**: Instantly see how long the wait will be based on queue lengths.
- **Search & Filter**: Easily find nearby or specific stations.

### Owner Dashboard
- **Station Management**: Owners manage the station linked to their account.
- **Fuel Toggles**: Quickly update `fuel_availability` status for Petrol and Diesel.
- **Queue Metrics**: View and update the current queue length.

### Estimated Waiting Time Logic
- **Simple Formula**: `Estimated Waiting Time = Queue Length × 2 minutes`
- **Real-time Display**: Shows on both customer and owner dashboards instantly.
- *Examples: 5 vehicles = 10 minutes | 12 vehicles = 24 minutes | 20 vehicles = 40 minutes*

---

## 💻 Tech Stack

| Layer | Technologies |
|--------|----------------|
| **Frontend** | HTML5, CSS3, Bootstrap 5, Vanilla JavaScript |
| **Backend** | PHP 8.x (PDO, Sessions, JSON APIs) |
| **Database** | MySQL 8.x (InnoDB) |

---

## 📁 Project Structure

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

## 🚀 Getting Started

### Prerequisites
- **Web Server**: XAMPP, WAMP, MAMP, or similar (Apache + PHP **8.0+** + **MySQL**).
- Project folder served from the web root (e.g., `htdocs/Fuel-Queue-Management-System/`).

### Database Setup
1. Start **MySQL** (e.g., via XAMPP Control Panel).
2. Open **phpMyAdmin** or your preferred MySQL client.
3. Import **`database/fqms.sql`** to create the `fqms` database, necessary tables, and initial demo data.

### Configuration
Database settings are located in `backend/config.php` and default to:
- **Host**: `127.0.0.1` | **Database**: `fqms` | **User**: `root` | **Password**: *(empty)*

*(You can override these using environment variables: `FQMS_DB_HOST`, `FQMS_DB_NAME`, `FQMS_DB_USER`, `FQMS_DB_PASS`)*

### Running the App
1. Place the repository in your server document root.
2. Start **Apache** and **MySQL**.
3. Navigate to: `http://localhost/Fuel-Queue-Management-System/frontend/login.html` (Adjust the path based on your setup).

---

## 👥 Roles and Workflows

| Role | Capabilities | Dashboard |
|------|--------------|-----------|
| **Customer** | Browse stations, check fuel availability, view estimated wait times. | `dashboard.html` |
| **Owner** | Manage own station's fuel status, update queue lengths. | `owner-dashboard.html` |

*Owners can also view the Customer Dashboard from the navigation bar to see their station from the public perspective.*

---

## 🔌 API Overview

All endpoints return JSON and require authentication (except login/register).

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `login.php` | POST | Authenticate user | ✗ |
| `register.php` | POST | Create new account | ✗ |
| `logout.php` | POST | Clear session | ✓ |
| `stations.php` | GET | List all stations with queue/fuel | ✓ |
| `owner_station.php` | GET/POST | Get owner's station / Save fuel status | ✓ (Owner) |
| `update_queue.php` | POST/PUT | Update queue length | ✓ |
| `api/station/{id}/estimated-time`| GET | Get estimated waiting time | ✓ |

---

## 🧪 Troubleshooting

- **"503 Database unavailable"**: Start MySQL from your control panel.
- **"401 Authentication required"**: Ensure you are logged in.
- **"404 Station not found"**: Import `database/fqms.sql` to seed the initial data.
- **Queue doesn't update**: Check browser console (F12) for errors.
- **Owner dashboard redirects to customer view**: Ensure your account role is set to `owner` and linked to a station.

---

## 📝 Development Notes

### Recent Changes (v2.0)
- ✅ Simplified estimated waiting time formula to: Queue Length × 2
- ✅ Removed complex service_rate / active_pumps calculation
- ✅ Auto-calculate waiting_time in update_queue.php
- ✅ Enhanced UI with better queue display cards and status badges (Quick / Normal / Long)
- ✅ Improved responsive design for mobile/tablet

For more details, see [WAITING_TIME_LOGIC.md](docs/WAITING_TIME_LOGIC.md) and [QUICK_START.md](docs/QUICK_START.md).

---

## 🔮 Future Enhancements
- 🗺️ Google Maps integration for station locations.
- 📱 Customer-submitted real-time queue reports.
- 📊 Admin dashboard for moderation and analytics.
- 🔔 Push notifications for fuel availability alerts.

---

## 📄 License
Use this project for educational and commercial purposes as needed. Feel free to fork and contribute!
