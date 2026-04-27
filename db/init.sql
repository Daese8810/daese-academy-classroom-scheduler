CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS teachers (
  id BIGSERIAL PRIMARY KEY,
  login_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('영어과', '국어과')),
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  floor TEXT NOT NULL CHECK (floor IN ('6층', '7층')),
  room_type TEXT NOT NULL CHECK (room_type IN ('classroom', 'seminar')),
  sort_order INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('usage', 'event', 'blocked')),
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  repeat_group_id UUID NULL,
  created_by_teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  updated_by_teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS teacher_sessions (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_room_time ON reservations (room_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_reservations_teacher_time ON reservations (teacher_id, start_at);
CREATE INDEX IF NOT EXISTS idx_teacher_sessions_teacher ON teacher_sessions (teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_sessions_expires ON teacher_sessions (expires_at);

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

CREATE INDEX IF NOT EXISTS idx_team_messages_recipient_time ON team_messages (recipient_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_sender_time ON team_messages (sender_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_access_logs_time ON team_access_logs (created_at DESC);

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

CREATE TABLE IF NOT EXISTS todo_task_completions (
  task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, person_name)
);

CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON todo_tasks (due_date, created_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todo_task_completions_person ON todo_task_completions (person_name, completed_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'reservations_no_time_overlap_per_room'
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_time_overlap_per_room
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      );
  END IF;
END $$;

INSERT INTO teachers (login_id, display_name, department, role, password_hash, must_change_password)
VALUES
  ('스텐', '스텐', '영어과', 'admin',   'scrypt$16384$8$1$+FFam7HwZFVilTgwxsORqg==$RMrqUE6kGhinnL/qJIj3EAxRpixhVwzhzv2xYLc8WMnBcaUVDazJip/GX2fiNzHUGD7F0J1ZgMdC7mcKbs7GFA==', TRUE),
  ('조나단', '조나단', '영어과', 'teacher', 'scrypt$16384$8$1$FLK8wmIYCBk2lFI8WlC9Uw==$QBYxeldHBIP+DXF2tUTYy0msBNGB3UTgbNHFO3/RgGHs9hj+TCbkXiMPgcnc1wNdHVoeZgNzBRV/VoDnS4Jq7Q==', TRUE),
  ('존', '존', '영어과', 'teacher',     'scrypt$16384$8$1$KOT3k9XIGkgzAEPhSUuwGA==$FbtpnY4F807HmRToIMz5lMNcFJEJyYVf5rjFV10RfYub9f8UyW2+SJ0RTfqMHX2ShFVYxuh09DcqwuaiRsck9Q==', TRUE),
  ('스테이시', '스테이시', '영어과', 'teacher', 'scrypt$16384$8$1$borBOZzbcCRR3oKgoA+YXw==$xx9e3Hy/sE5L3b50DzD9VTmUvl3WqIqr/XVMgetrJ6UUAA6Ak8oVyf50n964HZjYdtbL3+zsMkpULJl0MpaTgw==', TRUE),
  ('다나', '다나', '영어과', 'teacher',   'scrypt$16384$8$1$7FzeL6RlnxiMpZSkdHJtVQ==$+X8dPTATctzoT7XCEHdeRuix5HnOJDhMQ2UAS4SMpwIIsGpjLfoQ1Nz5FA8Kqf34IYzww0BKhKq37yjnDalA5Q==', TRUE),
  ('주디', '주디', '영어과', 'teacher',   'scrypt$16384$8$1$+5oz2zaiXBr0lwZLX+lN0g==$8Ahq+8+y3yGL2M4TL2o2wQkktaVuUzCroTIJHS8bb0GZdcpiuDS9BNDYIByVRoSmrVTcWooepm56TTCeLPBhoA==', TRUE),
  ('국신', '국신', '국어과', 'teacher',   'scrypt$16384$8$1$+QbveTc0lvmPbdKbT5jLuw==$ratv6TW4iZc03Wd/lZpRHDqDlnPN/ZF6BrTSFj6ps5uZ6RKNkqK4XofEWatdQK7+ffnmRS7wfRtwocJtZpBKaw==', TRUE),
  ('국화', '국화', '국어과', 'teacher',   'scrypt$16384$8$1$/cgEM21hyMdtMSvWNHCFMg==$nDSfHe++GBkseYWHwO24CxLF10vdy1/wxHPad3IwTL5765n1KHHB4mE0wcusaXA/6GO05g8fv7LZHPiOD7xwUA==', TRUE),
  ('국보', '국보', '국어과', 'teacher',   'scrypt$16384$8$1$XUOl5A5PjLmz6tRnNR8uZQ==$KIGgzkO1NUCVxzKGduqcjnXGi0w4kvUu7YpJuiqFOgCFDwHDisRq1n3Lw4nu1Dz4ImFT5he8oApVnzqeaS1qWw==', TRUE),
  ('국호', '국호', '국어과', 'teacher',   'scrypt$16384$8$1$0nHAYtc/6RBNXCIwmg5vpA==$2rpAn7INF7MjP7cy//U95u5uDrDGSGeC7A2tuygG058RCtY0mDL9pewJ2lgmpVQjgGjtw+N7gQTCN+qJ01xxwQ==', TRUE),
  ('국대', '국대', '국어과', 'teacher',   'scrypt$16384$8$1$iTn1SHtj785gV2hOAu2AqA==$NAkPofkV2KfPPOryYQ9Q//zb5SXD+GRDCx/oD016HrpQLywUqklGGfWasNGFMk2wkyBBAvmGs01jhtCUFZ5lNw==', TRUE),
  ('국짱', '국짱', '국어과', 'teacher',   'scrypt$16384$8$1$CgQC5z3wtSjuD1FJDHQ/TQ==$OUZIy++WHCWBZdtMlt8RohSJ54sIDfNAXGp/xcEcSpWGj2vN0xjvLv+VcEYMJEt/miRT/duF0PHxdJ7Te8Gw6Q==', TRUE)
ON CONFLICT (login_id) DO NOTHING;

INSERT INTO team_presence (person_name)
VALUES
  ('스텐'),
  ('주디'),
  ('조나단'),
  ('존'),
  ('다나'),
  ('스테이시'),
  ('관리팀')
ON CONFLICT (person_name) DO NOTHING;

INSERT INTO rooms (code, name, short_name, floor, room_type, sort_order)
VALUES
  ('6-1', '6층 1번 강의실', '6층 1번', '6층', 'classroom', 1),
  ('6-2', '6층 2번 강의실', '6층 2번', '6층', 'classroom', 2),
  ('6-3', '6층 3번 강의실', '6층 3번', '6층', 'classroom', 3),
  ('6-4', '6층 4번 강의실', '6층 4번', '6층', 'classroom', 4),
  ('6-5', '6층 5번 강의실', '6층 5번', '6층', 'classroom', 5),
  ('6-6', '6층 6번 강의실', '6층 6번', '6층', 'classroom', 6),
  ('6-7', '6층 7번 강의실', '6층 7번', '6층', 'classroom', 7),
  ('6-seminar', '6층 세미나실', '6층 세미나실', '6층', 'seminar', 8),
  ('7-1', '7층 1번 강의실', '7층 1번', '7층', 'classroom', 9),
  ('7-2', '7층 2번 강의실', '7층 2번', '7층', 'classroom', 10),
  ('7-3', '7층 3번 강의실', '7층 3번', '7층', 'classroom', 11),
  ('7-4', '7층 4번 강의실', '7층 4번', '7층', 'classroom', 12),
  ('7-5', '7층 5번 강의실', '7층 5번', '7층', 'classroom', 13)
ON CONFLICT (code) DO NOTHING;
