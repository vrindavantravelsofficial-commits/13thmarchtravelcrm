# Travvip CRM

Travel management CRM system built with Next.js 14 and Supabase.

## Features

- **Customer Query Management** - Track and manage customer inquiries
- **Itinerary/Quote Builder** - Create detailed travel itineraries and quotes
- **Operations Dashboard** - Monitor business operations
- **PDF Generation** - Generate professional PDFs using Playwright
- **Multi-organization Support** - Manage multiple travel organizations

## Tech Stack

- **Frontend:** Next.js 14, React 18, TailwindCSS, ShadCN UI
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **PDF Generation:** Playwright with Chromium
- **Deployment:** Docker & Docker Compose

## Prerequisites

Before deploying to Hostinger VPS KVM 1, ensure you have:

- Docker installed (version 20.10 or higher)
- Docker Compose installed (version 2.0 or higher)
- At least 2GB RAM available
- Port 3000 available
- Git installed (optional, for repository cloning)

### Installing Docker on Ubuntu/Debian (Hostinger VPS)

```bash
# Update package index
sudo apt-get update

# Install required packages
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

## Deployment on Hostinger VPS

### Step 1: Upload Project Files

Upload your project files to your Hostinger VPS using one of these methods:

**Option A: Using Git (if you have a repository)**
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

**Option B: Using SCP/SFTP**
```bash
# From your local machine
scp -r /path/to/project/* user@your-vps-ip:/home/user/travvip-crm/
```

**Option C: Using Hostinger File Manager**
- Upload the ZIP file through Hostinger's file manager
- Extract it on the server

### Step 2: Configure Environment Variables

The `.env.production` file already contains Supabase credentials. If you need to update them:

```bash
cd /path/to/project
nano frontend/.env.production
```

Update with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
```

### Step 3: Build and Deploy with Docker

```bash
# Navigate to project directory
cd /path/to/project

# Build and start the application
docker compose up -d --build
```

This command will:
1. Build the Docker image with all dependencies
2. Install Playwright and Chromium for PDF generation
3. Build the Next.js application
4. Start the container in detached mode

### Step 4: Verify Deployment

```bash
# Check if container is running
docker compose ps

# View logs
docker compose logs -f frontend

# Test the health endpoint
curl http://localhost:3000/api/health
```

### Step 5: Access Your Application

- **Local access:** `http://localhost:3000`
- **Remote access:** `http://your-vps-ip:3000`

## Docker Management Commands

### View Logs
```bash
# View all logs
docker compose logs -f

# View last 100 lines
docker compose logs --tail=100 frontend
```

### Stop Application
```bash
docker compose down
```

### Restart Application
```bash
docker compose restart
```

### Rebuild After Code Changes
```bash
# Stop and remove containers
docker compose down

# Rebuild and start
docker compose up -d --build
```

### Access Container Shell
```bash
docker compose exec frontend sh
```

### Clean Up (Remove all containers and images)
```bash
docker compose down --rmi all --volumes
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

### Memory Issues
If you encounter memory errors during build:
```bash
# Increase Docker memory limit (edit docker-compose.yml)
services:
  frontend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Container Won't Start
```bash
# Check logs for errors
docker compose logs frontend

# Check container status
docker compose ps -a

# Restart with fresh build
docker compose down
docker compose up -d --build --force-recreate
```

### Playwright/PDF Generation Issues
```bash
# Rebuild with no cache to ensure Playwright installs correctly
docker compose build --no-cache
docker compose up -d
```

## Updating the Application

When you make changes to the code:

```bash
# Pull latest changes (if using git)
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

## Firewall Configuration (if needed)

```bash
# Allow port 3000 through firewall
sudo ufw allow 3000/tcp

# Check firewall status
sudo ufw status
```

## Setting Up Domain (Optional)

To use a custom domain with Nginx reverse proxy:

1. Install Nginx:
```bash
sudo apt-get install nginx
```

2. Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/travvip
```

3. Add configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/travvip /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Performance Monitoring

```bash
# Check container resource usage
docker stats

# Check disk space
docker system df

# Clean up unused resources
docker system prune -a
```

## Backup

```bash
# Backup application data
docker compose down
tar -czf travvip-backup-$(date +%Y%m%d).tar.gz /path/to/project

# Restore from backup
tar -xzf travvip-backup-YYYYMMDD.tar.gz -C /restore/path
```

## Support

For issues related to:
- **Supabase:** Check your database connection and credentials
- **Docker:** Ensure Docker and Docker Compose are properly installed
- **Playwright:** Verify Chromium dependencies are installed in container
- **Port conflicts:** Make sure port 3000 is not in use by another application

## License

Private - All rights reserved
