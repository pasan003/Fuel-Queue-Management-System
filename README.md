# ⛽ Fuel Queue Management System (FQMS)

A modern web application for checking real-time fuel availability and queue status at fuel stations. Customers can browse stations and see estimated wait times, while station owners can manage fuel availability and track queue metrics for their station.

**Version**: 2.1 (with Admin Dashboard)
**Status**: Production Ready ✅

### 🆕 Admin Dashboard (v2.1)
The production-level Admin Dashboard is now fully functional! 
- **Admin Login**: ✅ Working
- **Email**: `admin@fqms.lk`
- **Password**: `admin123`
- See [Admin Setup Guide](ADMIN_SETUP.md) for complete details

### 🔧 Recent Fixes (May 2026)
**Login Issue Fixed**: Admin login was failing with "Invalid credentials" even with correct email and password.
- **Root Cause**: Admin user in database had invalid/mismatched password hash
- **Fix Applied**: Updated admin password hash to correct bcrypt hash for `admin123`
- **Status**: ✅ Verified working - all login tests pass

**Customer Dashboard Map Persistence Fixed**: Auto refresh was resetting the Leaflet map view after users focused a station from a card click.
- **Root Cause**: The refresh flow rebuilt markers and re-applied auto-fit logic, which overwrote the user's current center/zoom and closed the selected station popup.
- **Fix Applied**: The map instance is initialized once; polling refresh now updates markers in-place and preserves center/zoom + selected station/popup state.
- **Status**: ✅ Map stays focused during live polling (no view reset / no tile reload)

**Admin Dashboard Data Not Displaying (Users, Stations, Reports, Alerts, Audit Logs) - FIXED**:
- **Root Cause #1**: API response structure mismatch. Backend returns `{"users": [...], "pagination": {...}}` but frontend was accessing `result.data?.rows`
  - **Fix**: Updated all 5 data loading functions in `admin-modern.js` to use correct response keys:
    - `loadUsers()`: Changed to `result.users` 
    - `loadStations()`: Changed to `result.stations`
    - `loadReports()`: Changed to `result.reports`
    - `loadAlerts()`: Changed to `result.alerts`
    - `loadAuditLogs()`: Changed to `result.logs`
  - All pagination calls updated to use `result.pagination?.total_pages`
- **Root Cause #2**: CSS display rules being overridden. Sections had `.active` class but inline `style="display:none"` had higher specificity
  - **Fix**: Removed inline styles from HTML sections and added `!important` to CSS rules in `admin-modern.css`
- **Status**: ✅ All sections now display correctly with full data (Users: 3 users, Stations: 9 stations, Reports/Alerts/Audit: empty states working)

---

## 📖 Problem Statement

Fuel shortages and long queues make real-time visibility valuable. This project reduces unnecessary travel by surfacing availability and queue-related information per station, helping users make informed decisions and saving time.

---

## 🎯 Key Features

### Authentication & Authorization
- **Role-based Access**: Register and log in as either a **Customer** or an **Owner**.
- **Secure Sessions**: PHP session management with client-side credential persistence.

### Customer Dashboard
- **Live Station Data (Lightweight Polling)**: View all stations with current petrol/diesel availability, queue lengths, and computed status (Available / Limited / No Fuel).
- **Smart Estimated Wait Times**: Instantly see how long the wait will be based on queue lengths.
- **Search & Filter**: Easily find nearby or specific stations.
- **Interactive Map**: View all fuel stations on an interactive Leaflet map with OpenStreetMap tiles.
- **Auto Refresh (No Page Reload)**: Dashboard auto-refreshes station/queue/fuel data every ~7 seconds using `setInterval()` + the existing `backend/stations.php` endpoint (no WebSockets).
- **Diff-based UI Updates**: Only station cards that changed are patched in the DOM (queue length, waiting time, fuel flags, status badge, last-updated text) to avoid flicker and heavy re-rendering.
- **Animated Changes**: Subtle fade/pulse animations for updated cards and queue changes, smooth number transitions, and smooth badge color transitions.
- **Resilient Error Handling**: If a refresh fails, the UI keeps the old data visible and shows a small warning toast; updates retry automatically on the next polling tick.

### Owner Dashboard
- **Station Management**: Owners manage the station linked to their account.
- **Fuel Toggles**: Quickly update `fuel_availability` status for Petrol and Diesel.
- **Queue Metrics**: View and update the current queue length.
- **Station Map**: View your station's location on an interactive map.

### Admin Dashboard
- **Professional SaaS Design**: Modern, professional monitoring center with smooth animations and professional styling inspired by Linear, Vercel, and Stripe dashboards.
- **Hero Statistics Section**: 6 animated stat cards showing:
  - Active Stations (with trend indicators)
  - Active Queues (real-time queue count)
  - Fuel Alerts (no-fuel stations)
  - Pending Reports (awaiting review)
  - Active Users (not suspended)
  - Avg Wait Time (system-wide average)
- **Live Activity Monitoring**: 
  - Real-time queue activity feed with timestamps
  - Recent alerts and suspicious activity panel
  - Live station status grid with queue details and fuel availability
  - Auto-refreshing every 15 seconds without page reload
- **Advanced Analytics Center**:
  - Queue trends chart (avg queue + wait time over time)
  - Fuel availability visualization (available vs unavailable stations)
  - User distribution by role (customers, owners, admins)
  - Peak queue hours heatmap
  - Report status breakdown
  - All charts are smooth, responsive, and avoid flicker on updates
- **Station Approval System**: Review and approve/reject pending fuel station registrations with optional feedback.
- **Reports Moderation**: Moderate user-submitted reports with spam detection and resolution tracking.
- **System Alerts**: Monitor critical and high-priority system alerts with acknowledgment tracking.
- **Audit Logs**: Complete audit trail of all admin actions with filtering and export.
- **User Management**: Suspend, activate, or delete users with reasons and audit logging.
- **Data Export**: Export system data (users, stations, reports) to CSV.
- **Dark Mode Support**: Toggle between light and dark themes with persistent preference storage.
- **Responsive Design**: Fully responsive layout that works perfectly on desktop, tablet, and mobile with collapsible sidebar.
- **Global Search**: Debounced search bar for finding users, stations, and reports across the system.
- **Quick Actions Panel**: Fast-access buttons for common admin tasks (approve stations, review reports, view alerts, export data).
- **Modern Interactions**:
  - Smooth page transitions and animations
  - Animated number counters (0 → target value)
  - Loading states and skeleton screens
  - Toast notifications for user feedback
  - Hover effects and interactive elements
  - Theme persistence with localStorage

### Estimated Waiting Time Logic
- **Simple Formula**: `Estimated Waiting Time = Queue Length × 2 minutes`
- **Real-time Display**: Shows on both customer and owner dashboards instantly.
- *Examples: 5 vehicles = 10 minutes | 12 vehicles = 24 minutes | 20 vehicles = 40 minutes*

---

## 💻 Tech Stack

| Layer | Technologies |
|--------|----------------|
| **Frontend** | HTML5, CSS3, Bootstrap 5, Vanilla JavaScript, Chart.js, Leaflet.js (maps) |
| **Backend** | PHP 8.x (PDO, Sessions, JSON APIs) |
| **Database** | MySQL 8.x (InnoDB) |

---

## 📁 Project Structure

```text
Fuel-Queue-Management-System/
├── frontend/                    # Client-side application
│   ├── css/
│   │   ├── main.css            # Global styles + animations
│   │   ├── auth.css            # Login/register styling
│   │   ├── dashboard.css       # Customer dashboard + enhanced queue display
│   │   ├── owner-dashboard.css # Owner dashboard + queue styling
│   │   └── admin-modern.css    # Modern SaaS-style admin dashboard (NEW)
│   ├── js/
│   │   ├── auth.js             # Authentication logic
│   │   ├── dashboard.js        # Customer dashboard with queue handling
│   │   ├── owner-dashboard.js  # Owner dashboard with fuel toggles
│   │   └── admin-modern.js     # Modern admin dashboard (NEW)
│   ├── login.html              # Login page
│   ├── register.html           # Registration page
│   ├── dashboard.html          # Customer dashboard (main view)
│   ├── owner-dashboard.html    # Owner dashboard
│   ├── admin-dashboard.html    # Modern admin dashboard (REDESIGNED)
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
│   ├── admin/                  # Admin API endpoints
│   │   ├── users.php           # GET list users with filtering
│   │   ├── user-actions.php    # POST suspend/activate/delete user
│   │   ├── stations.php        # GET list stations with approval status
│   │   ├── station-actions.php # POST approve/reject station
│   │   ├── reports.php         # GET list reports with filtering
│   │   ├── report-actions.php  # POST review/resolve/spam report
│   │   ├── statistics.php      # GET dashboard statistics
│   │   ├── live-stats.php      # GET lightweight live stats (NEW)
│   │   ├── analytics.php       # GET analytics data (NEW)
│   │   ├── audit-logs.php      # GET admin action audit logs
│   │   ├── alerts.php          # GET system alerts
│   │   ├── alert-actions.php   # POST acknowledge/delete alerts
│   │   ├── search.php          # GET global search results
│   │   └── export.php          # GET CSV export (users/stations/reports)
│   └── api/
│       └── station/
│           └── estimated-time.php  # GET estimated waiting time
│
├── database/
│   ├── fqms.sql                # Complete schema + demo seed data
│   └── admin_schema_update.sql # Admin feature schema updates
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
4. (Optional) Import **`database/sample_stations_seed.sql`** to add multiple demo stations with coordinates for the map.
5. (Optional) Import **`database/users_seed.sql`** to seed demo users (admin/customer/owner) without duplicate-key errors.

### Configuration
Database settings are located in `backend/config.php` and default to:
- **Host**: `127.0.0.1` | **Database**: `fqms` | **User**: `root` | **Password**: *(empty)*

*(You can override these using environment variables: `FQMS_DB_HOST`, `FQMS_DB_NAME`, `FQMS_DB_USER`, `FQMS_DB_PASS`)*

### Running the App
1. Place the repository in your server document root.
2. Start **Apache** and **MySQL**.
3. Navigate to: `http://localhost/Fuel-Queue-Management-System/frontend/login.html` (Adjust the path based on your setup).

### 🔐 Admin Dashboard Access

The Admin Dashboard is now a professional, modern monitoring platform. To access it:

1. **Log in as admin** with:
   - **Email**: `admin@fqms.lk`
   - **Password**: `admin123`

2. You'll be redirected to `/frontend/admin-dashboard.html` with:
   - **Modern SaaS-style design** with professional dark/light mode
   - **Real-time monitoring** with animated counters and live updates
   - **Professional analytics** with smooth Chart.js visualizations
   - **Responsive layout** that works on all devices
   - **Dark mode support** (toggle in navbar)
```

**Default Admin Credentials**:
- **Email**: `admin@fqms.lk`
- **Password**: `admin123`

#### Step 3: Login as Admin
1. Go to: `http://localhost/Fuel-Queue-Management-System/frontend/login.html`
2. Enter email: `admin@fqms.lk`
3. Enter password: `admin123`
4. You will be redirected to: `http://localhost/Fuel-Queue-Management-System/frontend/admin-dashboard.html`

#### Security Notes
- ⚠️ **IMPORTANT**: Change the admin password immediately after first login!
- To generate a secure password hash in PHP: `php -r "echo password_hash('your_secure_password', PASSWORD_DEFAULT);"`
- Update database manually: `UPDATE users SET password = 'hashed_password_here' WHERE email = 'admin@fqms.lk';`
- Admin access is role-restricted on both frontend and backend
- All admin actions are logged in the audit_logs table with IP address and timestamp

#### How Admin Login Works
1. **Backend** (`backend/login.php`):
   - Accepts login with username (email) and password
   - Verifies password using `password_verify()` against the hashed database password
   - Detects admin role and returns `"role": "admin"` in response
   - Sets `$_SESSION['role'] = 'admin'` for server-side authorization

2. **Frontend** (`frontend/js/auth.js`):
   - Stores user role in localStorage: `userType = 'admin'`
   - Redirects to `admin-dashboard.html` for admin users

3. **Dashboard Protection** (`frontend/admin-dashboard.html`):
   - Client-side check: Redirects to login if `userType !== 'admin'`
   - JavaScript protection in `admin.js` verifies admin role on page load

4. **API Protection** (`backend/admin/*.php`):
   - All admin endpoints call `require_admin_json()`
   - Returns 403 Forbidden if `$_SESSION['role'] !== 'admin'`
   - Ensures only admins can access admin functionality

#### Troubleshooting Admin Login

**Problem: Login fails with "Invalid credentials"**
- Verify admin user exists: `SELECT * FROM users WHERE email = 'admin@fqms.lk';`
- Check password hash is valid: Hash should start with `$2y$`
- Ensure MySQL is running and database is updated with schema

**Problem: Redirects to login after successful login**
- Verify role column contains `'admin'` (case-sensitive)
- Check localStorage has `userType = 'admin'`
- Open browser console for JavaScript errors

**Problem: Admin dashboard shows "Admin access required"**
- This means session role is not recognized as admin
- Verify `$_SESSION['role']` by adding debug: Check browser cookies for PHP session ID
- Ensure backend/admin/*.php endpoints are being called correctly

**Problem: Dashboard shows empty or no data loads**
- Verify admin user has proper role in database
- Check browser console for JavaScript errors
- Ensure database tables (audit_logs, admin_alerts, system_settings) exist

---

## 👥 Roles and Workflows

| Role | Capabilities | Dashboard |
|------|--------------|-----------|
| **Customer** | Browse stations, check fuel availability, view estimated wait times. | `dashboard.html` |
| **Owner** | Manage own station's fuel status, update queue lengths. | `owner-dashboard.html` |
| **Admin** | Manage users, approve stations, moderate reports, view audit logs, system analytics. | `admin-dashboard.html` (NEW) |

*Owners can also view the Customer Dashboard from the navigation bar to see their station from the public perspective.*
*Admins have full system access and control via the dedicated Admin Dashboard.*

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

## 🛡️ Admin Dashboard (NEW - v2.1)

### Overview
The Admin Dashboard is a comprehensive management system for system administrators to oversee users, stations, reports, and system activity. It provides real-time analytics, moderation tools, and audit logging.

### Access
- **URL**: `frontend/admin-dashboard.html`
- **Requirements**: Admin role account (set in database)
- **Authentication**: Automatic redirect to login if not authenticated; admin-only access checks on all endpoints

### Admin Features

#### 1. Dashboard & Statistics
- **System Overview**: Total users, stations, reports, and active queues
- **Live Auto Refresh**: Dashboard sections poll every 15 seconds without a full page reload and preserve active filters/sidebar state
- **Live Station Status**: Queue length, waiting time, fuel availability, station status, and wait badges update in place with subtle highlights
- **Real-time Charts**: Queue trends, fuel availability, active users by role, peak queue hours, and report status breakdown
- **Station Approval Status**: Pending, approved, and rejected stations
- **Fuel Availability Trends**: Percentage of stations with fuel available by type
- **System Alerts**: Critical, high, medium, and low severity alerts
- **Recent Activity**: New users, stations, reports, and admin actions (last 24h)
- **Global Search**: Debounced search bar for users, stations, and reports with categorized results
- **Mobile UI**: Collapsible sidebar, responsive tables/cards, touch-friendly controls, and responsive Chart.js canvases

#### 2. User Management
**Features**:
- View all users with role and status
- Search users by name, email, or national ID
- Filter by role (customer, owner, admin) or status (active, suspended)
- Pagination (20 users per page)
- **Actions**:
  - **Suspend User**: Disable account with suspension reason (audit logged)
  - **Activate User**: Re-enable suspended account
  - **Delete User**: Permanently remove user (cascade deletes related data)
- All actions send notifications to affected users

**Audit**: Every action is logged with admin name, timestamp, IP address, and changes

#### 3. Station Management
**Features**:
- View all fuel stations with approval status
- Search stations by name or location
- Filter by approval status (pending, approved, rejected)
- Display station owner, queue length, waiting time, fuel availability
- Pagination support

**Actions**:
- **Approve Station**: Activate pending station registration (notifies owner)
- **Reject Station**: Reject registration with reason (notifies owner)
- Only pending stations can be approved/rejected

**Status Workflow**: `pending` → `approved` or `rejected`

#### 4. Reports Moderation
**Features**:
- View user-submitted reports about stations or fuel availability
- Search reports by comment or reporter name
- Filter by status (pending, reviewed, resolved, spam)
- Display reporter, station, comment, fuel type, and creation date
- Admin notes for review documentation

**Actions**:
- **Review**: Mark report as reviewed
- **Resolve**: Mark as resolved (issue addressed)
- **Mark as Spam**: Flag false/fake reports (creates system alert)
- **Delete**: Remove spam or inappropriate reports

**Spam Detection**: Tracks patterns; alerts generated for potential spam campaigns

#### 5. System Alerts & Notifications
**Features**:
- Display unacknowledged alerts by default (filter available)
- Severity levels: Critical, High, Medium, Low
- Alert types: suspicious activity, queue spikes, spam reports, user actions
- Real-time alert indicators in sidebar badges

**Actions**:
- **Acknowledge**: Mark alert as reviewed (records admin + timestamp)
- **Acknowledge All**: Batch acknowledge unacknowledged alerts
- **Delete**: Remove alert from system

**Auto-Generated Alerts**:
- Queue length exceeds 30 vehicles
- Spam report patterns detected
- User account suspended/deleted
- Station rejected
- Multiple spam reports from single user

#### 6. Audit Logs & Compliance
**Features**:
- Complete audit trail of all admin actions
- Searchable and filterable logs
- Filter by action type (user_suspended, station_approved, report_reviewed, etc.)
- Filter by admin user
- Display: Admin name, action, entity type, description, IP address, timestamp
- Shows old and new values for changes (JSON format)

**Tracked Actions**:
- `user_suspended`, `user_activated`, `user_deleted`
- `station_approved`, `station_rejected`
- `report_reviewed`, `report_resolved`, `report_spam`, `report_deleted`
- `alert_acknowledged`, `alert_deleted`

#### 7. Data Export
**Features**:
- Export data as CSV for external reporting/analysis
- Available exports: Users, Stations, Reports
- CSV includes relevant metadata and timestamps

**Export Contents**:
- **Users**: ID, name, email, national ID, role, status, station count, dates, suspension reason
- **Stations**: ID, name, location, owner, approval status, queue, fuel availability, dates
- **Reports**: ID, reporter, station, comment, status, fuel type, dates

### API Endpoints (Admin Only)

All endpoints require admin authentication and return JSON.

#### User Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `admin/users.php` | GET | List users (page, limit, search, role, status filters) |
| `admin/user-actions.php` | POST | Suspend/activate/delete user |

#### Station Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `admin/stations.php` | GET | List stations (page, limit, search, approval_status filters) |
| `admin/station-actions.php` | POST | Approve/reject station |

#### Reports Moderation
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `admin/reports.php` | GET | List reports (page, limit, search, status filters) |
| `admin/report-actions.php` | POST | Review/resolve/spam/delete report |

#### System Monitoring
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `admin/statistics.php` | GET | Dashboard statistics (users, stations, reports, alerts, fuel availability) |
| `admin/live-stats.php` | GET | Lightweight live dashboard snapshot for polling (summary, badges, active station queue/status data) |
| `admin/analytics.php` | GET | Chart.js analytics aggregates (queue trends, fuel availability, users, peak hours, reports) |
| `admin/search.php` | GET | Debounced global search across users, stations, and reports |
| `admin/alerts.php` | GET | List system alerts (page, limit, acknowledged filter) |
| `admin/alert-actions.php` | POST | Acknowledge/delete alerts |
| `admin/audit-logs.php` | GET | View admin action logs (page, limit, action, user filters) |

#### Data Export
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `admin/export.php` | GET | Export CSV (type: users, stations, reports) |

### Creating Admin Accounts

An admin account has been **pre-configured** in the database:

#### 🔑 Default Admin Credentials
- **Email**: `admin@fqms.lk`
- **Password**: `admin123`
- **Role**: `admin`
- **Status**: Active

#### ✅ Login Steps
1. Navigate to [login.html](frontend/login.html)
2. Enter email: `admin@fqms.lk`
3. Enter password: `admin123`
4. You will be redirected to the **Admin Dashboard**

#### 🔒 Security - IMPORTANT

**Immediately after first login:**
- ⚠️ **Change the default password** to a strong password
- Update your profile with your actual name
- Use 12+ characters, mixed case, numbers, and symbols
- Never share admin credentials

#### Creating Additional Admin Accounts

To create additional admin accounts, use a MySQL client:

```sql
-- Generate a secure password hash
-- Option A: Use PHP CLI:
-- php -r "echo password_hash('YourSecurePassword123', PASSWORD_DEFAULT);"

-- Option B: Run this query with an MD5 or similar (NOT recommended for production)

-- Then insert:
INSERT INTO users (name, national_id, email, password, role, is_active)
VALUES (
  'Second Admin Name',
  '000000002',
  'admin2@fqms.lk',
  '$2y$10$[paste_generated_hash_here]',
  'admin',
  1
);
```

**Recommended**: Use the test script `backend/test-admin-login.php` to verify admin credentials work before changing them.

#### Troubleshooting Admin Login

If admin login fails with "Invalid credentials":

1. **Verify the account exists**:
   ```sql
   SELECT user_id, name, email, role, is_active FROM users WHERE email = 'admin@fqms.lk';
   ```

2. **Test password verification** (run from command line):
   ```bash
   php backend/test-admin-login.php
   ```

3. **If password is wrong**, regenerate:
   ```bash
   php backend/generate-hash.php
   ```
   Then update: `UPDATE users SET password = '[new_hash]' WHERE email = 'admin@fqms.lk';`

### Database Schema Updates

Run the following SQL to add admin support to existing installations:

```bash
# Import admin schema updates
mysql -u root -p fqms < database/admin_schema_update.sql
```

**New Tables**:
- `audit_logs`: Track all admin actions
- `admin_alerts`: System alerts and notifications
- `system_settings`: Admin configuration
- `queue_history`: Historical queue snapshots recorded when queue length changes; powers trend and peak-hour analytics
- `statistics_cache`: Optional short-lived JSON cache table reserved for heavier dashboard aggregates

**Modified Tables**:
- `users`: Added `is_active`, `suspension_reason`, `suspended_at`, `suspended_by`
- `fuel_stations`: Added `approval_status`, `rejection_reason`, `approved_by`, `approved_at`
- `reports`: Added `report_status`, `admin_notes`, `reviewed_by`, `reviewed_at`

### Security Considerations

1. **Authentication**: Admin endpoints verify role via session
2. **Authorization**: All actions require admin role; non-admins get 403 Forbidden
3. **Audit Logging**: All actions logged with IP address and admin identity
4. **Input Validation**: All inputs validated and sanitized
5. **SQL Injection Prevention**: Prepared statements used throughout
6. **Session Security**: PHP session-based, secure cookies
7. **Rate Limiting**: Recommended for production (implement via web server config)
8. **Password Policy**: Enforce strong passwords for admin accounts
9. **Access Control**: Admin dashboard accessible only to admin role

### Best Practices

1. **Regular Audits**: Review audit logs weekly for suspicious activity
2. **Alert Response**: Acknowledge critical/high alerts promptly
3. **Data Exports**: Export reports monthly for business analytics
4. **User Management**: Suspend suspicious accounts; delete inactive users
5. **Station Approval**: Review pending stations within 24 hours
6. **Backup**: Regular database backups (before major admin operations)
7. **Testing**: Test admin features in staging before production deployment

### Troubleshooting Admin Issues

- **Cannot access admin dashboard**: Verify user role is 'admin' in database
- **404 on admin API**: Ensure `backend/admin/` folder exists
- **Actions not saving**: Check database permissions and error logs
- **Alerts not appearing**: Verify `admin_alerts` table exists; check system_settings
- **Export failing**: Ensure write permissions; check MySQL user privileges
- **Audit logs empty**: Verify actions are being performed by admin accounts

---

## 🧪 Troubleshooting

- **"503 Database unavailable"**: Start MySQL from your control panel.
- **"401 Authentication required"**: Ensure you are logged in.
- **"404 Station not found"**: Import `database/fqms.sql` to seed the initial data.
- **Queue doesn't update**: Check browser console (F12) for errors.
- **Owner dashboard redirects to customer view**: Ensure your account role is set to `owner` and linked to a station.

---

## 📝 Development Notes

### Recent Changes (v2.1 - Admin Release)
- ✅ Complete Admin Dashboard with comprehensive management features
- ✅ User management (suspend, activate, delete with reasons)
- ✅ Station approval workflow (pending → approved/rejected)
- ✅ Reports moderation system (review, resolve, spam detection)
- ✅ Real-time system statistics and analytics dashboard
- ✅ Audit logging with IP tracking and change history
- ✅ System alerts and notifications (critical, high, medium, low)
- ✅ Data export to CSV (users, stations, reports)
- ✅ Role-based access control (RBAC) with admin authorization
- ✅ Responsive admin UI with Bootstrap 5
- ✅ Chart.js integration for statistics visualization

### Previous Changes (v2.0)
- ✅ Simplified estimated waiting time formula to: Queue Length × 2
- ✅ Removed complex service_rate / active_pumps calculation
- ✅ Auto-calculate waiting_time in update_queue.php
- ✅ Enhanced UI with better queue display cards and status badges (Quick / Normal / Long)
- ✅ Improved responsive design for mobile/tablet

### Live Updates (v2.2 - Lightweight Real-Time Feel)
- ✅ Auto-refresh station/queue/fuel data with polling (no page reload, no WebSockets)
- ✅ Prevent duplicate intervals and prevent overlapping refresh calls (single in-flight fetch)
- ✅ Update only changed station cards to minimize DOM work and avoid UI flicker
- ✅ Last-updated indicator on the dashboard header meta (relative time)
- ✅ Non-blocking loading indicator during refresh + warning toast on refresh errors

For more details, see [WAITING_TIME_LOGIC.md](docs/WAITING_TIME_LOGIC.md) and [QUICK_START.md](docs/QUICK_START.md).

---

## �️ Leaflet Map Integration

The system now includes interactive maps powered by **Leaflet.js** with **OpenStreetMap** tiles — no API keys or Google Maps required.

### Map Features

- **User Dashboard Map** (`frontend/dashboard.html`):
  - Displays **all fuel stations dynamically from the database** (via `backend/stations.php`) as markers (only when coordinates are available).
  - Default center: **Sri Lanka** (6.9271, 79.8612) | Default zoom: **7** (auto-fits bounds when multiple stations have coordinates).
  - Click markers to see:
    - Station name + location
    - Fuel availability (Petrol/Diesel/Both/None)
    - Queue length (vehicles)
    - Available (Yes/No)
  - **Station card → map interaction (NEW)**:
    - Clicking any existing station card smoothly animates the map to that station using `map.flyTo()`
    - Automatically opens the matching marker popup using `marker.openPopup()`
    - Temporarily highlights the selected marker for quick visual confirmation
    - Implementation detail:
      - Station cards include `data-station-id` (and optional `data-lat` / `data-lng`) attributes
      - Markers are stored in a stationId → marker lookup (`userMarkersByStationId` / `userMarkers`) to open the correct popup
  - Map container: 400px height, responsive design

- **Owner Dashboard Map** (`frontend/owner-dashboard.html`):
  - Displays **multiple stations dynamically** (same data source as the user dashboard) for quick comparison.
  - Also pins **your station** (when coordinates are set) with a "Your Station" popup.
  - Default center: Sri Lanka (6.9271, 79.8612) if coordinates are not set (auto-fits bounds when other stations have coordinates).
  - Map container: 400px height, responsive design

### Marker Colors

Markers are color-coded based on station status returned by the backend:
- **Green**: `available`
- **Yellow**: `limited`
- **Red**: `nofuel`

### Technical Implementation

**Frontend Files Updated**:
- `frontend/dashboard.html` — Leaflet CSS/JS CDN includes (v1.9.4), map container `<div id="mapUser">`
- `frontend/owner-dashboard.html` — Leaflet CSS/JS CDN includes (v1.9.4), map container `<div id="mapOwner">`
- `frontend/css/dashboard.css` — `.map-container` styling + status-colored marker + popup styling
- `frontend/css/owner-dashboard.css` — `.map-container` styling
- `frontend/js/dashboard.js` — initializes Leaflet, fetches stations, validates coordinates, renders **multiple markers** + popups
- `frontend/js/owner-dashboard.js` — initializes Leaflet, loads owner station + also renders **multiple markers** + popups

**Backend Files Updated**:
- `backend/stations.php` — Returns `latitude` and `longitude` fields (float|null) for each station
- `backend/owner_station.php` — Returns station object with `latitude` and `longitude` fields

**Database**:
- `fuel_stations` table already has `latitude` and `longitude` columns (decimal type)

### How It Works

1. **Initialization**:
   - Maps initialize on dashboard page load
   - Leaflet library loads from CDN
   - OpenStreetMap tiles layer added automatically

2. **User Dashboard Markers**:
   - Stations API is called to fetch all stations with coordinates
   - For each station with valid `latitude` and `longitude`, a marker is added
   - Clicking a marker shows: `<station_name>, <location>`
   - If no stations have coordinates, no markers are shown (just base map)

3. **Owner Dashboard Marker**:
   - Owner's station details are loaded from `backend/owner_station.php`
   - If coordinates exist (`latitude` and `longitude`), marker is placed at that location
   - If coordinates don't exist, marker shows at default center (6.9271, 79.8612)
   - Marker popup: "Fuel Station Location"

### Customizing Map Coordinates

**Method 1: Update Database (Recommended)**
```sql
UPDATE fuel_stations 
SET latitude = 6.9271, longitude = 79.8612 
WHERE station_id = 1;
```

### Adding Coordinates for New Stations

When a new station is created (owner registration flow), you can set coordinates later in MySQL:

```sql
UPDATE fuel_stations
SET latitude = 7.2906, longitude = 80.6337
WHERE station_id = 2;
```

### Importing Sample Stations (Quick Demo)

To quickly populate multiple stations (with queue + availability + coordinates) for Leaflet markers:

```bash
mysql -u root -p fqms < database/sample_stations_seed.sql
```

**Method 2: Edit Default Center in Code**
- Open `frontend/js/dashboard.js`
- Change: `const defaultCenter = [6.9271, 79.8612];` (line ~27)
- Open `frontend/js/owner-dashboard.js`
- Change: `const defaultCenter = [6.9271, 79.8612];` (line ~282)

### Browser Requirements
- Modern browser with JavaScript enabled
- Internet connection (for OpenStreetMap tile layer)
- No API keys required

### Future Enhancements
- Admin UI to edit station coordinates
- Real-time geolocation search
- Proximity-based station ranking for users
- Custom map markers and icons
- Station cluster display for high-density areas

---

## �🔮 Future Enhancements
- 📱 Customer-submitted real-time queue reports (with moderation).
- 🔔 Push notifications for fuel availability alerts.
- 📈 Advanced analytics and trend analysis.
- 🔒 Two-factor authentication (2FA) for admin accounts.
- 🌐 Multi-language support.
- 📊 Customizable admin dashboard widgets.
- ⚙️ Admin API rate limiting and request throttling.
- 🗺️ Advanced map features (clustering, heatmaps, custom routing).
- 🌍 Geolocation search for nearby stations.

---

## 📄 License
Use this project for educational and commercial purposes as needed. Feel free to fork and contribute!
