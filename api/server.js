const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

/*
 * Vercel-compatible Humsafar Rishta API
 *
 * Frontend/static files are served by Vercel.
 * API routes are handled through /api/*.
 *
 * Required Vercel Environment Variables:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   ADMIN_PASSWORD
 *
 * Do NOT upload the Firebase service-account JSON file to GitHub.
 */

// ---------- Firebase ----------

function getFirebaseApp() {
  if (getApps().length) return getApps()[0];

  const fs = require('node:fs');
  const path = require('node:path');
  const localKey = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(localKey)) {
    try {
      const sa = JSON.parse(fs.readFileSync(localKey, 'utf8'));
      return initializeApp({ credential: cert(sa) });
    } catch (e) {}
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }

  if (privateKey) {
    privateKey = privateKey.trim();
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

function getProposalsRef() {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  return { db, proposalsRef: db.collection('proposals') };
}

// ---------- Admin password ----------

function getAdminPassword() {
  const password = String(process.env.ADMIN_PASSWORD || '').trim();
  return password || 'meer6734';
}

// ---------- Fields ----------

const fields = [
  'proposal_id', 'gender', 'age', 'city', 'education', 'ethnicity', 'profession', 'height',
  'marital_status', 'religion', 'siblings', 'siblings_details', 'family_background', 'about', 'looking_for',
  'image_url', 'status', 'created_at'
];

const SEED_PROPOSAL_IDS = new Set();

// ---------- Helpers ----------

function sendJson(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0'
  );
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const result = {};

  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}

function getRequestToken(req) {
  const cookies = parseCookies(req);
  if (cookies.hr_session) return cookies.hr_session;

  const authHeader = req.headers['x-admin-auth'] || req.headers.authorization;
  if (!authHeader) return '';

  return String(authHeader).replace(/^Bearer\s+/i, '').trim();
}

/*
 * Stateless admin authentication for Vercel.
 *
 * Instead of storing sessions in a server-side Map (which is not reliable
 * across Vercel instances), the login endpoint creates a signed token.
 */
const crypto = require('node:crypto');

function createSessionToken() {
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(24).toString('hex');
  const payload = `${timestamp}.${nonce}`;
  const signature = crypto
    .createHmac('sha256', getAdminPassword())
    .update(payload)
    .digest('hex');

  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;

  const parts = String(token).split('.');
  if (parts.length !== 3) return false;

  const [timestamp, nonce, signature] = parts;
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]+$/i.test(nonce)) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) {
    return false;
  }

  const payload = `${timestamp}.${nonce}`;
  const expected = crypto
    .createHmac('sha256', getAdminPassword())
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

function isAdmin(req) {
  const token = getRequestToken(req);
  if (!token || typeof token !== 'string') return false;

  const adminPass = getAdminPassword();
  if (adminPass && token === adminPass) return true;

  return verifySessionToken(token);
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: 'Unauthorized' });
  return false;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  let raw = '';

  await new Promise((resolve, reject) => {
    req.on('data', chunk => {
      raw += chunk;

      if (raw.length > 12 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });

    req.on('end', resolve);
    req.on('error', reject);
  });

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON');
  }
}

function proposalPayload(body) {
  const payload = Object.fromEntries(
    fields.map(field => [field, body[field] != null ? String(body[field]).trim() : ''])
  );

  if (!payload.proposal_id) {
    payload.proposal_id = 'HR-' + Math.floor(1000 + Math.random() * 9000);
  }

  payload.created_at =
    payload.created_at || new Date().toISOString().slice(0, 10);
  payload.status = payload.status || 'Active';

  return payload;
}

// ---------- Firestore ----------

async function getProposals(admin) {
  const { proposalsRef } = getProposalsRef();
  let query = proposalsRef;

  if (!admin) {
    query = query.where('status', '==', 'Active');
  }

  try {
    const snapshot = await query.orderBy('created_at', 'desc').get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.warn('Fallback in-memory sort for proposals:', err.message);

    const snapshot = await query.get();

    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    docs.sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || '')
    );

    return docs;
  }
}

async function getProposalById(id) {
  const { proposalsRef } = getProposalsRef();
  const doc = await proposalsRef.doc(id).get();

  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function createProposal(payload) {
  const { proposalsRef } = getProposalsRef();
  const docRef = proposalsRef.doc(payload.proposal_id);
  const existing = await docRef.get();

  if (existing.exists) {
    throw new Error('UNIQUE constraint failed: proposal_id already exists');
  }

  await docRef.set(payload);

  return {
    id: docRef.id,
    ...payload
  };
}

async function updateProposal(id, payload) {
  const { proposalsRef } = getProposalsRef();
  const docRef = proposalsRef.doc(id);
  const existing = await docRef.get();

  if (!existing.exists) return null;

  await docRef.update(payload);

  const updated = await docRef.get();

  return {
    id: updated.id,
    ...updated.data()
  };
}

async function deleteProposal(id) {
  const { proposalsRef } = getProposalsRef();
  const docRef = proposalsRef.doc(id);
  const existing = await docRef.get();

  if (!existing.exists) return false;

  await docRef.delete();
  return true;
}

// ---------- API ----------

module.exports = async function handler(req, res) {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-admin-auth'
    );

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    let pathname = new URL(
      req.url,
      `https://${req.headers.host || 'localhost'}`
    ).pathname;

    if (req.headers['x-matched-path'] && !req.headers['x-matched-path'].startsWith('/api/server') && !req.headers['x-matched-path'].startsWith('/api/[...')) {
      pathname = new URL(req.headers['x-matched-path'], `https://${req.headers.host || 'localhost'}`).pathname;
    } else if (req.query && Array.isArray(req.query.all)) {
      pathname = '/api/' + req.query.all.join('/');
    } else if (req.query && typeof req.query.all === 'string') {
      pathname = '/api/' + req.query.all;
    }

    // GET /api/proposals
    if (req.method === 'GET' && pathname === '/api/proposals') {
      const requestUrl = new URL(
        req.url,
        `https://${req.headers.host || 'localhost'}`
      );

      const adminMode =
        isAdmin(req) && requestUrl.searchParams.get('admin') === '1';

      return sendJson(res, 200, await getProposals(adminMode));
    }

    // GET /api/proposals/{id}
    if (req.method === 'GET' && /^\/api\/proposals\/[^/]+$/.test(pathname)) {
      const id = decodeURIComponent(pathname.split('/').pop());
      const proposal = await getProposalById(id);

      if (!proposal) {
        return sendJson(res, 404, { error: 'Not found' });
      }

      // Do not expose hidden proposals to unauthenticated users.
      if (proposal.status !== 'Active' && !isAdmin(req)) {
        return sendJson(res, 404, { error: 'Not found' });
      }

      return sendJson(res, 200, proposal);
    }

    // GET /api/admin/session
    if (req.method === 'GET' && pathname === '/api/admin/session') {
      return sendJson(res, 200, {
        authenticated: isAdmin(req)
      });
    }

    // POST /api/admin/login
    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const body = await readBody(req);
      const pass = String(body.password || '').trim();

      if (!pass || pass !== getAdminPassword()) {
        return sendJson(res, 401, { error: 'Invalid password' });
      }

      const token = createSessionToken();

      return sendJson(
        res,
        200,
        { ok: true, token },
        {
          'Set-Cookie':
            `hr_session=${encodeURIComponent(token)}; ` +
            'HttpOnly; Secure; SameSite=Lax; Path=/'
        }
      );
    }

    // POST /api/admin/logout
    if (req.method === 'POST' && pathname === '/api/admin/logout') {
      return sendJson(
        res,
        200,
        { ok: true },
        {
          'Set-Cookie':
            'hr_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }
      );
    }

    // Everything below this point requires admin authentication.
    if (pathname.startsWith('/api/proposals')) {
      if (!requireAdmin(req, res)) return;

      if (req.method === 'POST' && pathname === '/api/proposals') {
        const payload = proposalPayload(await readBody(req));
        const created = await createProposal(payload);

        return sendJson(res, 201, created);
      }

      const match = pathname.match(/^\/api\/proposals\/([^/]+)$/);

      if (!match) {
        return sendJson(res, 404, { error: 'Not found' });
      }

      const id = decodeURIComponent(match[1]);

      if (req.method === 'PUT') {
        const payload = proposalPayload(await readBody(req));
        const updated = await updateProposal(id, payload);

        if (!updated) {
          return sendJson(res, 404, { error: 'Not found' });
        }

        return sendJson(res, 200, updated);
      }

      if (req.method === 'DELETE') {
        const deleted = await deleteProposal(id);

        if (!deleted) {
          return sendJson(res, 404, { error: 'Not found' });
        }

        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('API error:', error);

    return sendJson(res, 500, {
      error: error.message || 'Internal server error'
    });
  }
};

