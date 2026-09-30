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

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

const db = getFirestore(getFirebaseApp());
const proposalsRef = db.collection('proposals');

// ---------- Admin password ----------

function getAdminPassword() {
  const password = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!password) throw new Error('ADMIN_PASSWORD is not configured.');
  return password;
}

// ---------- Fields ----------

const fields = [
  'proposal_id', 'gender', 'age', 'city', 'education', 'profession', 'height',
  'marital_status', 'religion', 'family_background', 'about', 'looking_for',
  'image_url', 'status', 'created_at'
];

// ---------- Seed data ----------

const seedData = [

  { proposal_id:'HR-1001', gender:'مرد', age:29, city:'لاہور', education:'ماسٹرز - کمپیوٹر سائنس', profession:'سافٹ ویئر انجینئر', height:"5'9\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'متوسط، تعلیم یافتہ خاندان، دو بہن بھائی۔', about:'پرسکون طبیعت، دین دار اور خاندان کے قریب رہنے والا۔', looking_for:'تعلیم یافتہ، سلجھی ہوئی طبیعت کی حامل خاتون۔', image_url:'', status:'Active', created_at:'2026-08-01' },
  { proposal_id:'HR-1002', gender:'خواتین', age:25, city:'اسلام آباد', education:'بی ایس سی - نرسنگ', profession:'نرس', height:"5'4\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'مذہبی و تعلیم یافتہ خاندان، ایک بھائی۔', about:'نرم مزاج، خدمتِ خلق کا جذبہ رکھنے والی۔', looking_for:'ذمہ دار اور مہذب رشتہ۔', image_url:'', status:'Active', created_at:'2026-08-02' },
  { proposal_id:'HR-1003', gender:'مرد', age:33, city:'کراچی', education:'ایم بی اے', profession:'بینکر', height:"5'11\"", marital_status:'مطلقہ', religion:'', family_background:'بزنس فیملی، خوشحال گھرانہ۔', about:'خوش اخلاق، سنجیدہ اور کیریئر کے لحاظ سے مستحکم۔', looking_for:'سمجھدار اور خاندان کی قدر کرنے والی خاتون۔', image_url:'', status:'Active', created_at:'2026-08-03' },
  { proposal_id:'HR-1004', gender:'خواتین', age:27, city:'فیصل آباد', education:'بی ایڈ', profession:'ٹیچر', height:"5'3\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'تدریسی پس منظر رکھنے والا خاندان۔', about:'صابر، پرعزم اور بچوں سے محبت کرنے والی۔', looking_for:'مستحکم اور مذہبی رجحان رکھنے والا رشتہ۔', image_url:'', status:'Active', created_at:'2026-08-05' },
  { proposal_id:'HR-1005', gender:'مرد', age:31, city:'راولپنڈی', education:'انجینئرنگ (سول)', profession:'سول انجینئر', height:"5'10\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'فوجی پس منظر، نظم و ضبط کا حامل خاندان۔', about:'محنتی، وقت کا پابند اور خاندان کا خیال رکھنے والا۔', looking_for:'باحیا اور سادگی پسند خاتون۔', image_url:'', status:'Active', created_at:'2026-08-06' },
  { proposal_id:'HR-1006', gender:'خواتین', age:24, city:'سیالکوٹ', education:'بی ایس سی - آنرز', profession:'گھریلو', height:"5'5\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'کاروباری خاندان، روایات کے قدر دان۔', about:'خوش مزاج، گھریلو امور میں ماہر۔', looking_for:'مستحکم اور معزز رشتہ۔', image_url:'', status:'Active', created_at:'2026-08-07' },
  { proposal_id:'HR-1007', gender:'مرد', age:35, city:'ملتان', education:'ڈاکٹر آف میڈیسن', profession:'ڈاکٹر', height:"5'8\"", marital_status:'بیوہ / بیوہ مرد', religion:'', family_background:'معزز، تعلیم یافتہ خاندان۔', about:'مہذب، ذمہ دار، ایک بچے کا والد۔', looking_for:'خیال رکھنے والی اور بردبار خاتون۔', image_url:'', status:'Hidden', created_at:'2026-08-08' },
  { proposal_id:'HR-1008', gender:'خواتین', age:29, city:'گوجرانوالہ', education:'ماسٹرز - اردو ادب', profession:'لیکچرار', height:"5'6\"", marital_status:'مطلقہ', religion:'', family_background:'علمی و ادبی ذوق رکھنے والا خاندان۔', about:'باشعور، مہذب اور خوش اسلوب۔', looking_for:'باوقار اور سمجھدار رشتہ۔', image_url:'', status:'Active', created_at:'2026-08-09' },
  { proposal_id:'HR-1009', gender:'مرد', age:27, city:'گجرات', education:'بی ایس سی - آئی ٹی', profession:'فری لانسر', height:"5'7\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'متوسط طبقے کا محنتی خاندان۔', about:'تخلیقی سوچ رکھنے والا اور خود مختار۔', looking_for:'ہم خیال اور مثبت سوچ رکھنے والی خاتون۔', image_url:'', status:'Active', created_at:'2026-08-10' },
  { proposal_id:'HR-1010', gender:'خواتین', age:23, city:'لاہور', education:'فارمیسی ڈاکٹر', profession:'فارماسسٹ', height:"5'4\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'صحت کے شعبے سے وابستہ خاندان۔', about:'ذہین، محنتی اور نرم گفتار۔', looking_for:'تعلیم یافتہ اور خاندان کا احترام کرنے والا رشتہ۔', image_url:'', status:'Active', created_at:'2026-08-11' },
  { proposal_id:'HR-1011', gender:'مرد', age:38, city:'کراچی', education:'چارٹرڈ اکاؤنٹنٹ', profession:'اکاؤنٹنٹ', height:"5'9\"", marital_status:'غیر شادی شدہ', religion:'', family_background:'مستحکم، تعلیم یافتہ خاندان۔', about:'سنجیدہ طبیعت، مالی طور پر مستحکم۔', looking_for:'باحیا اور سادگی پسند خاتون۔', image_url:'', status:'Active', created_at:'2026-08-12' },
  { proposal_id:'HR-1012', gender:'خواتین', age:31, city:'اسلام آباد', education:'ایم فل', profession:'ریسرچر', height:"5'5\"", marital_status:'مطلقہ', religion:'', family_background:'علمی و پیشہ ورانہ پس منظر رکھنے والا خاندان۔', about:'خودمختار، باشعور اور مستحکم سوچ کی حامل۔', looking_for:'ہم خیال اور احترام کرنے والا رشتہ۔', image_url:'', status:'Active', created_at:'2026-08-13' }
];

// ---------- Helpers ----------

function sendJson(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
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
  if (!token) return false;

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

  // Preserve support for x-admin-auth / Authorization with the configured
  // password, while the normal browser login uses the signed session token.
  if (token === getAdminPassword()) return true;

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
    fields.map(field => [field, body[field] ?? ''])
  );

  if (!payload.proposal_id || !String(payload.proposal_id).trim()) {
    payload.proposal_id = 'HR-' + Math.floor(1000 + Math.random() * 9000);
  } else {
    payload.proposal_id = String(payload.proposal_id).trim();
  }

  payload.age = Number(payload.age);
  payload.created_at =
    payload.created_at || new Date().toISOString().slice(0, 10);

  if (
    !payload.gender ||
    !payload.city ||
    !payload.education ||
    !payload.profession ||
    !Number.isInteger(payload.age)
  ) {
    throw new Error(
      'Required proposal fields are missing (gender, age, city, education, profession)'
    );
  }

  return payload;
}

// ---------- Firestore ----------

async function seedIfEmpty() {
  try {
    const snapshot = await proposalsRef.limit(1).get();

    if (!snapshot.empty) {
      return;
    }

    const batch = db.batch();

    for (const proposal of seedData) {
      const docRef = proposalsRef.doc(proposal.proposal_id);
      batch.set(docRef, proposal);
    }

    await batch.commit();
    console.log('Initial sample proposals seeded.');
  } catch (err) {
    console.warn('Seed check/batch error:', err.message);
  }
}

async function getProposals(admin) {
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
  const doc = await proposalsRef.doc(id).get();

  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function createProposal(payload) {
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

    const pathname = new URL(
      req.url,
      `https://${req.headers.host || 'localhost'}`
    ).pathname;

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
        { ok: true },
        {
          'Set-Cookie':
            `hr_session=${encodeURIComponent(token)}; ` +
            'HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400'
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
            'hr_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
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

// Seed on a normal serverless invocation. The function remains stateless.
seedIfEmpty().catch(err => {
  console.warn('Background seed warning:', err.message);
});
