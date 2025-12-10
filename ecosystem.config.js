// PM2 Ecosystem Configuration for Production
// Ensures backend NEVER goes down with auto-restart, clustering, and monitoring

module.exports = {
  apps: [{
    name: 'zodiac-backend',
    script: './src/app-production.js',

    // Instances and clustering
    instances: process.env.PM2_INSTANCES || 2, // Run 2 instances for high availability
    exec_mode: 'cluster', // Cluster mode for load balancing

    // Auto-restart configuration
    autorestart: true, // Always restart on crash
    watch: false, // Don't watch files in production (causes unnecessary restarts)
    max_memory_restart: '500M', // Restart if memory exceeds 500MB

    // Exponential backoff for restarts
    exp_backoff_restart_delay: 100, // Start with 100ms delay
    min_uptime: '10s', // Minimum uptime before considering a restart stable
    max_restarts: 10, // Maximum restarts within restart_delay window
    restart_delay: 4000, // 4 seconds between restarts

    // Environment
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
    },

    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true, // Prefix logs with timestamps
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Advanced features
    merge_logs: true, // Merge logs from all instances

    // Health monitoring
    kill_timeout: 5000, // Time to wait for graceful shutdown (5s)
    listen_timeout: 10000, // Time to wait for app to be ready (10s)
    wait_ready: false, // Don't wait for ready signal (we handle this internally)

    // Crash handling
    pmx: true, // Enable PM2 monitoring
    vizion: true, // Enable version control features

    // Additional process management
    cron_restart: '0 4 * * *', // Restart daily at 4 AM (during low traffic)

    // Resource limits
    node_args: [
      '--max-old-space-size=450', // Limit Node.js heap to 450MB
      '--max-http-header-size=16384' // Increase header size for large requests
    ]
  }]
};