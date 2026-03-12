module.exports = {
  apps: [
    {
      name: 'travvip-crm',
      script: 'npm',
      args: 'start',
      cwd: '/home/user/public_html/travvip-crm',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000
    }
  ]
};
