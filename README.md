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
│   │   ├── owner-dashboard.js  # Owner dashboard with fuel toggles
│   │   └── admin.js            # Admin dashboard with API integration (NEW)
│   ├── login.html              # Login page
│   ├── register.html           # Registration page
│   ├── dashboard.html          # Customer dashboard (main view)
│   ├── owner-dashboard.html    # Owner dashboard
│   ├── admin-dashboard.html    # Admin dashboard (NEW)
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
│   ├── admin/                  # Admin API endpoints (NEW)
│   │   ├── users.php           # GET list users with filtering
│   │   ├── user-actions.php    # POST suspend/activate/delete user
│   │   ├── stations.php        # GET list stations with approval status
│   │   ├── station-actions.php # POST approve/reject station
│   │   ├── reports.php         # GET list reports with filtering
│   │   ├── report-actions.php  # POST review/resolve/spam report
│   │   ├── statistics.php      # GET dashboard statistics
│   │   ├── audit-logs.php      # GET admin action audit logs
│   │   ├── alerts.php          # GET system alerts
│   │   ├── alert-actions.php   # POST acknowledge/delete alerts
│   │   └── export.php          # GET CSV export (users/stations/reports)
│   └── api/
│       └── station/
│           └── estimated-time.php  # GET estimated waiting time
│
├── database/
│   ├── fqms.sql                # Complete schema + demo seed data
│   └── admin_schema_update.sql # Admin feature schema updates (NEW)
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
- **Real-time Charts**: User distribution by role, report status breakdown
- **Station Approval Status**: Pending, approved, and rejected stations
- **Fuel Availability Trends**: Percentage of stations with fuel available by type
- **System Alerts**: Critical, high, medium, and low severity alerts
- **Recent Activity**: New users, stations, reports, and admin actions (last 24h)

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

For more details, see [WAITING_TIME_LOGIC.md](docs/WAITING_TIME_LOGIC.md) and [QUICK_START.md](docs/QUICK_START.md).

---

## 🔮 Future Enhancements
- 🗺️ Google Maps integration for station locations.
- 📱 Customer-submitted real-time queue reports (with moderation).
- 🔔 Push notifications for fuel availability alerts.
- 📈 Advanced analytics and trend analysis.
- 🔒 Two-factor authentication (2FA) for admin accounts.
- 🌐 Multi-language support.
- 📊 Customizable admin dashboard widgets.
- ⚙️ Admin API rate limiting and request throttling.

---

## 📄 License
Use this project for educational and commercial purposes as needed. Feel free to fork and contribute!
