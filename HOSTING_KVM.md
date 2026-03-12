# Hostinger VPS / KVM - Deployment notes

This document explains how to deploy the app on a Hostinger VPS (KVM) using Docker Compose. It intentionally does not include secrets — populate environment files on the server.

1) Prepare the VPS
  - SSH into the server.
  - Install Docker and Docker Compose (or use the distro packages).

2) Clone the repo on the VPS
  git clone https://github.com/vrindavantravelsofficial-commits/13thmarchtravelcrm.git
  cd 13thmarchtravelcrm

3) Create `frontend/.env.production` on the server (fill real values, do NOT commit)
  mkdir -p frontend
  cat > frontend/.env.production <<EOF
  NEXT_PUBLIC_SUPABASE_URL=https://your.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-xxxxx
  SUPABASE_SERVICE_ROLE_KEY=service-role-xxxxx
  NODE_ENV=production
  EOF

4) Provide nginx config
  - Create `deploy/nginx/conf.d/default.conf` with a proxy to `http://frontend:3000`.

5) Start with Docker Compose for hosting
  docker-compose -f docker-compose.hosting.yml up -d --build

6) Logs & health
  docker-compose -f docker-compose.hosting.yml logs -f
  docker ps

Security notes
- Do not commit `.env.production` or any secrets. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
