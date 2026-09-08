module.exports = {
  apps: [
    {
      name: 'roofing-dashboard',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3999,
        DATABASE_URL: 'sqlite:./data/roofing.db'
      },
      env_production_postgres: {
        NODE_ENV: 'production',
        PORT: 3999,
        DATABASE_URL: 'postgresql://roofing_user:password@localhost:5432/roofing_db'
      }
    }
  ]
};
