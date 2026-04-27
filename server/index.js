const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_URL || '';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'daese_session';
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14);
const SLOT_START = 9 * 60;
const SLOT_END = 22 * 60;
const SLOT_MINUTES = 30;
const SEOUL_OFFSET = '+09:00';
const SEOUL_TZ = 'Asia/Seoul';
const TEAM_COMMUNICATION_PEOPLE = ['스텐', '주디', '조나단', '존', '다나', '스테이시', '관리팀'];
const TODO_DELETE_PEOPLE = ['스텐', '존'];
const TEAM_COMMUNICATION_ONLINE_MS = 90 * 1000;
const TODO_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const TODO_ALLOWED_ORIGINS = new Set([
  'https://daeseenglish.com',
  'https://www.daeseenglish.com',
  'http://localhost',
  'http://127.0.0.1',
]);
const DASHBOARD_ALLOWED_ORIGINS = new Set([
  'https://daese8810.github.io',
  'https://daeseaca.cafe24.com',
  'http://localhost',
  'http://127.0.0.1',
]);

if (!DATABASE_URL) {
  console.error('DATABASE_URL 환경 변수가 필요합니다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if ((APP_URL || '').startsWith('https://')) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});
app.use('/api/team-communication', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (DASHBOARD_ALLOWED_ORIGINS.has(origin) || DASHBOARD_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/team-communication', express.text({ type: 'text/plain', limit: '16kb' }));
app.use('/api/todos', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (TODO_ALLOWED_ORIGINS.has(origin) || TODO_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/todos', express.json({ limit: '8mb' }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));

const loginRate = new Map();

function sanitizeTeacher(row) {
  if (!row) return null;
  return {
    id: row.login_id,
    dept: row.department,
    role: row.role,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return [part, ''];
        return [decodeURIComponent(part.slice(0, idx)), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function makeRandomToken(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

function passwordHash(password, saltB64) {
  const salt = saltB64 ? Buffer.from(saltB64, 'base64') : crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, expectedB64] = parts;
  const derived = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), Buffer.from(expectedB64, 'base64').length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
  });
  return crypto.timingSafeEqual(derived, Buffer.from(expectedB64, 'base64'));
}

function jsonError(res, status, message, extra = {}) {
  res.status(status).json({ ok: false, message, ...extra });
}

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function addDays(dateStr, amount) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + amount);
  return dt.toISOString().slice(0, 10);
}

function parseTimeToMinutes(timeStr) {
  const m = /^([01]\d|2[0-3]):([03]0)$/.exec(String(timeStr));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isValidSlotTime(timeStr, allowEnd = false) {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes === null) return false;
  if (allowEnd && minutes === SLOT_END) return true;
  return minutes >= SLOT_START && minutes < SLOT_END && minutes % SLOT_MINUTES === 0;
}

function toKstTimestamp(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00${SEOUL_OFFSET}`;
}

function getSeoulNowParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    actualMinutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function roomPublic(row) {
  return {
    id: row.code,
    name: row.name,
    short: row.short_name,
    floor: row.floor,
    type: row.room_type,
  };
}

function reservationPublic(row) {
  return {
    id: row.id,
    date: row.date,
    roomId: row.room_id,
    ownerId: row.owner_id,
    ownerDept: row.owner_dept,
    title: row.title,
    note: row.note || '',
    start: row.start_time,
    end: row.end_time,
    category: row.category,
    recurringGroupId: row.repeat_group_id || null,
    createdAt: row.created_at,
  };
}

function isTeamCommunicationPerson(name) {
  return TEAM_COMMUNICATION_PEOPLE.includes(String(name || '').trim());
}

function canDeleteTodoTask(name) {
  return TODO_DELETE_PEOPLE.includes(String(name || '').trim());
}

function teamMessagePublic(row) {
  return {
    id: row.id,
    sender: row.sender_name,
    recipient: row.recipient_name,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at || null,
  };
}

function teamAccessLogPublic(row) {
  return {
    id: row.id,
    person: row.person_name,
    event: row.event_type,
    createdAt: row.created_at,
  };
}

function todoTaskPublic(row) {
  const attachmentName = String(row.attachment_name || '').trim();
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedBy: Array.isArray(row.completed_by) ? row.completed_by : [],
    attachment: attachmentName
      ? {
          name: attachmentName,
          dataUrl: row.attachment_data_url || '',
          size: Number(row.attachment_size || 0),
        }
      : null,
  };
}

function normalizeTodoAttachment(raw) {
  if (!raw || typeof raw !== 'object') {
    return { name: '', dataUrl: '', size: 0 };
  }

  const name = String(raw.name || '').trim().slice(0, 200);
  const dataUrl = String(raw.dataUrl || '').trim();
  const size = Number(raw.size || 0);
  if (!name && !dataUrl) {
    return { name: '', dataUrl: '', size: 0 };
  }
  if (!name || !dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('TODO_ATTACHMENT_INVALID');
  }
  if (!Number.isFinite(size) || size <= 0 || size > TODO_ATTACHMENT_MAX_BYTES) {
    throw new Error('TODO_ATTACHMENT_TOO_LARGE');
  }
  if (dataUrl.length > Math.ceil(TODO_ATTACHMENT_MAX_BYTES * 1.45) + 2000) {
    throw new Error('TODO_ATTACHMENT_TOO_LARGE');
  }
  return { name, dataUrl, size: Math.round(size) };
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function checkRateLimit(req) {
  const ip = getClientIp(req) || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxFailures = 10;
  const entry = loginRate.get(ip) || { failures: [] };
  entry.failures = entry.failures.filter((ts) => now - ts < windowMs);
  loginRate.set(ip, entry);
  if (entry.failures.length >= maxFailures) {
    return { blocked: true, ip };
  }
  return { blocked: false, ip };
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const entry = loginRate.get(ip) || { failures: [] };
  entry.failures = entry.failures.filter((ts) => now - ts < 15 * 60 * 1000);
  entry.failures.push(now);
  loginRate.set(ip, entry);
}

function clearLoginFailures(ip) {
  loginRate.delete(ip);
}

function buildCookieParts(req) {
  const secure = APP_URL.startsWith('https://') || req.secure || req.headers['x-forwarded-proto'] === 'https';
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : null,
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ].filter(Boolean);
}

function setSessionCookie(res, req, token) {
  res.setHeader('Set-Cookie', [`${COOKIE_NAME}=${encodeURIComponent(token)}`, ...buildCookieParts(req)].join('; '));
}

function clearSessionCookie(res, req) {
  const parts = buildCookieParts(req).filter((part) => !part.startsWith('Max-Age='));
  res.setHeader('Set-Cookie', [`${COOKIE_NAME}=`, ...parts, 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'].join('; '));
}

async function findTeacherByLoginId(loginId) {
  const { rows } = await pool.query(
    `SELECT id, login_id, display_name, department, role, password_hash, must_change_password
       FROM teachers
      WHERE login_id = $1`,
    [loginId]
  );
  return rows[0] || null;
}

async function findRoomByCode(code) {
  const { rows } = await pool.query(
    `SELECT id, code, name, short_name, floor, room_type, sort_order
       FROM rooms
      WHERE code = $1 AND active = TRUE`,
    [code]
  );
  return rows[0] || null;
}

async function findConflict(client, roomId, startAt, endAt, excludeId = null) {
  const { rows } = await client.query(
    `SELECT r.id::text,
            room.code AS room_id,
            room.short_name,
            teacher.login_id AS owner_id,
            r.title,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'YYYY-MM-DD') AS date,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS start_time,
            to_char(r.end_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS end_time
       FROM reservations r
       JOIN rooms room ON room.id = r.room_id
       JOIN teachers teacher ON teacher.id = r.teacher_id
      WHERE r.room_id = $1
        AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
        AND ($4::uuid IS NULL OR r.id <> $4::uuid)
      LIMIT 1`,
    [roomId, startAt, endAt, excludeId]
  );
  return rows[0] || null;
}

async function loadBoardReservations(startDate, endDate) {
  const startAt = `${startDate}T00:00:00${SEOUL_OFFSET}`;
  const endExclusive = `${addDays(endDate, 1)}T00:00:00${SEOUL_OFFSET}`;
  const { rows } = await pool.query(
    `SELECT r.id::text,
            room.code AS room_id,
            teacher.login_id AS owner_id,
            teacher.department AS owner_dept,
            r.title,
            COALESCE(r.note, '') AS note,
            r.category,
            COALESCE(r.repeat_group_id::text, '') AS repeat_group_id,
            r.created_at,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'YYYY-MM-DD') AS date,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS start_time,
            to_char(r.end_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS end_time
       FROM reservations r
       JOIN rooms room ON room.id = r.room_id
       JOIN teachers teacher ON teacher.id = r.teacher_id
      WHERE r.start_at >= $1::timestamptz
        AND r.start_at < $2::timestamptz
      ORDER BY room.sort_order, r.start_at, r.created_at`,
    [startAt, endExclusive]
  );
  return rows.map(reservationPublic);
}

async function loadSummary(user, floor = 'all') {
  const now = getSeoulNowParts();
  const nowTs = `${now.date}T${now.time}:00${SEOUL_OFFSET}`;

  const [availableRoomsRes, allRoomsRes, todayReservationsRes, upcomingMineRes] = await Promise.all([
    pool.query(
      `SELECT code, name, short_name, floor, room_type
         FROM rooms room
        WHERE room.active = TRUE
          AND ($1::text = 'all' OR room.floor = $1)
          AND NOT EXISTS (
            SELECT 1
              FROM reservations r
             WHERE r.room_id = room.id
               AND r.start_at <= $2::timestamptz
               AND r.end_at > $2::timestamptz
          )
        ORDER BY room.sort_order`,
      [floor, nowTs]
    ),
    pool.query(
      `SELECT code, name, short_name, floor, room_type
         FROM rooms
        WHERE active = TRUE AND ($1::text = 'all' OR floor = $1)
        ORDER BY sort_order`,
      [floor]
    ),
    pool.query(
      `SELECT room.code AS room_id,
              room.short_name,
              to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS start_time,
              to_char(r.end_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS end_time
         FROM reservations r
         JOIN rooms room ON room.id = r.room_id
        WHERE ($1::text = 'all' OR room.floor = $1)
          AND r.start_at >= $2::timestamptz
          AND r.start_at < $3::timestamptz
        ORDER BY room.sort_order, r.start_at`,
      [floor, `${now.date}T00:00:00${SEOUL_OFFSET}`, `${addDays(now.date, 1)}T00:00:00${SEOUL_OFFSET}`]
    ),
    pool.query(
      `SELECT r.id::text,
              room.code AS room_id,
              teacher.login_id AS owner_id,
              teacher.department AS owner_dept,
              r.title,
              COALESCE(r.note, '') AS note,
              r.category,
              COALESCE(r.repeat_group_id::text, '') AS repeat_group_id,
              r.created_at,
              to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'YYYY-MM-DD') AS date,
              to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS start_time,
              to_char(r.end_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS end_time
         FROM reservations r
         JOIN rooms room ON room.id = r.room_id
         JOIN teachers teacher ON teacher.id = r.teacher_id
        WHERE r.teacher_id = $1
          AND r.end_at >= NOW()
        ORDER BY r.start_at ASC
        LIMIT 8`,
      [user.dbId]
    ),
  ]);

  const availableNow = availableRoomsRes.rows.map(roomPublic);
  const roomMap = new Map();
  for (const row of todayReservationsRes.rows) {
    const list = roomMap.get(row.room_id) || [];
    list.push({ start: row.start_time, end: row.end_time });
    roomMap.set(row.room_id, list);
  }

  const remainingFree = [];
  const cursorStart = Math.max(SLOT_START, Math.ceil(now.actualMinutes / SLOT_MINUTES) * SLOT_MINUTES);
  if (cursorStart < SLOT_END) {
    for (const room of allRoomsRes.rows) {
      const reservations = (roomMap.get(room.code) || []).slice().sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
      let cursor = cursorStart;
      for (const item of reservations) {
        const start = parseTimeToMinutes(item.start);
        const end = parseTimeToMinutes(item.end);
        if (end <= cursor) continue;
        if (start > cursor) {
          remainingFree.push({ room: room.short_name, start: minutesToTime(cursor), end: minutesToTime(start) });
          break;
        }
        cursor = Math.max(cursor, end);
      }
      if (cursor < SLOT_END) {
        remainingFree.push({ room: room.short_name, start: minutesToTime(cursor), end: minutesToTime(SLOT_END) });
      }
    }
  }

  return {
    availableNow,
    remainingFree: remainingFree.slice(0, 12),
    myUpcoming: upcomingMineRes.rows.map(reservationPublic),
    now,
  };
}

function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

async function ensureTeamCommunicationTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_presence (
      person_name TEXT PRIMARY KEY,
      is_online BOOLEAN NOT NULL DEFAULT FALSE,
      last_seen_at TIMESTAMPTZ NULL,
      last_login_at TIMESTAMPTZ NULL,
      last_logout_at TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS team_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_name TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ NULL
    );

    CREATE TABLE IF NOT EXISTS team_access_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      person_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_team_messages_recipient_time
      ON team_messages (recipient_name, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_messages_sender_time
      ON team_messages (sender_name, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_access_logs_time
      ON team_access_logs (created_at DESC);
  `);

  for (const person of TEAM_COMMUNICATION_PEOPLE) {
    await pool.query(
      'INSERT INTO team_presence (person_name) VALUES ($1) ON CONFLICT (person_name) DO NOTHING',
      [person]
    );
  }
}

async function ensureTodoTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todo_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      due_date DATE NOT NULL,
      created_by TEXT NOT NULL,
      attachment_name TEXT NOT NULL DEFAULT '',
      attachment_data_url TEXT NOT NULL DEFAULT '',
      attachment_size INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ NULL
    );

    ALTER TABLE todo_tasks
      ADD COLUMN IF NOT EXISTS attachment_name TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS attachment_data_url TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS attachment_size INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS todo_task_completions (
      task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
      person_name TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (task_id, person_name)
    );

    CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date
      ON todo_tasks (due_date, created_at)
      WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_todo_task_completions_person
      ON todo_task_completions (person_name, completed_at DESC);
  `);
}

async function authMiddleware(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[COOKIE_NAME];
    if (!token) {
      req.user = null;
      return next();
    }
    const tokenHash = sha256(token);
    const { rows } = await pool.query(
      `SELECT s.id AS session_id,
              t.id AS teacher_id,
              t.login_id,
              t.department,
              t.role,
              t.must_change_password
         FROM teacher_sessions s
         JOIN teachers t ON t.id = s.teacher_id
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1`,
      [tokenHash]
    );
    const row = rows[0];
    if (!row) {
      clearSessionCookie(res, req);
      req.user = null;
      return next();
    }
    req.user = {
      dbId: row.teacher_id,
      sessionId: row.session_id,
      login_id: row.login_id,
      department: row.department,
      role: row.role,
      must_change_password: row.must_change_password,
    };
    pool.query('UPDATE teacher_sessions SET last_seen_at = NOW() WHERE id = $1', [row.session_id]).catch(() => {});
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return jsonError(res, 401, '로그인이 필요합니다.');
  next();
}

app.use(authMiddleware);

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'daese-classroom-scheduler' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const [teachersRes, roomsRes] = await Promise.all([
      pool.query(
        `SELECT login_id AS id, department AS dept, role
           FROM teachers
          ORDER BY CASE department WHEN '영어과' THEN 1 ELSE 2 END, display_name`
      ),
      pool.query(
        `SELECT code, name, short_name, floor, room_type
           FROM rooms
          WHERE active = TRUE
          ORDER BY sort_order`
      ),
    ]);
    res.json({
      ok: true,
      appName: '대세학원 강의실 예약',
      orgName: '대세영어 X 대세국어',
      settings: {
        slotStart: SLOT_START,
        slotEnd: SLOT_END,
        slotMinutes: SLOT_MINUTES,
        timezone: SEOUL_TZ,
      },
      me: req.user
        ? {
            id: req.user.login_id,
            dept: req.user.department,
            role: req.user.role,
            mustChangePassword: Boolean(req.user.must_change_password),
          }
        : null,
      users: teachersRes.rows,
      rooms: roomsRes.rows.map(roomPublic),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team-communication/snapshot', async (req, res, next) => {
  try {
    const person = String(req.query.person || '').trim();
    if (!isTeamCommunicationPerson(person)) {
      return jsonError(res, 400, '등록된 사용자만 조회할 수 있습니다.');
    }

    const [presenceRes, receivedRes, sentRes, unreadRes, accessLogRes] = await Promise.all([
      pool.query(
        `SELECT person_name, is_online, last_seen_at
           FROM team_presence
          WHERE person_name = ANY($1::text[])`,
        [TEAM_COMMUNICATION_PEOPLE]
      ),
      pool.query(
        `SELECT id::text, sender_name, recipient_name, body, created_at, read_at
           FROM team_messages
          WHERE recipient_name = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [person]
      ),
      pool.query(
        `SELECT id::text, sender_name, recipient_name, body, created_at, read_at
           FROM team_messages
          WHERE sender_name = $1
          ORDER BY created_at DESC
          LIMIT 200`,
        [person]
      ),
      pool.query(
        `SELECT id::text, sender_name, recipient_name, body, created_at, read_at
           FROM team_messages
          WHERE recipient_name = $1
            AND read_at IS NULL
          ORDER BY created_at DESC
          LIMIT 50`,
        [person]
      ),
      person === '스텐'
        ? pool.query(
            `SELECT id::text, person_name, event_type, created_at
               FROM team_access_logs
              ORDER BY created_at DESC
              LIMIT 300`
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const presenceByName = new Map(presenceRes.rows.map((row) => [row.person_name, row]));
    const now = Date.now();
    const people = TEAM_COMMUNICATION_PEOPLE.map((name) => {
      const row = presenceByName.get(name) || {};
      const seenAt = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
      return {
        name,
        online: Boolean(row.is_online) && seenAt > 0 && now - seenAt <= TEAM_COMMUNICATION_ONLINE_MS,
        lastSeenAt: row.last_seen_at || null,
      };
    });

    res.json({
      ok: true,
      people,
      receivedMessages: receivedRes.rows.map(teamMessagePublic),
      sentMessages: sentRes.rows.map(teamMessagePublic),
      unreadMessages: unreadRes.rows.map(teamMessagePublic),
      unreadCount: unreadRes.rows.length,
      accessLogs: accessLogRes.rows.map(teamAccessLogPublic),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/todos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.id::text,
              t.title,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              t.created_by,
              t.attachment_name,
              t.attachment_data_url,
              t.attachment_size,
              t.created_at,
              COALESCE(
                array_remove(array_agg(c.person_name ORDER BY c.completed_at), NULL),
                ARRAY[]::text[]
              ) AS completed_by
         FROM todo_tasks t
         LEFT JOIN todo_task_completions c ON c.task_id = t.id
        WHERE t.archived_at IS NULL
        GROUP BY t.id
        ORDER BY t.due_date ASC, t.created_at ASC
        LIMIT 300`
    );
    res.json({ ok: true, tasks: rows.map(todoTaskPublic) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/todos', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const dueDate = String(req.body.dueDate || '').trim();
    const createdBy = String(req.body.createdBy || '').trim();
    let attachment;
    try {
      attachment = normalizeTodoAttachment(req.body.attachment);
    } catch (error) {
      if (error.message === 'TODO_ATTACHMENT_TOO_LARGE') {
        return jsonError(res, 400, '첨부 파일은 5MB 이하로 업로드해주세요.');
      }
      return jsonError(res, 400, '첨부 파일 형식이 올바르지 않습니다.');
    }

    if (!isTeamCommunicationPerson(createdBy)) {
      return jsonError(res, 400, '교수팀 계정으로 로그인한 뒤 업무를 추가해주세요.');
    }
    if (!title) {
      return jsonError(res, 400, '업무 내용을 입력해주세요.');
    }
    if (!isValidDate(dueDate)) {
      return jsonError(res, 400, '마감일을 선택해주세요.');
    }

    const { rows } = await pool.query(
      `INSERT INTO todo_tasks (
          title, due_date, created_by,
          attachment_name, attachment_data_url, attachment_size
       )
       VALUES ($1, $2::date, $3, $4, $5, $6)
       RETURNING id::text,
                 title,
                 to_char(due_date, 'YYYY-MM-DD') AS due_date,
                 created_by,
                 attachment_name,
                 attachment_data_url,
                 attachment_size,
                 created_at,
                 ARRAY[]::text[] AS completed_by`,
      [
        title.slice(0, 300),
        dueDate,
        createdBy,
        attachment.name,
        attachment.dataUrl,
        attachment.size,
      ]
    );
    res.json({ ok: true, task: todoTaskPublic(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/todos/:id', async (req, res, next) => {
  try {
    const taskId = String(req.params.id || '').trim();
    const title = String(req.body.title || '').trim();
    const dueDate = String(req.body.dueDate || '').trim();
    const updatedBy = String(req.body.updatedBy || '').trim();
    let attachment;
    try {
      attachment = normalizeTodoAttachment(req.body.attachment);
    } catch (error) {
      if (error.message === 'TODO_ATTACHMENT_TOO_LARGE') {
        return jsonError(res, 400, '첨부 파일은 5MB 이하로 업로드해주세요.');
      }
      return jsonError(res, 400, '첨부 파일 형식이 올바르지 않습니다.');
    }

    if (!isTeamCommunicationPerson(updatedBy)) {
      return jsonError(res, 400, '교수팀 계정으로 로그인한 뒤 업무를 수정해주세요.');
    }
    if (!title) {
      return jsonError(res, 400, '업무 내용을 입력해주세요.');
    }
    if (!isValidDate(dueDate)) {
      return jsonError(res, 400, '마감일을 선택해주세요.');
    }

    const updated = await pool.query(
      `UPDATE todo_tasks
          SET title = $2,
              due_date = $3::date,
              attachment_name = $4,
              attachment_data_url = $5,
              attachment_size = $6
        WHERE id = $1::uuid
          AND archived_at IS NULL`,
      [
        taskId,
        title.slice(0, 300),
        dueDate,
        attachment.name,
        attachment.dataUrl,
        attachment.size,
      ]
    );
    if (updated.rowCount === 0) {
      return jsonError(res, 404, '업무를 찾을 수 없습니다.');
    }

    const { rows } = await pool.query(
      `SELECT t.id::text,
              t.title,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              t.created_by,
              t.attachment_name,
              t.attachment_data_url,
              t.attachment_size,
              t.created_at,
              COALESCE(
                array_remove(array_agg(c.person_name ORDER BY c.completed_at), NULL),
                ARRAY[]::text[]
              ) AS completed_by
         FROM todo_tasks t
         LEFT JOIN todo_task_completions c ON c.task_id = t.id
        WHERE t.id = $1::uuid
        GROUP BY t.id`,
      [taskId]
    );
    res.json({ ok: true, task: todoTaskPublic(rows[0]) });
  } catch (error) {
    if (error && error.code === '22P02') {
      return jsonError(res, 400, '업무 ID가 올바르지 않습니다.');
    }
    next(error);
  }
});

app.post('/api/todos/:id/completion', async (req, res, next) => {
  try {
    const taskId = String(req.params.id || '').trim();
    const person = String(req.body.person || '').trim();
    const completed = req.body.completed === true || String(req.body.completed || '').toLowerCase() === 'true';

    if (!isTeamCommunicationPerson(person)) {
      return jsonError(res, 400, '교수팀 계정으로 로그인한 뒤 체크해주세요.');
    }

    const existing = await pool.query(
      `SELECT id
         FROM todo_tasks
        WHERE id = $1::uuid
          AND archived_at IS NULL`,
      [taskId]
    );
    if (existing.rowCount === 0) {
      return jsonError(res, 404, '업무를 찾을 수 없습니다.');
    }

    if (completed) {
      await pool.query(
        `INSERT INTO todo_task_completions (task_id, person_name)
         VALUES ($1::uuid, $2)
         ON CONFLICT (task_id, person_name)
         DO UPDATE SET completed_at = NOW()`,
        [taskId, person]
      );
    } else {
      await pool.query(
        `DELETE FROM todo_task_completions
          WHERE task_id = $1::uuid
            AND person_name = $2`,
        [taskId, person]
      );
    }

    const { rows } = await pool.query(
      `SELECT t.id::text,
              t.title,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              t.created_by,
              t.attachment_name,
              t.attachment_data_url,
              t.attachment_size,
              t.created_at,
              COALESCE(
                array_remove(array_agg(c.person_name ORDER BY c.completed_at), NULL),
                ARRAY[]::text[]
              ) AS completed_by
         FROM todo_tasks t
         LEFT JOIN todo_task_completions c ON c.task_id = t.id
        WHERE t.id = $1::uuid
        GROUP BY t.id`,
      [taskId]
    );
    res.json({ ok: true, task: todoTaskPublic(rows[0]) });
  } catch (error) {
    if (error && error.code === '22P02') {
      return jsonError(res, 400, '업무 ID가 올바르지 않습니다.');
    }
    next(error);
  }
});

app.delete('/api/todos/:id', async (req, res, next) => {
  try {
    const taskId = String(req.params.id || '').trim();
    const person = String(req.query.person || req.body?.person || '').trim();
    if (!canDeleteTodoTask(person)) {
      return jsonError(res, 403, '업무 삭제는 스텐 또는 존 계정만 가능합니다.');
    }

    const result = await pool.query(
      `UPDATE todo_tasks
          SET archived_at = NOW()
        WHERE id = $1::uuid
          AND archived_at IS NULL`,
      [taskId]
    );
    res.json({ ok: true, deletedCount: result.rowCount });
  } catch (error) {
    if (error && error.code === '22P02') {
      return jsonError(res, 400, '업무 ID가 올바르지 않습니다.');
    }
    next(error);
  }
});

app.post('/api/team-communication/presence', async (req, res, next) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const person = String(body.person || '').trim();
    const event = String(body.event || 'heartbeat').trim();
    if (!isTeamCommunicationPerson(person)) {
      return jsonError(res, 400, '등록된 사용자만 접속 상태를 남길 수 있습니다.');
    }
    if (!['login', 'heartbeat', 'logout'].includes(event)) {
      return jsonError(res, 400, '접속 이벤트가 올바르지 않습니다.');
    }

    await pool.query(
      'INSERT INTO team_presence (person_name) VALUES ($1) ON CONFLICT (person_name) DO NOTHING',
      [person]
    );

    if (event === 'logout') {
      await pool.query(
        `UPDATE team_presence
            SET is_online = FALSE,
                last_logout_at = NOW(),
                updated_at = NOW()
          WHERE person_name = $1`,
        [person]
      );
    } else {
      await pool.query(
        `UPDATE team_presence
            SET is_online = TRUE,
                last_seen_at = NOW(),
                last_login_at = CASE WHEN $2 = 'login' THEN NOW() ELSE last_login_at END,
                updated_at = NOW()
          WHERE person_name = $1`,
        [person, event]
      );
    }

    if (event === 'login' || event === 'logout') {
      await pool.query(
        `INSERT INTO team_access_logs (person_name, event_type, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [person, event, getClientIp(req), String(req.headers['user-agent'] || '').slice(0, 300)]
      );
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team-communication/messages', async (req, res, next) => {
  try {
    const sender = String(req.body.sender || '').trim();
    const recipient = String(req.body.recipient || '').trim();
    const body = String(req.body.body || '').trim();
    if (!isTeamCommunicationPerson(sender) || !isTeamCommunicationPerson(recipient)) {
      return jsonError(res, 400, '등록된 사용자끼리만 메시지를 보낼 수 있습니다.');
    }
    if (sender === recipient) {
      return jsonError(res, 400, '본인에게는 메시지를 보낼 수 없습니다.');
    }
    if (!body) {
      return jsonError(res, 400, '메시지 내용을 입력해 주세요.');
    }

    const { rows } = await pool.query(
      `INSERT INTO team_messages (sender_name, recipient_name, body)
       VALUES ($1, $2, $3)
       RETURNING id::text, sender_name, recipient_name, body, created_at, read_at`,
      [sender, recipient, body.slice(0, 2000)]
    );
    res.json({ ok: true, message: teamMessagePublic(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team-communication/messages/read', async (req, res, next) => {
  try {
    const person = String(req.body.person || '').trim();
    if (!isTeamCommunicationPerson(person)) {
      return jsonError(res, 400, '등록된 사용자만 메시지를 읽을 수 있습니다.');
    }

    const result = await pool.query(
      `UPDATE team_messages
          SET read_at = COALESCE(read_at, NOW())
        WHERE recipient_name = $1
          AND read_at IS NULL`,
      [person]
    );
    res.json({ ok: true, updatedCount: result.rowCount });
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const rate = checkRateLimit(req);
    if (rate.blocked) return jsonError(res, 429, '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');

    const loginId = String(req.body.loginId || '').trim();
    const password = String(req.body.password || '');
    if (!loginId || !password) {
      recordLoginFailure(rate.ip);
      return jsonError(res, 400, '아이디와 비밀번호를 입력해 주세요.');
    }

    const teacher = await findTeacherByLoginId(loginId);
    if (!teacher || !verifyPassword(password, teacher.password_hash)) {
      recordLoginFailure(rate.ip);
      return jsonError(res, 401, '아이디 또는 비밀번호가 맞지 않습니다.');
    }

    const token = makeRandomToken(32);
    const tokenHash = sha256(token);
    await pool.query(
      `INSERT INTO teacher_sessions (teacher_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 || ' days')::interval)`,
      [teacher.id, tokenHash, SESSION_DAYS]
    );
    clearLoginFailures(rate.ip);
    setSessionCookie(res, req, token);
    res.json({ ok: true, me: sanitizeTeacher(teacher) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/logout', requireAuth, async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[COOKIE_NAME];
    if (token) {
      await pool.query('DELETE FROM teacher_sessions WHERE token_hash = $1', [sha256(token)]);
    }
    clearSessionCookie(res, req);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return jsonError(res, 400, '현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.');
    }
    if (newPassword.length < 4) {
      return jsonError(res, 400, '새 비밀번호는 4자 이상으로 입력해 주세요.');
    }
    const teacher = await findTeacherByLoginId(req.user.login_id);
    if (!teacher || !verifyPassword(currentPassword, teacher.password_hash)) {
      return jsonError(res, 400, '현재 비밀번호가 맞지 않습니다.');
    }
    await pool.query(
      `UPDATE teachers
          SET password_hash = $1,
              must_change_password = FALSE,
              updated_at = NOW()
        WHERE id = $2`,
      [passwordHash(newPassword), teacher.id]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reservations', requireAuth, async (req, res, next) => {
  try {
    const startDate = String(req.query.start || '');
    const endDate = String(req.query.end || '');
    if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) {
      return jsonError(res, 400, '조회 날짜 범위가 올바르지 않습니다.');
    }
    const reservations = await loadBoardReservations(startDate, endDate);
    res.json({ ok: true, reservations });
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard-summary', requireAuth, async (req, res, next) => {
  try {
    const floor = ['all', '6층', '7층'].includes(String(req.query.floor || 'all')) ? String(req.query.floor || 'all') : 'all';
    const summary = await loadSummary(req.user, floor);
    res.json({ ok: true, ...summary });
  } catch (error) {
    next(error);
  }
});

app.post('/api/reservations', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const date = String(req.body.date || '');
    const roomCode = String(req.body.roomId || '');
    const start = String(req.body.start || '');
    const end = String(req.body.end || '');
    const title = String(req.body.title || '').trim();
    const note = String(req.body.note || '').trim();
    const category = String(req.body.category || 'usage');
    const ownerLoginId = req.user.role === 'admin' ? String(req.body.ownerId || req.user.login_id) : req.user.login_id;
    const repeatCount = Number(req.body.repeatCount || 1);

    if (!isValidDate(date)) return jsonError(res, 400, '날짜가 올바르지 않습니다.');
    if (!isValidSlotTime(start) || !isValidSlotTime(end, true)) return jsonError(res, 400, '시간은 30분 단위로 입력해 주세요.');
    if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) return jsonError(res, 400, '종료 시간은 시작 시간보다 뒤여야 합니다.');
    if (!title) return jsonError(res, 400, '용도 / 제목을 입력해 주세요.');
    if (!['usage', 'event', 'blocked'].includes(category)) return jsonError(res, 400, '예약 구분이 올바르지 않습니다.');
    if (category === 'blocked' && req.user.role !== 'admin') return jsonError(res, 403, '관리자만 차단 일정을 만들 수 있습니다.');
    if (!Number.isInteger(repeatCount) || repeatCount < 1 || !((repeatCount >= 1 && repeatCount <= 12) || repeatCount === 52)) {
  return jsonError(res, 400, '반복 횟수는 1~12회 또는 52회만 가능합니다.');
}

    const [room, owner] = await Promise.all([findRoomByCode(roomCode), findTeacherByLoginId(ownerLoginId)]);
    if (!room) return jsonError(res, 404, '강의실을 찾을 수 없습니다.');
    if (!owner) return jsonError(res, 404, '예약자를 찾을 수 없습니다.');
    if (req.user.role !== 'admin' && owner.login_id !== req.user.login_id) return jsonError(res, 403, '본인 일정만 예약할 수 있습니다.');

    const repeatGroupId = repeatCount > 1 ? crypto.randomUUID() : null;
    const payloads = Array.from({ length: repeatCount }, (_, index) => {
      const targetDate = addDays(date, index * 7);
      return {
        date: targetDate,
        startAt: toKstTimestamp(targetDate, start),
        endAt: toKstTimestamp(targetDate, end),
      };
    });

    await client.query('BEGIN');
    for (const item of payloads) {
      const conflict = await findConflict(client, room.id, item.startAt, item.endAt, null);
      if (conflict) {
        await client.query('ROLLBACK');
        return jsonError(res, 409, '중복 예약이 있어 저장할 수 없습니다.', {
          conflict: {
            date: conflict.date,
            start: conflict.start_time,
            end: conflict.end_time,
            room: conflict.short_name,
            title: conflict.title,
            ownerId: conflict.owner_id,
          },
        });
      }
    }

    const inserted = [];
    for (const item of payloads) {
      const { rows } = await client.query(
        `INSERT INTO reservations (
            room_id, teacher_id, category, title, note,
            start_at, end_at, repeat_group_id,
            created_by_teacher_id, updated_by_teacher_id
         )
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::uuid, $9, $9)
         RETURNING id::text`,
        [room.id, owner.id, category, title, note, item.startAt, item.endAt, repeatGroupId, req.user.dbId]
      );
      inserted.push(rows[0].id);
    }
    await client.query('COMMIT');
    res.json({ ok: true, insertedCount: inserted.length, ids: inserted });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error && error.code === '23P01') {
      return jsonError(res, 409, '이미 같은 시간대에 예약된 강의실입니다.');
    }
    next(error);
  } finally {
    client.release();
  }
});

app.put('/api/reservations/:id', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const reservationId = String(req.params.id || '');
    const { rows: existingRows } = await client.query(
      `SELECT r.id::text,
              r.room_id,
              r.teacher_id,
              r.category,
              r.repeat_group_id::text,
              t.login_id AS owner_id
         FROM reservations r
         JOIN teachers t ON t.id = r.teacher_id
        WHERE r.id = $1::uuid`,
      [reservationId]
    );
    const existing = existingRows[0];
    if (!existing) return jsonError(res, 404, '예약을 찾을 수 없습니다.');
    const canEdit = req.user.role === 'admin' || existing.owner_id === req.user.login_id;
    if (!canEdit) return jsonError(res, 403, '이 예약을 수정할 권한이 없습니다.');

    const date = String(req.body.date || '');
    const roomCode = String(req.body.roomId || '');
    const start = String(req.body.start || '');
    const end = String(req.body.end || '');
    const title = String(req.body.title || '').trim();
    const note = String(req.body.note || '').trim();
    const category = String(req.body.category || 'usage');
    const ownerLoginId = req.user.role === 'admin' ? String(req.body.ownerId || existing.owner_id) : existing.owner_id;

    if (!isValidDate(date)) return jsonError(res, 400, '날짜가 올바르지 않습니다.');
    if (!isValidSlotTime(start) || !isValidSlotTime(end, true)) return jsonError(res, 400, '시간은 30분 단위로 입력해 주세요.');
    if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) return jsonError(res, 400, '종료 시간은 시작 시간보다 뒤여야 합니다.');
    if (!title) return jsonError(res, 400, '용도 / 제목을 입력해 주세요.');
    if (!['usage', 'event', 'blocked'].includes(category)) return jsonError(res, 400, '예약 구분이 올바르지 않습니다.');
    if (category === 'blocked' && req.user.role !== 'admin') return jsonError(res, 403, '관리자만 차단 일정으로 바꿀 수 있습니다.');

    const [room, owner] = await Promise.all([findRoomByCode(roomCode), findTeacherByLoginId(ownerLoginId)]);
    if (!room) return jsonError(res, 404, '강의실을 찾을 수 없습니다.');
    if (!owner) return jsonError(res, 404, '예약자를 찾을 수 없습니다.');
    if (req.user.role !== 'admin' && owner.login_id !== req.user.login_id) return jsonError(res, 403, '본인 일정만 수정할 수 있습니다.');

    const startAt = toKstTimestamp(date, start);
    const endAt = toKstTimestamp(date, end);

    await client.query('BEGIN');
    const conflict = await findConflict(client, room.id, startAt, endAt, reservationId);
    if (conflict) {
      await client.query('ROLLBACK');
      return jsonError(res, 409, '중복 예약이 있어 저장할 수 없습니다.', {
        conflict: {
          date: conflict.date,
          start: conflict.start_time,
          end: conflict.end_time,
          room: conflict.short_name,
          title: conflict.title,
          ownerId: conflict.owner_id,
        },
      });
    }

    await client.query(
      `UPDATE reservations
          SET room_id = $1,
              teacher_id = $2,
              category = $3,
              title = $4,
              note = $5,
              start_at = $6::timestamptz,
              end_at = $7::timestamptz,
              updated_by_teacher_id = $8,
              updated_at = NOW()
        WHERE id = $9::uuid`,
      [room.id, owner.id, category, title, note, startAt, endAt, req.user.dbId, reservationId]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error && error.code === '23P01') {
      return jsonError(res, 409, '이미 같은 시간대에 예약된 강의실입니다.');
    }
    next(error);
  } finally {
    client.release();
  }
});

app.delete('/api/reservations/:id', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const reservationId = String(req.params.id || '');
    const scope = req.query.scope === 'series' ? 'series' : 'single';
    const { rows } = await client.query(
      `SELECT r.id::text, r.repeat_group_id::text, t.login_id AS owner_id
         FROM reservations r
         JOIN teachers t ON t.id = r.teacher_id
        WHERE r.id = $1::uuid`,
      [reservationId]
    );
    const reservation = rows[0];
    if (!reservation) return jsonError(res, 404, '예약을 찾을 수 없습니다.');
    const canDelete = req.user.role === 'admin' || reservation.owner_id === req.user.login_id;
    if (!canDelete) return jsonError(res, 403, '이 예약을 취소할 권한이 없습니다.');

    if (scope === 'series' && reservation.repeat_group_id) {
      const result = await client.query('DELETE FROM reservations WHERE repeat_group_id = $1::uuid', [reservation.repeat_group_id]);
      return res.json({ ok: true, deletedCount: result.rowCount, scope: 'series' });
    }

    const result = await client.query('DELETE FROM reservations WHERE id = $1::uuid', [reservationId]);
    res.json({ ok: true, deletedCount: result.rowCount, scope: 'single' });
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: false,
  maxAge: '1h',
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  jsonError(res, 500, '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
});

setInterval(() => {
  pool.query('DELETE FROM teacher_sessions WHERE expires_at <= NOW()').catch(() => {});
}, 30 * 60 * 1000).unref();

async function start() {
  await pool.query('SELECT 1');
  await ensureTeamCommunicationTables();
  await ensureTodoTables();
  app.listen(PORT, () => {
    console.log(`대세학원 강의실 예약 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
