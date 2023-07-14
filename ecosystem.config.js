module.exports = {
  apps : [{
    name: 'introer',
    script: 'dist/src/server/app.js',
    interpreter: '/usr/bin/node',
    watch: 'src',
    ignore_watch : ["node_modules", "dist"],
    watch_options: {
      "followSymlinks": false
    },
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    autorestart: true,
    exec_mode: 'fork',
    instances: 1,
  }],
};
