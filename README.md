# Fuel Queue Management System

## 📌 Project Overview
The Fuel Queue Management System is a web-based platform designed to help users check real-time fuel availability and queue status at nearby fuel stations.

This system aims to reduce waiting time, avoid unnecessary travel, and improve fuel distribution awareness.

---

## 🚨 Problem Statement
Sri Lanka has experienced fuel shortages causing:

- Long queues at fuel stations
- Lack of fuel availability information
- Traffic congestion
- Time and fuel wastage

Currently, there is no centralized system to check real-time fuel queue status.

---

## 💡 Proposed Solution
This system allows users to:

- Check nearby fuel stations
- View queue length and waiting time
- Check petrol and diesel availability
- Submit queue reports
- Receive notifications when fuel is available

Station administrators/owners can:

- Update fuel availability
- Update queue status
- Manage reports

---

## 🚀 Features

### User Features
- **User Registration & Login (Completed)** - Role-based authentication (Customer/Owner)
- **Search fuel stations by location (Completed)**
- **View queue status (Completed)** - Shows queue length and estimated wait times
- **View fuel availability (Completed)** - Displays Petrol/Diesel availability
- Submit queue reports (with optional images) (Planned)
- Receive alerts (Planned)

### Admin/Owner Features
- **Station Registration (Completed)**
- **Owner Dashboard (Completed)**
- **Update fuel availability (Completed)** - Toggle Petrol/Diesel availability
- Update queue status (In Progress)
- Manage reports (Planned)
- Monitor user submissions (Planned)

---

## 🧭 User Flow

1. User visits the website
2. User registers or logs in (Customer or Owner)
3. User searches for fuel stations
4. System displays nearby stations
5. User checks queue and fuel status
6. User decides where to go
7. User can submit reports
8. Owner updates official data

---

## 🛠️ Technologies Used

### Frontend
- HTML5
- CSS3
- Bootstrap 5
- JavaScript (Vanilla)
- FontAwesome (Icons)

### Backend
- PHP

### Database
- File-based JSON storage (for early development/fallback)
- MySQL (Schema provided for future migration)

---

## 🏗️ System Architecture

User Browser → Frontend (HTML/CSS/JS) → PHP Server → File Storage / MySQL Database

---

## 🗂️ Project Structure
```text
Fuel-Queue-Management-System/
│
├── frontend/
│   ├── css/                  # Stylesheets (auth, dashboard, owner-dashboard, main)
│   ├── js/                   # Client-side logic (auth, dashboard, owner-dashboard)
│   ├── login.html            # Login interface
│   ├── register.html         # Registration interface
│   ├── dashboard.html        # Customer dashboard
│   ├── owner-dashboard.html  # Station owner dashboard
│   └── user_dashboard.html   # Redirect utility
├── backend/
│   ├── config.php            # Server config & File-based DB logic
│   ├── login.php             # Login API handler
│   ├── register.php          # Registration API handler
│   └── data/                 # JSON file storage for user/station data
├── database/
│   └── fqms.sql              # MySQL Database schema
├── docs/                     # Documentation
└── README.md
```

---

## ⚙️ How to Run This Project

Follow these steps to set up and run the project locally:

### 1. Prerequisites
- Install a local server environment like **XAMPP**, **WAMP**, or **MAMP**.
- Ensure you have **MySQL** and **PHP** (v7.4+) installed.

### 2. Set Up the Project
- Clone the repository or download the source code.
- Place the project folder inside your server's root directory (e.g., `C:\xampp\htdocs\` for XAMPP or `C:\wamp64\www\` for WAMP).

### 3. Database Configuration (Optional for now)
- The project currently uses a **JSON-based storage system** (`backend/data/users.json`) for ease of development.
- However, a MySQL schema is provided in `database/fqms.sql` for future migration.
- If you want to prepare the database:
  - Open **phpMyAdmin**.
  - Create a new database named `fqms`.
  - Import the SQL file located at `database/fqms.sql`.

### 4. Configure Backend
- No configuration is required for the current JSON storage.
- If migrating to MySQL in the future, you would update `backend/config.php`.

### 5. Launch the Application
- Start your Apache server.
- Open your browser and navigate to:
  `http://localhost/Fuel-Queue-Management-System/frontend/login.html`

---

## 🚧 Current Development Status
- **Frontend**: UI completed for `login.html`, `register.html`, `dashboard.html` (Customer), and `owner-dashboard.html`. The UI is responsive, features modern styling, and includes JavaScript interactions for validation, filtering, and fuel management. Role-based routing is fully implemented.
- **Backend**: Basic PHP backend is implemented to handle authentication using a simple file-based JSON storage system (`backend/data/users.json`) to keep the project runnable without strict database dependencies initially.
- **Database**: The MySQL database schema (`fqms.sql`) has been designed, including tables for users, stations, fuel availability, queues, and reports.

---

## 📅 Development Plan

- Week 1: Planning & Database Design (Completed)
- Week 2–3: Frontend Development & Authentication (Completed)
- Week 4: Core Features Implementation (Owner Dashboard, Fuel Management) (Completed)
- Week 5: Notifications & Full Backend Integration
- Week 6: Testing, Integration & Deployment

---

## 👥 Team Contributions

- Frontend Development: UI design, responsiveness, form validation, dashboards
- Backend Development: PHP logic, authentication, file-based storage APIs
- Database & Testing: MySQL design, testing, debugging

---

## 💰 Budget

- Domain: $10/year
- Hosting: $20–$50/year
- Tools: Free

Total: Under $100

---

## 🎯 Conclusion

This project provides a practical solution to a real-world problem in Sri Lanka. It improves fuel accessibility and reduces unnecessary waiting time using modern web technologies.
