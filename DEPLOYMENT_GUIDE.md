# DEPLOYMENT & INSTALLATION GUIDE

Complete production-ready deployment instructions.

---

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment](#production-deployment)
4. [Configuration Management](#configuration-management)
5. [Database Setup](#database-setup)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements (Development)
- PHP 8.1+
- MySQL 8.0+
- Apache 2.4+ or Nginx 1.18+
- 2GB RAM
- 5GB Disk Space

### Recommended (Production)
- PHP 8.2 (FPM)
- MySQL 8.0.32+ (or MariaDB 10.6+)
- Nginx 1.24+ (better performance) or Apache 2.4
- 8GB+ RAM
- 50GB+ SSD Storage
- CDN (for static assets)
- Redis 7.0+ (optional, for caching)

### Software Dependencies
```bash
# PHP Extensions required
php-pdo
php-pdo-mysql
php-json
php-mbstring
php-curl
php-gd
php-imagick
php-zip
php-xml

# Development tools
composer (PHP package manager)
git
curl
mysql-client
```

---

## Local Development Setup

### Step 1: Install Prerequisites

**macOS:**
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PHP 8.2
brew install php@8.2
brew link php@8.2

# Install MySQL 8.0
brew install mysql@8.0
brew services start mysql@8.0

# Install Composer
brew install composer

# Install Node.js (for build tools)
brew install node
```

**Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PHP 8.2
sudo apt install -y php8.2 php8.2-{pdo,pdo-mysql,json,mbstring,curl,gd,zip,xml}

# Install MySQL 8.0
sudo apt install -y mysql-server

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**Windows:**
```bash
# Download from official sites:
# PHP: https://windows.php.net/download/
# MySQL: https://dev.mysql.com/downloads/mysql/
# Composer: https://getcomposer.org/download/
# Node.js: https://nodejs.org/

# Add to PATH environment variable
# Then verify installation
php -v
mysql --version
composer -V
node -v
```

### Step 2: Clone Repository

```bash
cd ~/projects
git clone https://github.com/your-org/fqms.git
cd fqms
```

### Step 3: Install PHP Dependencies

```bash
# Install via Composer
composer install

# For development with dev dependencies
composer install --dev
```

### Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with local values
nano .env

# Generate app key (if needed)
php artisan key:generate  # or custom setup script
```

### Step 5: Database Setup

```bash
# Create database
mysql -u root -p
mysql> CREATE DATABASE fqms_dev;
mysql> EXIT;

# Import schema
mysql -u root -p fqms_dev < database/schema.sql

# Run migrations
php scripts/migrate.php

# Seed data
php scripts/seed.php --with-demo-data
```

### Step 6: Start Development Server

```bash
# Option 1: PHP Built-in Server
php -S localhost:8000 -t public/

# Option 2: Using Docker
docker-compose up -d

# Option 3: Using Apache (if configured)
# Access: http://localhost/fqms
```

### Step 7: Verify Installation

```bash
# Check status endpoints
curl http://localhost:8000/api/v1/health

# Test login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fqms.lk",
    "password": "SecureAdmin@123"
  }'
```

---

## Production Deployment

### Step 1: Choose Hosting Provider

**Recommended Options:**
- AWS EC2 (t3.medium or larger)
- DigitalOcean (Professional plan)
- Linode (4GB+ RAM)
- Azure App Service
- Google Cloud Platform

### Step 2: Server Setup

```bash
# SSH into server
ssh ubuntu@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y php8.2-fpm php8.2-{pdo,pdo-mysql,json,mbstring,curl,gd,zip,xml,opcache}
sudo apt install -y mysql-server-8.0
sudo apt install -y nginx
sudo apt install -y supervisor
sudo apt install -y certbot python3-certbot-nginx
sudo apt install -y fail2ban
sudo apt install -y ufw

# Enable UFW firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Start services
sudo systemctl start php8.2-fpm
sudo systemctl start mysql
sudo systemctl start nginx
sudo systemctl enable php8.2-fpm
sudo systemctl enable mysql
sudo systemctl enable nginx
```

### Step 3: Deploy Application

```bash
# Create application directory
sudo mkdir -p /var/www/fqms
cd /var/www/fqms

# Clone repository (using SSH key)
sudo git clone git@github.com:your-org/fqms.git .

# Set permissions
sudo chown -R www-data:www-data /var/www/fqms
sudo chmod -R 755 /var/www/fqms
sudo chmod -R 775 /var/www/fqms/storage
sudo chmod -R 775 /var/www/fqms/bootstrap/cache

# Install dependencies
cd /var/www/fqms
composer install --no-dev --optimize-autoloader

# Set environment
sudo cp .env.example .env.production
sudo nano .env.production  # Edit with production values

# Database setup
mysql -u root -p < database/schema.sql
php scripts/migrate.php
```

### Step 4: Configure Web Server (Nginx)

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/fqms

# Insert configuration:
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.fqms.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.fqms.example.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.fqms.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fqms.example.com/privkey.pem;
    
    # Performance
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Root directory
    root /var/www/fqms/public;
    index index.php;
    
    # Compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;
    gzip_vary on;
    
    # Client body size limit
    client_max_body_size 10M;
    
    # PHP-FPM upstream
    upstream php {
        server unix:/run/php/php8.2-fpm.sock;
    }
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    
    # Location rules
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \.php$ {
        fastcgi_pass php;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        
        # PHP-FPM timeouts
        fastcgi_connect_timeout 60s;
        fastcgi_send_timeout 300s;
        fastcgi_read_timeout 300s;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Deny access to sensitive files
    location ~ ~$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Logging
    access_log /var/log/nginx/fqms-access.log combined buffer=32k;
    error_log /var/log/nginx/fqms-error.log warn;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/fqms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: SSL/TLS Certificate (Let's Encrypt)

```bash
# Obtain certificate
sudo certbot certonly --nginx -d api.fqms.example.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo certbot renew --dry-run
```

### Step 6: Configure PHP-FPM

```bash
# Edit PHP-FPM config
sudo nano /etc/php/8.2/fpm/pool.d/www.conf

# Key settings:
# user = www-data
# group = www-data
# listen = /run/php/php8.2-fpm.sock
# listen.owner = www-data
# listen.group = www-data
# pm = dynamic
# pm.max_children = 50
# pm.start_servers = 10
# pm.min_spare_servers = 5
# pm.max_spare_servers = 35

sudo systemctl restart php8.2-fpm
```

### Step 7: Process Monitoring (Supervisor)

```bash
# Create supervisor config
sudo nano /etc/supervisor/conf.d/fqms.conf

# Insert:
```

```ini
[program:fqms-queue-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/fqms/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
numprocs=4
user=www-data
stdout_logfile=/var/log/fqms-worker.log
stderr_logfile=/var/log/fqms-worker-error.log

[program:fqms-scheduler]
process_name=%(program_name)s
command=php /var/www/fqms/artisan schedule:work
autostart=true
autorestart=true
user=www-data
stdout_logfile=/var/log/fqms-scheduler.log
stderr_logfile=/var/log/fqms-scheduler-error.log
```

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
```

---

## Configuration Management

### .env Production File

```bash
# .env.production example

# App
APP_NAME="Fuel Queue Management System"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.fqms.example.com

# Database
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=fqms_prod
DB_USERNAME=fqms_user
DB_PASSWORD=SecureRandomPassword123!@#
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# Cache
CACHE_DRIVER=file
CACHE_TTL=300

# Session
SESSION_DRIVER=database
SESSION_LIFETIME=1440
SESSION_SECURE_COOKIES=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax

# Security
CSRF_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_LOGIN_ATTEMPTS=5
RATE_LIMIT_LOGIN_WINDOW=60
RATE_LIMIT_API_REQUESTS=300
RATE_LIMIT_API_WINDOW=60

# Password Policy
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL_CHARS=true

# Email (for notifications)
MAIL_DRIVER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_FROM_ADDRESS=noreply@fqms.example.com
MAIL_FROM_NAME="Fuel Queue System"

# Logging
LOG_CHANNEL=stack
LOG_LEVEL=info

# Monitoring
SENTRY_DSN=https://key@sentry.io/project-id

# Timezone
APP_TIMEZONE=Asia/Colombo
```

---

## Database Setup

### User & Permissions

```bash
# Create database user
mysql -u root -p

mysql> CREATE USER 'fqms_user'@'localhost' IDENTIFIED BY 'SecurePassword123!@#';

# Grant permissions
mysql> GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP 
    ON fqms_prod.* TO 'fqms_user'@'localhost';

# Grant EXECUTE for stored procedures
mysql> GRANT EXECUTE ON fqms_prod.* TO 'fqms_user'@'localhost';

# Apply changes
mysql> FLUSH PRIVILEGES;

mysql> EXIT;
```

### Backup Strategy

```bash
# Daily backup script
cat > /usr/local/bin/backup-fqms-db.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/fqms"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="fqms_prod"
DB_USER="fqms_user"

mkdir -p $BACKUP_DIR

# Full backup
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_DIR/fqms_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "fqms_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/fqms_$DATE.sql.gz"
EOF

chmod +x /usr/local/bin/backup-fqms-db.sh

# Schedule daily backup
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-fqms-db.sh
```

---

## Security Hardening

### PHP Security Settings

```bash
# /etc/php/8.2/fpm/php.ini

expose_php = Off
upload_tmp_dir = /var/tmp
session.name = FQMSID
session.use_only_cookies = On
session.cookie_secure = On
session.cookie_httponly = On
session.cookie_samesite = Strict
disable_functions = exec, passthru, shell_exec, system, proc_open, popen, curl_exec, curl_multi_exec, parse_ini_file, show_source
```

### MySQL Security

```bash
# Secure MySQL
sudo mysql_secure_installation

# Disable remote access
# Edit /etc/mysql/mysql.conf.d/mysqld.cnf
# Set: bind-address = 127.0.0.1

# Set strong password policy
mysql -u root -p
mysql> INSTALL COMPONENT 'file://component_validate_password';
mysql> SET GLOBAL validate_password.policy='STRONG';
mysql> EXIT;
```

### Firewall Rules

```bash
# UFW firewall configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Rate limiting with fail2ban
sudo nano /etc/fail2ban/jail.local

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5

sudo systemctl restart fail2ban
```

---

## Monitoring & Maintenance

### Monitoring Stack

```bash
# Install monitoring tools
sudo apt install -y prometheus node-exporter grafana-server

# Start Prometheus & Grafana
sudo systemctl start prometheus
sudo systemctl start grafana-server

# Access Grafana: http://your-server:3000
# Default: admin / admin
```

### Log Management

```bash
# Install ELK Stack (optional)
sudo apt install -y elasticsearch logstash kibana

# Centralize logs
sudo nano /etc/logstash/conf.d/fqms.conf

input {
  file {
    path => "/var/log/fqms/*.log"
    start_position => "beginning"
  }
}

filter {
  json {
    source => "message"
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "fqms-%{+YYYY.MM.dd}"
  }
}
```

### Performance Tuning

```bash
# Monitor slow queries
mysql -u root -p -e "SET GLOBAL slow_query_log = 'ON';"
mysql -u root -p -e "SET GLOBAL long_query_time = 2;"

# View slow queries
tail -f /var/log/mysql/slow.log

# Analyze with pt-query-digest (Percona Toolkit)
pt-query-digest /var/log/mysql/slow.log
```

---

## Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check MySQL service
sudo systemctl status mysql

# Verify credentials
mysql -u fqms_user -p -h localhost fqms_prod

# Check logs
sudo tail -f /var/log/mysql/error.log
```

**PHP-FPM Not Starting:**
```bash
# Check errors
sudo systemctl status php8.2-fpm
sudo journalctl -xe

# Syntax check
sudo php8.2 -l /var/www/fqms/public/index.php

# Restart
sudo systemctl restart php8.2-fpm
```

**High Memory Usage:**
```bash
# Check memory
free -h
ps aux --sort=-%mem | head -20

# Adjust PHP-FPM settings
sudo nano /etc/php/8.2/fpm/php.ini
# Increase: memory_limit = 256M
```

**SSL Certificate Issues:**
```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Check expiration
openssl x509 -in /etc/letsencrypt/live/api.fqms.example.com/fullchain.pem -noout -dates
```

---

This deployment guide provides:
✅ Development setup  
✅ Production deployment  
✅ Configuration management  
✅ Security hardening  
✅ Monitoring setup  
✅ Troubleshooting guide  
✅ Backup strategy  
✅ Performance optimization
