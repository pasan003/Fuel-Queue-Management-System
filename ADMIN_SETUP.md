# Admin Dashboard - Quick Setup Guide

## ⚡ 5-Minute Setup

### Step 1: Import Database Schema (1 min)
```bash
mysql -u root -p fqms < database/admin_schema_update.sql
```

### Step 2: Create Admin Account (2 min)

**Option A: Using phpMyAdmin**
1. Open phpMyAdmin → fqms database → users table
2. Click "Insert" → Add new row with:
   - name: "Admin" (or your name)
   - national_id: "000000000"
   - email: "admin@fqms.local" (or your email)
   - password: [click "Function" → select "PASSWORD"] and enter: "SecurePassword123"
   - role: "admin"
   - is_active: 1

**Option B: Using MySQL Command**
```sql
INSERT INTO users (name, national_id, email, password, role, is_active)
VALUES (
  'Admin',
  '000000000',
  'admin@fqms.local',
  '$2y$10$OtQOb4H8iKlpH6/L5pLQwOZW6QmPc5Yj8.5tMDJKqT3vN2pLyWmqO',
  'admin',
  1
);
```
*Password hash above is for: "admin123"*

**Option C: Generate Your Own Hash (PHP)**
```bash
php -r "echo password_hash('YourPassword123', PASSWORD_DEFAULT);"
```
Then use the hash in the INSERT statement above.

### Step 3: Access Admin Dashboard (2 min)

1. Start Apache and MySQL
2. Go to: `http://localhost/Fuel-Queue-Management-System/frontend/login.html`
3. Login with admin credentials:
   - Email: admin@fqms.local
   - Password: admin123 (or your password)
4. You'll be redirected to: `admin-dashboard.html`

---

## 🎯 First Steps

### 1. Change Admin Password
- ⚠️ IMPORTANT: Change the default password immediately
- Use direct database UPDATE or registration form

### 2. Explore Dashboard
- View system statistics
- Check alerts (if any)
- Review pending stations for approval

### 3. Approve Pending Stations
1. Click **Stations** in sidebar
2. Filter by "Pending" status
3. Click "Approve" button
4. Confirm action

### 4. Review User List
1. Click **Users** in sidebar
2. View active and suspended users
3. Test suspend/activate features

### 5. Check Audit Logs
1. Click **Audit Logs** in sidebar
2. Verify your actions are logged
3. Note IP address and timestamp tracking

---

## 🔍 Verification Checklist

- [ ] Database schema imported successfully
- [ ] Admin user created in users table
- [ ] Can login with admin credentials
- [ ] Redirected to admin-dashboard.html
- [ ] Dashboard shows statistics
- [ ] Can view users list
- [ ] Can view stations list
- [ ] Can view reports
- [ ] Can view alerts
- [ ] Can view audit logs
- [ ] Export button works
- [ ] Sidebar navigation works

---

## 📝 Default Admin Credentials

**Username (Email)**: admin@fqms.local  
**Password**: admin123  
**Role**: admin  
**Status**: Active  

⚠️ **Security**: Change these immediately after first login!

---

## 🆘 Troubleshooting

### "Cannot access admin dashboard"
```
→ Verify user role is 'admin' in database:
  SELECT * FROM users WHERE email='admin@fqms.local';
  
→ Check is_active = 1

→ Clear browser cache and try again
```

### "403 Forbidden on API endpoints"
```
→ Verify you're logged in as admin
→ Check session is valid
→ Verify role was set correctly in database
```

### "No data showing in tables"
```
→ Make sure database schema was updated
→ Check all admin table fields exist:
  DESCRIBE admin_alerts;
  DESCRIBE audit_logs;
  
→ Verify users/stations/reports exist in main tables
```

### "Charts not displaying"
```
→ Check browser console for errors (F12)
→ Verify Chart.js is loading from CDN
→ Check internet connection
```

### "Audit logs not appearing"
```
→ Perform an admin action (suspend user, etc.)
→ Check audit_logs table:
  SELECT * FROM audit_logs ORDER BY created_at DESC;
```

---

## 🔒 Security Setup Checklist

- [ ] Change default admin password
- [ ] Use strong password (12+ chars, mixed case, symbols)
- [ ] Enable HTTPS in production
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Monitor audit logs regularly
- [ ] Create additional admin accounts if needed
- [ ] Test non-admin access is properly blocked
- [ ] Verify session timeout is configured
- [ ] Review and acknowledge alerts regularly

---

## 📱 Access Details

**Admin Dashboard URL**: 
```
http://localhost/Fuel-Queue-Management-System/frontend/admin-dashboard.html
```

**Automatic Redirect**:
- If admin is logged in, login page redirects to admin dashboard

**Direct Access**:
- Can access directly if already logged in
- Session must be valid
- Will prompt to login if session expired

---

## 🎓 Key Features to Try

1. **User Management**
   - Search and filter users
   - Suspend a test user account
   - View suspension reason in audit logs

2. **Station Approval**
   - Filter pending stations
   - Approve/reject stations
   - See owner notifications

3. **Reports Moderation**
   - View submitted reports
   - Mark as reviewed/spam
   - Add admin notes

4. **Analytics**
   - Check dashboard statistics
   - View real-time charts
   - Monitor fuel availability

5. **Data Export**
   - Export users as CSV
   - Export stations as CSV
   - Use in spreadsheet

6. **Audit Trail**
   - View all admin actions
   - Check IP addresses
   - See before/after values

---

## 🔄 Regular Maintenance Tasks

### Daily
- [ ] Review and acknowledge alerts
- [ ] Check dashboard statistics
- [ ] Approve/reject pending stations

### Weekly
- [ ] Review audit logs for suspicious activity
- [ ] Check user activity patterns
- [ ] Verify spam report trends

### Monthly
- [ ] Export and archive data
- [ ] Review system performance
- [ ] Backup database
- [ ] Review user accounts for cleanup

---

## 📞 Need Help?

Check the detailed documentation:
- **Admin Guide**: See `docs/ADMIN_DASHBOARD.md`
- **Full Documentation**: See `README.md`
- **API Reference**: Embedded in backend files
- **Implementation Guide**: See `IMPLEMENTATION_SUMMARY.md`

---

**Setup Complete!** ✅  
**Admin Dashboard Ready for Use** 🚀
