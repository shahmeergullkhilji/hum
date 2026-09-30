const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_PASSWORDS = new Set([
  'meer6734',
  ...(process.env.ADMIN_PASSWORD ? [String(process.env.ADMIN_PASSWORD).trim()] : [])
]);
const ROOT = __dirname;
const sessions = new Map();

// Brute-force protection: track failed login attempts per IP
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Files that must NEVER be served to any client
const BLOCKED_FILES = new Set([
  'serviceaccountkey.json',
  'humsafar-rishta-firebase-adminsdk-fbsvc-e7b20ae956.json',
  'cookies.txt',
  'humsafar.sqlite',
  'firebase-debug.log',
  'package.json',
  'package-lock.json',
  '.gitignore',
  'readme.md',
  'server.js',
  'server.log',
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json',
]);

/* =========================================================
   FIREBASE INITIALIZATION
   ========================================================= */
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  || path.join(ROOT, 'serviceAccountKey.json');

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
} else {
  console.error('ERROR: No Firebase credentials found.');
  process.exit(1);
}

const db = getFirestore();
const proposalsRef = db.collection('proposals');

const fields = [
  'proposal_id', 'gender', 'age', 'city', 'education', 'profession', 'height',
  'marital_status', 'religion', 'family_background', 'about', 'looking_for',
  'image_url', 'status', 'created_at'
];

/* =========================================================
   HELPERS
   ========================================================= */
function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-auth, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Private-Network': 'true',
    ...extraHeaders
  });
  res.end(payload);
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(pair => {
    const index = pair.indexOf('=');
    return [pair.slice(0, index).trim(), decodeURIComponent(pair.slice(index + 1).trim())];
  }));
}

function isAdmin(req) {
  const token = parseCookies(req).hr_session;
  if (token && sessions.has(token)) return true;
  const authHeader = req.headers['x-admin-auth'] || req.headers['authorization'];
  if (authHeader) {
    const clean = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    if (ALLOWED_PASSWORDS.has(clean) || sessions.has(clean)) return true;
  }
  return false;
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: 'Unauthorized' });
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function proposalPayload(body) {
  const payload = Object.fromEntries(fields.map(field => [field, body[field] ?? '']));
  if (!payload.proposal_id || !String(payload.proposal_id).trim()) {
    payload.proposal_id = 'HR-' + Math.floor(1000 + Math.random() * 9000);
  } else {
    payload.proposal_id = String(payload.proposal_id).trim();
  }
  payload.age = Number(payload.age);
  payload.created_at = payload.created_at || new Date().toISOString().slice(0, 10);
  if (!payload.gender || !payload.city || !payload.education || !payload.profession || !Number.isInteger(payload.age)) {
    throw new Error('Required proposal fields are missing (gender, age, city, education, profession)');
  }
  return payload;
}

/* =========================================================
   FIRESTORE CRUD
   ========================================================= */
async function getProposals(admin) {
  let query = proposalsRef;
  if (!admin) {
    query = query.where('status', '==', 'Active');
  }
  try {
    const snapshot = await query.orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    docs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return docs;
  }
}

async function createProposal(payload) {
  const docRef = proposalsRef.doc(payload.proposal_id);
  const existing = await docRef.get();
  if (existing.exists) {
    throw new Error('UNIQUE constraint failed: proposal_id already exists');
  }
  await docRef.set(payload);
  return { id: docRef.id, ...payload };
}

async function updateProposal(id, payload) {
  const docRef = proposalsRef.doc(id);
  const existing = await docRef.get();
  if (!existing.exists) return null;
  await docRef.update(payload);
  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() };
}

async function deleteProposal(id) {
  const docRef = proposalsRef.doc(id);
  const existing = await docRef.get();
  if (!existing.exists) return false;
  await docRef.delete();
  return true;
}

/* =========================================================
   API HANDLER
   ========================================================= */
async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/proposals') {
    const adminMode = isAdmin(req) && url.searchParams.get('admin') === '1';
    return sendJson(res, 200, await getProposals(adminMode));
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/session') {
    return sendJson(res, 200, { authenticated: isAdmin(req) });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempt = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };

    if (attempt.lockedUntil > now) {
      const remaining = Math.ceil((attempt.lockedUntil - now) / 60000);
      return sendJson(res, 429, { error: `Too many failed attempts. Try again in ${remaining} minute(s).` });
    }

    const body = await readBody(req);
    const pass = String(body.password || '').trim();
    if (!ALLOWED_PASSWORDS.has(pass)) {
      attempt.count += 1;
      if (attempt.count >= MAX_ATTEMPTS) {
        attempt.lockedUntil = now + LOCKOUT_MS;
        attempt.count = 0;
      }
      loginAttempts.set(ip, attempt);
      return sendJson(res, 401, { error: 'Invalid password' });
    }

    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now());
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `hr_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400` });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    const token = parseCookies(req).hr_session;
    sessions.delete(token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'hr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  if (!url.pathname.startsWith('/api/proposals')) return false;
  if (!requireAdmin(req, res)) return true;

  try {
    if (req.method === 'POST' && url.pathname === '/api/proposals') {
      const payload = proposalPayload(await readBody(req));
      const created = await createProposal(payload);
      return sendJson(res, 201, created);
    }

    const match = url.pathname.match(/^\/api\/proposals\/([^/]+)$/);
    if (!match) return sendJson(res, 404, { error: 'Not found' });
    const id = decodeURIComponent(match[1]);

    if (req.method === 'PUT') {
      const payload = proposalPayload(await readBody(req));
      const updated = await updateProposal(id, payload);
      if (!updated) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, updated);
    }
    if (req.method === 'DELETE') {
      const deleted = await deleteProposal(id);
      if (!deleted) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, { ok: true });
    }
  } catch (error) {
    return sendJson(res, error.message.includes('UNIQUE') ? 409 : 400, { error: error.message });
  }
  return sendJson(res, 405, { error: 'Method not allowed' });
}

/* =========================================================
   STATIC FILE SERVER + START
   ========================================================= */
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-auth, Access-Control-Request-Private-Network',
      'Access-Control-Allow-Private-Network': 'true'
    });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    try { if (await handleApi(req, res, url) !== false) return; } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  // Route mapping
  const requested = (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin.html')
    ? (fs.existsSync(path.join(ROOT, 'index.html')) ? '/index.html' : '/humsafar-rishta.html')
    : (url.pathname === '/proposals' || url.pathname === '/proposals.html')
    ? '/proposals.html'
    : url.pathname;

  const filePath = path.resolve(ROOT, `.${requested}`);

  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  const fileName = path.basename(filePath).toLowerCase();
  if (BLOCKED_FILES.has(fileName) || fileName.startsWith('.')) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, ...SECURITY_HEADERS });
  fs.createReadStream(filePath).pipe(res);
});

async function start() {
  server.listen(PORT, () => console.log(`Humsafar Rishta running at http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
