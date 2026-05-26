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
const KAKAOWORK_REFERRAL_APP_KEY = process.env.KAKAOWORK_REFERRAL_APP_KEY || '';
const KAKAOWORK_REFERRAL_EMAIL = process.env.KAKAOWORK_REFERRAL_EMAIL || 'ltdall@naver.com';
const KAKAOWORK_NEW_STUDENT_APP_KEY = process.env.KAKAOWORK_NEW_STUDENT_APP_KEY || '';
const KAKAOWORK_NEW_STUDENT_EMAIL = process.env.KAKAOWORK_NEW_STUDENT_EMAIL || 'ltdall@naver.com';
const KAKAOWORK_WITHDRAWAL_APP_KEY = process.env.KAKAOWORK_WITHDRAWAL_APP_KEY || '';
const KAKAOWORK_WITHDRAWAL_EMAIL = process.env.KAKAOWORK_WITHDRAWAL_EMAIL || 'ltdall@naver.com';
const KAKAOWORK_CLASS_MOVE_APP_KEY = process.env.KAKAOWORK_CLASS_MOVE_APP_KEY || '';
const KAKAOWORK_CLASS_MOVE_EMAIL = process.env.KAKAOWORK_CLASS_MOVE_EMAIL || 'ltdall@naver.com';
const SLOT_START = 9 * 60;
const SLOT_END = 22 * 60;
const SLOT_MINUTES = 30;
const SEOUL_OFFSET = '+09:00';
const SEOUL_TZ = 'Asia/Seoul';
const TEAM_COMMUNICATION_PEOPLE = ['스텐', '주디', '조나단', '존', '다나', '스테이시', '관리팀1', '관리팀2', '관리팀3', '관리팀4', '관리팀5'];
const TODO_DEFAULT_ASSIGNEES = ['존', '주디', '스테이시', '다나', '조나단', '스텐'];
const TODO_DELETE_PEOPLE = ['스텐', '존'];
const TODO_DAILY_AUTO_TITLES = ['클리닉표 작성 및 확인', '반별 과제 안내'];
const TODO_REPEAT_CYCLES = new Set(['daily', 'weekdays', 'weekly', 'monthly']);
const TODO_REPEAT_MAX_OCCURRENCES = 366;
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
const CLINIC_LISTENING_GRADES = [
  '초등부',
  '화목 초등부',
  '초등부 Starter',
  '중1',
  '화목 중1',
  '중2',
  '화목 중2',
  '중3',
  '화목 중3',
  '고1',
  '고2',
];
const CLINIC_DICTATION_GRADE_ALIASES = new Map([
  ['화목 초등부', '초등부'],
  ['화목 중1', '중1'],
  ['화목 중2', '중2'],
  ['화목 중3', '중3'],
]);
const CLINIC_LISTENING_SHEET_SYNC_MIN_VERSION = 3;
const CLINIC_LISTENING_UPLOAD_MAX_BYTES = Number(process.env.CLINIC_LISTENING_UPLOAD_MAX_BYTES || 100 * 1024 * 1024);
const CLINIC_DICTATION_UPLOAD_MAX_BYTES = Number(process.env.CLINIC_DICTATION_UPLOAD_MAX_BYTES || 8 * 1024 * 1024);
const CLINIC_DICTATION_NORMALIZE_HWAMOK_GRADE =
  process.env.CLINIC_DICTATION_NORMALIZE_HWAMOK_GRADE !== 'false';
const CLINIC_DICTATION_UPLOAD_MAX_COUNT = Number(process.env.CLINIC_DICTATION_UPLOAD_MAX_COUNT || 6);
const CLINIC_DICTATION_UPLOAD_TOTAL_MAX_BYTES = Number(
  process.env.CLINIC_DICTATION_UPLOAD_TOTAL_MAX_BYTES ||
    CLINIC_DICTATION_UPLOAD_MAX_BYTES * CLINIC_DICTATION_UPLOAD_MAX_COUNT
);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_VOCABULARY_MODEL = process.env.OPENAI_VOCABULARY_MODEL || 'gpt-4.1-mini';
const OPENAI_VOCABULARY_MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_VOCABULARY_MAX_OUTPUT_TOKENS || 32000);
const OPENAI_WRITING_WORKSHEET_MODEL =
  process.env.OPENAI_WRITING_WORKSHEET_MODEL || OPENAI_VOCABULARY_MODEL;
const OPENAI_WRITING_WORKSHEET_MAX_OUTPUT_TOKENS = Number(
  process.env.OPENAI_WRITING_WORKSHEET_MAX_OUTPUT_TOKENS || 12000
);
const OPENAI_REHEARSAL_MODEL =
  process.env.OPENAI_REHEARSAL_MODEL || OPENAI_WRITING_WORKSHEET_MODEL;
const OPENAI_REHEARSAL_MAX_OUTPUT_TOKENS = Number(
  process.env.OPENAI_REHEARSAL_MAX_OUTPUT_TOKENS || 20000
);
const OPENAI_STATS_PREDICTION_MODEL =
  process.env.OPENAI_STATS_PREDICTION_MODEL || OPENAI_WRITING_WORKSHEET_MODEL;
const OPENAI_STATS_PREDICTION_MAX_OUTPUT_TOKENS = Number(
  process.env.OPENAI_STATS_PREDICTION_MAX_OUTPUT_TOKENS || 1800
);
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads');
const CLINIC_LISTENING_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'clinic-listening');
const CLINIC_LISTENING_BOOK_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'clinic-listening-books');
const CLINIC_DICTATION_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'dictation');
const CLINIC_LISTENING_BOOK_COMMON_GRADE = '공용';
const TODO_ALLOWED_ORIGINS = new Set([
  'https://daeseenglish.com',
  'https://www.daeseenglish.com',
  'http://localhost',
  'http://127.0.0.1',
]);
const DASHBOARD_ALLOWED_ORIGINS = new Set([
  'https://daeseenglish.com',
  'https://www.daeseenglish.com',
  'https://daeseaca.com',
  'https://www.daeseaca.com',
  'https://daese8810.github.io',
  'https://daeseaca.cafe24.com',
  'http://localhost',
  'http://127.0.0.1',
]);
const DASHBOARD_STORAGE_KEYS = new Set([
  'teacher-preferences',
  'exam-scores',
  'clinic-attendance-records',
  'clinic-table-results',
  'clinic-roster-backups',
  'clinic-table-backups',
  'full-schedule-backups',
  'assignment-kakao-link-backups',
  'academy-calendar-backups',
  'curriculum-plan-backups',
  'daese-rehearsal-scope-library',
  'daese-rehearsal-school-examples',
  '_utf8_health_check',
]);
const DASHBOARD_STORAGE_KEY_PATTERNS = [
  /^clinic-file-v1-daese-rehearsal-scope-pdf-\d+-\d+-[0-9a-f]+$/i,
];
const TEACHER_PREFERENCES_STORAGE_KEY = 'teacher-preferences';
const STUDENT_ROSTER_EDITS_PREFERENCE_KEY = '_clinic_student_roster_edits_v1';
const CLINIC_TABLE_VISIBILITY_PREFERENCE_KEY = '_clinic_table_visibility_v1';
const ATTENDANCE_RECORDS_PREFERENCE_KEY = '_clinic_attendance_records_v1';
const ATTENDANCE_ABSENCE_REASONS_PREFERENCE_KEY =
  '_clinic_attendance_absence_reasons_v1';
const ATTENDANCE_HOMEWORK_MISSING_PREFERENCE_KEY =
  '_clinic_attendance_homework_missing_v1';
const ATTENDANCE_STATUS_NAMES = new Set(['present', 'late', 'absent']);
const ATTENDANCE_HOMEWORK_CATEGORY_NAMES = new Set([
  'grammar',
  'reading',
  'dictation',
  'examPrep',
  'other',
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
app.use('/api/clinic-listening-materials', express.json({ limit: '160mb' }));
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
app.use('/api/clinic-listening-books', express.json({ limit: '160mb' }));
app.use('/api/clinic-dictation', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (TODO_ALLOWED_ORIGINS.has(origin) || TODO_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/clinic-dictation', express.json({ limit: '80mb' }));
app.use('/api/dashboard-storage', (req, res, next) => {
  const origin = String(req.headers.origin || '');
  const originRoot = origin.replace(/:\d+$/, '');
  if (DASHBOARD_ALLOWED_ORIGINS.has(origin) || DASHBOARD_ALLOWED_ORIGINS.has(originRoot)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/dashboard-storage', express.json({ limit: '160mb' }));
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
app.use('/api/referral-discount-notifications', (req, res, next) => {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/referral-discount-notifications', express.json({ limit: '32kb' }));
app.use('/api/new-student-notifications', (req, res, next) => {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/new-student-notifications', express.json({ limit: '32kb' }));
app.use('/api/withdrawal-notifications', (req, res, next) => {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/withdrawal-notifications', express.json({ limit: '32kb' }));
app.use('/api/class-move-notifications', (req, res, next) => {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/class-move-notifications', express.json({ limit: '32kb' }));
app.use('/api/vocabulary-workbook', (req, res, next) => {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/vocabulary-workbook', express.json({ limit: '512kb' }));
app.use('/api/writing-worksheet', (req, res, next) => {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/writing-worksheet', express.json({ limit: '512kb' }));
app.use('/api/stats-prediction', (req, res, next) => {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api/stats-prediction', express.json({ limit: '128kb' }));
app.use('/api/daese-rehearsal', (req, res, next) => {
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
app.use('/api/daese-rehearsal', express.json({ limit: '40mb' }));
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

function normalizeVocabularyWorkbookWords(raw) {
  const source = Array.isArray(raw) ? raw.join('\n') : String(raw || '');
  const seen = new Set();
  const words = [];
  for (const part of source.split(/[\r\n,\t]+/)) {
    const word = String(part || '').trim().replace(/^[-*\d.\s]+/, '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word.slice(0, 80));
    if (words.length >= 300) break;
  }
  return words;
}


function sanitizeWritingWorksheetText(value, maxLength = 1200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeWritingWorksheetExerciseTypes(raw) {
  const allowed = new Set([
    'rearrange',
    'rearrangeTransform',
    'rearrangeAdd',
    'rearrangeTransformAdd',
    'guided',
    'errorCorrection',
    'expansion',
  ]);
  const values = Array.isArray(raw)
    ? raw
    : String(raw || '').split(/[,|\s]+/);
  const result = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (allowed.has(text) && !result.includes(text)) {
      result.push(text);
    }
  }
  return result.length ? result : ['rearrange'];
}

function normalizeWritingWorksheetDifficultyCode(rawCode, rawLabel) {
  const code = String(rawCode || '').trim();
  if (['easy', 'standard', 'challenge'].includes(code)) {
    return code;
  }

  const label = String(rawLabel || '').trim();
  if (label === '기초') return 'easy';
  if (label === '심화') return 'challenge';
  return 'standard';
}

function writingWorksheetDifficultyInstruction(code) {
  if (code === 'easy') {
    return [
      '기초: 짧은 단문 중심으로 만든다.',
      '한 문장에는 핵심 문법 포인트를 1개만 넣는다.',
      '어휘는 학생이 바로 배열할 수 있을 정도로 평이하게 고른다.',
      'wrong/baseSentence/tip도 기본 형태 확인에 맞춘다.',
    ].join(' ');
  }
  if (code === 'challenge') {
    return [
      '심화: 절, 수식어, 시간 표현, 전치사구 등으로 문장 구조를 더 길고 까다롭게 만든다.',
      '한 문장에 핵심 문법 포인트와 보조 포인트를 함께 넣을 수 있다.',
      '형태 변형과 누락 기능어를 헷갈리기 쉽게 설계하되 정답은 명확해야 한다.',
      'wrong/baseSentence/tip은 학생이 왜 틀리는지 드러나게 만든다.',
    ].join(' ');
  }
  return [
    '표준: 교재 수준의 자연스러운 문장으로 만든다.',
    '핵심 문법을 실제 문맥에 적용하게 한다.',
    '문장 길이와 어휘 난도는 학교 시험 대비 표준 수준으로 유지한다.',
  ].join(' ');
}

function writingWorksheetExerciseTypeInstruction(types) {
  const lines = [];
  if (types.includes('rearrange')) {
    lines.push('rearrange: 단어를 그대로 배열해 완전한 문장을 만들 수 있는 sentence를 만든다.');
  }
  if (types.includes('rearrangeTransform')) {
    lines.push('rearrangeTransform: 일부 단어의 시제, 수, 품사, 동사 형태를 바꿔야 정답이 되도록 sentence와 wrong을 만든다.');
  }
  if (types.includes('rearrangeAdd')) {
    lines.push('rearrangeAdd: 관사, 전치사, 조동사, be동사, 접속사 같은 기능어 1개를 추가해야 정답이 되도록 sentence를 만든다.');
  }
  if (types.includes('rearrangeTransformAdd')) {
    lines.push('rearrangeTransformAdd: 단어 형태 변형과 기능어 추가가 모두 필요하도록 sentence를 만든다.');
  }
  return lines.length ? lines.join(' ') : 'rearrange: 단어를 그대로 배열해 완전한 문장을 만들 수 있는 sentence를 만든다.';
}

function parseOpenAIJsonObject(text) {
  const source = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(source);
  } catch (error) {
    const first = source.indexOf('{');
    const last = source.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(source.slice(first, last + 1));
    }
    throw error;
  }
}

function normalizeWritingWorksheetSentences(raw, limit) {
  const source = raw && Array.isArray(raw.sentences) ? raw.sentences : [];
  const result = [];
  const seen = new Set();
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const english = sanitizeWritingWorksheetText(item.english, 240);
    const korean = sanitizeWritingWorksheetText(item.korean, 240);
    if (!english || !korean) continue;
    const key = `${english.toLowerCase()}|${korean}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      english,
      korean,
      wrong: sanitizeWritingWorksheetText(item.wrong, 240) || english,
      baseSentence: sanitizeWritingWorksheetText(item.baseSentence, 180) || english,
      expansionCondition: sanitizeWritingWorksheetText(item.expansionCondition, 200) ||
        '?? ??? ??? ??? ? ???? ????',
      tip: sanitizeWritingWorksheetText(item.tip, 240) || '?? ??? ?? ??? ?????.',
    });
    if (result.length >= limit) break;
  }
  return result;
}

function extractOpenAIResponseText(data) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const chunks = [];
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = item && Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string') chunks.push(part.text);
      if (typeof part.output_text === 'string') chunks.push(part.output_text);
    }
  }
  return chunks.join('\n').trim();
}

function normalizeStatsPredictionNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(99999, Math.round(parsed)));
}

function normalizeStatsPredictionRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(2, parsed));
}

function normalizeStatsPredictionPopulation(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const elementary = normalizeStatsPredictionNumber(source.elementary);
  const middle = normalizeStatsPredictionNumber(source.middle);
  const high = normalizeStatsPredictionNumber(source.high);
  return {
    elementary,
    middle,
    high,
    total: elementary + middle + high,
  };
}

function normalizeStatsPredictionHorizon(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    title: sanitizeWritingWorksheetText(source.title, 40),
    rangeLabel: sanitizeWritingWorksheetText(source.rangeLabel, 80),
    inquiry: normalizeStatsPredictionNumber(source.inquiry),
    placement: normalizeStatsPredictionNumber(source.placement),
    newStudent: normalizeStatsPredictionNumber(source.newStudent),
    withdrawal: normalizeStatsPredictionNumber(source.withdrawal),
    netChange: Math.max(-99999, Math.min(99999, Math.round(Number(source.netChange) || 0))),
    population: normalizeStatsPredictionPopulation(source.population),
    confidence: sanitizeWritingWorksheetText(source.confidence, 20),
    confidenceDetail: sanitizeWritingWorksheetText(source.confidenceDetail, 240),
  };
}

function normalizeStatsPredictionHorizons(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map(normalizeStatsPredictionHorizon);
}

function normalizeStatsWithdrawalRiskCandidate(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const reasons = Array.isArray(source.reasons)
    ? source.reasons
        .slice(0, 4)
        .map((item) => sanitizeWritingWorksheetText(item, 120))
        .filter(Boolean)
    : [];
  return {
    studentName: sanitizeWritingWorksheetText(source.studentName, 40),
    schoolLabel: sanitizeWritingWorksheetText(source.schoolLabel, 60),
    className: sanitizeWritingWorksheetText(source.className, 80),
    teacherName: sanitizeWritingWorksheetText(source.teacherName, 40),
    score: normalizeStatsPredictionNumber(source.score),
    riskLabel: sanitizeWritingWorksheetText(source.riskLabel, 20),
    confidence: sanitizeWritingWorksheetText(source.confidence, 20),
    reasons,
  };
}

function normalizeStatsWithdrawalRiskCandidates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 8)
    .map(normalizeStatsWithdrawalRiskCandidate)
    .filter((item) => item.studentName);
}

function normalizeStatsPredictionPayload(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const rates = source.conversionRates && typeof source.conversionRates === 'object'
    ? source.conversionRates
    : {};
  return {
    fingerprint: sanitizeWritingWorksheetText(source.fingerprint, 120),
    teacher: sanitizeWritingWorksheetText(source.teacher, 40),
    algorithmVersion: normalizeStatsPredictionNumber(source.algorithmVersion, 1),
    sourceMonthCount: normalizeStatsPredictionNumber(source.sourceMonthCount),
    hasMonthOnlyInquiry: source.hasMonthOnlyInquiry === true,
    currentPopulation: normalizeStatsPredictionPopulation(source.currentPopulation),
    conversionRates: {
      placementPerInquiry: normalizeStatsPredictionRate(rates.placementPerInquiry),
      newStudentPerInquiry: normalizeStatsPredictionRate(rates.newStudentPerInquiry),
    },
    nextFourWeeks: normalizeStatsPredictionHorizon(source.nextFourWeeks),
    nextMonth: normalizeStatsPredictionHorizon(source.nextMonth),
    weeklyForecasts: normalizeStatsPredictionHorizons(source.weeklyForecasts),
    nextFourWeeksTotal: normalizeStatsPredictionHorizon(source.nextFourWeeksTotal),
    withdrawalRiskCandidates: normalizeStatsWithdrawalRiskCandidates(source.withdrawalRiskCandidates),
    notes: sanitizeWritingWorksheetText(source.notes, 500),
  };
}

function sanitizeDaeseRehearsalText(value, maxLength = 60000) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
}

const DAESE_REHEARSAL_ACTUAL_FILE_MAX_COUNT = 15;
const DAESE_REHEARSAL_ACTUAL_FILE_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const DAESE_REHEARSAL_SCOPE_PDF_MAX_BYTES = 25 * 1024 * 1024;
const DAESE_REHEARSAL_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const DAESE_REHEARSAL_FILE_MIME_TYPES = new Set(['application/pdf']);

function dataUrlParts(value) {
  const text = String(value || '').trim();
  const match = /^data:([^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/s.exec(text);
  if (!match) return null;
  const mimeType = String(match[1] || '').trim().toLowerCase();
  const base64 = String(match[2] || '').replace(/\s+/g, '');
  if (!mimeType || !base64) return null;
  return { mimeType, base64, dataUrl: `data:${mimeType};base64,${base64}` };
}

function base64ByteLength(base64) {
  const normalized = String(base64 || '').replace(/\s+/g, '');
  if (!normalized) return 0;
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function normalizeDaeseRehearsalActualFiles(raw) {
  if (!Array.isArray(raw)) return { files: [] };

  const files = [];
  let totalBytes = 0;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    if (files.length >= DAESE_REHEARSAL_ACTUAL_FILE_MAX_COUNT) {
      return {
        errorStatus: 413,
        errorMessage: 'Past-exam file upload limit is 15 files.',
      };
    }

    const parsed = dataUrlParts(item.dataUrl);
    if (!parsed) {
      return {
        errorStatus: 400,
        errorMessage: 'Past-exam files must be Base64 data URLs.',
      };
    }
    const declaredMime = sanitizeDaeseRehearsalText(item.mimeType, 80)
      .toLowerCase();
    const mimeType = declaredMime || parsed.mimeType;
    if (
      mimeType !== parsed.mimeType ||
      (!DAESE_REHEARSAL_IMAGE_MIME_TYPES.has(mimeType) &&
        !DAESE_REHEARSAL_FILE_MIME_TYPES.has(mimeType))
    ) {
      return {
        errorStatus: 400,
        errorMessage: 'Only PNG, JPEG, WEBP images and PDF files are supported.',
      };
    }

    const bytes = base64ByteLength(parsed.base64);
    totalBytes += bytes;
    if (totalBytes > DAESE_REHEARSAL_ACTUAL_FILE_MAX_TOTAL_BYTES) {
      return {
        errorStatus: 413,
        errorMessage: 'Past-exam files must be 25 MB or less in total.',
      };
    }

    const name =
      sanitizeDaeseRehearsalText(item.name, 180) ||
      (mimeType === 'application/pdf'
        ? `past-exam-${files.length + 1}.pdf`
        : `past-exam-${files.length + 1}.jpg`);
    files.push({
      name,
      mimeType,
      dataUrl: parsed.dataUrl,
      base64: parsed.base64,
      bytes,
    });
  }
  return { files };
}

function normalizeDaeseRehearsalScopePdfFile(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      errorStatus: 400,
      errorMessage: 'A middle-school textbook unit PDF file is required.',
    };
  }

  const parsed = dataUrlParts(raw.dataUrl);
  if (!parsed) {
    return {
      errorStatus: 400,
      errorMessage: 'The textbook unit PDF must be a Base64 data URL.',
    };
  }
  const declaredMime = sanitizeDaeseRehearsalText(raw.mimeType, 80)
    .toLowerCase();
  const mimeType = declaredMime || parsed.mimeType;
  if (mimeType !== 'application/pdf' || parsed.mimeType !== 'application/pdf') {
    return {
      errorStatus: 400,
      errorMessage: 'Only PDF files are supported for textbook unit analysis.',
    };
  }

  const bytes = base64ByteLength(parsed.base64);
  if (bytes <= 0 || bytes > DAESE_REHEARSAL_SCOPE_PDF_MAX_BYTES) {
    return {
      errorStatus: 413,
      errorMessage: 'The textbook unit PDF must be 25 MB or less.',
    };
  }

  return {
    file: {
      name:
        sanitizeDaeseRehearsalText(raw.name, 180) ||
        'middle-school-textbook-unit.pdf',
      mimeType,
      dataUrl: parsed.dataUrl,
      base64: parsed.base64,
      bytes,
    },
  };
}

function daeseRehearsalFileInputContent(files) {
  const result = [];
  for (const file of files) {
    if (DAESE_REHEARSAL_IMAGE_MIME_TYPES.has(file.mimeType)) {
      result.push({
        type: 'input_image',
        image_url: file.dataUrl,
        detail: 'high',
      });
    } else if (file.mimeType === 'application/pdf') {
      result.push({
        type: 'input_file',
        filename: file.name,
        file_data: file.dataUrl,
      });
    }
  }
  return result;
}

function normalizeDaeseRehearsalList(value, maxItems = 10, maxLength = 500) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\n+/);
  const result = [];
  for (const item of source) {
    const text = sanitizeDaeseRehearsalText(item, maxLength).replace(/\s+/g, ' ');
    if (!text) continue;
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

const DAESE_REHEARSAL_ANALYSIS_KEYS = [
  'passageSelection',
  'transformationPatterns',
  'preferredQuestionTypes',
  'intentPatterns',
  'distractorPatterns',
  'studentTrapPatterns',
  'answerEvidencePatterns',
  'passagePositionPatterns',
  'choiceDesignPatterns',
  'subjectivePatterns',
  'scopeBlendingPatterns',
  'difficultyPatterns',
  'teacherHabits',
  'lowPriorityPatterns',
  'nextScopeRules',
  'confidenceNotes',
];

const DAESE_REHEARSAL_ANALYSIS_LABELS = {
  passageSelection: '출제된 지문/문장 선택 기준',
  transformationPatterns: '변형된 문장이나 표현과 변형 방식',
  preferredQuestionTypes: '선호 문제 유형',
  intentPatterns: '출제 의도',
  distractorPatterns: '오답 선택지 제작 방식',
  studentTrapPatterns: '학생 실수 유도 포인트',
  answerEvidencePatterns: '정답 근거 위치와 근거 거리',
  passagePositionPatterns: '지문 내 출제 위치 패턴',
  choiceDesignPatterns: '보기 구성 방식',
  subjectivePatterns: '서술형 출제 방식',
  scopeBlendingPatterns: '교과서/부교재/여러 지문 결합 방식',
  difficultyPatterns: '난이도 조절 방식',
  teacherHabits: '반복되는 선생님 특유의 출제 습관',
  lowPriorityPatterns: '출제 제외 또는 낮은 우선순위 경향',
  nextScopeRules: '다음 시험범위에 적용할 출제 예측 규칙',
  confidenceNotes: '분석 신뢰도와 근거 부족 항목',
};

const DAESE_REHEARSAL_SCOPE_ANALYSIS_KEYS = [
  'unitOverview',
  'passages',
  'dialogues',
  'grammarPoints',
  'vocabulary',
  'keyExpressions',
  'keySentences',
  'examPointCandidates',
  'questionGenerationRules',
  'confidenceNotes',
];

function normalizeDaeseRehearsalAnalysis(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const key of DAESE_REHEARSAL_ANALYSIS_KEYS) {
    result[key] = normalizeDaeseRehearsalList(source[key], 12, 900);
  }
  return result;
}

function hasDaeseRehearsalAnalysis(value) {
  const analysis = normalizeDaeseRehearsalAnalysis(value);
  return DAESE_REHEARSAL_ANALYSIS_KEYS.some((key) => analysis[key].length > 0);
}

function normalizeDaeseRehearsalScopeAnalysis(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const key of DAESE_REHEARSAL_SCOPE_ANALYSIS_KEYS) {
    result[key] = normalizeDaeseRehearsalList(source[key], 18, 900);
  }
  return result;
}

function hasDaeseRehearsalScopeAnalysis(value) {
  const analysis = normalizeDaeseRehearsalScopeAnalysis(value);
  return DAESE_REHEARSAL_SCOPE_ANALYSIS_KEYS.some((key) => analysis[key].length > 0);
}

function formatDaeseRehearsalAnalysis(value) {
  const analysis = normalizeDaeseRehearsalAnalysis(value);
  const lines = [];
  for (const key of DAESE_REHEARSAL_ANALYSIS_KEYS) {
    const items = analysis[key];
    if (!items.length) continue;
    lines.push(`${DAESE_REHEARSAL_ANALYSIS_LABELS[key] || key}:`);
    for (const item of items) {
      lines.push(`- ${item}`);
    }
  }
  return lines.length ? lines.join('\n') : 'No stored past-exam analysis was supplied.';
}

function normalizeDaeseRehearsalExamples(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const semester = sanitizeDaeseRehearsalText(item.semester || item.term, 80);
    const examType = sanitizeDaeseRehearsalText(item.examType || item.examName, 120);
    const example = {
      year: sanitizeDaeseRehearsalText(item.year, 20),
      school: sanitizeDaeseRehearsalText(item.school, 80),
      grade: sanitizeDaeseRehearsalText(item.grade, 40),
      semester,
      examType,
      term: sanitizeDaeseRehearsalText(item.term || semester, 80),
      examName: sanitizeDaeseRehearsalText(item.examName || examType, 120),
      scopeText: sanitizeDaeseRehearsalText(item.scopeText, 12000),
      actualQuestions: sanitizeDaeseRehearsalText(item.actualQuestions, 20000),
      actualAnswers: sanitizeDaeseRehearsalText(item.actualAnswers, 12000),
      analysis: normalizeDaeseRehearsalAnalysis(item.analysis),
    };
    if (!example.scopeText || (!example.actualQuestions && !hasDaeseRehearsalAnalysis(example.analysis))) continue;
    result.push(example);
    if (result.length >= 8) break;
  }
  return result;
}

function normalizeDaeseRehearsalChoiceText(value) {
  let text = sanitizeDaeseRehearsalText(value, 500).replace(/\s+/g, ' ').trim();
  text = text.replace(/^\s*(?:\d+[\.)]|\(\d+\)|\[\d+\])\s*/, '').trim();
  if (text.length > 0) {
    const first = text.codePointAt(0);
    if (first >= 0x2460 && first <= 0x2473) {
      text = text.slice(String.fromCodePoint(first).length).trimStart();
    }
  }
  while (text.endsWith('.') && !/(?:[A-Za-z]\.){2,}$/.test(text) && !/\b(?:Mr|Mrs|Ms|Dr|Prof|St|No|vs)\.$/.test(text)) {
    text = text.slice(0, -1).trimEnd();
  }
  return text;
}

function normalizeDaeseRehearsalKoreanPrompt(value) {
  const text = sanitizeDaeseRehearsalText(value, 1200).replace(/\s+/g, ' ').trim();
  if (!text) return text;
  if (/[?-?]/.test(text)) return text;
  const lower = text.toLowerCase();
  if (/what is the main (point|idea|topic|focus)|main point|main idea|main topic/.test(lower)) {
    return '?? ?? ??? ?? ??? ???';
  }
  if (/underlined reference.*different|different.*referent/.test(lower)) {
    return '?? ? ?? ? ???? ??? ???? ?? ???';
  }
  if (/grammatically incorrect|underlined part.*incorrect/.test(lower)) {
    return '?? ? ?? ? ??? ?? ???';
  }
  if (/used incorrectly in context|underlined word.*incorrect/.test(lower)) {
    return '?? ? ??? ??? ??? ???? ?? ???';
  }
  if (/complete.*sentence|best completes/.test(lower)) {
    return '??? ??? ?? ?? ??? ???';
  }
  if (/most likely mean|meaning of the underlined/.test(lower)) {
    return '?? ? ??? ??? ?? ??? ???';
  }
  if (/correct order|order of the following/.test(lower)) {
    return '??? ???? ?? ??? ?? ??? ???';
  }
  if (/unrelated to the overall flow|unrelated sentence/.test(lower)) {
    return '?? ??? ???? ????';
  }
  if (/where does the sentence|fit best/.test(lower)) {
    return '??? ??? ??? ??? ?? ??? ???';
  }
  return text;
}



function normalizeDaeseRehearsalObjectiveQuestions(raw, count) {
  const source = Array.isArray(raw) ? raw : [];
  const result = [];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const choices = normalizeDaeseRehearsalList(item.choices, 8, 500)
      .map(normalizeDaeseRehearsalChoiceText)
      .filter(Boolean);
    const question = normalizeDaeseRehearsalKoreanPrompt(item.question);
    if (!question || choices.length < 2) continue;
    const number = Number.parseInt(String(item.number || result.length + 1), 10) || result.length + 1;
    const answerIndexRaw = Number.parseInt(String(item.answerIndex || '1'), 10);
    const answerIndex = Math.min(Math.max(answerIndexRaw || 1, 1), choices.length);
    result.push({
      number,
      passage: sanitizeDaeseRehearsalText(item.passage, 5000),
      question,
      choices,
      answerIndex,
      answer: normalizeDaeseRehearsalChoiceText(item.answer) || choices[answerIndex - 1],
      explanation: sanitizeDaeseRehearsalText(item.explanation, 1600),
      sourceHint: sanitizeDaeseRehearsalText(item.sourceHint, 300),
    });
    if (result.length >= count) break;
  }
  return result;
}


function normalizeDaeseRehearsalSubjectiveQuestions(raw, count, offset) {
  const source = Array.isArray(raw) ? raw : [];
  const result = [];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const prompt = normalizeDaeseRehearsalKoreanPrompt(item.prompt);
    const answer = sanitizeDaeseRehearsalText(item.answer, 1600);
    if (!prompt || !answer) continue;
    const number = Number.parseInt(String(item.number || offset + result.length + 1), 10) || offset + result.length + 1;
    result.push({
      number,
      prompt,
      answer,
      explanation: sanitizeDaeseRehearsalText(item.explanation, 1600),
      scoringGuide: sanitizeDaeseRehearsalText(item.scoringGuide, 1600),
      sourceHint: sanitizeDaeseRehearsalText(item.sourceHint, 300),
    });
    if (result.length >= count) break;
  }
  return result;
}

function normalizeDaeseRehearsalGeneratedExam(parsed, payload) {
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const objectiveQuestions = normalizeDaeseRehearsalObjectiveQuestions(
    source.objectiveQuestions,
    payload.objectiveCount
  );
  const subjectiveQuestions = normalizeDaeseRehearsalSubjectiveQuestions(
    source.subjectiveQuestions,
    payload.subjectiveCount,
    objectiveQuestions.length
  );
  if (objectiveQuestions.length !== payload.objectiveCount || subjectiveQuestions.length !== payload.subjectiveCount) {
    return null;
  }
  const generatedAnswerKey = [
    ...objectiveQuestions.map((question) => ({
      number: question.number,
      answer: question.answer,
      explanation: question.explanation,
    })),
    ...subjectiveQuestions.map((question) => ({
      number: question.number,
      answer: question.answer,
      explanation: question.explanation || question.scoringGuide,
    })),
  ];
  const rawAnswerKey = Array.isArray(source.answerKey) ? source.answerKey : [];
  const answerKey = rawAnswerKey.length
    ? rawAnswerKey.map((item, index) => ({
        number: Number.parseInt(String(item && item.number || index + 1), 10) || index + 1,
        answer: sanitizeDaeseRehearsalText(item && item.answer, 1200),
        explanation: sanitizeDaeseRehearsalText(item && item.explanation, 1600),
      })).filter((item) => item.answer)
    : generatedAnswerKey;
  return {
    title: sanitizeDaeseRehearsalText(source.title, 180) || `${payload.school} Rehearsal Exam`,
    subtitle: sanitizeDaeseRehearsalText(source.subtitle, 240) || [payload.year, payload.grade, payload.semester || payload.term, payload.examType || payload.examName, payload.rehearsalRound].filter(Boolean).join(' / '),
    trendSummary: normalizeDaeseRehearsalList(source.trendSummary, 8, 500),
    qualityChecks: normalizeDaeseRehearsalList(source.qualityChecks, 8, 500),
    objectiveQuestions,
    subjectiveQuestions,
    answerKey: answerKey.length ? answerKey : generatedAnswerKey,
  };
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


function buildReferralDiscountMessage(payload) {
  const student = [
    payload.school || '',
    payload.grade || '',
    payload.name || '',
  ].filter(Boolean).join(' / ') || '미입력';
  return [
    '[소개 할인 신규생 등록]',
    `등록자: ${payload.createdBy || '미입력'}`,
    `신규 등원일: ${payload.date || '미입력'}`,
    `학생: ${student}`,
    `반명: ${payload.className || '미입력'}`,
    `소개 할인: ${payload.referralDiscount || '미입력'}`,
  ].join('\n');
}

async function sendReferralDiscountKakaoWorkMessageByEmail({ email, text }) {
  if (!KAKAOWORK_REFERRAL_APP_KEY) {
    throw new Error('KAKAOWORK_REFERRAL_APP_KEY_MISSING');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(KAKAOWORK_MESSAGES_SEND_BY_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KAKAOWORK_REFERRAL_APP_KEY}`,
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


function buildStudentIdentity(payload) {
  return [
    payload.school || '',
    payload.grade || '',
    payload.name || '',
  ].filter(Boolean).join(' / ') || '미입력';
}

function buildNewStudentNotificationMessage(payload) {
  const lines = [
    '[신규생 등록]',
    `등록자: ${payload.createdBy || '미입력'}`,
    `신규 등원일: ${payload.date || '미입력'}`,
    `학생: ${buildStudentIdentity(payload)}`,
    `반명: ${payload.className || '미입력'}`,
  ];
  if (payload.studentPhone) {
    lines.push(`학생 핸드폰 번호: ${payload.studentPhone}`);
  }
  if (payload.parentPhone) {
    lines.push(`학부모 핸드폰 번호: ${payload.parentPhone}`);
  }
  if (payload.referralDiscount) {
    lines.push(`소개 할인: ${payload.referralDiscount}`);
  }
  lines.push('중심업무에 수강료를 등록해주세요');
  return lines.join('\n');
}

function buildWithdrawalNotificationMessage(payload) {
  const lines = [
    '[퇴원 요청]',
    `요청자: ${payload.createdBy || '미입력'}`,
    `퇴원 요청일: ${payload.date || '미입력'}`,
    `학생: ${buildStudentIdentity(payload)}`,
    `반명: ${payload.className || '미입력'}`,
  ];
  if (payload.consultation) {
    lines.push(`퇴원 상담 내용: ${payload.consultation}`);
  }
  lines.push('중심업무에서 퇴원 처리를 해주세요');
  return lines.join('\n');
}

async function sendStudentMovementKakaoWorkMessageByEmail({
  appKey,
  missingCode,
  email,
  text,
}) {
  if (!appKey) {
    throw new Error(missingCode);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(KAKAOWORK_MESSAGES_SEND_BY_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appKey}`,
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

function normalizeClassMoveNotificationStudents(value) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 80).map((student) => ({
    name: sanitizeSupplyRequestText(student && student.name, 80),
    school: sanitizeSupplyRequestText(student && student.school, 80),
    memo: sanitizeSupplyRequestText(student && student.memo, 200),
  })).filter((student) => student.name);
}

function buildClassMoveNotificationMessage(payload) {
  const students = payload.students.length > 0
    ? payload.students.map((student) => {
        const school = student.school ? `(${student.school})` : '';
        const memo = student.memo ? ` / ${student.memo}` : '';
        return `- ${student.name}${school}${memo}`;
      })
    : ['- 미입력'];

  return [
    '[반 이동]',
    '반 이동 결과를 어플에 반영해주세요',
    `처리자: ${payload.movedBy || '미입력'}`,
    `처리 시각: ${payload.movedAt || '미입력'}`,
    `이전 반: ${payload.sourceClassName || payload.sourceClassHeader || '미입력'}`,
    `이동 반: ${payload.targetClassName || payload.targetClassHeader || '미입력'}`,
    '',
    '학생',
    ...students,
  ].join('\n');
}

async function sendClassMoveKakaoWorkMessageByEmail({ email, text }) {
  if (!KAKAOWORK_CLASS_MOVE_APP_KEY) {
    throw new Error('KAKAOWORK_CLASS_MOVE_APP_KEY_MISSING');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(KAKAOWORK_MESSAGES_SEND_BY_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KAKAOWORK_CLASS_MOVE_APP_KEY}`,
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
const KOREAN_WEEKDAY_LABELS = ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'];

function formatReservationNoticeDate(dateStr) {
  const date = String(dateStr || '').trim();
  if (!isValidDate(date)) return date;
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${date} ${KOREAN_WEEKDAY_LABELS[weekday]}`;
}

function addMonthsClamped(dateStr, amount) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + amount, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

function compareDateKeys(left, right) {
  return String(left || '').localeCompare(String(right || ''));
}

function isoDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  return day === 0 ? 7 : day;
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

function canDeleteClinicDictationAttempt(name) {
  return String(name || '').trim() === '스텐';
}

function isValidDashboardStorageKey(key) {
  const normalized = String(key || '').trim();
  return (
    DASHBOARD_STORAGE_KEYS.has(normalized) ||
    DASHBOARD_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function isValidDashboardStorageJsonText(jsonText) {
  const text = String(jsonText || '').trim() || '{}';
  try {
    JSON.parse(text);
    return true;
  } catch (_) {
    // The dashboard stores UTF-8 JSON as Base64 to avoid charset loss.
  }

  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8');
    if (!decoded || decoded.includes('\uFFFD')) {
      return false;
    }
    JSON.parse(decoded);
    return true;
  } catch (_) {
    return false;
  }
}

function dashboardStorageJsonToObject(jsonText) {
  const text = String(jsonText || '').trim() || '{}';
  const parseObject = (raw) => {
    const parsed = JSON.parse(String(raw || '').trim() || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  };

  try {
    const parsed = parseObject(text);
    if (
      parsed.__encoding === 'base64:utf8-json' &&
      typeof parsed.payload === 'string'
    ) {
      const decoded = Buffer.from(parsed.payload.trim(), 'base64').toString('utf8');
      if (!decoded.includes('\uFFFD')) {
        return parseObject(decoded);
      }
    }
    return parsed;
  } catch (_) {
    // The dashboard may store UTF-8 JSON as plain Base64.
  }

  const decoded = Buffer.from(text, 'base64').toString('utf8');
  if (!decoded || decoded.includes('\uFFFD')) {
    throw new Error('INVALID_DASHBOARD_STORAGE_JSON');
  }
  return parseObject(decoded);
}

function dashboardStorageObjectToBase64(value) {
  const payload = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function currentKoreaDateKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function normalizeRosterActiveStatusReservation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const targetIsActive = value.targetIsActive;
  const effectiveDate = String(value.effectiveDate || '').trim();
  if (
    typeof targetIsActive !== 'boolean' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
  ) {
    return null;
  }
  return { targetIsActive, effectiveDate };
}

function normalizeClinicTableStatusReservation(value, fallbackClassKey = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const targetIsActive = value.targetIsActive;
  const classKey = String(value.classKey || fallbackClassKey || '').trim();
  const legacyClassKey = String(value.legacyClassKey || '').trim();
  const effectiveDate = String(value.effectiveDate || '').trim();
  if (
    typeof targetIsActive !== 'boolean' ||
    !classKey ||
    !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)
  ) {
    return null;
  }
  return { classKey, legacyClassKey, targetIsActive, effectiveDate };
}

function applyDueRosterActiveStatusReservationsToPreferences(
  preferences,
  todayKey = currentKoreaDateKey()
) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return 0;
  }
  const rosterClasses = preferences[STUDENT_ROSTER_EDITS_PREFERENCE_KEY];
  if (!Array.isArray(rosterClasses)) {
    return 0;
  }

  let appliedCount = 0;
  const nextRosterClasses = rosterClasses.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return entry;
    }
    const reservation = normalizeRosterActiveStatusReservation(
      entry.activeStatusReservation
    );
    if (!reservation || reservation.effectiveDate > todayKey) {
      return entry;
    }
    const nextEntry = {
      ...entry,
      isActive: reservation.targetIsActive,
    };
    delete nextEntry.activeStatusReservation;
    appliedCount += 1;
    return nextEntry;
  });

  if (appliedCount > 0) {
    preferences[STUDENT_ROSTER_EDITS_PREFERENCE_KEY] = nextRosterClasses;
  }
  return appliedCount;
}

function applyDueClinicTableStatusReservationsToPreferences(
  preferences,
  todayKey = currentKoreaDateKey()
) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return 0;
  }
  const visibility = preferences[CLINIC_TABLE_VISIBILITY_PREFERENCE_KEY];
  if (!visibility || typeof visibility !== 'object' || Array.isArray(visibility)) {
    return 0;
  }

  const rawReservations = visibility.statusReservations;
  if (!rawReservations || typeof rawReservations !== 'object' || Array.isArray(rawReservations)) {
    return 0;
  }

  const hiddenKeys = new Set();
  const rawHiddenKeys = Array.isArray(visibility.hiddenClassKeys)
    ? visibility.hiddenClassKeys
    : Array.isArray(visibility.hiddenClasses)
      ? visibility.hiddenClasses
      : [];
  for (const item of rawHiddenKeys) {
    const key = String(item || '').trim();
    if (key) hiddenKeys.add(key);
  }

  const nextReservations = {};
  let appliedCount = 0;
  for (const [fallbackClassKey, rawReservation] of Object.entries(rawReservations)) {
    const reservation = normalizeClinicTableStatusReservation(
      rawReservation,
      fallbackClassKey
    );
    if (!reservation) {
      continue;
    }
    if (reservation.effectiveDate > todayKey) {
      nextReservations[reservation.classKey] = rawReservation;
      continue;
    }

    if (reservation.targetIsActive) {
      hiddenKeys.delete(reservation.classKey);
      if (reservation.legacyClassKey) {
        hiddenKeys.delete(reservation.legacyClassKey);
      }
    } else {
      hiddenKeys.add(reservation.classKey);
    }
    appliedCount += 1;
  }

  if (appliedCount > 0) {
    visibility.hiddenClassKeys = Array.from(hiddenKeys).sort();
    delete visibility.hiddenClasses;
    if (Object.keys(nextReservations).length > 0) {
      visibility.statusReservations = nextReservations;
    } else {
      delete visibility.statusReservations;
    }
    preferences[CLINIC_TABLE_VISIBILITY_PREFERENCE_KEY] = visibility;
  }
  return appliedCount;
}

async function applyDueRosterActiveStatusReservations() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT storage_key, json_text, updated_at
         FROM dashboard_storage
        WHERE storage_key = $1
        FOR UPDATE`,
      [TEACHER_PREFERENCES_STORAGE_KEY]
    );
    const preferences = dashboardStorageJsonToObject(rows[0]?.json_text || '{}');
    const rosterAppliedCount =
      applyDueRosterActiveStatusReservationsToPreferences(preferences);
    const clinicTableAppliedCount =
      applyDueClinicTableStatusReservationsToPreferences(preferences);
    const appliedCount = rosterAppliedCount + clinicTableAppliedCount;

    if (appliedCount > 0) {
      const nextJsonText = dashboardStorageObjectToBase64(preferences);
      await client.query(
        `INSERT INTO dashboard_storage (storage_key, json_text, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (storage_key)
         DO UPDATE SET json_text = EXCLUDED.json_text,
                       updated_at = NOW()`,
        [TEACHER_PREFERENCES_STORAGE_KEY, nextJsonText]
      );
    }

    await client.query('COMMIT');
    if (appliedCount > 0) {
      console.log(
        `반/클리닉표 활성 상태 예약 ${appliedCount}건을 적용했습니다. ` +
        `(인원명단 ${rosterAppliedCount}건, 클리닉표 ${clinicTableAppliedCount}건)`
      );
    }
    return appliedCount;
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }
    console.error('인원명단 반 활성 상태 예약 적용 실패:', error);
    return 0;
  } finally {
    if (client) {
      client.release();
    }
  }
}

function normalizeAttendanceRecordsByDate(value) {
  const records = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return records;
  }

  for (const [dateKeyRaw, rawDailyRecords] of Object.entries(value)) {
    const dateKey = String(dateKeyRaw || '').trim();
    if (!dateKey || !rawDailyRecords || typeof rawDailyRecords !== 'object' || Array.isArray(rawDailyRecords)) {
      continue;
    }
    const dailyRecords = {};
    for (const [recordKeyRaw, statusRaw] of Object.entries(rawDailyRecords)) {
      const recordKey = String(recordKeyRaw || '').trim();
      const status = String(statusRaw || '').trim();
      if (recordKey && ATTENDANCE_STATUS_NAMES.has(status)) {
        dailyRecords[recordKey] = status;
      }
    }
    if (Object.keys(dailyRecords).length > 0) {
      records[dateKey] = dailyRecords;
    }
  }
  return records;
}

function normalizeAttendanceTextRecordsByDate(value) {
  const records = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return records;
  }

  for (const [dateKeyRaw, rawDailyRecords] of Object.entries(value)) {
    const dateKey = String(dateKeyRaw || '').trim();
    if (!dateKey || !rawDailyRecords || typeof rawDailyRecords !== 'object' || Array.isArray(rawDailyRecords)) {
      continue;
    }
    const dailyRecords = {};
    for (const [recordKeyRaw, textRaw] of Object.entries(rawDailyRecords)) {
      const recordKey = String(recordKeyRaw || '').trim();
      const text = String(textRaw || '').trim();
      if (recordKey && text) {
        dailyRecords[recordKey] = text;
      }
    }
    if (Object.keys(dailyRecords).length > 0) {
      records[dateKey] = dailyRecords;
    }
  }
  return records;
}

function normalizeAttendanceHomeworkMissingRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const categories = [];
  const rawCategories = Array.isArray(value.categories) ? value.categories : [];
  for (const categoryRaw of rawCategories) {
    const category = String(categoryRaw || '').trim();
    if (ATTENDANCE_HOMEWORK_CATEGORY_NAMES.has(category) && !categories.includes(category)) {
      categories.push(category);
    }
  }
  const otherText = String(value.otherText || '').trim().slice(0, 1000);
  if (otherText && !categories.includes('other')) {
    categories.push('other');
  }
  return { categories, otherText };
}

function normalizeAttendanceHomeworkMissingByDate(value) {
  const records = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return records;
  }

  for (const [dateKeyRaw, rawDailyRecords] of Object.entries(value)) {
    const dateKey = String(dateKeyRaw || '').trim();
    if (!dateKey || !rawDailyRecords || typeof rawDailyRecords !== 'object' || Array.isArray(rawDailyRecords)) {
      continue;
    }
    const dailyRecords = {};
    for (const [recordKeyRaw, rawHomeworkMissing] of Object.entries(rawDailyRecords)) {
      const recordKey = String(recordKeyRaw || '').trim();
      const homeworkMissing = normalizeAttendanceHomeworkMissingRecord(rawHomeworkMissing);
      if (recordKey && homeworkMissing) {
        dailyRecords[recordKey] = homeworkMissing;
      }
    }
    if (Object.keys(dailyRecords).length > 0) {
      records[dateKey] = dailyRecords;
    }
  }
  return records;
}

function normalizeAttendanceMutations(body) {
  const dateKey = String(body?.dateKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const error = new Error('INVALID_ATTENDANCE_DATE');
    error.statusCode = 400;
    throw error;
  }

  const rawChanges = Array.isArray(body?.changes) ? body.changes : [];
  if (rawChanges.length === 0 || rawChanges.length > 300) {
    const error = new Error('INVALID_ATTENDANCE_CHANGES');
    error.statusCode = 400;
    throw error;
  }

  const changes = rawChanges.map((change) => {
    const recordKey = String(change?.recordKey || '').trim();
    if (!recordKey || recordKey.length > 500) {
      const error = new Error('INVALID_ATTENDANCE_RECORD_KEY');
      error.statusCode = 400;
      throw error;
    }

    const rawStatus = change?.status;
    const status = rawStatus == null || String(rawStatus).trim().isEmpty
      ? null
      : String(rawStatus).trim();
    if (status !== null && !ATTENDANCE_STATUS_NAMES.has(status)) {
      const error = new Error('INVALID_ATTENDANCE_STATUS');
      error.statusCode = 400;
      throw error;
    }
    const homeworkMissingProvided = Object.prototype.hasOwnProperty.call(
      change || {},
      'homeworkMissing'
    );
    const homeworkMissing = homeworkMissingProvided
      ? normalizeAttendanceHomeworkMissingRecord(change.homeworkMissing)
      : null;

    return {
      recordKey,
      status,
      absenceReason: String(change?.absenceReason || '').trim().slice(0, 1000),
      homeworkMissingProvided,
      homeworkMissing,
    };
  });

  return { dateKey, changes };
}

function applyAttendanceMutations(preferences, dateKey, changes) {
  const attendanceRecords = normalizeAttendanceRecordsByDate(
    preferences[ATTENDANCE_RECORDS_PREFERENCE_KEY]
  );
  const absenceReasons = normalizeAttendanceTextRecordsByDate(
    preferences[ATTENDANCE_ABSENCE_REASONS_PREFERENCE_KEY]
  );
  const homeworkMissing = normalizeAttendanceHomeworkMissingByDate(
    preferences[ATTENDANCE_HOMEWORK_MISSING_PREFERENCE_KEY]
  );
  const dailyRecords = { ...(attendanceRecords[dateKey] || {}) };
  const dailyReasons = { ...(absenceReasons[dateKey] || {}) };
  const dailyHomeworkMissing = { ...(homeworkMissing[dateKey] || {}) };

  for (const change of changes) {
    if (change.status === null) {
      delete dailyRecords[change.recordKey];
      delete dailyReasons[change.recordKey];
      delete dailyHomeworkMissing[change.recordKey];
      continue;
    }

    dailyRecords[change.recordKey] = change.status;
    if (change.status === 'absent' && change.absenceReason) {
      dailyReasons[change.recordKey] = change.absenceReason;
    } else {
      delete dailyReasons[change.recordKey];
    }
    if (change.status === 'absent') {
      delete dailyHomeworkMissing[change.recordKey];
    } else if (change.homeworkMissingProvided) {
      if (change.homeworkMissing) {
        dailyHomeworkMissing[change.recordKey] = change.homeworkMissing;
      } else {
        delete dailyHomeworkMissing[change.recordKey];
      }
    }
  }

  for (const [recordKey, reason] of Object.entries({ ...dailyReasons })) {
    if (dailyRecords[recordKey] !== 'absent' || !String(reason || '').trim()) {
      delete dailyReasons[recordKey];
    }
  }
  for (const [recordKey, homework] of Object.entries({ ...dailyHomeworkMissing })) {
    if (
      !['present', 'late'].includes(dailyRecords[recordKey]) ||
      !normalizeAttendanceHomeworkMissingRecord(homework)
    ) {
      delete dailyHomeworkMissing[recordKey];
    }
  }

  if (Object.keys(dailyRecords).length > 0) {
    attendanceRecords[dateKey] = dailyRecords;
  } else {
    delete attendanceRecords[dateKey];
  }
  if (Object.keys(dailyReasons).length > 0) {
    absenceReasons[dateKey] = dailyReasons;
  } else {
    delete absenceReasons[dateKey];
  }
  if (Object.keys(dailyHomeworkMissing).length > 0) {
    homeworkMissing[dateKey] = dailyHomeworkMissing;
  } else {
    delete homeworkMissing[dateKey];
  }

  preferences[ATTENDANCE_RECORDS_PREFERENCE_KEY] = attendanceRecords;
  preferences[ATTENDANCE_ABSENCE_REASONS_PREFERENCE_KEY] = absenceReasons;
  preferences[ATTENDANCE_HOMEWORK_MISSING_PREFERENCE_KEY] = homeworkMissing;
  return {
    records: attendanceRecords[dateKey] || {},
    absenceReasons: absenceReasons[dateKey] || {},
    homeworkMissing: homeworkMissing[dateKey] || {},
  };
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

function normalizeTodoRepeat(raw, dueDate) {
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, cycle: '', endDate: '' };
  }

  const enabled = raw.enabled === true || String(raw.enabled || '').toLowerCase() === 'true';
  if (!enabled) {
    return { enabled: false, cycle: '', endDate: '' };
  }

  const cycle = String(raw.cycle || '').trim();
  const endDate = String(raw.endDate || '').trim();
  if (!TODO_REPEAT_CYCLES.has(cycle)) {
    throw new Error('TODO_REPEAT_CYCLE_INVALID');
  }
  if (!isValidDate(endDate) || compareDateKeys(endDate, dueDate) < 0) {
    throw new Error('TODO_REPEAT_END_DATE_INVALID');
  }

  return { enabled: true, cycle, endDate };
}

function todoRepeatDueDates(dueDate, repeat) {
  if (!repeat || !repeat.enabled) {
    return [dueDate];
  }

  const dates = [];
  let current = dueDate;
  while (compareDateKeys(current, repeat.endDate) <= 0) {
    if (repeat.cycle !== 'weekdays' || isoDayOfWeek(current) <= 5) {
      dates.push(current);
    }
    if (dates.length > TODO_REPEAT_MAX_OCCURRENCES) {
      throw new Error('TODO_REPEAT_TOO_MANY');
    }

    if (repeat.cycle === 'weekly') {
      current = addDays(current, 7);
    } else if (repeat.cycle === 'monthly') {
      current = addMonthsClamped(current, 1);
    } else {
      current = addDays(current, 1);
    }
  }

  return dates.length ? dates : [dueDate];
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
  if (dates.length <= 1) return formatReservationNoticeDate(dates[0] || fallbackDate);
  return `${formatReservationNoticeDate(dates[0])} ~ ${formatReservationNoticeDate(dates[dates.length - 1])} (${dates.length}\uD68C \uBC18\uBCF5)`;
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

function normalizeClinicDictationGrade(raw) {
  const grade = normalizeClinicListeningGrade(raw);
  if (!grade) return '';
  if (!CLINIC_DICTATION_NORMALIZE_HWAMOK_GRADE) return grade;
  return CLINIC_DICTATION_GRADE_ALIASES.get(grade) || grade;
}

function normalizeClinicListeningDayNumber(raw) {
  const value = Number(String(raw || '').replace(/[^\d]/g, ''));
  return Number.isInteger(value) && value >= 1 && value <= 60 ? value : 0;
}

function normalizeClinicListeningAnswers(raw) {
  const source = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  return (source.match(/\d/g) || []).join(',');
}

function normalizeClinicStudentText(raw, max = 120) {
  return String(raw || '').trim().slice(0, max);
}

function normalizeClinicPhone(raw) {
  return String(raw || '').replace(/[^\d+]/g, '').trim().slice(0, 40);
}

function normalizePositiveInteger(raw, min, max) {
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : 0;
}

function normalizeWrongAnswerNumbers(raw) {
  const source = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  return (source.match(/\d+/g) || [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 300)
    .join(',');
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

function clinicDictationAttemptPublic(row) {
  const wrongAnswers = String(row.wrong_answers || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  const dictationRequired = Boolean(row.dictation_required);
  const dictationSubmitted = Boolean(row.dictation_submitted);
  const imageUrls = Array.isArray(row.dictation_image_urls)
    ? row.dictation_image_urls.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const imageNames = Array.isArray(row.dictation_image_names)
    ? row.dictation_image_names.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const fallbackImageUrl = String(row.dictation_image_url || '').trim();
  const fallbackImageName = String(row.dictation_image_name || '').trim();
  if (!imageUrls.length && fallbackImageUrl) {
    imageUrls.push(fallbackImageUrl);
  }
  if (!imageNames.length && fallbackImageName) {
    imageNames.push(fallbackImageName);
  }
  return {
    id: row.id,
    phone: row.phone,
    name: row.student_name || '',
    className: row.class_name || '',
    grade: row.grade,
    day: `Day ${row.day_number}`,
    dayNumber: Number(row.day_number || 0),
    totalCount: Number(row.total_count || 0),
    correctCount: Number(row.correct_count || 0),
    wrongAnswers,
    dictationRequired,
    dictationSubmitted,
    status: !dictationRequired ? 'perfect' : dictationSubmitted ? 'submitted' : 'pending',
    imageUrl: imageUrls[0] || '',
    imageName: imageNames[0] || '',
    imageUrls,
    imageNames,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    submittedAt: row.submitted_at || null,
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

function dictationFileExtensionFromMime(mime, fallbackName) {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('heic')) return '.heic';
  if (normalized.includes('heif')) return '.heif';
  const ext = path.extname(String(fallbackName || '')).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12);
  return ext || '.jpg';
}

async function saveClinicDictationUpload(req, rawFile) {
  if (!rawFile || typeof rawFile !== 'object') {
    throw new Error('DICTATION_FILE_INVALID');
  }
  const dataUrl = String(rawFile.dataUrl || '').trim();
  const match = /^data:([^;,]+)?;base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new Error('DICTATION_FILE_INVALID');
  }

  const mime = String(match[1] || '').toLowerCase();
  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(mime)) {
    throw new Error('DICTATION_FILE_INVALID');
  }

  const buffer = Buffer.from(match[2], 'base64');
  const declaredSize = Number(rawFile.size || 0);
  if (
    !buffer.length ||
    buffer.length > CLINIC_DICTATION_UPLOAD_MAX_BYTES ||
    (Number.isFinite(declaredSize) && declaredSize > 0 && declaredSize > CLINIC_DICTATION_UPLOAD_MAX_BYTES)
  ) {
    throw new Error('DICTATION_FILE_TOO_LARGE');
  }

  await fs.promises.mkdir(CLINIC_DICTATION_UPLOAD_DIR, { recursive: true });
  const originalName = sanitizeUploadFileName(rawFile.name || 'dictation-homework.jpg');
  const ext = dictationFileExtensionFromMime(mime, originalName);
  const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(CLINIC_DICTATION_UPLOAD_DIR, safeName), buffer, { flag: 'wx' });
  return {
    name: safeName,
    url: `${publicBaseUrl(req)}/uploads/dictation/${encodeURIComponent(safeName)}`,
  };
}

function normalizeClinicDictationSubmissionFiles(body) {
  const payload = body && typeof body === 'object' ? body : {};
  if (Array.isArray(payload.files)) {
    return payload.files.filter((file) => file && typeof file === 'object');
  }
  if (payload.file && typeof payload.file === 'object') {
    return [payload.file];
  }
  return [];
}

async function deleteUploadedDictationFiles(uploadedFiles) {
  await Promise.all(
    uploadedFiles.map((file) =>
      fs.promises
        .unlink(path.join(CLINIC_DICTATION_UPLOAD_DIR, file.name))
        .catch(() => {})
    )
  );
}

function clinicDictationUploadPathFromUrl(imageUrl) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw, 'https://daeseaca.cafe24.com');
  } catch (_) {
    return '';
  }
  if (!parsed.pathname.startsWith('/uploads/dictation/')) {
    return '';
  }
  let fileName = '';
  try {
    fileName = path.basename(decodeURIComponent(parsed.pathname));
  } catch (_) {
    return '';
  }
  if (!fileName || fileName === '.' || fileName === '..') {
    return '';
  }
  const root = path.resolve(CLINIC_DICTATION_UPLOAD_DIR);
  const target = path.resolve(root, fileName);
  if (target !== root && target.startsWith(`${root}${path.sep}`)) {
    return target;
  }
  return '';
}

function clinicDictationImageUrlsFromRow(row) {
  const urls = [];
  const addUrl = (value) => {
    const text = String(value || '').trim();
    if (text) urls.push(text);
  };
  addUrl(row.dictation_image_url);
  const rawUrls = row.dictation_image_urls;
  if (Array.isArray(rawUrls)) {
    rawUrls.forEach(addUrl);
  } else if (typeof rawUrls === 'string' && rawUrls.trim()) {
    try {
      const parsed = JSON.parse(rawUrls);
      if (Array.isArray(parsed)) {
        parsed.forEach(addUrl);
      }
    } catch (_) {
      rawUrls.split(',').forEach(addUrl);
    }
  }
  return [...new Set(urls)];
}

async function deleteClinicDictationUploadedImages(rows) {
  let deletedImageCount = 0;
  let failedImageCount = 0;
  const paths = new Set();
  for (const row of rows) {
    for (const imageUrl of clinicDictationImageUrlsFromRow(row)) {
      const localPath = clinicDictationUploadPathFromUrl(imageUrl);
      if (localPath) paths.add(localPath);
    }
  }

  for (const localPath of paths) {
    try {
      await fs.promises.unlink(localPath);
      deletedImageCount += 1;
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        failedImageCount += 1;
      }
    }
  }
  return { deletedImageCount, failedImageCount };
}

async function saveClinicDictationUploads(req, rawFiles) {
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  if (!files.length) {
    throw new Error('DICTATION_FILE_INVALID');
  }
  if (files.length > CLINIC_DICTATION_UPLOAD_MAX_COUNT) {
    throw new Error('DICTATION_FILE_COUNT_EXCEEDED');
  }

  const declaredTotalSize = files.reduce((sum, file) => {
    const size = Number(file && file.size);
    return sum + (Number.isFinite(size) && size > 0 ? size : 0);
  }, 0);
  if (declaredTotalSize > CLINIC_DICTATION_UPLOAD_TOTAL_MAX_BYTES) {
    throw new Error('DICTATION_FILE_TOO_LARGE');
  }

  const uploaded = [];
  try {
    for (const file of files) {
      uploaded.push(await saveClinicDictationUpload(req, file));
    }
    return uploaded;
  } catch (error) {
    await deleteUploadedDictationFiles(uploaded);
    throw error;
  }
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

async function clinicListeningGasSupportsSheetSync() {
  const decoded = await fetchClinicListeningGasJson({
    action: 'listeningMaterialsVersion',
  }).catch(() => null);
  return !!(
    decoded &&
    decoded.ok === true &&
    decoded.feature === 'clinicListeningMaterials' &&
    Number(decoded.version || 0) >= CLINIC_LISTENING_SHEET_SYNC_MIN_VERSION
  );
}

async function postClinicListeningGradeSnapshotToGas(snapshot) {
  const grade = normalizeClinicListeningGrade(snapshot && snapshot.grade);
  if (!grade || !CLINIC_LISTENING_GAS_URL) {
    return { ok: false, skipped: true, message: 'missing grade or GAS URL' };
  }

  const title = String((snapshot && snapshot.title) || '').trim();
  const materials = Array.isArray(snapshot && snapshot.materials)
    ? snapshot.materials.map((item) => ({
        day: `Day ${normalizeClinicListeningDayNumber(item && (item.dayNumber || item.day)) || ''}`,
        answers: normalizeClinicListeningAnswers(item && item.answers),
        link: String((item && (item.link || item.audioLink)) || '').trim(),
      })).filter((item) => normalizeClinicListeningDayNumber(item.day))
    : [];

  if (!(await clinicListeningGasSupportsSheetSync())) {
    postClinicListeningToGas({
      action: 'saveListeningBookTitle',
      grade,
      title,
    });
    for (const material of materials) {
      if (!material.answers) continue;
      postClinicListeningToGas({
        action: 'saveListeningMaterial',
        grade,
        day: material.day,
        answers: material.answers,
        link: material.link,
      });
    }
    return { ok: false, fallback: true, grade, count: materials.length };
  }

  const params = new URLSearchParams();
  params.set('action', 'syncListeningGradeMaterials');
  params.set('grade', grade);
  params.set('title', title);
  params.set('materialsJson', JSON.stringify(materials));

  const response = await fetch(CLINIC_LISTENING_GAS_URL, {
    method: 'POST',
    body: params,
  });
  const text = await response.text();
  if (!response.ok || !text || text.trimStart().startsWith('<')) {
    throw new Error(`GAS sheet sync failed: HTTP ${response.status}`);
  }
  const decoded = JSON.parse(text);
  if (!decoded || decoded.ok !== true) {
    throw new Error(decoded && decoded.message ? decoded.message : 'GAS sheet sync failed');
  }
  return decoded;
}

async function fetchClinicListeningBookSnapshotByTitle(title) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return null;

  const bookRes = await pool.query(
    `SELECT id::text, grade, title,
            textbook_file_name, textbook_file_link,
            explanation_file_name, explanation_file_link,
            created_at, updated_at
       FROM clinic_listening_books
      WHERE title = $1
      ORDER BY CASE WHEN grade = $2 THEN 0 ELSE 1 END, updated_at DESC
      LIMIT 1`,
    [cleanTitle, CLINIC_LISTENING_BOOK_COMMON_GRADE]
  );
  const book = bookRes.rows[0];
  if (!book) return null;

  const daysRes = await pool.query(
    `SELECT book_id::text, day_number, answers, audio_file_name, audio_link, updated_at
       FROM clinic_listening_book_days
      WHERE book_id = $1::uuid
      ORDER BY day_number ASC`,
    [book.id]
  );
  return clinicListeningBookPublic(book, daysRes.rows);
}

async function syncClinicListeningGradeSelectionToGas(grade, title) {
  const cleanGrade = normalizeClinicListeningGrade(grade);
  const cleanTitle = String(title || '').trim();
  if (!cleanGrade) return { ok: false, skipped: true, message: 'missing grade' };

  const book = await fetchClinicListeningBookSnapshotByTitle(cleanTitle);
  if (!book) {
    postClinicListeningToGas({
      action: 'saveListeningBookTitle',
      grade: cleanGrade,
      title: cleanTitle,
    });
    return { ok: false, fallback: true, grade: cleanGrade, count: 0 };
  }

  return postClinicListeningGradeSnapshotToGas({
    grade: cleanGrade,
    title: cleanTitle,
    materials: book.days,
  });
}

async function syncClinicListeningBookForAssignedGradesToGas(book) {
  const title = String((book && book.title) || '').trim();
  if (!title) return [];

  const gradesRes = await pool.query(
    `SELECT grade
       FROM clinic_listening_book_titles
      WHERE title = $1
      ORDER BY grade ASC`,
    [title]
  );
  const results = [];
  for (const row of gradesRes.rows) {
    results.push(await postClinicListeningGradeSnapshotToGas({
      grade: row.grade,
      title,
      materials: book.days || [],
    }));
  }
  return results;
}

async function syncAllClinicListeningGradeSelectionsToGas() {
  const titleRes = await pool.query(
    `SELECT grade, title
       FROM clinic_listening_book_titles
      WHERE grade = ANY($1::text[])
      ORDER BY grade ASC`,
    [CLINIC_LISTENING_GRADES]
  );
  const results = [];
  for (const row of titleRes.rows) {
    results.push(await syncClinicListeningGradeSelectionToGas(row.grade, row.title));
  }
  return results;
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

    CREATE TABLE IF NOT EXISTS clinic_dictation_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT NOT NULL,
      student_name TEXT NOT NULL DEFAULT '',
      class_name TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL,
      day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 60),
      total_count INTEGER NOT NULL CHECK (total_count > 0),
      correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
      wrong_answers TEXT NOT NULL DEFAULT '',
      dictation_required BOOLEAN NOT NULL DEFAULT FALSE,
      dictation_submitted BOOLEAN NOT NULL DEFAULT FALSE,
      submitted_at TIMESTAMPTZ NULL,
      dictation_image_url TEXT NOT NULL DEFAULT '',
      dictation_image_name TEXT NOT NULL DEFAULT '',
      dictation_image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      dictation_image_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (phone, grade, day_number),
      CHECK (correct_count <= total_count)
    );

    ALTER TABLE clinic_dictation_attempts
      ADD COLUMN IF NOT EXISTS dictation_image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE clinic_dictation_attempts
      ADD COLUMN IF NOT EXISTS dictation_image_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

    CREATE INDEX IF NOT EXISTS idx_clinic_dictation_attempts_phone_time
      ON clinic_dictation_attempts (phone, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_clinic_dictation_attempts_class_status
      ON clinic_dictation_attempts (class_name, dictation_required, dictation_submitted);
  `);

  await pool.query(`
    WITH grade_pairs(hwamok_grade, base_grade) AS (
      VALUES
        ('화목 초등부', '초등부'),
        ('화목 중1', '중1'),
        ('화목 중2', '중2'),
        ('화목 중3', '중3')
    )
    INSERT INTO clinic_listening_book_titles (grade, title, updated_at)
    SELECT pair.hwamok_grade, source.title, NOW()
      FROM grade_pairs pair
      JOIN clinic_listening_book_titles source
        ON source.grade = pair.base_grade
     WHERE NOT EXISTS (
       SELECT 1
         FROM clinic_listening_book_titles target
        WHERE target.grade = pair.hwamok_grade
     );

    WITH grade_pairs(hwamok_grade, base_grade) AS (
      VALUES
        ('화목 초등부', '초등부'),
        ('화목 중1', '중1'),
        ('화목 중2', '중2'),
        ('화목 중3', '중3')
    )
    INSERT INTO clinic_listening_materials (grade, day_number, answers, link, updated_at)
    SELECT pair.hwamok_grade, source.day_number, source.answers, source.link, NOW()
      FROM grade_pairs pair
      JOIN clinic_listening_materials source
        ON source.grade = pair.base_grade
     WHERE NOT EXISTS (
       SELECT 1
         FROM clinic_listening_materials target
        WHERE target.grade = pair.hwamok_grade
          AND target.day_number = source.day_number
     );
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
    let repeat;
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
    try {
      repeat = normalizeTodoRepeat(req.body.repeat, dueDate);
    } catch (error) {
      if (error.message === 'TODO_REPEAT_CYCLE_INVALID') {
        return jsonError(res, 400, '반복 주기를 선택해주세요.');
      }
      if (error.message === 'TODO_REPEAT_END_DATE_INVALID') {
        return jsonError(res, 400, '반복 종료일은 마감일 이후로 선택해주세요.');
      }
      return jsonError(res, 400, '반복 생성 설정이 올바르지 않습니다.');
    }

    let dueDates;
    try {
      dueDates = todoRepeatDueDates(dueDate, repeat);
    } catch (error) {
      if (error.message === 'TODO_REPEAT_TOO_MANY') {
        return jsonError(res, 400, '반복 생성 기간이 너무 깁니다.');
      }
      throw error;
    }
    const { rows } = await pool.query(
      `WITH inserted AS (
         INSERT INTO todo_tasks (
            title, due_date, created_by, assignees,
            attachment_name, attachment_data_url, attachment_size
         )
         SELECT $1, dates.due_date, $2, $3::text[], $4, $5, $6
           FROM unnest($7::date[]) AS dates(due_date)
         RETURNING id::text,
                   title,
                   to_char(due_date, 'YYYY-MM-DD') AS due_date,
                   created_by,
                   assignees,
                   attachment_name,
                   attachment_data_url,
                   attachment_size,
                   created_at
       )
       SELECT id,
              title,
              due_date,
              created_by,
              assignees,
              attachment_name,
              attachment_data_url,
              attachment_size,
              created_at,
              ARRAY[]::text[] AS completed_by
         FROM inserted
        ORDER BY due_date ASC, created_at ASC`,
      [
        title.slice(0, 300),
        createdBy,
        assignees,
        attachment.name,
        attachment.dataUrl,
        attachment.size,
        dueDates,
      ]
    );
    res.json({
      ok: true,
      task: todoTaskPublic(rows[0]),
      tasks: rows.map(todoTaskPublic),
      createdCount: rows.length,
    });
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
    if (!isValidDashboardStorageJsonText(jsonText)) {
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


app.post('/api/dashboard-storage/teacher-preferences/attendance-mutations', async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const { dateKey, changes } = normalizeAttendanceMutations(req.body);

    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT storage_key, json_text, updated_at
         FROM dashboard_storage
        WHERE storage_key = $1
        FOR UPDATE`,
      [TEACHER_PREFERENCES_STORAGE_KEY]
    );
    const existingJsonText = rows[0]?.json_text || '{}';
    const preferences = dashboardStorageJsonToObject(existingJsonText);
    const daily = applyAttendanceMutations(preferences, dateKey, changes);
    const nextJsonText = dashboardStorageObjectToBase64(preferences);

    const saved = await client.query(
      `INSERT INTO dashboard_storage (storage_key, json_text, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (storage_key)
       DO UPDATE SET json_text = EXCLUDED.json_text,
                     updated_at = NOW()
       RETURNING storage_key, updated_at`,
      [TEACHER_PREFERENCES_STORAGE_KEY, nextJsonText]
    );
    await client.query('COMMIT');

    res.json({
      ok: true,
      key: TEACHER_PREFERENCES_STORAGE_KEY,
      dateKey,
      records: daily.records,
      absenceReasons: daily.absenceReasons,
      homeworkMissing: daily.homeworkMissing,
      updatedAt: saved.rows[0]?.updated_at || null,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    if (error && error.statusCode === 400) {
      return jsonError(res, 400, '출석 자동 저장 요청이 올바르지 않습니다.');
    }
    if (error && error.message === 'INVALID_DASHBOARD_STORAGE_JSON') {
      return jsonError(res, 500, '저장된 출석 데이터를 읽을 수 없습니다.');
    }
    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});


app.delete('/api/dashboard-storage/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key || '').trim();
    if (key !== '_utf8_health_check') {
      return jsonError(res, 400, 'Unsupported storage key.');
    }

    await pool.query('DELETE FROM dashboard_storage WHERE storage_key = $1', [
      key,
    ]);
    res.json({ ok: true, key });
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


app.post('/api/referral-discount-notifications', async (req, res, next) => {
  try {
    const payload = {
      createdBy: sanitizeSupplyRequestText(req.body.createdBy, 80),
      date: sanitizeSupplyRequestText(req.body.date, 40),
      school: sanitizeSupplyRequestText(req.body.school, 80),
      grade: sanitizeSupplyRequestText(req.body.grade, 40),
      name: sanitizeSupplyRequestText(req.body.name, 80),
      className: sanitizeSupplyRequestText(req.body.className, 160),
      referralDiscount: sanitizeSupplyRequestText(req.body.referralDiscount, 300),
    };

    if (!payload.name) {
      return jsonError(res, 400, '학생 이름을 입력해주세요.');
    }
    if (!payload.referralDiscount) {
      return jsonError(res, 400, '소개 할인 내용이 없습니다.');
    }

    const message = buildReferralDiscountMessage(payload);
    await sendReferralDiscountKakaoWorkMessageByEmail({
      email: KAKAOWORK_REFERRAL_EMAIL,
      text: message,
    });
    res.json({ ok: true });
  } catch (error) {
    if (error && error.message === 'KAKAOWORK_REFERRAL_APP_KEY_MISSING') {
      return jsonError(res, 500, '소개 할인 카카오워크 봇 앱키가 서버에 설정되어 있지 않습니다.');
    }
    next(error);
  }
});


app.post('/api/new-student-notifications', async (req, res, next) => {
  try {
    const payload = {
      createdBy: sanitizeSupplyRequestText(req.body.createdBy, 80),
      date: sanitizeSupplyRequestText(req.body.date, 40),
      school: sanitizeSupplyRequestText(req.body.school, 80),
      grade: sanitizeSupplyRequestText(req.body.grade, 40),
      name: sanitizeSupplyRequestText(req.body.name, 80),
      className: sanitizeSupplyRequestText(req.body.className, 160),
      studentPhone: sanitizeSupplyRequestText(req.body.studentPhone, 80),
      parentPhone: sanitizeSupplyRequestText(req.body.parentPhone, 80),
      referralDiscount: sanitizeSupplyRequestText(req.body.referralDiscount, 300),
      consultation: sanitizeSupplyRequestText(req.body.consultation, 1000),
    };

    if (!payload.name) {
      return jsonError(res, 400, '학생 이름을 입력해주세요.');
    }

    const message = buildNewStudentNotificationMessage(payload);
    await sendStudentMovementKakaoWorkMessageByEmail({
      appKey: KAKAOWORK_NEW_STUDENT_APP_KEY,
      missingCode: 'KAKAOWORK_NEW_STUDENT_APP_KEY_MISSING',
      email: KAKAOWORK_NEW_STUDENT_EMAIL,
      text: message,
    });
    res.json({ ok: true });
  } catch (error) {
    if (error && error.message === 'KAKAOWORK_NEW_STUDENT_APP_KEY_MISSING') {
      return jsonError(res, 500, '신규생 등록 카카오워크 봇 앱키가 서버에 설정되어 있지 않습니다.');
    }
    next(error);
  }
});

app.post('/api/withdrawal-notifications', async (req, res, next) => {
  try {
    const payload = {
      createdBy: sanitizeSupplyRequestText(req.body.createdBy, 80),
      date: sanitizeSupplyRequestText(req.body.date, 40),
      school: sanitizeSupplyRequestText(req.body.school, 80),
      grade: sanitizeSupplyRequestText(req.body.grade, 40),
      name: sanitizeSupplyRequestText(req.body.name, 80),
      className: sanitizeSupplyRequestText(req.body.className, 160),
      studentPhone: sanitizeSupplyRequestText(req.body.studentPhone, 80),
      parentPhone: sanitizeSupplyRequestText(req.body.parentPhone, 80),
      referralDiscount: sanitizeSupplyRequestText(req.body.referralDiscount, 300),
      consultation: sanitizeSupplyRequestText(req.body.consultation, 1000),
    };

    if (!payload.name) {
      return jsonError(res, 400, '학생 이름을 입력해주세요.');
    }

    const message = buildWithdrawalNotificationMessage(payload);
    await sendStudentMovementKakaoWorkMessageByEmail({
      appKey: KAKAOWORK_WITHDRAWAL_APP_KEY,
      missingCode: 'KAKAOWORK_WITHDRAWAL_APP_KEY_MISSING',
      email: KAKAOWORK_WITHDRAWAL_EMAIL,
      text: message,
    });
    res.json({ ok: true });
  } catch (error) {
    if (error && error.message === 'KAKAOWORK_WITHDRAWAL_APP_KEY_MISSING') {
      return jsonError(res, 500, '퇴원 요청 카카오워크 봇 앱키가 서버에 설정되어 있지 않습니다.');
    }
    next(error);
  }
});

app.post('/api/class-move-notifications', async (req, res, next) => {
  try {
    const payload = {
      movedBy: sanitizeSupplyRequestText(req.body.movedBy, 80),
      movedAt: sanitizeSupplyRequestText(req.body.movedAt, 80),
      sourceClassName: sanitizeSupplyRequestText(req.body.sourceClassName, 200),
      sourceClassHeader: sanitizeSupplyRequestText(req.body.sourceClassHeader, 300),
      targetClassName: sanitizeSupplyRequestText(req.body.targetClassName, 200),
      targetClassHeader: sanitizeSupplyRequestText(req.body.targetClassHeader, 300),
      students: normalizeClassMoveNotificationStudents(req.body.students),
    };

    if (payload.students.length === 0) {
      return jsonError(res, 400, '반 이동 학생 정보가 없습니다.');
    }

    const message = buildClassMoveNotificationMessage(payload);
    await sendClassMoveKakaoWorkMessageByEmail({
      email: KAKAOWORK_CLASS_MOVE_EMAIL,
      text: message,
    });
    res.json({ ok: true });
  } catch (error) {
    if (error && error.message === 'KAKAOWORK_CLASS_MOVE_APP_KEY_MISSING') {
      return jsonError(res, 500, '반 이동 카카오워크 봇 앱키가 서버에 설정되어 있지 않습니다.');
    }
    next(error);
  }
});


const DAESE_REHEARSAL_JOB_TTL_MS = 30 * 60 * 1000;
const daeseRehearsalJobs = new Map();

function cleanupDaeseRehearsalJobs(now = Date.now()) {
  for (const [jobId, job] of daeseRehearsalJobs.entries()) {
    if (job.status !== 'running' && now - job.updatedAt > DAESE_REHEARSAL_JOB_TTL_MS) {
      daeseRehearsalJobs.delete(jobId);
    }
  }
}

function createDaeseRehearsalJobId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

function buildDaeseRehearsalPayload(body) {
  const totalCount = Number.parseInt(String(body.totalCount || '0'), 10);
  const objectiveCount = Number.parseInt(String(body.objectiveCount || '0'), 10);
  const subjectiveCount = Number.parseInt(String(body.subjectiveCount || '0'), 10);
  const semester = sanitizeDaeseRehearsalText(body.semester || body.term, 80);
  const examType = sanitizeDaeseRehearsalText(body.examType || body.examName, 120);
  const payload = {
    year: sanitizeDaeseRehearsalText(body.year, 20),
    school: sanitizeDaeseRehearsalText(body.school, 80),
    grade: sanitizeDaeseRehearsalText(body.grade, 40),
    semester,
    examType,
    rehearsalRound: sanitizeDaeseRehearsalText(body.rehearsalRound, 80),
    term: sanitizeDaeseRehearsalText(body.term || semester, 80),
    examName: sanitizeDaeseRehearsalText(body.examName || examType, 120),
    scopeText: sanitizeDaeseRehearsalText(body.scopeText, 60000),
    totalCount,
    objectiveCount,
    subjectiveCount,
    difficulty: sanitizeDaeseRehearsalText(body.difficulty, 20) || 'medium',
    examples: normalizeDaeseRehearsalExamples(body.examples),
  };

  if (!payload.school || !payload.scopeText) {
    return { errorStatus: 400, errorMessage: 'School and test scope are required.' };
  }
  if (!Number.isInteger(totalCount) || totalCount < 1 || totalCount > 80) {
    return { errorStatus: 400, errorMessage: 'Total question count must be between 1 and 80.' };
  }
  if (!Number.isInteger(objectiveCount) || !Number.isInteger(subjectiveCount) || objectiveCount < 0 || subjectiveCount < 0) {
    return { errorStatus: 400, errorMessage: 'Objective and subjective question counts are invalid.' };
  }
  if (objectiveCount + subjectiveCount !== totalCount) {
    return { errorStatus: 400, errorMessage: 'Objective plus subjective question counts must equal total count.' };
  }
  return { payload };
}

function createDaeseRehearsalHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildDaeseRehearsalExampleAnalysisPayload(body) {
  const semester = sanitizeDaeseRehearsalText(body.semester || body.term, 80);
  const examType = sanitizeDaeseRehearsalText(body.examType || body.examName, 120);
  const actualFiles = normalizeDaeseRehearsalActualFiles(body.actualFiles);
  if (actualFiles.errorStatus) return actualFiles;
  const payload = {
    year: sanitizeDaeseRehearsalText(body.year, 20),
    school: sanitizeDaeseRehearsalText(body.school, 80),
    grade: sanitizeDaeseRehearsalText(body.grade, 40),
    semester,
    examType,
    term: sanitizeDaeseRehearsalText(body.term || semester, 80),
    examName: sanitizeDaeseRehearsalText(body.examName || examType, 120),
    scopeText: sanitizeDaeseRehearsalText(body.scopeText, 60000),
    actualQuestions: sanitizeDaeseRehearsalText(body.actualQuestions, 60000),
    actualAnswers: sanitizeDaeseRehearsalText(body.actualAnswers, 20000),
    actualFiles: actualFiles.files,
  };
  if (!payload.school || !payload.scopeText || (!payload.actualQuestions && !payload.actualFiles.length)) {
    return { errorStatus: 400, errorMessage: 'School, test scope, and past questions or files are required.' };
  }
  return { payload };
}

function buildDaeseRehearsalScopePdfAnalysisPayload(body) {
  const normalizedFile = normalizeDaeseRehearsalScopePdfFile(body.file);
  if (normalizedFile.errorStatus) return normalizedFile;
  const unitNumber = Number.parseInt(String(body.unitNumber || '0'), 10);
  const payload = {
    grade: sanitizeDaeseRehearsalText(body.grade, 40),
    textbook: sanitizeDaeseRehearsalText(body.textbook, 160),
    unitNumber,
    file: normalizedFile.file,
  };
  if (!payload.grade || !payload.textbook) {
    return {
      errorStatus: 400,
      errorMessage: 'Grade and textbook are required for textbook unit analysis.',
    };
  }
  if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 8) {
    return {
      errorStatus: 400,
      errorMessage: 'Unit number must be between 1 and 8.',
    };
  }
  return { payload };
}

async function analyzeDaeseRehearsalExample(payload) {
  if (!OPENAI_API_KEY) {
    throw createDaeseRehearsalHttpError(503, 'The rehearsal OpenAI API key is not configured on the server.');
  }

  const newline = String.fromCharCode(10);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_REHEARSAL_MODEL,
      input: [
        {
          role: 'system',
          content: [
            '너는 고등학교 영어 내신 출제 경향 분석가다.',
            '아래에 제공되는 시험범위, 실제 기출문제, 정답을 바탕으로 이 학교 영어 선생님이 시험범위를 실제 문제로 바꾸는 방식을 분석하라.',
            '분석 목표는 단순 요약이 아니라, 다음 시험범위에서 어떤 문제가 나올 가능성이 높은지 예측할 수 있도록 출제자의 반복 습관과 문제 제작 방식을 구조화하는 것이다.',
            '근거가 부족하면 단정하지 말고 "추정" 또는 "근거 부족"이라고 표시하라.',
            '실제 기출 문장을 그대로 재사용하지 말고, 분석 목적으로만 짧게 요약하라.',
            '반드시 유효한 JSON만 반환하라. 마크다운을 쓰지 마라.',
          ].join(newline),
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: [
            `연도: ${payload.year}`,
            `학교: ${payload.school}`,
            `학년: ${payload.grade}`,
            `학기: ${payload.semester || payload.term}`,
            `고사: ${payload.examType || payload.examName}`,
            '',
            '시험범위:',
            payload.scopeText,
            '',
            '실제 기출문제:',
            payload.actualQuestions || 'Typed past questions were not supplied. Read the uploaded past-exam files instead.',
            '',
            '정답:',
            payload.actualAnswers || '정답 미입력',
            '',
            'Uploaded past-exam files:',
            payload.actualFiles && payload.actualFiles.length
              ? payload.actualFiles.map((file, index) => `${index + 1}. ${file.name} (${file.mimeType})`).join(newline)
              : 'No uploaded files.',
            'Use uploaded files only as temporary analysis input. Do not treat handwriting, grading marks, scores, solved traces, or personal information as teacher intent.',
            '',
            '다음 항목을 반드시 분석하라.',
            '1. 출제된 지문/문장 선택 기준',
            '2. 변형된 문장이나 표현과 변형 방식',
            '3. 선호 문제 유형',
            '4. 출제 의도',
            '5. 오답 선택지 제작 방식',
            '6. 학생 실수 유도 포인트',
            '7. 정답 근거 위치와 근거 거리',
            '8. 지문 내 출제 위치 패턴',
            '9. 보기 구성 방식',
            '10. 서술형 출제 방식',
            '11. 교과서/부교재/여러 지문 결합 방식',
            '12. 난이도 조절 방식',
            '13. 반복되는 선생님 특유의 출제 습관',
            '14. 출제 제외 또는 낮은 우선순위 경향',
            '15. 다음 시험범위에 적용할 출제 예측 규칙',
            '16. 분석 신뢰도와 근거 부족 항목',
            '',
            '세부 분석 기준:',
            '- 출제 의도: 단순 독해 확인, 문장 구조 분석, 어휘 뉘앙스 구분, 글의 흐름 파악 중 무엇인지 구분하라.',
            '- 출제 가능성이 높았던 이유: 핵심 주장문, 대조/역접, 원인-결과, 예시, 정의, 결론, 어법 포인트 중 무엇 때문인지 분석하라.',
            '- 함정 설계 방식: 의미 반전, 주체 바꾸기, 시제 바꾸기, 정도 부사 바꾸기, 원인/결과 뒤집기, 유사어 혼동 여부를 정리하라.',
            '- 정답 근거의 거리: 한 문장 안, 앞뒤 문맥 연결, 여러 문단 종합 중 어디에 해당하는지 분석하라.',
            '- 변형 강도: 원문 거의 그대로, 표현만 변경, 구조 변경, 여러 문장 결합 중 무엇인지 낮음/중간/높음으로 분류하라.',
            '- 학생 실수 유도 포인트: 해석 실수, 대명사 지칭 오류, 연결어 오판, 어휘 뉘앙스 착각, 삽입 위치 착각, 수식 관계 오해를 구분하라.',
            '- 지문 내 출제 위치: 첫 문장, 주제문, 예시문, 전환 문장, 결론 문장, 세부 정보 중 어디에서 문제가 나오는지 분석하라.',
            '- 보기 구성: 정답/오답 선택지의 길이, 어휘 수준, 문장 구조, 원문 재사용 정도, 오답의 정교함을 평가하라.',
            '- 서술형: 원문 암기형, 조건 영작형, 어법 수정형, 빈칸 완성형인지와 채점 포인트를 정리하라.',
            '- 범위 간 결합: 교과서 본문과 부교재 지문을 같은 주제/어법/어휘로 묶는 방식이 있는지 확인하라.',
            '- 난이도: 어려운 문제가 지문 난이도, 선택지 함정, 문장 구조 중 무엇 때문에 어려운지 구분하라.',
            '- 출제 제외 경향: 시험범위에 있었지만 실제로 낮은 우선순위로 보이는 지문/유형을 추론하라.',
            '- 다음 시험범위 적용 규칙: 단순 요약이 아니라 다음 문제 생성에 바로 쓸 수 있는 실행 규칙으로 작성하라.',
            '',
            '각 항목은 반드시 구체적인 근거를 들어 작성하라.',
            '다음 JSON shape만 반환하라. 각 값은 한국어 문자열 배열이어야 한다.',
            '{"passageSelection":[],"transformationPatterns":[],"preferredQuestionTypes":[],"intentPatterns":[],"distractorPatterns":[],"studentTrapPatterns":[],"answerEvidencePatterns":[],"passagePositionPatterns":[],"choiceDesignPatterns":[],"subjectivePatterns":[],"scopeBlendingPatterns":[],"difficultyPatterns":[],"teacherHabits":[],"lowPriorityPatterns":[],"nextScopeRules":[],"confidenceNotes":[]}',
          ].join(newline) }, ...daeseRehearsalFileInputContent(payload.actualFiles || [])],
        },
      ],
      temperature: 0.2,
      max_output_tokens: Math.min(OPENAI_REHEARSAL_MAX_OUTPUT_TOKENS, 6000),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('OpenAI daese rehearsal analysis error:', response.status, body.slice(0, 500));
    throw createDaeseRehearsalHttpError(502, `OpenAI analysis response error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = extractOpenAIResponseText(data);
  if (!content) {
    throw createDaeseRehearsalHttpError(502, 'No rehearsal analysis content was found in the OpenAI response.');
  }

  let parsed;
  try {
    parsed = parseOpenAIJsonObject(content);
  } catch (error) {
    console.error('OpenAI daese rehearsal analysis JSON parse error:', content.slice(0, 500));
    throw createDaeseRehearsalHttpError(502, 'The OpenAI analysis response was not valid JSON.');
  }

  const analysis = normalizeDaeseRehearsalAnalysis(parsed);
  if (!hasDaeseRehearsalAnalysis(analysis)) {
    throw createDaeseRehearsalHttpError(502, 'The OpenAI analysis response did not contain usable analysis.');
  }

  return {
    action: 'analyzeDaeseRehearsalExample',
    model: OPENAI_REHEARSAL_MODEL,
    analysis,
  };
}

async function analyzeDaeseRehearsalScopePdf(payload) {
  if (!OPENAI_API_KEY) {
    throw createDaeseRehearsalHttpError(503, 'The rehearsal OpenAI API key is not configured on the server.');
  }

  const newline = String.fromCharCode(10);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_REHEARSAL_MODEL,
      input: [
        {
          role: 'system',
          content: [
            '너는 중학교 영어 내신 시험범위 분석가다.',
            '업로드된 PDF는 중학교 교과서 단원 내용정리, 대화문, 본문, 문법, 어휘 정리 양식이다.',
            '업로드된 교과서 단원 PDF를 읽고, 이후 시험지 생성에 바로 사용할 수 있도록 단원 내용을 구조화하라.',
            '분석 목표는 원문을 길게 복사하는 것이 아니라 본문, 대화문, 문법, 어휘, 핵심 표현, 출제 후보 포인트를 재사용 가능한 요약 데이터로 만드는 것이다.',
            'PDF 앞부분이나 꼬리말의 저작권/라이선스 안내, 페이지 번호, 출처 표기, 편집용 안내문은 시험범위 내용으로 보지 말고 제외하라.',
            '학생 풀이 흔적, 채점 표시, 개인정보, 낙서가 보이면 시험범위 내용으로 보지 말고 무시하라.',
            '원문 문장을 장문으로 그대로 베끼지 말고 분석과 짧은 근거 요약만 작성하라.',
            '반드시 유효한 JSON만 반환하라. 마크다운을 쓰지 마라.',
          ].join(newline),
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `학년: ${payload.grade}`,
                `교과서: ${payload.textbook}`,
                `단원: ${payload.unitNumber}단원`,
                `PDF 파일명: ${payload.file.name}`,
                '',
                '다음 항목을 분석하라.',
                '1. 단원 전체 주제와 흐름',
                '2. 본문 지문별 핵심 내용, 주제문, 결론, 대조/원인-결과/예시 구조',
                '3. 대화문별 상황, 의사소통 기능, 핵심 표현',
                '4. 시험에 나오기 쉬운 문법 포인트와 문장 구조',
                '5. 필수 어휘와 의미 구분이 필요한 어휘',
                '6. 암기 또는 변형 출제 가능성이 높은 핵심 표현',
                '7. 핵심 문장과 변형 가능 포인트',
                '8. 객관식/서술형 출제 후보 포인트',
                '9. 새 문제 생성에 바로 적용할 실행 규칙',
                '10. 분석 신뢰도와 PDF에서 근거가 부족한 항목',
                '',
                '다음 JSON shape만 반환하라. 각 값은 한국어 문자열 배열이어야 한다.',
                '{"unitOverview":[],"passages":[],"dialogues":[],"grammarPoints":[],"vocabulary":[],"keyExpressions":[],"keySentences":[],"examPointCandidates":[],"questionGenerationRules":[],"confidenceNotes":[]}',
              ].join(newline),
            },
            {
              type: 'input_file',
              filename: payload.file.name,
              file_data: payload.file.dataUrl,
            },
          ],
        },
      ],
      temperature: 0.15,
      max_output_tokens: Math.min(OPENAI_REHEARSAL_MAX_OUTPUT_TOKENS, 6000),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('OpenAI daese rehearsal scope PDF analysis error:', response.status, body.slice(0, 500));
    throw createDaeseRehearsalHttpError(502, `OpenAI scope PDF analysis response error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = extractOpenAIResponseText(data);
  if (!content) {
    throw createDaeseRehearsalHttpError(502, 'No textbook unit analysis content was found in the OpenAI response.');
  }

  let parsed;
  try {
    parsed = parseOpenAIJsonObject(content);
  } catch (error) {
    console.error('OpenAI daese rehearsal scope PDF analysis JSON parse error:', content.slice(0, 500));
    throw createDaeseRehearsalHttpError(502, 'The OpenAI scope PDF analysis response was not valid JSON.');
  }

  const analysis = normalizeDaeseRehearsalScopeAnalysis(parsed);
  if (!hasDaeseRehearsalScopeAnalysis(analysis)) {
    throw createDaeseRehearsalHttpError(502, 'The OpenAI scope PDF analysis response did not contain usable analysis.');
  }

  return {
    action: 'analyzeDaeseRehearsalScopePdf',
    model: OPENAI_REHEARSAL_MODEL,
    analysis,
  };
}

async function generateDaeseRehearsalExam(payload) {
  if (!OPENAI_API_KEY) {
    throw createDaeseRehearsalHttpError(503, 'The rehearsal OpenAI API key is not configured on the server.');
  }

  const newline = String.fromCharCode(10);
  const exampleText = payload.examples.length
    ? payload.examples.map((example, index) => [
        `Example ${index + 1}`,
        `Year: ${example.year}`,
        `School: ${example.school}`,
        `Grade/Semester/Exam: ${[example.grade, example.semester || example.term, example.examType || example.examName].filter(Boolean).join(' / ')}`,
        `Stored past-exam analysis:${newline}${formatDaeseRehearsalAnalysis(example.analysis)}`,
        `Test scope:${newline}${example.scopeText}`,
        `Actual past questions:${newline}${example.actualQuestions}`,
        example.actualAnswers ? `Answer key for the past questions:${newline}${example.actualAnswers}` : 'Answer key for the past questions: not supplied',
      ].join(newline)).join(newline + newline)
    : 'No saved school-specific examples were supplied. Generate only from the new test scope.';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_REHEARSAL_MODEL,
      input: [
        {
          role: 'system',
          content: [
            'You create original English exam rehearsal worksheets for a Korean English academy.',
            'Use the school-specific past examples only as style and trend references.',
            'When stored past-exam analysis is supplied, treat it as the precomputed teacher-profile evidence and apply it before rereading the full past questions.',
            'Use supplied answer keys to infer the school exam intent, distractor style, and scoring focus.',
            'Before writing questions, analyze every supplied school-specific past example and infer how the teacher converted the old test scope into real questions.',
            'Identify repeated patterns: selected passages, transformed sentences, grammar/vocabulary/blank/order/insertion/summary/content-check preferences, distractor construction, answer evidence location, priority passages within the scope, and whether textbook and supplementary material are blended.',
            'Apply that inferred teacher profile to the new test scope by choosing the points the same teacher would most likely ask about.',
            'Do not reproduce real past questions verbatim. Create new questions grounded in the supplied test scope.',
            'All objective question prompts and subjective prompts must be written in Korean.',
            'Passages and objective answer choices may stay in English when the test scope is English.',
            'All explanations, answer keys, trend summaries, and quality notes must be written in Korean.',
            'Return valid JSON only. Do not use markdown.',
          ].join(newline),
        },
        {
          role: 'user',
          content: [
            `Year: ${payload.year}`,
            `School: ${payload.school}`,
            `Grade: ${payload.grade}`,
            `Semester: ${payload.semester || payload.term}`,
            `Exam type: ${payload.examType || payload.examName}`,
            `Rehearsal round: ${payload.rehearsalRound}`,
            `Difficulty: ${payload.difficulty}`,
            `Total questions: ${payload.totalCount}`,
            `Objective questions: ${payload.objectiveCount}`,
            `Subjective questions: ${payload.subjectiveCount}`,
            '',
            'Return exactly this JSON shape and no other text:',
            '{"title":"","subtitle":"","trendSummary":[""],"qualityChecks":[""],"objectiveQuestions":[{"number":1,"passage":"","question":"","choices":["","","","",""],"answerIndex":1,"answer":"","explanation":"","sourceHint":""}],"subjectiveQuestions":[{"number":1,"prompt":"","answer":"","explanation":"","scoringGuide":"","sourceHint":""}],"answerKey":[{"number":1,"answer":"","explanation":""}]}',
            '',
            'Generation rules:',
            '- The objectiveQuestions array length must exactly match the requested objective question count.',
            '- The subjectiveQuestions array length must exactly match the requested subjective question count.',
            '- Objective question values in question must be Korean prompts, not English prompts.',
            '- Use Korean exam-style prompts such as ?? ?? ??? ?? ??? ???, ??? ??? ?? ?? ??? ???, ?? ? ?? ? ??? ?? ???, ?? ??? ???? ????, ??? ??? ??? ??? ?? ??? ???.',
            '- Objective questions should use five choices unless the scope makes that impossible.',
            '- Do not include choice labels such as 1., 2., ?, or ? inside choices. Put only the choice text.',
            '- Do not end choice text with a final period unless the period is part of an abbreviation.',
            '- answerIndex is one-based.',
            '- Put a passage in passage only when the question needs one. Otherwise use an empty string.',
            '- answerKey must include every question in number order.',
            '- trendSummary must specifically summarize how the supplied past examples shaped this generated worksheet.',
            '- sourceHint must briefly state which new scope item and which inferred past-exam trend were reflected.',
            '- Never copy a real past question sentence or answer choice verbatim; use the past examples to predict style, not to duplicate content.',
            '',
            'New test scope:',
            payload.scopeText,
            '',
            'School-specific past examples with answer keys:',
            exampleText,
          ].join(newline),
        },
      ],
      temperature: 0.45,
      max_output_tokens: OPENAI_REHEARSAL_MAX_OUTPUT_TOKENS,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('OpenAI daese rehearsal error:', response.status, body.slice(0, 500));
    throw createDaeseRehearsalHttpError(502, `OpenAI response error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = extractOpenAIResponseText(data);
  if (!content) {
    throw createDaeseRehearsalHttpError(502, 'No rehearsal exam content was found in the OpenAI response.');
  }

  let parsed;
  try {
    parsed = parseOpenAIJsonObject(content);
  } catch (error) {
    console.error('OpenAI daese rehearsal JSON parse error:', content.slice(0, 500));
    throw createDaeseRehearsalHttpError(502, 'The OpenAI response was not valid JSON.');
  }

  const exam = normalizeDaeseRehearsalGeneratedExam(parsed, payload);
  if (!exam) {
    throw createDaeseRehearsalHttpError(502, 'The OpenAI response did not match the requested question counts.');
  }

  return {
    action: 'generateDaeseRehearsalExam',
    model: OPENAI_REHEARSAL_MODEL,
    exam,
  };
}

async function runDaeseRehearsalJob(jobId) {
  const job = daeseRehearsalJobs.get(jobId);
  if (!job || job.status !== 'queued') return;
  job.status = 'running';
  job.updatedAt = Date.now();
  try {
    const result = await generateDaeseRehearsalExam(job.payload);
    job.status = 'succeeded';
    job.model = result.model;
    job.exam = result.exam;
    job.message = '';
  } catch (error) {
    console.error('Daese rehearsal job failed:', error && error.message ? error.message : error);
    job.status = 'failed';
    job.message = error && error.message ? error.message : 'Rehearsal exam generation failed.';
  } finally {
    job.updatedAt = Date.now();
  }
}

app.post('/api/daese-rehearsal/generate', async (req, res, next) => {
  try {
    const built = buildDaeseRehearsalPayload(req.body || {});
    if (built.errorMessage) return jsonError(res, built.errorStatus, built.errorMessage);
    const result = await generateDaeseRehearsalExam(built.payload);
    res.json({ ok: true, ...result });
  } catch (error) {
    if (error && error.statusCode) return jsonError(res, error.statusCode, error.message);
    next(error);
  }
});

app.post('/api/daese-rehearsal/analyze-example', async (req, res, next) => {
  try {
    const built = buildDaeseRehearsalExampleAnalysisPayload(req.body || {});
    if (built.errorMessage) return jsonError(res, built.errorStatus, built.errorMessage);
    const result = await analyzeDaeseRehearsalExample(built.payload);
    res.json({ ok: true, ...result });
  } catch (error) {
    if (error && error.statusCode) return jsonError(res, error.statusCode, error.message);
    next(error);
  }
});

app.post('/api/daese-rehearsal/analyze-scope-pdf', async (req, res, next) => {
  try {
    const built = buildDaeseRehearsalScopePdfAnalysisPayload(req.body || {});
    if (built.errorMessage) return jsonError(res, built.errorStatus, built.errorMessage);
    const result = await analyzeDaeseRehearsalScopePdf(built.payload);
    res.json({ ok: true, ...result });
  } catch (error) {
    if (error && error.statusCode) return jsonError(res, error.statusCode, error.message);
    next(error);
  }
});

app.post('/api/daese-rehearsal/generate-jobs', async (req, res, next) => {
  try {
    if (!OPENAI_API_KEY) {
      return jsonError(res, 503, 'The rehearsal OpenAI API key is not configured on the server.');
    }
    const built = buildDaeseRehearsalPayload(req.body || {});
    if (built.errorMessage) return jsonError(res, built.errorStatus, built.errorMessage);
    cleanupDaeseRehearsalJobs();
    const now = Date.now();
    const jobId = createDaeseRehearsalJobId();
    daeseRehearsalJobs.set(jobId, {
      id: jobId,
      status: 'queued',
      payload: built.payload,
      createdAt: now,
      updatedAt: now,
      message: '',
      model: '',
      exam: null,
    });
    setImmediate(() => runDaeseRehearsalJob(jobId));
    res.status(202).json({ ok: true, jobId, status: 'queued' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/daese-rehearsal/generate-jobs/:jobId', async (req, res) => {
  cleanupDaeseRehearsalJobs();
  const jobId = String(req.params.jobId || '').trim();
  const job = daeseRehearsalJobs.get(jobId);
  if (!job) return jsonError(res, 404, 'Rehearsal generation job was not found.');
  res.json({
    ok: true,
    jobId,
    status: job.status,
    message: job.message || '',
    model: job.model || '',
    exam: job.status === 'succeeded' ? job.exam : null,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  });
});

app.post('/api/writing-worksheet/generate-sentences', async (req, res, next) => {
  try {
    if (!OPENAI_API_KEY) {
      return jsonError(res, 503, '?? ??? OpenAI API ?? ??? ???? ?? ????.');
    }

    const requestedCount = Number.parseInt(String(req.body.count || '12'), 10);
    const count = Number.isInteger(requestedCount)
      ? Math.min(Math.max(requestedCount, 1), 80)
      : 12;
    const payload = {
      className: sanitizeWritingWorksheetText(req.body.className, 120),
      classProfile: sanitizeWritingWorksheetText(req.body.classProfile, 180),
      level: sanitizeWritingWorksheetText(req.body.level, 40),
      difficulty: sanitizeWritingWorksheetText(req.body.difficulty, 40),
      difficultyCode: normalizeWritingWorksheetDifficultyCode(req.body.difficultyCode, req.body.difficulty),
      textbook: sanitizeWritingWorksheetText(req.body.textbook, 180),
      progress: sanitizeWritingWorksheetText(req.body.progress, 120),
      unitTitle: sanitizeWritingWorksheetText(req.body.unitTitle, 220),
      grammarFocus: sanitizeWritingWorksheetText(req.body.grammarFocus, 700),
      vocabulary: sanitizeWritingWorksheetText(req.body.vocabulary, 700),
      teacherNote: sanitizeWritingWorksheetText(req.body.teacherNote, 700),
      exerciseTypes: normalizeWritingWorksheetExerciseTypes(req.body.exerciseTypes),
    };

    if (!payload.textbook || !payload.progress || !payload.unitTitle || !payload.grammarFocus) {
      return jsonError(res, 400, '?? ??, ???, ?? ?? ??? ?????.');
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_WRITING_WORKSHEET_MODEL,
        input: [
          {
            role: 'system',
            content: [
              'You generate sentence candidates for a Korean English academy writing worksheet.',
              'Return valid JSON only. Do not use markdown.',
              'Every sentence must be strictly based on the supplied textbook scope.',
              'Do not create grammar or vocabulary outside the supplied scope.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Create exactly ${count} unique sentence candidates.`,
              'Return this JSON shape:',
              '{"sentences":[{"english":"","korean":"","wrong":"","baseSentence":"","expansionCondition":"","tip":""}]}',
              '',
              'Field rules:',
              '- english: one natural English sentence using the target grammar.',
              '- korean: Korean translation of english.',
              '- wrong: one intentionally incorrect English sentence with a target-grammar error.',
              '- baseSentence: a shorter/simple English sentence related to english.',
              '- expansionCondition: Korean instruction for expanding baseSentence into english.',
              '- tip: short Korean teaching point tied to the target grammar.',
              '',
              'Hard constraints:',
              '- No duplicate english, korean, or wrong sentences.',
              '- Use only the textbook unit, grammar, vocabulary, and teacher memo below.',
              '- Keep sentences appropriate for the student level, difficulty, and requested exercise types.',
              '- Output JSON only.',
              '',
              `Class: ${payload.className}`,
              `Class profile: ${payload.classProfile}`,
              `Student level: ${payload.level}`,
              `Difficulty: ${payload.difficulty}`,
              `Difficulty code: ${payload.difficultyCode}`,
              `Difficulty rules: ${writingWorksheetDifficultyInstruction(payload.difficultyCode)}`,
              `Textbook: ${payload.textbook}`,
              `Printed-page progress: ${payload.progress}`,
              `Unit title: ${payload.unitTitle}`,
              `Core grammar: ${payload.grammarFocus}`,
              `Required vocabulary: ${payload.vocabulary}`,
              `Teacher memo: ${payload.teacherNote}`,
              `Requested exercise types: ${payload.exerciseTypes.join(', ')}`,
              `Exercise type rules: ${writingWorksheetExerciseTypeInstruction(payload.exerciseTypes)}`,
            ].join('\n'),
          },
        ],
        temperature: 0.35,
        max_output_tokens: OPENAI_WRITING_WORKSHEET_MAX_OUTPUT_TOKENS,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('OpenAI writing worksheet error:', response.status, body.slice(0, 500));
      return jsonError(res, 502, `OpenAI ?? ??: HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = extractOpenAIResponseText(data);
    if (!content) {
      return jsonError(res, 502, 'OpenAI ???? ?? ?? ???? ?? ?????.');
    }

    let parsed;
    try {
      parsed = parseOpenAIJsonObject(content);
    } catch (error) {
      console.error('OpenAI writing worksheet JSON parse error:', content.slice(0, 500));
      return jsonError(res, 502, 'OpenAI ??? JSON?? ???? ?????.');
    }

    const sentences = normalizeWritingWorksheetSentences(parsed, count);
    if (!sentences.length) {
      return jsonError(res, 502, 'OpenAI ???? ??? ? ?? ?? ??? ????.');
    }

    res.json({
      ok: true,
      action: 'generateWritingWorksheetSentences',
      model: OPENAI_WRITING_WORKSHEET_MODEL,
      requestedCount: count,
      count: sentences.length,
      sentences,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/stats-prediction/explain', async (req, res, next) => {
  try {
    if (!OPENAI_API_KEY) {
      return jsonError(res, 503, 'The OpenAI API key is not configured on the server.');
    }

    const payload = normalizeStatsPredictionPayload(req.body);
    const hasV1Forecast = payload.nextFourWeeks.title && payload.nextMonth.title;
    const hasV2Forecast =
      payload.nextFourWeeksTotal.title && payload.weeklyForecasts.length > 0;
    if (!payload.fingerprint || (!hasV1Forecast && !hasV2Forecast)) {
      return jsonError(res, 400, 'The stats prediction payload is invalid.');
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_STATS_PREDICTION_MODEL,
        input: [
          {
            role: 'system',
            content: [
              'You are an operations analyst for a Korean English academy.',
              'Explain statistical forecasts in Korean.',
              'Do not change the numeric forecast. Use only the supplied aggregate data.',
              'Withdrawal risk candidates are prevention targets, not confirmed withdrawals.',
              'Use only supplied student names in withdrawalRiskCandidates.',
              'Do not invent student names, phone numbers, or private details.',
              'Keep the answer concise and actionable.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              'Write a short forecast explanation for the academy manager.',
              'Structure the answer in 3 compact paragraphs:',
              '1. Overall 4-week trend and expected net change.',
              '2. Week-by-week points to watch in inquiries, placement tests, new students, and withdrawals.',
              '3. Withdrawal risk candidates and suggested prevention actions for the next 4 weeks.',
              'If withdrawalRiskCandidates is empty, say that student-level evidence is insufficient.',
              'Use Korean only.',
              '',
              JSON.stringify(payload),
            ].join('\n'),
          },
        ],
        temperature: 0.25,
        max_output_tokens: OPENAI_STATS_PREDICTION_MAX_OUTPUT_TOKENS,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('OpenAI stats prediction error:', response.status, body.slice(0, 500));
      return jsonError(res, 502, `OpenAI stats prediction response error: HTTP ${response.status}`);
    }

    const data = await response.json();
    const explanation = sanitizeWritingWorksheetText(
      extractOpenAIResponseText(data),
      1800
    );
    if (!explanation) {
      return jsonError(res, 502, 'No stats prediction explanation was found in the OpenAI response.');
    }

    res.json({
      ok: true,
      action: 'explainStatsPrediction',
      model: OPENAI_STATS_PREDICTION_MODEL,
      explanation,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/vocabulary-workbook/generate', async (req, res, next) => {
  try {
    if (!OPENAI_API_KEY) {
      return jsonError(res, 503, '\uB2E8\uC5B4\uC7A5 \uC81C\uC791 API \uD0A4\uAC00 \uC11C\uBC84\uC5D0 \uC124\uC815\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.');
    }

    const level = String(req.body.level || '').trim().slice(0, 40);
    const wordsPerDay = Number.parseInt(String(req.body.wordsPerDay || '40'), 10);
    const words = normalizeVocabularyWorkbookWords(req.body.words);

    if (!level) {
      return jsonError(res, 400, '\uB808\uBCA8\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.');
    }
    if (!Number.isInteger(wordsPerDay) || wordsPerDay < 1 || wordsPerDay > 100) {
      return jsonError(res, 400, 'Day \uB2F9 \uB2E8\uC5B4 \uAC1C\uC218\uB294 1\uAC1C\uBD80\uD130 100\uAC1C\uAE4C\uC9C0 \uC785\uB825\uD574\uC8FC\uC138\uC694.');
    }
    if (!words.length) {
      return jsonError(res, 400, '\uC601\uC5B4 \uB2E8\uC5B4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.');
    }

    const numberedWords = words.map((word, index) => `${index + 1}. ${word}`).join('\n');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_VOCABULARY_MODEL,
        input: [
          {
            role: 'system',
            content: 'You create Korean English-academy vocabulary workbook material. Output plain text only. Follow the requested labels and headings exactly.',
          },
          {
            role: 'user',
            content: [
              `Student level: ${level}`,
              `Required word count in this Day: ${words.length}`,
              `Requested Words per Day: ${wordsPerDay}`,
              'The caller already splits words by Day. Create material for this single Day only.',
              'The only section heading must be exactly: Day 1',
              'Do not create Day 2 or any additional Day sections.',
              'Inside each Day, restart numbering from 1.',
              'For every vocabulary word, use exactly this 3-line format:',
              '1. Word [IPA] (Korean pronunciation) - Korean meanings',
              '\uC608\uBB38: one natural English example sentence for the student level',
              '\uD574\uC11D: Korean translation of the example sentence',
              'All meanings, Korean pronunciations, and translations must be in Korean. Do not use labels such as Example, Meaning, or \uB73B.',
              `Do not skip, reorder, or add words. You must output exactly ${words.length} numbered vocabulary entries.`,
              '',
              'Words:',
              numberedWords,
            ].join('\n'),
          },
        ],
        temperature: 0.2,
        max_output_tokens: OPENAI_VOCABULARY_MAX_OUTPUT_TOKENS,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('OpenAI vocabulary workbook error:', response.status, body.slice(0, 500));
      return jsonError(res, 502, `OpenAI \uC751\uB2F5 \uC624\uB958: HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = extractOpenAIResponseText(data);
    if (!content) {
      return jsonError(res, 502, 'OpenAI \uC751\uB2F5\uC5D0\uC11C \uB2E8\uC5B4\uC7A5 \uB0B4\uC6A9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
    }

    res.json({
      ok: true,
      action: 'generateVocabularyWorkbook',
      level,
      wordsPerDay,
      wordCount: words.length,
      content,
    });
  } catch (error) {
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
    const bookGrade = CLINIC_LISTENING_BOOK_COMMON_GRADE;
    const uploadGrade = 'common';
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
        return jsonError(res, 400, '교재 파일은 100MB 이하로 업로드해주세요.');
      }
      return jsonError(res, 400, '교재 파일 형식이 올바르지 않습니다.');
    }

    let bookRows;
    if (targetId) {
      bookRows = await pool.query(
        `UPDATE clinic_listening_books
            SET grade = $2,
                title = $3,
                textbook_file_name = COALESCE(NULLIF($4, ''), textbook_file_name),
                textbook_file_link = COALESCE(NULLIF($5, ''), textbook_file_link),
                explanation_file_name = COALESCE(NULLIF($6, ''), explanation_file_name),
                explanation_file_link = COALESCE(NULLIF($7, ''), explanation_file_link),
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
         DO UPDATE SET textbook_file_name = COALESCE(NULLIF(EXCLUDED.textbook_file_name, ''), clinic_listening_books.textbook_file_name),
                       textbook_file_link = COALESCE(NULLIF(EXCLUDED.textbook_file_link, ''), clinic_listening_books.textbook_file_link),
                       explanation_file_name = COALESCE(NULLIF(EXCLUDED.explanation_file_name, ''), clinic_listening_books.explanation_file_name),
                       explanation_file_link = COALESCE(NULLIF(EXCLUDED.explanation_file_link, ''), clinic_listening_books.explanation_file_link),
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
          return jsonError(res, 400, '회차별 음성 파일은 100MB 이하로 업로드해주세요.');
        }
        return jsonError(res, 400, '회차별 음성 파일 형식이 올바르지 않습니다.');
      }

      if (!answers && !audioLink && !audioFileName) {
        continue;
      }

      await pool.query(
        `INSERT INTO clinic_listening_book_days (
            book_id, day_number, answers, audio_file_name, audio_link, updated_at
         )
         VALUES ($1::uuid, $2, $3, $4, $5, NOW())
         ON CONFLICT (book_id, day_number)
         DO UPDATE SET answers = COALESCE(NULLIF(EXCLUDED.answers, ''), clinic_listening_book_days.answers),
                       audio_file_name = COALESCE(NULLIF(EXCLUDED.audio_file_name, ''), clinic_listening_book_days.audio_file_name),
                       audio_link = COALESCE(NULLIF(EXCLUDED.audio_link, ''), clinic_listening_book_days.audio_link),
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

    const publicBook = clinicListeningBookPublic(book, daysRes.rows);
    syncClinicListeningBookForAssignedGradesToGas(publicBook).catch((error) => {
      console.error('clinic listening assigned book GAS sync failed:', error && error.message ? error.message : error);
    });

    res.json({
      ok: true,
      action: 'saveListeningBook',
      book: publicBook,
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

    syncClinicListeningGradeSelectionToGas(grade, title).catch((error) => {
      console.error('clinic listening selected book GAS sync failed:', error && error.message ? error.message : error);
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

app.post('/api/clinic-listening-materials/sync-sheet', async (req, res, next) => {
  try {
    const results = await syncAllClinicListeningGradeSelectionsToGas();
    res.json({
      ok: true,
      action: 'syncListeningSheet',
      results,
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
        return jsonError(res, 400, '듣기 파일은 100MB 이하로 업로드해주세요.');
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

app.get('/api/clinic-dictation', async (req, res, next) => {
  try {
    const phone = normalizeClinicPhone(req.query.phone);
    if (!phone) {
      return jsonError(res, 400, '학생 연락처가 필요합니다.');
    }

    const { rows } = await pool.query(
      `SELECT id, phone, student_name, class_name, grade, day_number,
              total_count, correct_count, wrong_answers,
              dictation_required, dictation_submitted, submitted_at,
              dictation_image_url, dictation_image_name,
              dictation_image_urls, dictation_image_names,
              created_at, updated_at
         FROM clinic_dictation_attempts
        WHERE phone = $1
        ORDER BY updated_at DESC, grade ASC, day_number DESC`,
      [phone]
    );

    res.json({ ok: true, attempts: rows.map(clinicDictationAttemptPublic) });
  } catch (error) {
    next(error);
  }
});


app.get('/api/clinic-dictation/admin', async (req, res, next) => {
  try {
    const filters = [];
    const values = [];
    const addFilter = (sql, value) => {
      values.push(value);
      filters.push(sql.replace('?', `$${values.length}`));
    };

    const className = normalizeClinicStudentText(req.query.className);
    const grade = normalizeClinicDictationGrade(req.query.grade);
    const status = String(req.query.status || '').trim();
    const phone = normalizeClinicPhone(req.query.phone);
    const name = normalizeClinicStudentText(req.query.name);
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit || '500'), 10) || 500, 1),
      1000,
    );

    if (className) addFilter('class_name ILIKE ?', `%${className}%`);
    if (grade) addFilter('grade = ?', grade);
    if (phone) addFilter('phone LIKE ?', `%${phone}%`);
    if (name) addFilter('student_name ILIKE ?', `%${name}%`);

    if (status === 'perfect') {
      filters.push('dictation_required = FALSE');
    } else if (status === 'pending') {
      filters.push('dictation_required = TRUE AND dictation_submitted = FALSE');
    } else if (status === 'submitted') {
      filters.push('dictation_required = TRUE AND dictation_submitted = TRUE');
    } else if (status && status !== 'all') {
      return jsonError(res, 400, '?? ??? ???? ????.');
    }

    values.push(limit);
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, phone, student_name, class_name, grade, day_number,
              total_count, correct_count, wrong_answers,
              dictation_required, dictation_submitted, submitted_at,
              dictation_image_url, dictation_image_name,
              dictation_image_urls, dictation_image_names,
              created_at, updated_at
         FROM clinic_dictation_attempts
        ${whereClause}
        ORDER BY updated_at DESC, created_at DESC
        LIMIT $${values.length}`,
      values
    );

    res.json({
      ok: true,
      attempts: rows.map(clinicDictationAttemptPublic),
      count: rows.length,
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/clinic-dictation/admin', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const teacherName = String(body.teacherName || req.query.teacherName || '').trim();
    if (!canDeleteClinicDictationAttempt(teacherName)) {
      return jsonError(res, 403, '딕테이션 결과 삭제는 스텐 계정만 가능합니다.');
    }

    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map((id) => String(id || '').trim()).filter(Boolean))]
      : [];
    if (!ids.length) {
      return jsonError(res, 400, '삭제할 딕테이션 결과를 선택해주세요.');
    }
    const invalidId = ids.find(
      (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    if (invalidId) {
      return jsonError(res, 400, '딕테이션 결과 ID가 올바르지 않습니다.');
    }

    const { rows } = await pool.query(
      `DELETE FROM clinic_dictation_attempts
        WHERE id = ANY($1::uuid[])
        RETURNING id, dictation_image_url, dictation_image_name`,
      [ids]
    );
    const imageDeleteResult = await deleteClinicDictationUploadedImages(rows);

    res.json({
      ok: true,
      deletedCount: rows.length,
      deletedIds: rows.map((row) => row.id),
      ...imageDeleteResult,
    });
  } catch (error) {
    next(error);
  }
});


app.post('/api/clinic-dictation/attempts', async (req, res, next) => {
  try {
    const phone = normalizeClinicPhone(req.body.phone);
    const studentName = normalizeClinicStudentText(req.body.name || req.body.studentName);
    const className = normalizeClinicStudentText(req.body.className || '미정');
    const grade = normalizeClinicDictationGrade(req.body.grade);
    const dayNumber = normalizeClinicListeningDayNumber(req.body.dayNumber || req.body.day);
    const totalCount = normalizePositiveInteger(req.body.totalCount, 1, 300);
    const correctCount = normalizePositiveInteger(req.body.correctCount, 0, 300);
    const wrongAnswers = normalizeWrongAnswerNumbers(req.body.wrongAnswers);

    if (!phone) {
      return jsonError(res, 400, '학생 연락처가 필요합니다.');
    }
    if (!grade) {
      return jsonError(res, 400, '지원하지 않는 학년/부서입니다.');
    }
    if (!dayNumber) {
      return jsonError(res, 400, 'Day 정보가 올바르지 않습니다.');
    }
    if (!totalCount || correctCount > totalCount) {
      return jsonError(res, 400, '점수 정보가 올바르지 않습니다.');
    }

    const dictationRequired = correctCount < totalCount;
    const { rows } = await pool.query(
      `INSERT INTO clinic_dictation_attempts (
         phone, student_name, class_name, grade, day_number,
         total_count, correct_count, wrong_answers,
         dictation_required, dictation_submitted, submitted_at,
         dictation_image_url, dictation_image_name,
         dictation_image_urls, dictation_image_names,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NULL, '', '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], NOW(), NOW())
       ON CONFLICT (phone, grade, day_number)
       DO UPDATE SET student_name = EXCLUDED.student_name,
                     class_name = EXCLUDED.class_name,
                     total_count = EXCLUDED.total_count,
                     correct_count = EXCLUDED.correct_count,
                     wrong_answers = EXCLUDED.wrong_answers,
                     dictation_required = EXCLUDED.dictation_required,
                     dictation_submitted = FALSE,
                     submitted_at = NULL,
                     dictation_image_url = '',
                     dictation_image_name = '',
                     dictation_image_urls = ARRAY[]::TEXT[],
                     dictation_image_names = ARRAY[]::TEXT[],
                     updated_at = NOW()
       RETURNING id, phone, student_name, class_name, grade, day_number,
                 total_count, correct_count, wrong_answers,
                 dictation_required, dictation_submitted, submitted_at,
                 dictation_image_url, dictation_image_name,
                 dictation_image_urls, dictation_image_names,
                 created_at, updated_at`,
      [
        phone,
        studentName,
        className || '미정',
        grade,
        dayNumber,
        totalCount,
        correctCount,
        wrongAnswers,
        dictationRequired,
      ]
    );

    res.json({ ok: true, attempt: clinicDictationAttemptPublic(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/clinic-dictation/:id/submission', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const phone = normalizeClinicPhone(req.body.phone);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return jsonError(res, 400, '제출 대상 정보가 올바르지 않습니다.');
    }
    if (!phone) {
      return jsonError(res, 400, '학생 연락처가 필요합니다.');
    }

    const existing = await pool.query(
      `SELECT id, phone, dictation_required, dictation_submitted
         FROM clinic_dictation_attempts
        WHERE id = $1
        LIMIT 1`,
      [id]
    );
    const attempt = existing.rows[0];
    if (!attempt) {
      return jsonError(res, 404, '제출 대상 기록을 찾을 수 없습니다.');
    }
    if (attempt.phone !== phone) {
      return jsonError(res, 403, '해당 학생의 딕테이션 과제만 제출할 수 있습니다.');
    }
    if (!attempt.dictation_required) {
      return jsonError(res, 400, '만점 회차는 딕테이션 제출 대상이 아닙니다.');
    }
    if (attempt.dictation_submitted) {
      const { rows } = await pool.query(
        `SELECT id, phone, student_name, class_name, grade, day_number,
                total_count, correct_count, wrong_answers,
                dictation_required, dictation_submitted, submitted_at,
                dictation_image_url, dictation_image_name,
                dictation_image_urls, dictation_image_names,
                created_at, updated_at
           FROM clinic_dictation_attempts
          WHERE id = $1`,
        [id]
      );
      return res.json({ ok: true, attempt: clinicDictationAttemptPublic(rows[0]) });
    }

    let uploaded;
    try {
      uploaded = await saveClinicDictationUploads(
        req,
        normalizeClinicDictationSubmissionFiles(req.body)
      );
    } catch (error) {
      if (error.message === 'DICTATION_FILE_COUNT_EXCEEDED') {
        return jsonError(res, 400, `사진은 최대 ${CLINIC_DICTATION_UPLOAD_MAX_COUNT}장까지 업로드할 수 있습니다.`);
      }
      if (error.message === 'DICTATION_FILE_TOO_LARGE') {
        return jsonError(res, 400, '사진은 장당 8MB 이하, 총 48MB 이하로 업로드해주세요.');
      }
      return jsonError(res, 400, '사진 파일 형식이 올바르지 않습니다.');
    }

    const imageUrls = uploaded.map((file) => file.url);
    const imageNames = uploaded.map((file) => file.name);
    const { rows } = await pool.query(
      `UPDATE clinic_dictation_attempts
          SET dictation_submitted = TRUE,
              submitted_at = NOW(),
              dictation_image_url = $2,
              dictation_image_name = $3,
              dictation_image_urls = $4::TEXT[],
              dictation_image_names = $5::TEXT[],
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, phone, student_name, class_name, grade, day_number,
                  total_count, correct_count, wrong_answers,
                  dictation_required, dictation_submitted, submitted_at,
                  dictation_image_url, dictation_image_name,
                  dictation_image_urls, dictation_image_names,
                  created_at, updated_at`,
      [id, imageUrls[0] || '', imageNames[0] || '', imageUrls, imageNames]
    );

    res.json({ ok: true, attempt: clinicDictationAttemptPublic(rows[0]) });
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

setInterval(() => {
  applyDueRosterActiveStatusReservations().catch(() => {});
}, 10 * 60 * 1000).unref();

async function start() {
  await pool.query('SELECT 1');
  await ensureTeamCommunicationTables();
  await ensureTodoTables();
  await ensureClinicListeningMaterialTables();
  await ensureDashboardStorageTables();
  await applyDueRosterActiveStatusReservations();
  app.listen(PORT, () => {
    console.log(`대세학원 강의실 예약 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
