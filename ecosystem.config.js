module.exports = {
  apps: [{
    name: 'daily-workbench',
    script: './server/src/index.js',
    cwd: '/opt/DailyWorkbench',
    env: {
      NODE_ENV: 'production',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/daily-workbench-error.log',
    out_file: '/var/log/daily-workbench-out.log',
    max_memory_restart: '512M',
  }],
};
