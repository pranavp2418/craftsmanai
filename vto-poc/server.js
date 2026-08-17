import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4177);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, JPEG, and WEBP images are allowed.'));
    }
    cb(null, true);
  },
});

const sessions = new Map();
const nowIso = () => new Date().toISOString();
const sessionView = (s) => ({
  id: s.id,
  jewelryType: s.jewelryType,
  mode: s.mode,
  status: s.status,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
  captures: s.captures.map((c) => ({ slot: c.slot, url: c.url, validation: c.validation })),
  outputs: s.outputs.map((o) => ({ slot: o.slot, url: o.url, validation: o.validation })),
  failure: s.failure || null,
});

app.post('/api/session', upload.single('jewelry'), async (req, res) => {
  try {
    const jewelryType = String(req.body.jewelryType || '').toLowerCase();
    const mode = String(req.body.mode || '').toLowerCase();
    if (!['ring', 'pendant'].includes(jewelryType)) {
      return res.status(400).json({ error: 'jewelryType must be ring or pendant.' });
    }
    if (!['on-me', 'on-model'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be on-me or on-model.' });
    }
    if (!req.file) return res.status(400).json({ error: 'A jewelry image is required.' });

    const id = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(req.file.originalname || '') || '.png';
    const jewelryName = `${id}-jewelry${ext}`;
    fs.renameSync(req.file.path, path.join(uploadDir, jewelryName));

    const s = {
      id,
      jewelryType,
      mode,
      jewelryUrl: `/uploads/${jewelryName}`,
      status: mode === 'on-me' ? 'waiting_for_mobile' : 'ready_for_model',
      captures: [],
      outputs: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    sessions.set(id, s);

    const mobileUrl = `${PUBLIC_BASE_URL}/?session=${encodeURIComponent(id)}`;
    const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    res.json({ ...sessionView(s), mobileUrl, qrDataUrl, jewelryUrl: s.jewelryUrl });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create VTO session.' });
  }
});

app.get('/api/session/:id', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found or server restarted.' });
  res.json({ ...sessionView(s), jewelryUrl: s.jewelryUrl });
});

app.post('/api/session/:id/status', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found.' });
  const allowed = new Set([
    'waiting_for_mobile', 'camera_ready', 'validating', 'capturing', 'processing',
    'complete', 'failed', 'ready_for_model',
  ]);
  const status = String(req.body.status || '');
  if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status.' });
  s.status = status;
  s.failure = req.body.failure || null;
  s.updatedAt = nowIso();
  res.json(sessionView(s));
});

app.post('/api/session/:id/capture', upload.single('image'), (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found.' });
  if (!req.file) return res.status(400).json({ error: 'Capture image required.' });
  const slot = Number(req.body.slot);
  if (![0, 1, 2].includes(slot)) return res.status(400).json({ error: 'slot must be 0, 1, or 2.' });
  const name = `${s.id}-capture-${slot}.jpg`;
  fs.renameSync(req.file.path, path.join(uploadDir, name));
  const validation = JSON.parse(req.body.validation || '{}');
  s.captures = s.captures.filter((x) => x.slot !== slot);
  s.captures.push({ slot, url: `/uploads/${name}`, validation });
  s.captures.sort((a, b) => a.slot - b.slot);
  s.updatedAt = nowIso();
  res.json(sessionView(s));
});

app.post('/api/session/:id/output', upload.single('image'), (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found.' });
  if (!req.file) return res.status(400).json({ error: 'Output image required.' });
  const slot = Number(req.body.slot);
  if (![0, 1, 2].includes(slot)) return res.status(400).json({ error: 'slot must be 0, 1, or 2.' });
  const name = `${s.id}-output-${slot}.jpg`;
  fs.renameSync(req.file.path, path.join(uploadDir, name));
  const validation = JSON.parse(req.body.validation || '{}');
  s.outputs = s.outputs.filter((x) => x.slot !== slot);
  s.outputs.push({ slot, url: `/uploads/${name}`, validation });
  s.outputs.sort((a, b) => a.slot - b.slot);
  if (s.outputs.length === 3) s.status = 'complete';
  s.updatedAt = nowIso();
  res.json(sessionView(s));
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Request failed.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CraftsmanAI VTO POC running at http://localhost:${PORT}`);
  console.log(`QR/public base URL: ${PUBLIC_BASE_URL}`);
  if (!PUBLIC_BASE_URL.startsWith('https://')) {
    console.log('NOTE: phone camera access normally requires HTTPS. Use a tunnel and set PUBLIC_BASE_URL to its HTTPS URL.');
  }
});
