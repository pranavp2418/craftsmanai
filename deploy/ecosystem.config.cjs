const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND = path.join(ROOT, 'backend');
const VENV = path.join(BACKEND, 'venv', 'bin');

const backendProcess = {
  cwd: BACKEND,
  interpreter: 'none',
  autorestart: true,
  max_restarts: 10,
  env: { PYTHONPATH: BACKEND },
};

module.exports = {
  apps: [
    {
      name: 'frontend',
      cwd: FRONTEND,
      script: '/usr/bin/pnpm',
      args: 'start --hostname 127.0.0.1 --port 3000',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      out_file: path.join(ROOT, 'logs', 'frontend.out.log'),
      error_file: path.join(ROOT, 'logs', 'frontend.err.log'),
    },
    {
      ...backendProcess,
      name: 'backend',
      script: path.join(VENV, 'uvicorn'),
      args: 'app.main:app --host 127.0.0.1 --port 8000 --workers 2',
      kill_timeout: 30000,
      out_file: path.join(ROOT, 'logs', 'backend.out.log'),
      error_file: path.join(ROOT, 'logs', 'backend.err.log'),
    },
    {
      ...backendProcess,
      name: 'craftmen-worker',
      script: path.join(VENV, 'celery'),
      args: '-A app.core.celery_app:celery_app worker -Q design,celery,metal_variants,angle_variants --pool=prefork --concurrency=6 --loglevel=info -n gen@%h',
      kill_timeout: 30000,
      out_file: path.join(ROOT, 'logs', 'worker.out.log'),
      error_file: path.join(ROOT, 'logs', 'worker.err.log'),
    },
    {
      ...backendProcess,
      name: 'craftmen-utility',
      script: path.join(VENV, 'celery'),
      args: '-A app.core.celery_app:celery_app worker -Q email,cleanup --pool=prefork --concurrency=2 --loglevel=info -n util@%h',
      kill_timeout: 30000,
      out_file: path.join(ROOT, 'logs', 'utility.out.log'),
      error_file: path.join(ROOT, 'logs', 'utility.err.log'),
    },
    {
      ...backendProcess,
      name: 'craftmen-beat',
      script: path.join(VENV, 'celery'),
      args: '-A app.core.celery_app:celery_app beat --loglevel=info',
      out_file: path.join(ROOT, 'logs', 'beat.out.log'),
      error_file: path.join(ROOT, 'logs', 'beat.err.log'),
    },
  ],
};
