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
const REPEAT_MODE_WEEKLY_FOREVER = 'weekly_forever';
const UPCOMING_LOOKAHEAD_DAYS = Number(process.env.UPCOMING_LOOKAHEAD_DAYS || 180);

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

function getWeekday(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function alignDateToWeekdayOnOrAfter(dateStr, weekday) {
  const diff = (weekday - getWeekday(dateStr) + 7) % 7;
  return addDays(dateStr, diff);
}

function parseTimeToMinutes(timeStr) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(timeStr));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isValidSlotTime(timeStr, allowEnd = false) {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes === null) return false;
  if (allowEnd && minutes === SLOT_END) return true;
  return minutes >= SLOT_START && minutes < SLOT_END && minutes % SLOT_MINUTES === 0;
}

function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
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
  const repeatTotalCount = row.repeat_total_count !== undefined && row.repeat_total_count !== null && row.repeat_total_count !== ''
    ? Number(row.repeat_total_count)
    : null;
  const recurringGroupId = row.source_series_id || row.repeat_group_id || null;
  const repeatMode = row.repeat_mode || (row.source_series_id ? REPEAT_MODE_WEEKLY_FOREVER : null);
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
    recurringGroupId,
    repeatMode,
    repeatCount: repeatTotalCount,
    recurringTotalCount: repeatTotalCount,
    sourceSeriesId: row.source_series_id || null,
    sourceOccurrenceDate: row.source_occurrence_date || null,
    createdAt: row.created_at,
  };
}

function compareReservations(a, b) {
  return (
    String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.start || '').localeCompare(String(b.start || '')) ||
    String(a.roomId || '').localeCompare(String(b.roomId || '')) ||
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')) ||
    String(a.id || '').localeCompare(String(b.id || ''))
  );
}

function isReservationUpcoming(reservation, now) {
  if (reservation.date > now.date) return true;
  if (reservation.date < now.date) return false;
  return parseTimeToMinutes(reservation.end) > now.actualMinutes;
}

function buildConflictResponse(conflict) {
  return {
    date: conflict.date,
    start: conflict.start_time,
    end: conflict.end_time,
    room: conflict.short_name,
    title: conflict.title,
    ownerId: conflict.owner_id,
  };
}

function pickEarlierConflict(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (String(a.date) !== String(b.date)) return String(a.date) < String(b.date) ? a : b;
  if (String(a.start_time) !== String(b.start_time)) return String(a.start_time) <= String(b.start_time) ? a : b;
  return a;
}

function makeSeriesOccurrenceId(seriesId, occurrenceDate) {
  return `series:${seriesId}:${occurrenceDate}`;
}

function parseSeriesOccurrenceId(value) {
  const m = /^series:([0-9a-fA-F-]{36}):(\d{4}-\d{2}-\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  return { seriesId: m[1], occurrenceDate: m[2] };
}

function buildSeriesOccurrencePublic(row, occurrenceDate) {
  return {
    id: makeSeriesOccurrenceId(row.id, occurrenceDate),
    date: occurrenceDate,
    roomId: row.room_id,
    ownerId: row.owner_id,
    ownerDept: row.owner_dept,
    title: row.title,
    note: row.note || '',
    start: row.start_time,
    end: row.end_time,
    category: row.category,
    recurringGroupId: row.id,
    repeatMode: REPEAT_MODE_WEEKLY_FOREVER,
    repeatCount: null,
    recurringTotalCount: null,
    sourceSeriesId: row.id,
    sourceOccurrenceDate: occurrenceDate,
    createdAt: row.created_at,
  };
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

async function ensureRecurringSchema() {
  await pool.query(`
    ALTER TABLE reservations
      ADD COLUMN IF NOT EXISTS source_series_id uuid,
      ADD COLUMN IF NOT EXISTS source_occurrence_date date
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_recurring_series (
      id uuid PRIMARY KEY,
      room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      category text NOT NULL,
      title text NOT NULL,
      note text,
      start_time time NOT NULL,
      end_time time NOT NULL,
      start_date date NOT NULL,
      repeat_until date NULL,
      created_by_teacher_id BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
      updated_by_teacher_id BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_recurring_exceptions (
      series_id uuid NOT NULL REFERENCES reservation_recurring_series(id) ON DELETE CASCADE,
      occurrence_date date NOT NULL,
      created_by_teacher_id BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (series_id, occurrence_date)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS reservation_recurring_series_room_idx
      ON reservation_recurring_series (room_id, weekday, start_date, repeat_until)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS reservation_recurring_series_teacher_idx
      ON reservation_recurring_series (teacher_id, start_date)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS reservations_source_series_idx
      ON reservations (source_series_id, source_occurrence_date)
  `);
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

async function findRecurringSeriesById(db, seriesId) {
  const { rows } = await db.query(
    `SELECT s.id::text,
            s.room_id,
            s.teacher_id,
            s.weekday,
            s.category,
            s.title,
            COALESCE(s.note, '') AS note,
            to_char(s.start_time, 'HH24:MI') AS start_time,
            to_char(s.end_time, 'HH24:MI') AS end_time,
            to_char(s.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(s.repeat_until, 'YYYY-MM-DD') AS repeat_until,
            s.created_at,
            room.code AS room_code,
            room.name AS room_name,
            room.short_name,
            room.floor,
            room.room_type,
            teacher.login_id AS owner_id,
            teacher.department AS owner_dept
       FROM reservation_recurring_series s
       JOIN rooms room ON room.id = s.room_id
       JOIN teachers teacher ON teacher.id = s.teacher_id
      WHERE s.id = $1::uuid`,
    [seriesId]
  );
  return rows[0] || null;
}

async function findOverrideReservationBySeriesOccurrence(db, seriesId, occurrenceDate) {
  const { rows } = await db.query(
    `SELECT r.id::text,
            room.code AS room_id,
            teacher.login_id AS owner_id,
            teacher.department AS owner_dept,
            r.title,
            COALESCE(r.note, '') AS note,
            r.category,
            COALESCE(r.source_series_id::text, '') AS source_series_id,
            to_char(r.source_occurrence_date, 'YYYY-MM-DD') AS source_occurrence_date,
            r.created_at,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'YYYY-MM-DD') AS date,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS start_time,
            to_char(r.end_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS end_time
       FROM reservations r
       JOIN rooms room ON room.id = r.room_id
       JOIN teachers teacher ON teacher.id = r.teacher_id
      WHERE r.source_series_id = $1::uuid
        AND r.source_occurrence_date = $2::date
      LIMIT 1`,
    [seriesId, occurrenceDate]
  );
  return rows[0] || null;
}

async function upsertSeriesException(db, seriesId, occurrenceDate, teacherDbId) {
  await db.query(
    `INSERT INTO reservation_recurring_exceptions (series_id, occurrence_date, created_by_teacher_id)
     VALUES ($1::uuid, $2::date, $3)
     ON CONFLICT (series_id, occurrence_date) DO NOTHING`,
    [seriesId, occurrenceDate, teacherDbId]
  );
}

async function findStoredConflict(db, roomId, startAt, endAt, excludeId = null) {
  const { rows } = await db.query(
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

async function findRecurringConflictOnDate(db, roomId, date, start, end) {
  const weekday = getWeekday(date);
  const { rows } = await db.query(
    `SELECT s.id::text AS series_id,
            room.code AS room_id,
            room.short_name,
            teacher.login_id AS owner_id,
            s.title,
            $2::text AS date,
            to_char(s.start_time, 'HH24:MI') AS start_time,
            to_char(s.end_time, 'HH24:MI') AS end_time
       FROM reservation_recurring_series s
       JOIN rooms room ON room.id = s.room_id
       JOIN teachers teacher ON teacher.id = s.teacher_id
      WHERE s.room_id = $1
        AND s.weekday = $3
        AND s.start_date <= $2::date
        AND (s.repeat_until IS NULL OR s.repeat_until >= $2::date)
        AND s.start_time < $5::time
        AND s.end_time > $4::time
        AND NOT EXISTS (
          SELECT 1
            FROM reservation_recurring_exceptions e
           WHERE e.series_id = s.id
             AND e.occurrence_date = $2::date
        )
      ORDER BY s.start_date ASC, s.created_at ASC
      LIMIT 1`,
    [roomId, date, weekday, start, end]
  );
  return rows[0] || null;
}

async function findConflict(db, roomId, date, start, end, options = {}) {
  const startAt = toKstTimestamp(date, start);
  const endAt = toKstTimestamp(date, end);
  const storedConflict = await findStoredConflict(db, roomId, startAt, endAt, options.excludeReservationId || null);
  if (storedConflict) return storedConflict;
  return findRecurringConflictOnDate(db, roomId, date, start, end);
}

async function findFutureActualConflictForSeries(db, roomId, startDate, weekday, start, end) {
  const { rows } = await db.query(
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
        AND to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'YYYY-MM-DD') >= $2::text
        AND EXTRACT(DOW FROM (r.start_at AT TIME ZONE '${SEOUL_TZ}')) = $3
        AND ((r.start_at AT TIME ZONE '${SEOUL_TZ}')::time < $5::time)
        AND ((r.end_at AT TIME ZONE '${SEOUL_TZ}')::time > $4::time)
      ORDER BY r.start_at ASC, r.created_at ASC
      LIMIT 1`,
    [roomId, startDate, weekday, start, end]
  );
  return rows[0] || null;
}

async function findFutureSeriesConflict(db, roomId, startDate, weekday, start, end) {
  const { rows } = await db.query(
    `SELECT s.id::text AS series_id,
            room.code AS room_id,
            room.short_name,
            teacher.login_id AS owner_id,
            s.title,
            to_char(GREATEST(s.start_date, $2::date), 'YYYY-MM-DD') AS date,
            to_char(s.start_time, 'HH24:MI') AS start_time,
            to_char(s.end_time, 'HH24:MI') AS end_time
       FROM reservation_recurring_series s
       JOIN rooms room ON room.id = s.room_id
       JOIN teachers teacher ON teacher.id = s.teacher_id
      WHERE s.room_id = $1
        AND s.weekday = $3
        AND s.start_time < $5::time
        AND s.end_time > $4::time
        AND (s.repeat_until IS NULL OR s.repeat_until >= $2::date)
      ORDER BY GREATEST(s.start_date, $2::date) ASC, s.created_at ASC
      LIMIT 1`,
    [roomId, startDate, weekday, start, end]
  );
  return rows[0] || null;
}

async function findConflictForWeeklyForeverSeries(db, roomId, startDate, start, end) {
  const weekday = getWeekday(startDate);
  const actualConflict = await findFutureActualConflictForSeries(db, roomId, startDate, weekday, start, end);
  const seriesConflict = await findFutureSeriesConflict(db, roomId, startDate, weekday, start, end);
  return pickEarlierConflict(actualConflict, seriesConflict);
}

async function loadStoredReservations(db, { startDate, endDate, teacherDbId = null, floor = 'all' } = {}) {
  const startAt = `${startDate}T00:00:00${SEOUL_OFFSET}`;
  const endExclusive = `${addDays(endDate, 1)}T00:00:00${SEOUL_OFFSET}`;
  const params = [startAt, endExclusive];
  const where = [
    `r.start_at >= $1::timestamptz`,
    `r.start_at < $2::timestamptz`,
  ];

  if (teacherDbId !== null) {
    params.push(teacherDbId);
    where.push(`r.teacher_id = $${params.length}`);
  }
  if (floor !== 'all') {
    params.push(floor);
    where.push(`room.floor = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT r.id::text,
            room.code AS room_id,
            teacher.login_id AS owner_id,
            teacher.department AS owner_dept,
            r.title,
            COALESCE(r.note, '') AS note,
            r.category,
            COALESCE(r.repeat_group_id::text, '') AS repeat_group_id,
            COALESCE(r.source_series_id::text, '') AS source_series_id,
            to_char(r.source_occurrence_date, 'YYYY-MM-DD') AS source_occurrence_date,
            CASE WHEN r.source_series_id IS NOT NULL THEN '${REPEAT_MODE_WEEKLY_FOREVER}' ELSE NULL END AS repeat_mode,
            CASE WHEN r.repeat_group_id IS NOT NULL THEN COUNT(*) OVER (PARTITION BY r.repeat_group_id) ELSE NULL END AS repeat_total_count,
            r.created_at,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'YYYY-MM-DD') AS date,
            to_char(r.start_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS start_time,
            to_char(r.end_at AT TIME ZONE '${SEOUL_TZ}', 'HH24:MI') AS end_time
       FROM reservations r
       JOIN rooms room ON room.id = r.room_id
       JOIN teachers teacher ON teacher.id = r.teacher_id
      WHERE ${where.join(' AND ')}
      ORDER BY room.sort_order, r.start_at, r.created_at`,
    params
  );

  return rows.map(reservationPublic);
}

async function loadRecurringSeriesRows(db, { startDate, endDate, teacherDbId = null, floor = 'all' } = {}) {
  const params = [startDate, endDate];
  const where = [
    `s.start_date <= $2::date`,
    `(s.repeat_until IS NULL OR s.repeat_until >= $1::date)`,
  ];

  if (teacherDbId !== null) {
    params.push(teacherDbId);
    where.push(`s.teacher_id = $${params.length}`);
  }
  if (floor !== 'all') {
    params.push(floor);
    where.push(`room.floor = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT s.id::text,
            room.code AS room_id,
            teacher.login_id AS owner_id,
            teacher.department AS owner_dept,
            s.title,
            COALESCE(s.note, '') AS note,
            s.category,
            s.weekday,
            to_char(s.start_time, 'HH24:MI') AS start_time,
            to_char(s.end_time, 'HH24:MI') AS end_time,
            to_char(s.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(s.repeat_until, 'YYYY-MM-DD') AS repeat_until,
            s.created_at
       FROM reservation_recurring_series s
       JOIN rooms room ON room.id = s.room_id
       JOIN teachers teacher ON teacher.id = s.teacher_id
      WHERE ${where.join(' AND ')}
      ORDER BY room.sort_order, s.start_time, s.created_at`,
    params
  );

  return rows;
}

async function loadRecurringExceptionsMap(db, seriesIds, startDate, endDate) {
  const normalizedIds = Array.from(new Set((seriesIds || []).filter(Boolean)));
  const map = new Map();
  if (!normalizedIds.length) return map;

  const { rows } = await db.query(
    `SELECT series_id::text, to_char(occurrence_date, 'YYYY-MM-DD') AS occurrence_date
       FROM reservation_recurring_exceptions
      WHERE series_id = ANY($1::uuid[])
        AND occurrence_date >= $2::date
        AND occurrence_date <= $3::date`,
    [normalizedIds, startDate, endDate]
  );

  for (const row of rows) {
    const set = map.get(row.series_id) || new Set();
    set.add(row.occurrence_date);
    map.set(row.series_id, set);
  }
  return map;
}

function expandRecurringSeriesRows(seriesRows, startDate, endDate, exceptionMap) {
  const items = [];
  for (const row of seriesRows) {
    const effectiveStart = startDate > row.start_date ? startDate : row.start_date;
    const effectiveEnd = row.repeat_until && row.repeat_until < endDate ? row.repeat_until : endDate;
    if (effectiveEnd < effectiveStart) continue;

    let occurrenceDate = alignDateToWeekdayOnOrAfter(effectiveStart, Number(row.weekday));
    if (occurrenceDate < row.start_date) {
      occurrenceDate = alignDateToWeekdayOnOrAfter(row.start_date, Number(row.weekday));
    }

    const skippedDates = exceptionMap.get(row.id) || new Set();
    while (occurrenceDate <= effectiveEnd) {
      if (!skippedDates.has(occurrenceDate)) {
        items.push(buildSeriesOccurrencePublic(row, occurrenceDate));
      }
      occurrenceDate = addDays(occurrenceDate, 7);
    }
  }
  return items;
}

async function loadCombinedReservations(db, startDate, endDate, options = {}) {
  const [storedReservations, seriesRows] = await Promise.all([
    loadStoredReservations(db, { startDate, endDate, teacherDbId: options.teacherDbId ?? null, floor: options.floor || 'all' }),
    loadRecurringSeriesRows(db, { startDate, endDate, teacherDbId: options.teacherDbId ?? null, floor: options.floor || 'all' }),
  ]);
  const exceptionMap = await loadRecurringExceptionsMap(db, seriesRows.map((row) => row.id), startDate, endDate);
  const recurringReservations = expandRecurringSeriesRows(seriesRows, startDate, endDate, exceptionMap);
  return [...storedReservations, ...recurringReservations].sort(compareReservations);
}

async function loadBoardReservations(startDate, endDate) {
  return loadCombinedReservations(pool, startDate, endDate);
}

async function loadSummary(user, floor = 'all') {
  const now = getSeoulNowParts();
  const today = now.date;
  const todayReservations = await loadCombinedReservations(pool, today, today, { floor });
  const upcomingMine = (await loadCombinedReservations(pool, today, addDays(today, UPCOMING_LOOKAHEAD_DAYS), { teacherDbId: user.dbId }))
    .filter((reservation) => isReservationUpcoming(reservation, now))
    .slice(0, 8);

  const { rows: allRoomsRows } = await pool.query(
    `SELECT code, name, short_name, floor, room_type
       FROM rooms
      WHERE active = TRUE
        AND ($1::text = 'all' OR floor = $1)
      ORDER BY sort_order`,
    [floor]
  );

  const occupiedNow = new Set(
    todayReservations
      .filter((reservation) => parseTimeToMinutes(reservation.start) <= now.actualMinutes && parseTimeToMinutes(reservation.end) > now.actualMinutes)
      .map((reservation) => reservation.roomId)
  );

  const availableNow = allRoomsRows.map(roomPublic).filter((room) => !occupiedNow.has(room.id));

  const roomMap = new Map();
  for (const reservation of todayReservations) {
    const list = roomMap.get(reservation.roomId) || [];
    list.push({ start: reservation.start, end: reservation.end });
    roomMap.set(reservation.roomId, list);
  }

  const remainingFree = [];
  const cursorStart = Math.max(SLOT_START, Math.ceil(now.actualMinutes / SLOT_MINUTES) * SLOT_MINUTES);
  if (cursorStart < SLOT_END) {
    for (const room of allRoomsRows) {
      const reservations = (roomMap.get(room.code) || [])
        .slice()
        .sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
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
    myUpcoming: upcomingMine,
    now,
  };
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
      appName: '대세학원 강의실 공유 예약 보드',
      orgName: '대세학원 · 대세영어 / 대세국어',
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
    const requestedRepeatMode = String(req.body.repeatMode || '').trim();
    const repeatMode = requestedRepeatMode === REPEAT_MODE_WEEKLY_FOREVER ? REPEAT_MODE_WEEKLY_FOREVER : null;
    const repeatCount = repeatMode === REPEAT_MODE_WEEKLY_FOREVER ? null : Number(req.body.repeatCount || 1);

    if (!isValidDate(date)) return jsonError(res, 400, '날짜가 올바르지 않습니다.');
    if (!isValidSlotTime(start) || !isValidSlotTime(end, true)) return jsonError(res, 400, '시간은 30분 단위로 입력해 주세요.');
    if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) return jsonError(res, 400, '종료 시간은 시작 시간보다 뒤여야 합니다.');
    if (!title) return jsonError(res, 400, '용도 / 제목을 입력해 주세요.');
    if (!['usage', 'event', 'blocked'].includes(category)) return jsonError(res, 400, '예약 구분이 올바르지 않습니다.');
    if (category === 'blocked' && req.user.role !== 'admin') return jsonError(res, 403, '관리자만 차단 일정을 만들 수 있습니다.');
    if (!repeatMode && (!Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > 12)) {
      return jsonError(res, 400, '반복 횟수는 1~12회만 가능합니다.');
    }

    const [room, owner] = await Promise.all([findRoomByCode(roomCode), findTeacherByLoginId(ownerLoginId)]);
    if (!room) return jsonError(res, 404, '강의실을 찾을 수 없습니다.');
    if (!owner) return jsonError(res, 404, '예약자를 찾을 수 없습니다.');
    if (req.user.role !== 'admin' && owner.login_id !== req.user.login_id) return jsonError(res, 403, '본인 일정만 예약할 수 있습니다.');

    if (repeatMode === REPEAT_MODE_WEEKLY_FOREVER) {
      await client.query('BEGIN');
      const conflict = await findConflictForWeeklyForeverSeries(client, room.id, date, start, end);
      if (conflict) {
        await client.query('ROLLBACK');
        return jsonError(res, 409, '중복 예약이 있어 저장할 수 없습니다.', { conflict: buildConflictResponse(conflict) });
      }

      const seriesId = crypto.randomUUID();
      await client.query(
        `INSERT INTO reservation_recurring_series (
            id, room_id, teacher_id, weekday, category, title, note,
            start_time, end_time, start_date, repeat_until,
            created_by_teacher_id, updated_by_teacher_id
         )
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::time, $9::time, $10::date, NULL, $11, $11)`,
        [seriesId, room.id, owner.id, getWeekday(date), category, title, note, start, end, date, req.user.dbId]
      );
      await client.query('COMMIT');
      return res.json({ ok: true, insertedCount: 0, seriesId, repeatMode });
    }

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
      const conflict = await findConflict(client, room.id, item.date, start, end, { excludeReservationId: null });
      if (conflict) {
        await client.query('ROLLBACK');
        return jsonError(res, 409, '중복 예약이 있어 저장할 수 없습니다.', { conflict: buildConflictResponse(conflict) });
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
    const virtualOccurrence = parseSeriesOccurrenceId(reservationId);

    const date = String(req.body.date || '');
    const roomCode = String(req.body.roomId || '');
    const start = String(req.body.start || '');
    const end = String(req.body.end || '');
    const title = String(req.body.title || '').trim();
    const note = String(req.body.note || '').trim();
    const category = String(req.body.category || 'usage');

    if (!isValidDate(date)) return jsonError(res, 400, '날짜가 올바르지 않습니다.');
    if (!isValidSlotTime(start) || !isValidSlotTime(end, true)) return jsonError(res, 400, '시간은 30분 단위로 입력해 주세요.');
    if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) return jsonError(res, 400, '종료 시간은 시작 시간보다 뒤여야 합니다.');
    if (!title) return jsonError(res, 400, '용도 / 제목을 입력해 주세요.');
    if (!['usage', 'event', 'blocked'].includes(category)) return jsonError(res, 400, '예약 구분이 올바르지 않습니다.');
    if (category === 'blocked' && req.user.role !== 'admin') return jsonError(res, 403, '관리자만 차단 일정으로 바꿀 수 있습니다.');

    if (virtualOccurrence) {
      const series = await findRecurringSeriesById(client, virtualOccurrence.seriesId);
      if (!series) return jsonError(res, 404, '예약을 찾을 수 없습니다.');
      const canEdit = req.user.role === 'admin' || series.owner_id === req.user.login_id;
      if (!canEdit) return jsonError(res, 403, '이 예약을 수정할 권한이 없습니다.');

      const ownerLoginId = req.user.role === 'admin' ? String(req.body.ownerId || series.owner_id) : series.owner_id;
      const [room, owner, existingOverride] = await Promise.all([
        findRoomByCode(roomCode),
        findTeacherByLoginId(ownerLoginId),
        findOverrideReservationBySeriesOccurrence(client, virtualOccurrence.seriesId, virtualOccurrence.occurrenceDate),
      ]);
      if (!room) return jsonError(res, 404, '강의실을 찾을 수 없습니다.');
      if (!owner) return jsonError(res, 404, '예약자를 찾을 수 없습니다.');
      if (req.user.role !== 'admin' && owner.login_id !== req.user.login_id) return jsonError(res, 403, '본인 일정만 수정할 수 있습니다.');

      await client.query('BEGIN');
      await upsertSeriesException(client, virtualOccurrence.seriesId, virtualOccurrence.occurrenceDate, req.user.dbId);
      const conflict = await findConflict(client, room.id, date, start, end, {
        excludeReservationId: existingOverride ? existingOverride.id : null,
      });
      if (conflict) {
        await client.query('ROLLBACK');
        return jsonError(res, 409, '중복 예약이 있어 저장할 수 없습니다.', { conflict: buildConflictResponse(conflict) });
      }

      const startAt = toKstTimestamp(date, start);
      const endAt = toKstTimestamp(date, end);
      if (existingOverride) {
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
          [room.id, owner.id, category, title, note, startAt, endAt, req.user.dbId, existingOverride.id]
        );
      } else {
        await client.query(
          `INSERT INTO reservations (
              room_id, teacher_id, category, title, note,
              start_at, end_at, source_series_id, source_occurrence_date,
              created_by_teacher_id, updated_by_teacher_id
           )
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::uuid, $9::date, $10, $10)`,
          [room.id, owner.id, category, title, note, startAt, endAt, virtualOccurrence.seriesId, virtualOccurrence.occurrenceDate, req.user.dbId]
        );
      }
      await client.query('COMMIT');
      return res.json({ ok: true, mode: 'series_override' });
    }

    const { rows: existingRows } = await client.query(
      `SELECT r.id::text,
              r.room_id,
              r.teacher_id,
              r.category,
              COALESCE(r.repeat_group_id::text, '') AS repeat_group_id,
              COALESCE(r.source_series_id::text, '') AS source_series_id,
              to_char(r.source_occurrence_date, 'YYYY-MM-DD') AS source_occurrence_date,
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

    const ownerLoginId = req.user.role === 'admin' ? String(req.body.ownerId || existing.owner_id) : existing.owner_id;
    const [room, owner] = await Promise.all([findRoomByCode(roomCode), findTeacherByLoginId(ownerLoginId)]);
    if (!room) return jsonError(res, 404, '강의실을 찾을 수 없습니다.');
    if (!owner) return jsonError(res, 404, '예약자를 찾을 수 없습니다.');
    if (req.user.role !== 'admin' && owner.login_id !== req.user.login_id) return jsonError(res, 403, '본인 일정만 수정할 수 있습니다.');

    const startAt = toKstTimestamp(date, start);
    const endAt = toKstTimestamp(date, end);

    await client.query('BEGIN');
    if (existing.source_series_id && existing.source_occurrence_date) {
      await upsertSeriesException(client, existing.source_series_id, existing.source_occurrence_date, req.user.dbId);
    }

    const conflict = await findConflict(client, room.id, date, start, end, { excludeReservationId: reservationId });
    if (conflict) {
      await client.query('ROLLBACK');
      return jsonError(res, 409, '중복 예약이 있어 저장할 수 없습니다.', { conflict: buildConflictResponse(conflict) });
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
    const mode = String(req.query.mode || '');
    const stopFromRaw = String(req.query.stopFrom || '');
    const virtualOccurrence = parseSeriesOccurrenceId(reservationId);

    if (virtualOccurrence) {
      const series = await findRecurringSeriesById(client, virtualOccurrence.seriesId);
      if (!series) return jsonError(res, 404, '예약을 찾을 수 없습니다.');
      const canDelete = req.user.role === 'admin' || series.owner_id === req.user.login_id;
      if (!canDelete) return jsonError(res, 403, '이 예약을 취소할 권한이 없습니다.');

      if (scope === 'series') {
        const stopFrom = virtualOccurrence.occurrenceDate;
        const repeatUntil = addDays(stopFrom, -7);
        await client.query('BEGIN');
        await client.query(
          `UPDATE reservation_recurring_series
              SET repeat_until = $2::date,
                  updated_by_teacher_id = $3,
                  updated_at = NOW()
            WHERE id = $1::uuid`,
          [virtualOccurrence.seriesId, repeatUntil, req.user.dbId]
        );
        await client.query(
          `DELETE FROM reservations
            WHERE source_series_id = $1::uuid
              AND source_occurrence_date >= $2::date`,
          [virtualOccurrence.seriesId, stopFrom]
        );
        await client.query(
          `DELETE FROM reservation_recurring_exceptions
            WHERE series_id = $1::uuid
              AND occurrence_date >= $2::date`,
          [virtualOccurrence.seriesId, stopFrom]
        );
        await client.query('COMMIT');
        return res.json({ ok: true, scope: 'series', mode: 'stop', stopFrom, seriesId: virtualOccurrence.seriesId });
      }

      await client.query('BEGIN');
      await upsertSeriesException(client, virtualOccurrence.seriesId, virtualOccurrence.occurrenceDate, req.user.dbId);
      await client.query('COMMIT');
      return res.json({ ok: true, deletedCount: 1, scope: 'single', mode: 'skip', seriesId: virtualOccurrence.seriesId });
    }

    const { rows } = await client.query(
      `SELECT r.id::text,
              COALESCE(r.repeat_group_id::text, '') AS repeat_group_id,
              COALESCE(r.source_series_id::text, '') AS source_series_id,
              to_char(r.source_occurrence_date, 'YYYY-MM-DD') AS source_occurrence_date,
              t.login_id AS owner_id
         FROM reservations r
         JOIN teachers t ON t.id = r.teacher_id
        WHERE r.id = $1::uuid`,
      [reservationId]
    );
    const reservation = rows[0];
    if (!reservation) return jsonError(res, 404, '예약을 찾을 수 없습니다.');
    const canDelete = req.user.role === 'admin' || reservation.owner_id === req.user.login_id;
    if (!canDelete) return jsonError(res, 403, '이 예약을 취소할 권한이 없습니다.');

    if (scope === 'series' && reservation.source_series_id) {
      const stopFrom = reservation.source_occurrence_date || stopFromRaw;
      if (!isValidDate(stopFrom)) return jsonError(res, 400, '반복 종료 날짜가 올바르지 않습니다.');
      await client.query('BEGIN');
      await client.query(
        `UPDATE reservation_recurring_series
            SET repeat_until = $2::date,
                updated_by_teacher_id = $3,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [reservation.source_series_id, addDays(stopFrom, -7), req.user.dbId]
      );
      await client.query(
        `DELETE FROM reservations
          WHERE source_series_id = $1::uuid
            AND source_occurrence_date >= $2::date`,
        [reservation.source_series_id, stopFrom]
      );
      await client.query(
        `DELETE FROM reservation_recurring_exceptions
          WHERE series_id = $1::uuid
            AND occurrence_date >= $2::date`,
        [reservation.source_series_id, stopFrom]
      );
      await client.query('COMMIT');
      return res.json({ ok: true, scope: 'series', mode: 'stop', stopFrom, seriesId: reservation.source_series_id });
    }

    if (scope === 'series' && reservation.repeat_group_id) {
      const result = await client.query('DELETE FROM reservations WHERE repeat_group_id = $1::uuid', [reservation.repeat_group_id]);
      return res.json({ ok: true, deletedCount: result.rowCount, scope: 'series' });
    }

    if (reservation.source_series_id && reservation.source_occurrence_date) {
      await client.query('BEGIN');
      await upsertSeriesException(client, reservation.source_series_id, reservation.source_occurrence_date, req.user.dbId);
      const result = await client.query('DELETE FROM reservations WHERE id = $1::uuid', [reservationId]);
      await client.query('COMMIT');
      return res.json({ ok: true, deletedCount: result.rowCount, scope: 'single', mode: 'skip', seriesId: reservation.source_series_id });
    }

    const result = await client.query('DELETE FROM reservations WHERE id = $1::uuid', [reservationId]);
    res.json({ ok: true, deletedCount: result.rowCount, scope: 'single' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
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
  await ensureRecurringSchema();
  app.listen(PORT, () => {
    console.log(`대세학원 강의실 예약 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
