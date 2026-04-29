const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const APP_URL = process.env.APP_URL || '';
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'daese_session';
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14);
const KAKAOWORK_BOT_APP_KEY = process.env.KAKAOWORK_BOT_APP_KEY || '';
const KAKAOWORK_SUPPLY_REQUEST_EMAIL = process.env.KAKAOWORK_SUPPLY_REQUEST_EMAIL || 'ltdall@naver.com';
const SLOT_START = 9 * 60;
const SLOT_END = 22 * 60;
const SLOT_MINUTES = 30;
const SEOUL_OFFSET = '+09:00';
const SEOUL_TZ = 'Asia/Seoul';
const TEAM_COMMUNICATION_PEOPLE = ['스텐', '주디', '조나단', '존', '다나', '스테이시', '관리팀'];
const TODO_DEFAULT_ASSIGNEES = ['존', '주디', '스테이시', '다나', '조나단', '스텐'];
const TODO_DELETE_PEOPLE = ['스텐', '존'];
const TODO_DAILY_AUTO_TITLES = ['클리닉표 작성 및 확인', '반별 과제 안내'];
const TEAM_COMMUNICATION_ONLINE_MS = 90 * 1000;
const TODO_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const KAKAOWORK_APP_KEY = process.env.KAKAOWORK_APP_KEY || '';
const KAKAOWORK_KOREAN_ROOM_MANAGER_EMAIL =
  process.env.KAKAOWORK_KOREAN_ROOM_MANAGER_EMAIL || 'sasin0815@naver.com';
const KAKAOWORK_CLASSROOM_NOTICE_CONVERSATION_ID =
  process.env.KAKAOWORK_CLASSROOM_NOTICE_CONVERSATION_ID || '';
const KAKAOWORK_MESSAGES_SEND_BY_EMAIL_URL =
  'https://api.kakaowork.com/v1/messages.send_by_email';
const KAKAOWORK_MESSAGES_SEND_URL =
  'https://api.kakaowork.com/v1/messages.send';
const ENGLISH_TEACHERS = new Set([
  '스텐',
  '주디',
  '조나단',
  '존',
  '다나',
  '스테이시',
]);
const KOREAN_TEACHERS = new Set([
  '국신',
  '국대',
  '국호',
  '국화',
  '국짱',
  '국보',
]);
const KOREAN_ROOM_CODES = new Set([
  '6-5',
  '6-6',
  '6-7',
  '6-seminar',
  '7-3',
  '7-4',
]);
const ENGLISH_ROOM_CODES = new Set([
  '6-1',
  '6-2',
  '6-3',
  '6-4',
  '7-1',
  '7-2',
  '7-5',
]);
const CLINIC_LISTENING_GAS_URL = process.env.CLINIC_LISTENING_GAS_URL ||
  'https://script.google.com/macros/s/AKfycbyTm_Plkg1I9GA1tTBbJWiYaFJI2Tuachrbwo_ZpGLQD4JpskyNe0H2KhEG688qMIPLHw/exec';
const CLINIC_LISTENING_GRADES = ['초등부', '중1', '중2', '중3', '고1', '고2', '초등부 Starter'];
const CLINIC_LISTENING_UPLOAD_MAX_BYTES = Number(process.env.CLINIC_LISTENING_UPLOAD_MAX_BYTES || 50 * 1024 * 1024);
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads');
const CLINIC_LISTENING_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'clinic-listening');
const CLINIC_LISTENING_BOOK_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'clinic-listening-books');
const CLINIC_LISTENING_BOOK_COMMON_GRADE = '공용';
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
const DASHBOARD_STORAGE_KEYS = new Set(['teacher-preferences', 'exam-scores']);

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
  if (
    TODO_ALLOWED_ORIGINS.has(origin) ||
    TODO_ALLOWED_ORIGINS.has(originRoot) ||
    DASHBOARD_ALLOWED_ORIGINS.has(origin) ||
    DASHBOARD_ALLOWED_ORIGINS.has(originRoot)
  ) {
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
app.use('/api/clinic-listening-materials', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (TODO_ALLOWED_ORIGINS.has(origin) || TODO_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/clinic-listening-materials', express.json({ limit: '80mb' }));
app.use('/api/clinic-listening-books', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (TODO_ALLOWED_ORIGINS.has(origin) || TODO_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/clinic-listening-books', express.json({ limit: '120mb' }));
app.use('/api/dashboard-storage', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (TODO_ALLOWED_ORIGINS.has(origin) || TODO_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/dashboard-storage', express.json({ limit: '20mb' }));
app.use('/api/supply-requests', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (TODO_ALLOWED_ORIGINS.has(origin) || TODO_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/supply-requests', express.json({ limit: '64kb' }));
app.use('/uploads', express.static(UPLOAD_ROOT, {
  etag: true,
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));
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

function sanitizeSupplyRequestText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeSupplyRequestList(value, allowedValues) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(allowedValues);
  const result = [];
  for (const item of value) {
    const text = normalizeSupplyRequestItemName(item);
    const expanded = text === '분필 / 분필 홀더'
      ? ['분필', '분필 홀더']
      : text === '가위 / 칼'
        ? ['가위', '칼']
        : [text];
    for (const entry of expanded) {
      if (allowed.has(entry) && !result.includes(entry)) {
        result.push(entry);
      }
    }
  }
  return result;
}

function normalizeSupplyRequestItemName(value) {
  const text = sanitizeSupplyRequestText(value, 80);
  if (text === '종이') return '복사 용지';
  return text;
}

function normalizeSupplyRequestItemDetails(value, allowedItems, allowedPaperSizes) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(allowedItems);
  const allowedSizes = new Set(allowedPaperSizes);
  const result = [];
  const seen = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rawName = sanitizeSupplyRequestText(raw.name, 120);
    let name = normalizeSupplyRequestItemName(rawName);
    const paperPrefix = '복사 용지 ';
    if (name.startsWith(paperPrefix)) {
      const size = name.slice(paperPrefix.length).trim();
      if (!allowedSizes.has(size)) continue;
      name = `${paperPrefix}${size}`;
    } else if (!allowed.has(name)) {
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({
      name,
      quantity: sanitizeSupplyRequestText(raw.quantity, 80),
      productLink: sanitizeSupplyRequestText(raw.productLink, 1000),
    });
  }
  return result;
}

function supplyRequestKstLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

function buildSupplyRequestMessage(payload) {
  const itemDetails = Array.isArray(payload.itemDetails)
    ? payload.itemDetails
    : [];
  const items = itemDetails.length > 0
    ? itemDetails.map((item) => {
        const parts = [`- ${item.name}`];
        parts.push(`개수: ${item.quantity || '미입력'}`);
        if (item.productLink) {
          parts.push(`링크: ${item.productLink}`);
        }
        return parts.join(' / ');
      })
    : payload.items.map((item) => {
    if (item === '복사 용지' && payload.paperSizes.length > 0) {
      return `- 복사 용지: ${payload.paperSizes.join(', ')}`;
    }
    if (item === '기타' && payload.otherText) {
      return `- 기타: ${payload.otherText}`;
    }
    return `- ${item}`;
  });
  const extraLines = itemDetails.length > 0 && payload.otherText
    ? ['', `기타 내용: ${payload.otherText}`]
    : [];
  const legacyDetailLines = itemDetails.length === 0
    ? [
        '',
        `상품 링크: ${payload.productLink || '미입력'}`,
        `개수: ${payload.quantity || '미입력'}`,
      ]
    : [];

  return [
    '[비품 요청]',
    `요청자: ${payload.requester || '미입력'}`,
    `요청 시각: ${supplyRequestKstLabel()}`,
    '',
    '요청 품목',
    ...items,
    ...extraLines,
    ...legacyDetailLines,
  ].join('\n');
}

async function sendSupplyRequestKakaoWorkMessageByEmail({ email, text }) {
  if (!KAKAOWORK_BOT_APP_KEY) {
    throw new Error('KAKAOWORK_BOT_APP_KEY_MISSING');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(KAKAOWORK_MESSAGES_SEND_BY_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KAKAOWORK_BOT_APP_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, text }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let data = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (_) {}

    if (!response.ok || (data && data.success === false)) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : responseText || `HTTP ${response.status}`;
      const error = new Error(message);
      error.statusCode = response.status;
      throw error;
    }
    return data || { success: true };
  } finally {
    clearTimeout(timeout);
  }
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

function isValidDashboardStorageKey(key) {
  return DASHBOARD_STORAGE_KEYS.has(String(key || '').trim());
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
  const assignees = normalizeTodoAssignees(row.assignees);
  const completedBy = (Array.isArray(row.completed_by) ? row.completed_by : [])
    .map((name) => String(name || '').trim())
    .filter((name) => assignees.includes(name));
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    assignees,
    completedBy,
    attachment: attachmentName
      ? {
          name: attachmentName,
          dataUrl: row.attachment_data_url || '',
          size: Number(row.attachment_size || 0),
        }
      : null,
  };
}

async function ensureDailyAutoTodoTasks() {
  const { rows } = await pool.query(
    `SELECT (NOW() AT TIME ZONE 'Asia/Seoul')::date AS today,
            EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'Asia/Seoul'))::int AS day_of_week`
  );
  const today = rows[0] && rows[0].today;
  const dayOfWeek = Number(rows[0] && rows[0].day_of_week);
  if (!today || dayOfWeek < 1 || dayOfWeek > 5) {
    return;
  }

  for (const title of TODO_DAILY_AUTO_TITLES) {
    await pool.query(
      `INSERT INTO todo_tasks (title, due_date, created_by, assignees)
       SELECT $1, $2::date, $3, $4::text[]
        WHERE NOT EXISTS (
          SELECT 1
            FROM todo_tasks
           WHERE title = $1
             AND due_date = $2::date
        )`,
      [title, today, '자동 생성', TODO_DEFAULT_ASSIGNEES]
    );
  }
}

async function archiveCompletedPastDailyAutoTodoTasks() {
  await pool.query(
    `UPDATE todo_tasks t
        SET archived_at = NOW()
      WHERE t.title = ANY($1::text[])
        AND t.created_by = $2
        AND t.archived_at IS NULL
        AND t.due_date < (NOW() AT TIME ZONE 'Asia/Seoul')::date
        AND COALESCE(array_length(t.assignees, 1), 0) > 0
        AND NOT EXISTS (
          SELECT 1
            FROM unnest(t.assignees) AS assignee(person_name)
           WHERE NOT EXISTS (
             SELECT 1
               FROM todo_task_completions c
              WHERE c.task_id = t.id
                AND c.person_name = assignee.person_name
           )
        )`,
    [TODO_DAILY_AUTO_TITLES, '자동 생성']
  );
}

function normalizeTodoAssignees(raw) {
  const values = Array.isArray(raw)
    ? raw
    : String(raw || '').split(',');
  const result = [];
  for (const value of values) {
    const name = String(value || '').trim();
    if (name === '전체') {
      return [...TODO_DEFAULT_ASSIGNEES];
    }
    if (TODO_DEFAULT_ASSIGNEES.includes(name) && !result.includes(name)) {
      result.push(name);
    }
  }
  return result.length ? result : [...TODO_DEFAULT_ASSIGNEES];
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

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || APP_URL || '').replace(/\/+$/, '');
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured;
  }
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'daeseaca.cafe24.com').split(',')[0].trim();
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto || 'https'}://${host}`;
  }
  return 'https://daeseaca.cafe24.com';
}

function crossDepartmentReservationDirection({ owner, room, category }) {
  if (!owner || !room) return false;
  if (category === 'blocked') return false;
  if (ENGLISH_TEACHERS.has(owner.login_id) && KOREAN_ROOM_CODES.has(room.code)) {
    return '영어과 선생님이 국어과 강의실을 예약했습니다.';
  }
  if (KOREAN_TEACHERS.has(owner.login_id) && ENGLISH_ROOM_CODES.has(room.code)) {
    return '국어과 선생님이 영어과 강의실을 예약했습니다.';
  }
  return '';
}

function reservationDateSummary(payloads, fallbackDate) {
  const dates = Array.isArray(payloads) ? payloads.map((item) => item.date).filter(Boolean) : [];
  if (dates.length <= 1) return dates[0] || fallbackDate;
  return `${dates[0]} ~ ${dates[dates.length - 1]} (${dates.length}회 반복)`;
}

function classroomAppUrl() {
  return String(process.env.PUBLIC_BASE_URL || APP_URL || 'https://daeseaca.cafe24.com').replace(/\/+$/, '');
}

function buildCrossDepartmentReservationNoticeText({ owner, room, date, start, end, title, note, payloads, direction }) {
  const ownerName = owner.display_name || owner.login_id;
  const lines = [
    '[강의실 교차 예약 알림]',
    '',
    direction,
    '',
    `예약자: ${ownerName} (${owner.department || '소속 미확인'})`,
    `강의실: ${room.name || room.short_name || room.code}`,
    `날짜: ${reservationDateSummary(payloads, date)}`,
    `시간: ${start} ~ ${end}`,
    `용도: ${title}`,
  ];

  if (note) lines.push(`메모: ${note}`);

  const appUrl = classroomAppUrl();
  if (appUrl) lines.push('', `예약 보드: ${appUrl}`);

  return lines.join('\n');
}

async function sendKakaoWorkMessageToConversation({ conversationId, text }) {
  if (!KAKAOWORK_APP_KEY) {
    console.warn('[kakaowork] skipped: KAKAOWORK_APP_KEY is not configured');
    return;
  }
  if (!conversationId) {
    console.warn('[kakaowork] skipped: classroom notice conversation id is not configured');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(KAKAOWORK_MESSAGES_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KAKAOWORK_APP_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation_id: conversationId, text }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let decoded = null;
    try {
      decoded = responseText ? JSON.parse(responseText) : null;
    } catch (_) {}

    if (!response.ok || (decoded && decoded.success === false)) {
      throw new Error(`status=${response.status} body=${responseText.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function sendKakaoWorkMessageByEmail({ email, text }) {
  if (!KAKAOWORK_APP_KEY) {
    console.warn('[kakaowork] skipped: KAKAOWORK_APP_KEY is not configured');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(KAKAOWORK_MESSAGES_SEND_BY_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KAKAOWORK_APP_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, text }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let decoded = null;
    try {
      decoded = responseText ? JSON.parse(responseText) : null;
    } catch (_) {}

    if (!response.ok || (decoded && decoded.success === false)) {
      throw new Error(`status=${response.status} body=${responseText.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function queueCrossDepartmentReservationNotice(payload) {
  const direction = crossDepartmentReservationDirection(payload);
  if (!direction) return;

  const text = buildCrossDepartmentReservationNoticeText({ ...payload, direction });
  const sendPromise = KAKAOWORK_CLASSROOM_NOTICE_CONVERSATION_ID
    ? sendKakaoWorkMessageToConversation({
        conversationId: KAKAOWORK_CLASSROOM_NOTICE_CONVERSATION_ID,
        text,
      })
    : sendKakaoWorkMessageByEmail({
        email: KAKAOWORK_KOREAN_ROOM_MANAGER_EMAIL,
        text,
      });

  sendPromise
    .then(() => {
      console.log('[kakaowork] cross department reservation notice sent');
    })
    .catch((error) => {
      console.warn('[kakaowork] cross department reservation notice failed: ' + error.message);
    });
}

function normalizeClinicListeningGrade(raw) {
  const grade = String(raw || '').trim();
  if (grade === 'Starter') return '초등부 Starter';
  return CLINIC_LISTENING_GRADES.includes(grade) ? grade : '';
}

function normalizeClinicListeningDayNumber(raw) {
  const value = Number(String(raw || '').replace(/[^\d]/g, ''));
  return Number.isInteger(value) && value >= 1 && value <= 60 ? value : 0;
}

function normalizeClinicListeningAnswers(raw) {
  const source = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  return (source.match(/\d/g) || []).join(',');
}

function clinicListeningMaterialPublic(row) {
  return {
    grade: row.grade,
    day: `Day ${row.day_number}`,
    answers: row.answers || '',
    link: row.link || '',
    updatedAt: row.updated_at || null,
  };
}

function clinicListeningBookPublic(row, days = []) {
  return {
    id: row.id,
    grade: row.grade,
    title: row.title || '',
    textbookFileName: row.textbook_file_name || '',
    textbookFileLink: row.textbook_file_link || '',
    explanationFileName: row.explanation_file_name || '',
    explanationFileLink: row.explanation_file_link || '',
    updatedAt: row.updated_at || null,
    days: days.map((day) => ({
      day: `Day ${day.day_number}`,
      dayNumber: Number(day.day_number || 0),
      answers: day.answers || '',
      link: day.audio_link || '',
      audioFileName: day.audio_file_name || '',
      updatedAt: day.updated_at || null,
    })),
  };
}

function sanitizeUploadFileName(name) {
  const raw = String(name || 'clinic-listening-file').trim();
  const ext = path.extname(raw).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12);
  return `${Date.now()}-${crypto.randomUUID()}${ext || '.bin'}`;
}

async function saveClinicListeningNamedUpload(req, rawFile, uploadDir, fallbackName) {
  if (!rawFile || typeof rawFile !== 'object') return '';
  const dataUrl = String(rawFile.dataUrl || '').trim();
  const match = /^data:([^;,]+)?;base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new Error('CLINIC_LISTENING_FILE_INVALID');
  }
  const buffer = Buffer.from(match[2], 'base64');
  const declaredSize = Number(rawFile.size || 0);
  if (
    !buffer.length ||
    buffer.length > CLINIC_LISTENING_UPLOAD_MAX_BYTES ||
    (Number.isFinite(declaredSize) && declaredSize > 0 && declaredSize > CLINIC_LISTENING_UPLOAD_MAX_BYTES)
  ) {
    throw new Error('CLINIC_LISTENING_FILE_TOO_LARGE');
  }

  await fs.promises.mkdir(uploadDir, { recursive: true });
  const safeName = sanitizeUploadFileName(rawFile.name || fallbackName);
  await fs.promises.writeFile(path.join(uploadDir, safeName), buffer, { flag: 'wx' });
  const folder = path.basename(uploadDir);
  return {
    name: String(rawFile.name || safeName).trim(),
    link: `${publicBaseUrl(req)}/uploads/${folder}/${encodeURIComponent(safeName)}`,
    size: buffer.length,
  };
}

async function saveClinicListeningUpload(req, rawFile, grade, dayNumber) {
  const saved = await saveClinicListeningNamedUpload(
    req,
    rawFile,
    CLINIC_LISTENING_UPLOAD_DIR,
    `clinic-listening-${grade}-day-${dayNumber}`,
  );
  return saved ? saved.link : '';
}

async function fetchClinicListeningGasJson(params) {
  if (!CLINIC_LISTENING_GAS_URL) return null;
  const url = new URL(CLINIC_LISTENING_GAS_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) return null;
  const text = await response.text();
  if (!text || text.trimStart().startsWith('<')) return null;
  return JSON.parse(text);
}

async function importClinicListeningMaterialsFromGas(grade) {
  const decoded = await fetchClinicListeningGasJson({ grade }).catch(() => null);
  if (!Array.isArray(decoded)) return;
  for (const item of decoded) {
    const dayNumber = normalizeClinicListeningDayNumber(item && item.day);
    const answers = normalizeClinicListeningAnswers(item && item.answers);
    const link = String((item && item.link) || '').trim();
    if (!dayNumber || !answers) continue;
    await pool.query(
      `INSERT INTO clinic_listening_materials (grade, day_number, answers, link, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (grade, day_number)
       DO UPDATE SET answers = EXCLUDED.answers,
                     link = EXCLUDED.link,
                     updated_at = NOW()`,
      [grade, dayNumber, answers, link]
    );
  }
}

async function importClinicListeningBookTitleFromGas(grade) {
  const decoded = await fetchClinicListeningGasJson({
    action: 'listeningBookTitle',
    grade,
  }).catch(() => null);
  if (!decoded || decoded.ok !== true) return '';
  const title = String(decoded.title || '').trim();
  if (!title) return '';
  await pool.query(
    `INSERT INTO clinic_listening_book_titles (grade, title, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (grade)
     DO UPDATE SET title = EXCLUDED.title,
                   updated_at = NOW()`,
    [grade, title]
  );
  return title;
}

function postClinicListeningToGas(body) {
  if (!CLINIC_LISTENING_GAS_URL) return;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    params.set(key, String(value ?? ''));
  }
  fetch(CLINIC_LISTENING_GAS_URL, {
    method: 'POST',
    body: params,
  }).catch((error) => {
    console.error('clinic listening GAS sync failed:', error && error.message ? error.message : error);
  });
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
      assignees TEXT[] NOT NULL DEFAULT ARRAY['존','주디','스테이시','다나','조나단','스텐']::text[],
      attachment_name TEXT NOT NULL DEFAULT '',
      attachment_data_url TEXT NOT NULL DEFAULT '',
      attachment_size INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ NULL
    );

    ALTER TABLE todo_tasks
      ADD COLUMN IF NOT EXISTS assignees TEXT[] NOT NULL DEFAULT ARRAY['존','주디','스테이시','다나','조나단','스텐']::text[],
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

async function ensureClinicListeningMaterialTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinic_listening_book_titles (
      grade TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clinic_listening_materials (
      grade TEXT NOT NULL,
      day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 60),
      answers TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (grade, day_number)
    );

    ALTER TABLE clinic_listening_materials
      DROP CONSTRAINT IF EXISTS clinic_listening_materials_day_number_check;
    ALTER TABLE clinic_listening_materials
      ADD CONSTRAINT clinic_listening_materials_day_number_check
      CHECK (day_number BETWEEN 1 AND 60);

    CREATE INDEX IF NOT EXISTS idx_clinic_listening_materials_grade_day
      ON clinic_listening_materials (grade, day_number);

    CREATE TABLE IF NOT EXISTS clinic_listening_books (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      grade TEXT NOT NULL,
      title TEXT NOT NULL,
      textbook_file_name TEXT NOT NULL DEFAULT '',
      textbook_file_link TEXT NOT NULL DEFAULT '',
      explanation_file_name TEXT NOT NULL DEFAULT '',
      explanation_file_link TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (grade, title)
    );

    CREATE TABLE IF NOT EXISTS clinic_listening_book_days (
      book_id UUID NOT NULL REFERENCES clinic_listening_books(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 60),
      answers TEXT NOT NULL DEFAULT '',
      audio_file_name TEXT NOT NULL DEFAULT '',
      audio_link TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (book_id, day_number)
    );

    ALTER TABLE clinic_listening_book_days
      DROP CONSTRAINT IF EXISTS clinic_listening_book_days_day_number_check;
    ALTER TABLE clinic_listening_book_days
      ADD CONSTRAINT clinic_listening_book_days_day_number_check
      CHECK (day_number BETWEEN 1 AND 60);

    CREATE INDEX IF NOT EXISTS idx_clinic_listening_books_grade_title
      ON clinic_listening_books (grade, title);
    CREATE INDEX IF NOT EXISTS idx_clinic_listening_book_days_book_day
      ON clinic_listening_book_days (book_id, day_number);
  `);
}

async function ensureDashboardStorageTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dashboard_storage (
      storage_key TEXT PRIMARY KEY,
      json_text TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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
    await archiveCompletedPastDailyAutoTodoTasks();
    await ensureDailyAutoTodoTasks();

    const { rows } = await pool.query(
      `SELECT t.id::text,
              t.title,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              t.created_by,
              t.assignees,
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
    const assignees = normalizeTodoAssignees(req.body.assignees);
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
          title, due_date, created_by, assignees,
          attachment_name, attachment_data_url, attachment_size
       )
       VALUES ($1, $2::date, $3, $4::text[], $5, $6, $7)
       RETURNING id::text,
                 title,
                 to_char(due_date, 'YYYY-MM-DD') AS due_date,
                 created_by,
                 assignees,
                 attachment_name,
                 attachment_data_url,
                 attachment_size,
                 created_at,
                 ARRAY[]::text[] AS completed_by`,
      [
        title.slice(0, 300),
        dueDate,
        createdBy,
        assignees,
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
    const assignees = normalizeTodoAssignees(req.body.assignees);
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
              assignees = $4::text[],
              attachment_name = $5,
              attachment_data_url = $6,
              attachment_size = $7
        WHERE id = $1::uuid
          AND archived_at IS NULL`,
      [
        taskId,
        title.slice(0, 300),
        dueDate,
        assignees,
        attachment.name,
        attachment.dataUrl,
        attachment.size,
      ]
    );
    if (updated.rowCount === 0) {
      return jsonError(res, 404, '업무를 찾을 수 없습니다.');
    }
    await pool.query(
      `DELETE FROM todo_task_completions
        WHERE task_id = $1::uuid
          AND NOT (person_name = ANY($2::text[]))`,
      [taskId, assignees]
    );

    const { rows } = await pool.query(
      `SELECT t.id::text,
              t.title,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              t.created_by,
              t.assignees,
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
      `SELECT id, assignees
         FROM todo_tasks
        WHERE id = $1::uuid
          AND archived_at IS NULL`,
      [taskId]
    );
    if (existing.rowCount === 0) {
      return jsonError(res, 404, '업무를 찾을 수 없습니다.');
    }
    const assignees = normalizeTodoAssignees(existing.rows[0].assignees);
    if (!assignees.includes(person)) {
      return jsonError(res, 403, '이 업무의 대상자만 체크할 수 있습니다.');
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
              t.assignees,
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

app.get('/api/dashboard-storage/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!isValidDashboardStorageKey(key)) {
      return jsonError(res, 400, '지원하지 않는 저장소 키입니다.');
    }

    const { rows } = await pool.query(
      `SELECT storage_key, json_text, updated_at
         FROM dashboard_storage
        WHERE storage_key = $1`,
      [key]
    );
    const row = rows[0];
    res.json({
      ok: true,
      key,
      json: row ? row.json_text : '{}',
      updatedAt: row ? row.updated_at : null,
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/dashboard-storage/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!isValidDashboardStorageKey(key)) {
      return jsonError(res, 400, '지원하지 않는 저장소 키입니다.');
    }

    const jsonText = String(req.body?.json ?? '').trim() || '{}';
    try {
      JSON.parse(jsonText);
    } catch (_) {
      return jsonError(res, 400, '저장할 JSON 형식이 올바르지 않습니다.');
    }

    const { rows } = await pool.query(
      `INSERT INTO dashboard_storage (storage_key, json_text, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (storage_key)
       DO UPDATE SET json_text = EXCLUDED.json_text,
                     updated_at = NOW()
       RETURNING storage_key, updated_at`,
      [key, jsonText]
    );
    res.json({
      ok: true,
      key,
      updatedAt: rows[0]?.updated_at || null,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/supply-requests', async (req, res, next) => {
  try {
    const allowedItems = [
      '복사 용지',
      '포스트잇',
      '스테이플러심',
      '분필',
      '분필 홀더',
      '채점용 색연필',
      '가위',
      '칼',
      '강의실 방향제',
      '기타',
    ];
    const allowedPaperSizes = ['A4', 'B4', 'A3'];
    const requester = sanitizeSupplyRequestText(req.body.requester, 80);
    const items = normalizeSupplyRequestList(req.body.items, allowedItems);
    const paperSizes = normalizeSupplyRequestList(req.body.paperSizes, allowedPaperSizes);
    const itemDetails = normalizeSupplyRequestItemDetails(
      req.body.itemDetails,
      allowedItems,
      allowedPaperSizes
    );
    const otherText = sanitizeSupplyRequestText(req.body.otherText, 300);
    const productLink = sanitizeSupplyRequestText(req.body.productLink, 1000);
    const quantity = sanitizeSupplyRequestText(req.body.quantity, 80);

    if (items.length === 0) {
      return jsonError(res, 400, '요청할 비품을 하나 이상 선택해주세요.');
    }
    if (items.includes('복사 용지') && paperSizes.length === 0 &&
        !itemDetails.some((item) => item.name.startsWith('복사 용지 '))) {
      return jsonError(res, 400, '복사 용지 규격을 선택해주세요.');
    }
    if (items.includes('기타') && !otherText) {
      return jsonError(res, 400, '기타 요청 내용을 입력해주세요.');
    }

    const message = buildSupplyRequestMessage({
      requester,
      items,
      paperSizes,
      itemDetails,
      otherText,
      productLink,
      quantity,
    });

    await sendSupplyRequestKakaoWorkMessageByEmail({
      email: KAKAOWORK_SUPPLY_REQUEST_EMAIL,
      text: message,
    });
    res.json({ ok: true });
  } catch (error) {
    if (error && error.message === 'KAKAOWORK_BOT_APP_KEY_MISSING') {
      return jsonError(res, 500, '카카오워크 봇 앱키가 서버에 설정되어 있지 않습니다.');
    }
    next(error);
  }
});

app.get('/api/clinic-listening-books', async (req, res, next) => {
  try {
    const booksRes = await pool.query(
      `SELECT id::text, grade, title,
              textbook_file_name, textbook_file_link,
              explanation_file_name, explanation_file_link,
              created_at, updated_at
         FROM clinic_listening_books
        ORDER BY LOWER(title) ASC, updated_at DESC`
    );
    const bookIds = booksRes.rows.map((row) => row.id);
    let daysByBook = new Map();
    if (bookIds.length > 0) {
      const daysRes = await pool.query(
        `SELECT book_id::text, day_number, answers, audio_file_name, audio_link, updated_at
           FROM clinic_listening_book_days
          WHERE book_id = ANY($1::uuid[])
          ORDER BY day_number ASC`,
        [bookIds]
      );
      for (const day of daysRes.rows) {
        const list = daysByBook.get(day.book_id) || [];
        list.push(day);
        daysByBook.set(day.book_id, list);
      }
    }

    res.json({
      ok: true,
      books: booksRes.rows.map((book) => clinicListeningBookPublic(book, daysByBook.get(book.id) || [])),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/clinic-listening-books', async (req, res, next) => {
  try {
    const requestGrade = normalizeClinicListeningGrade(req.body.grade);
    const title = String(req.body.title || '').trim().slice(0, 200);
    if (!title) {
      return jsonError(res, 400, '듣기 책 이름을 입력해주세요.');
    }

    const existingId = String(req.body.id || '').trim();
    const existingBookRes = existingId
      ? await pool.query(
          `SELECT id::text, grade
             FROM clinic_listening_books
            WHERE id = $1::uuid`,
          [existingId]
        )
      : { rows: [] };
    const sameTitleRes = existingId
      ? { rows: [] }
      : await pool.query(
          `SELECT id::text, grade
             FROM clinic_listening_books
            WHERE title = $1
            ORDER BY CASE WHEN grade = $2 THEN 0 ELSE 1 END, updated_at DESC
            LIMIT 1`,
          [title, CLINIC_LISTENING_BOOK_COMMON_GRADE]
        );
    const targetId = existingBookRes.rows[0]?.id || sameTitleRes.rows[0]?.id || '';
    const bookGrade =
      existingBookRes.rows[0]?.grade ||
      sameTitleRes.rows[0]?.grade ||
      CLINIC_LISTENING_BOOK_COMMON_GRADE;
    const uploadGrade = requestGrade || bookGrade || 'common';
    let textbookFileName = String(req.body.textbookFileName || '').trim().slice(0, 300);
    let textbookFileLink = String(req.body.textbookFileLink || '').trim().slice(0, 1000);
    let explanationFileName = String(req.body.explanationFileName || '').trim().slice(0, 300);
    let explanationFileLink = String(req.body.explanationFileLink || '').trim().slice(0, 1000);

    try {
      const textbookUpload = await saveClinicListeningNamedUpload(
        req,
        req.body.textbookFile,
        CLINIC_LISTENING_BOOK_UPLOAD_DIR,
        `clinic-listening-book-${uploadGrade}`,
      );
      if (textbookUpload) {
        textbookFileName = textbookUpload.name;
        textbookFileLink = textbookUpload.link;
      }

      const explanationUpload = await saveClinicListeningNamedUpload(
        req,
        req.body.explanationFile,
        CLINIC_LISTENING_BOOK_UPLOAD_DIR,
        `clinic-listening-explanation-${uploadGrade}`,
      );
      if (explanationUpload) {
        explanationFileName = explanationUpload.name;
        explanationFileLink = explanationUpload.link;
      }
    } catch (error) {
      if (error.message === 'CLINIC_LISTENING_FILE_TOO_LARGE') {
        return jsonError(res, 400, '교재 파일은 50MB 이하로 업로드해주세요.');
      }
      return jsonError(res, 400, '교재 파일 형식이 올바르지 않습니다.');
    }

    let bookRows;
    if (targetId) {
      bookRows = await pool.query(
        `UPDATE clinic_listening_books
            SET grade = $2,
                title = $3,
                textbook_file_name = $4,
                textbook_file_link = $5,
                explanation_file_name = $6,
                explanation_file_link = $7,
                updated_at = NOW()
          WHERE id = $1::uuid
          RETURNING id::text, grade, title,
                    textbook_file_name, textbook_file_link,
                    explanation_file_name, explanation_file_link,
                    created_at, updated_at`,
        [
          targetId,
          bookGrade,
          title,
          textbookFileName,
          textbookFileLink,
          explanationFileName,
          explanationFileLink,
        ]
      );
    }

    if (!targetId || bookRows.rowCount === 0) {
      bookRows = await pool.query(
        `INSERT INTO clinic_listening_books (
            grade, title,
            textbook_file_name, textbook_file_link,
            explanation_file_name, explanation_file_link,
            updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (grade, title)
         DO UPDATE SET textbook_file_name = EXCLUDED.textbook_file_name,
                       textbook_file_link = EXCLUDED.textbook_file_link,
                       explanation_file_name = EXCLUDED.explanation_file_name,
                       explanation_file_link = EXCLUDED.explanation_file_link,
                       updated_at = NOW()
         RETURNING id::text, grade, title,
                   textbook_file_name, textbook_file_link,
                   explanation_file_name, explanation_file_link,
                   created_at, updated_at`,
        [
          bookGrade,
          title,
          textbookFileName,
          textbookFileLink,
          explanationFileName,
          explanationFileLink,
        ]
      );
    }

    const book = bookRows.rows[0];
    const rawDays = Array.isArray(req.body.days) ? req.body.days : [];
    for (const rawDay of rawDays) {
      const dayNumber = normalizeClinicListeningDayNumber(rawDay && (rawDay.dayNumber || rawDay.day));
      if (!dayNumber) continue;

      const answers = normalizeClinicListeningAnswers(rawDay.answers);
      let audioLink = String(rawDay.link || rawDay.audioLink || '').trim().slice(0, 1000);
      let audioFileName = String(rawDay.audioFileName || '').trim().slice(0, 300);
      try {
        const audioUpload = await saveClinicListeningNamedUpload(
          req,
          rawDay.file || rawDay.audioFile,
          CLINIC_LISTENING_BOOK_UPLOAD_DIR,
          `clinic-listening-book-${uploadGrade}-day-${dayNumber}`,
        );
        if (audioUpload) {
          audioFileName = audioUpload.name;
          audioLink = audioUpload.link;
        }
      } catch (error) {
        if (error.message === 'CLINIC_LISTENING_FILE_TOO_LARGE') {
          return jsonError(res, 400, '회차별 음성 파일은 50MB 이하로 업로드해주세요.');
        }
        return jsonError(res, 400, '회차별 음성 파일 형식이 올바르지 않습니다.');
      }

      if (!answers && !audioLink && !audioFileName) {
        await pool.query(
          `DELETE FROM clinic_listening_book_days
            WHERE book_id = $1::uuid AND day_number = $2`,
          [book.id, dayNumber]
        );
        continue;
      }

      await pool.query(
        `INSERT INTO clinic_listening_book_days (
            book_id, day_number, answers, audio_file_name, audio_link, updated_at
         )
         VALUES ($1::uuid, $2, $3, $4, $5, NOW())
         ON CONFLICT (book_id, day_number)
         DO UPDATE SET answers = EXCLUDED.answers,
                       audio_file_name = EXCLUDED.audio_file_name,
                       audio_link = EXCLUDED.audio_link,
                       updated_at = NOW()`,
        [book.id, dayNumber, answers, audioFileName, audioLink]
      );
    }

    const daysRes = await pool.query(
      `SELECT book_id::text, day_number, answers, audio_file_name, audio_link, updated_at
         FROM clinic_listening_book_days
        WHERE book_id = $1::uuid
        ORDER BY day_number ASC`,
      [book.id]
    );

    res.json({
      ok: true,
      action: 'saveListeningBook',
      book: clinicListeningBookPublic(book, daysRes.rows),
    });
  } catch (error) {
    if (error && error.code === '23505') {
      return jsonError(res, 400, '같은 학년에 같은 이름의 듣기 교재가 이미 있습니다.');
    }
    if (error && error.code === '22P02') {
      return jsonError(res, 400, '교재 ID가 올바르지 않습니다.');
    }
    next(error);
  }
});

app.get('/api/clinic-listening-materials', async (req, res, next) => {
  try {
    const grade = normalizeClinicListeningGrade(req.query.grade);
    if (!grade) {
      return jsonError(res, 400, '지원하지 않는 학년/부서입니다.');
    }

    let { rows } = await pool.query(
      `SELECT grade, day_number, answers, link, updated_at
         FROM clinic_listening_materials
        WHERE grade = $1
        ORDER BY day_number ASC`,
      [grade]
    );

    if (rows.length === 0) {
      await importClinicListeningMaterialsFromGas(grade);
      const refreshed = await pool.query(
        `SELECT grade, day_number, answers, link, updated_at
           FROM clinic_listening_materials
          WHERE grade = $1
          ORDER BY day_number ASC`,
        [grade]
      );
      rows = refreshed.rows;
    }

    res.json({ ok: true, materials: rows.map(clinicListeningMaterialPublic) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/clinic-listening-materials/book-title', async (req, res, next) => {
  try {
    const grade = normalizeClinicListeningGrade(req.query.grade);
    if (!grade) {
      return jsonError(res, 400, '지원하지 않는 학년/부서입니다.');
    }

    let { rows } = await pool.query(
      `SELECT grade, title, updated_at
         FROM clinic_listening_book_titles
        WHERE grade = $1
        LIMIT 1`,
      [grade]
    );

    if (rows.length === 0) {
      await importClinicListeningBookTitleFromGas(grade);
      const refreshed = await pool.query(
        `SELECT grade, title, updated_at
           FROM clinic_listening_book_titles
          WHERE grade = $1
          LIMIT 1`,
        [grade]
      );
      rows = refreshed.rows;
    }

    res.json({
      ok: true,
      grade,
      title: rows[0] ? rows[0].title || '' : '',
      updatedAt: rows[0] ? rows[0].updated_at || null : null,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/clinic-listening-materials/book-title', async (req, res, next) => {
  try {
    const grade = normalizeClinicListeningGrade(req.body.grade);
    const title = String(req.body.title || '').trim().slice(0, 200);
    if (!grade) {
      return jsonError(res, 400, '지원하지 않는 학년/부서입니다.');
    }

    const { rows } = await pool.query(
      `INSERT INTO clinic_listening_book_titles (grade, title, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (grade)
       DO UPDATE SET title = EXCLUDED.title,
                     updated_at = NOW()
       RETURNING grade, title, updated_at`,
      [grade, title]
    );

    postClinicListeningToGas({
      action: 'saveListeningBookTitle',
      grade,
      title,
    });

    res.json({
      ok: true,
      action: 'saveListeningBookTitle',
      grade: rows[0].grade,
      title: rows[0].title,
      updatedAt: rows[0].updated_at,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/clinic-listening-materials', async (req, res, next) => {
  try {
    const grade = normalizeClinicListeningGrade(req.body.grade);
    const dayNumber = normalizeClinicListeningDayNumber(req.body.dayNumber || req.body.day);
    const answers = normalizeClinicListeningAnswers(req.body.answers);
    let link = String(req.body.link || '').trim();
    if (!grade) {
      return jsonError(res, 400, '지원하지 않는 학년/부서입니다.');
    }
    if (!dayNumber) {
      return jsonError(res, 400, 'Day 1부터 Day 60까지만 저장할 수 있습니다.');
    }
    if (!answers) {
      return jsonError(res, 400, '정답을 입력해주세요.');
    }

    try {
      const uploadedLink = await saveClinicListeningUpload(req, req.body.file, grade, dayNumber);
      if (uploadedLink) {
        link = uploadedLink;
      }
    } catch (error) {
      if (error.message === 'CLINIC_LISTENING_FILE_TOO_LARGE') {
        return jsonError(res, 400, '듣기 파일은 50MB 이하로 업로드해주세요.');
      }
      return jsonError(res, 400, '듣기 파일 형식이 올바르지 않습니다.');
    }

    const { rows } = await pool.query(
      `INSERT INTO clinic_listening_materials (grade, day_number, answers, link, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (grade, day_number)
       DO UPDATE SET answers = EXCLUDED.answers,
                     link = EXCLUDED.link,
                     updated_at = NOW()
       RETURNING grade, day_number, answers, link, updated_at`,
      [grade, dayNumber, answers, link]
    );

    postClinicListeningToGas({
      action: 'saveListeningMaterial',
      grade,
      day: `Day ${dayNumber}`,
      answers,
      link,
    });

    res.json({
      ok: true,
      action: 'saveListeningMaterial',
      material: clinicListeningMaterialPublic(rows[0]),
    });
  } catch (error) {
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

app.post('/api/team-communication/access-logs/clear', async (req, res, next) => {
  try {
    const person = String(req.body.person || '').trim();
    if (person !== '스텐') {
      return jsonError(res, 403, '접속 로그는 스텐만 삭제할 수 있습니다.');
    }

    const result = await pool.query('DELETE FROM team_access_logs');
    res.json({ ok: true, deletedCount: result.rowCount });
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
    queueCrossDepartmentReservationNotice({
      owner,
      room,
      category,
      date,
      start,
      end,
      title,
      note,
      payloads,
    });
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
  await ensureClinicListeningMaterialTables();
  await ensureDashboardStorageTables();
  app.listen(PORT, () => {
    console.log(`대세학원 강의실 예약 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
