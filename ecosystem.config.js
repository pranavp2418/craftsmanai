/**
 * PM2 process config for the CraftsmanAI backend.
 *
 * Runs the THREE processes the app needs — they must all run, and all be restarted on every deploy:
 *   1) craftmen-api    → the FastAPI/Socket.IO server (uvicorn). Enqueues background jobs.
 *   2) craftmen-worker → the Celery worker that ACTUALLY runs generation/refine/metal/angle/email/cleanup.
 *                        It MUST listen to every queue below, or those jobs silently never run.
 *   3) craftmen-beat   → the Celery beat scheduler for the periodic cleanup tasks.
 *
 * WHY the server gave wrong/incomplete results before: restarting only the API left the OLD worker code
 * running (stale prompts/logic), and/or the worker wasn't listening to all queues (design, celery,
 * metal_variants, angle_variants, email, cleanup) so metal colours / angle views / refines never ran.
 *
 * Deploy on the server (from the project folder):
 *   git pull
 *   pm2 startOrReload ecosystem.config.js   # (re)starts ALL three with fresh code
 *   pm2 save
 *
 * Adjust VENV / HOST / PORT / CONCURRENCY below for your server. VENV is the path to the virtualenv that
 * has uvicorn + celery installed (e.g. ".venv" or "venv" or an absolute path).
 */
const path = require('path');

const CWD = __dirname;               // the project folder this file sits in
const VENV = '.venv';                // <-- change to your venv folder name if different (e.g. 'venv')
const HOST = '0.0.0.0';
const PORT = 8000;
const CONCURRENCY = 4;               // raise if the server has more RAM (each 2K image job ~0.5-1GB)
const QUEUES = 'design,celery,metal_variants,angle_variants,email,cleanup';

const bin = (name) => path.join(CWD, VENV, 'bin', name);

module.exports = {
  apps: [
    {
      name: 'craftmen-api',
      cwd: CWD,
      script: bin('uvicorn'),
      args: `app.main:app --host ${HOST} --port ${PORT}`,
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      env: { PYTHONPATH: CWD },
      out_file: 'logs/pm2-api.out.log',
      error_file: 'logs/pm2-api.err.log',
    },
    {
      name: 'craftmen-worker',
      cwd: CWD,
      script: bin('celery'),
      // -Q lists EVERY queue the tasks route to. Missing one = those jobs never run.
      // --concurrency here OVERRIDES worker_concurrency in celery_app.py — keep them in sync.
      args: `-A app.core.celery_app worker -Q ${QUEUES} --concurrency=${CONCURRENCY} --pool=prefork --loglevel=info -n worker@%h`,
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      // Give the worker time to finish an in-flight image job before a restart kills it.
      kill_timeout: 30000,
      env: { PYTHONPATH: CWD },
      out_file: 'logs/pm2-worker.out.log',
      error_file: 'logs/pm2-worker.err.log',
    },
    {
      name: 'craftmen-beat',
      cwd: CWD,
      script: bin('celery'),
      args: '-A app.core.celery_app beat --loglevel=info',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      env: { PYTHONPATH: CWD },
      out_file: 'logs/pm2-beat.out.log',
      error_file: 'logs/pm2-beat.err.log',
    },
  ],
};
