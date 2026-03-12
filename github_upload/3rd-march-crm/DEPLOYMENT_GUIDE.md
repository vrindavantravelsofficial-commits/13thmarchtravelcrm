# Quick Deployment Guide for Hostinger VPS KVM 1

## Prerequisites Checklist
- ✅ Hostinger VPS KVM 1 with root/sudo access
- ✅ Ubuntu/Debian OS
- ✅ At least 2GB RAM
- ✅ Port 3000 available

## Step-by-Step Deployment

### 1. Connect to Your VPS
```bash
ssh root@your-vps-ip
# OR
ssh username@your-vps-ip
```

### 2. Install Docker (if not already installed)
```bash
# Quick install script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional)
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

### 3. Upload Your Project
Choose one method:

**Method A: Direct Upload via SCP**
```bash
# From your local machine
scp -r /path/to/this/project root@your-vps-ip:/root/travvip-crm/
```

**Method B: Upload ZIP and Extract on Server**
```bash
# On VPS
cd /root
# Upload ZIP via Hostinger file manager, then:
apt-get install unzip
unzip your-project.zip
cd travvip-crm
```

**Method C: Git Clone (if you have repo)**
```bash
# On VPS
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 4. Verify Files
```bash
# Check all required files exist
ls -la

# Should see:
# - Dockerfile
# - docker-compose.yml
# - frontend/ directory
# - backend/ directory (not used)
```

### 5. Check Environment Configuration
```bash
# Verify .env.production exists
cat frontend/.env.production

# Should contain Supabase credentials
# If not, create it:
nano frontend/.env.production
```

### 6. Build and Deploy
```bash
# Make sure you're in the project root directory
cd /root/travvip-crm  # or your project path

# Build and start
docker compose up -d --build
```

This will take 5-15 minutes depending on your VPS specs.

### 7. Monitor the Build
```bash
# Watch the build process
docker compose logs -f
```

Wait until you see:
```
✓ Ready in Xms
```

Press `Ctrl+C` to exit logs (container keeps running)

### 8. Verify Deployment
```bash
# Check container status
docker compose ps

# Should show:
# NAME                         STATUS
# travvip-crm-frontend-1       Up X minutes (healthy)

# Test the application
curl http://localhost:3000/api/health
```

### 9. Access Your Application
Open in browser:
- From VPS: `http://localhost:3000`
- From internet: `http://YOUR_VPS_IP:3000`

Example: `http://203.0.113.45:3000`

### 10. Open Firewall (if needed)
```bash
# If you can't access from browser, open port 3000
sudo ufw allow 3000/tcp

# Or disable firewall temporarily (not recommended for production)
sudo ufw disable
```

## Common Issues & Quick Fixes

### Issue: "Cannot connect to Docker daemon"
```bash
# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

### Issue: "Port 3000 already in use"
```bash
# Find and kill process
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Issue: "Out of memory during build"
```bash
# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Issue: "Container exits immediately"
```bash
# Check logs for errors
docker compose logs frontend

# Common fix: rebuild from scratch
docker compose down
docker system prune -a -f
docker compose up -d --build
```

### Issue: "Build fails at Playwright install"
```bash
# Rebuild without cache
docker compose build --no-cache
docker compose up -d
```

## Useful Commands

```bash
# View logs
docker compose logs -f

# Restart application
docker compose restart

# Stop application
docker compose down

# Update after code changes
docker compose down && docker compose up -d --build

# Check resource usage
docker stats

# Access container shell
docker compose exec frontend sh

# Remove everything and start fresh
docker compose down --rmi all --volumes
docker system prune -a -f
```

## Setting Up Auto-Start on Reboot

```bash
# Ensure Docker starts on boot
sudo systemctl enable docker

# Your docker-compose.yml already has "restart: unless-stopped"
# so containers will auto-restart
```

## Production Checklist

- ✅ Docker and Docker Compose installed
- ✅ Application deployed and accessible
- ✅ Health check passing
- ✅ Firewall configured (if needed)
- ✅ Environment variables set correctly
- ✅ Container auto-restart enabled

## Next Steps

1. **Set up domain (optional):**
   - Point your domain to VPS IP
   - Install Nginx reverse proxy
   - Configure SSL with Let's Encrypt

2. **Set up monitoring:**
   - Install monitoring tools (Portainer, etc.)
   - Set up log aggregation

3. **Configure backups:**
   - Regular database backups
   - Application state backups

## Support Contacts

- Hostinger Support: https://www.hostinger.com/tutorials/vps
- Docker Documentation: https://docs.docker.com/
- Project-specific issues: Check application logs

---

**Deployment completed successfully! 🚀**

Access your application at: `http://YOUR_VPS_IP:3000`
