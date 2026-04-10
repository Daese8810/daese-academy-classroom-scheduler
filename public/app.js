    (() => {
      const UI_KEY = 'daese_classroom_ui_v1';
      const SLOT_START = 9 * 60;
      const SLOT_END = 18 * 60;
      const SLOT_MINUTES = 30;
      const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
      const VIEW_MODES = {
        week: '주간 보기',
        day: '일간 보기'
      };

      const loginView = document.getElementById('loginView');
      const appView = document.getElementById('appView');
      const modalBackdrop = document.getElementById('modalBackdrop');
      const toastWrap = document.getElementById('toastWrap');

      let state = {
        appName: '대세학원 대세학원 강의실 공유 예약 보드',
        orgName: '대세학원 · 대세영어 / 대세국어',
        users: [],
        rooms: [],
        reservations: [],
        summary: {
          availableNow: [],
          remainingFree: [],
          myUpcoming: [],
          now: null
        },
        me: null,
        ui: loadUiState()
      };

      function defaultUiState() {
        const today = formatDate(new Date());
        return {
          selectedDate: today,
          mobileSelectedDate: today,
          viewMode: 'week',
          floor: 'all',
          teacher: 'all',
          dept: 'all',
          availableNowOnly: false,
          remainingTodayOnly: false,
          myOnly: false,
          forceMobile: false
        };
      }

      function loadUiState() {
        try {
          const raw = localStorage.getItem(UI_KEY);
          if (!raw) return defaultUiState();
          return Object.assign(defaultUiState(), JSON.parse(raw) || {});
        } catch (error) {
          console.error(error);
          return defaultUiState();
        }
      }

      function saveUiState() {
        localStorage.setItem(UI_KEY, JSON.stringify(state.ui));
      }

      function statefulId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      }

      function getCurrentUser() {
        return state.me;
      }

      function ensureSessionStillValid() {}

      async function api(path, options = {}) {
        const init = {
          method: options.method || 'GET',
          headers: Object.assign({}, options.headers || {}),
          credentials: 'same-origin'
        };
        if (options.body !== undefined) {
          init.headers['Content-Type'] = 'application/json';
          init.body = JSON.stringify(options.body);
        }
        const response = await fetch(path, init);
        let data = null;
        try {
          data = await response.json();
        } catch (error) {
          data = null;
        }
        if (!response.ok || !data?.ok) {
          if (response.status === 401) {
            state.me = null;
            state.reservations = [];
            state.summary = { availableNow: [], remainingFree: [], myUpcoming: [], now: null };
          }
          const err = new Error(data?.message || '요청 처리 중 오류가 발생했습니다.');
          err.status = response.status;
          err.data = data;
          throw err;
        }
        return data;
      }

      async function loadBootstrap() {
        const data = await api('/api/bootstrap');
        state.appName = data.appName || state.appName;
        state.orgName = data.orgName || state.orgName;
        state.users = Array.isArray(data.users) ? data.users : [];
        state.rooms = Array.isArray(data.rooms) ? data.rooms : [];
        state.me = data.me || null;
      }

      function getReservationFetchRange() {
        if (state.ui.viewMode === 'day') {
          return { start: state.ui.selectedDate, end: state.ui.selectedDate };
        }
        const weekDates = getWeekDates(state.ui.selectedDate);
        return { start: weekDates[0], end: weekDates[6] };
      }

      async function refreshBoardData() {
        if (!state.me) {
          state.reservations = [];
          return;
        }
        const { start, end } = getReservationFetchRange();
        const data = await api(`/api/reservations?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
        state.reservations = Array.isArray(data.reservations) ? data.reservations : [];
      }

      async function refreshSummaryData() {
        if (!state.me) {
          state.summary = { availableNow: [], remainingFree: [], myUpcoming: [], now: null };
          return;
        }
        const data = await api(`/api/dashboard-summary?floor=${encodeURIComponent(state.ui.floor)}`);
        state.summary = {
          availableNow: Array.isArray(data.availableNow) ? data.availableNow : [],
          remainingFree: Array.isArray(data.remainingFree) ? data.remainingFree : [],
          myUpcoming: Array.isArray(data.myUpcoming) ? data.myUpcoming : [],
          now: data.now || null
        };
      }

      async function refreshAllData() {
        await Promise.all([refreshBoardData(), refreshSummaryData()]);
      }
      function parseDate(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
      }

      function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }

      function formatDateLabel(dateStr) {
        const date = parseDate(dateStr);
        return `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`;
      }

      function formatDateLong(dateStr) {
        const date = parseDate(dateStr);
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${DAY_NAMES[date.getDay()]})`;
      }

      function getWeekStart(date) {
        const copy = new Date(date);
        copy.setHours(0, 0, 0, 0);
        const diff = (copy.getDay() + 6) % 7;
        copy.setDate(copy.getDate() - diff);
        return copy;
      }

      function addDays(date, amount) {
        const copy = new Date(date);
        copy.setDate(copy.getDate() + amount);
        return copy;
      }

      function getWeekDates(dateStr) {
        const weekStart = getWeekStart(parseDate(dateStr));
        return Array.from({ length: 7 }, (_, i) => formatDate(addDays(weekStart, i)));
      }

      function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      }

      function minutesToTime(minutes) {
        const h = String(Math.floor(minutes / 60)).padStart(2, '0');
        const m = String(minutes % 60).padStart(2, '0');
        return `${h}:${m}`;
      }

      function getTimeSlots() {
        const slots = [];
        for (let m = SLOT_START; m < SLOT_END; m += SLOT_MINUTES) {
          slots.push(minutesToTime(m));
        }
        return slots;
      }

      function getEndTimeOptions() {
        const slots = [];
        for (let m = SLOT_START + SLOT_MINUTES; m <= SLOT_END; m += SLOT_MINUTES) {
          slots.push(minutesToTime(m));
        }
        return slots;
      }

      function getRoom(roomId) {
        return state.rooms.find(r => r.id === roomId) || null;
      }

      function getUser(userId) {
        return state.users.find(u => u.id === userId) || null;
      }

      function getReservationsForRoomDate(roomId, date) {
        return state.reservations
          .filter(r => r.roomId === roomId && r.date === date)
          .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
      }

      function overlaps(a, b) {
        if (a.roomId !== b.roomId || a.date !== b.date) return false;
        return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);
      }

      function canEditReservation(reservation, user) {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return reservation.ownerId === user.id;
      }

      function isToday(dateStr) {
        return dateStr === formatDate(new Date());
      }

      function getNowInfo() {
        if (state.summary?.now?.date && state.summary?.now?.time) {
          return {
            date: state.summary.now.date,
            time: state.summary.now.time,
            actualMinutes: timeToMinutes(state.summary.now.time)
          };
        }
        const now = new Date();
        return {
          date: formatDate(now),
          time: minutesToTime(now.getHours() * 60 + (now.getMinutes() < 30 ? 0 : 30)),
          actualMinutes: now.getHours() * 60 + now.getMinutes()
        };
      }

      function isReservationMatchingFilters(reservation, user) {
        const ui = state.ui;
        if (ui.teacher !== 'all' && reservation.ownerId !== ui.teacher) return false;
        if (ui.dept !== 'all' && reservation.ownerDept !== ui.dept) return false;
        if (ui.myOnly && user && reservation.ownerId !== user.id) return false;
        return true;
      }

      function roomMatchesFilters(room, selectedDate) {
        const ui = state.ui;
        if (ui.floor !== 'all' && room.floor !== ui.floor) return false;
        if (ui.availableNowOnly) {
          return getAvailableRoomsNow().some(r => r.id === room.id);
        }
        return true;
      }

      function getVisibleRooms(selectedDate) {
        return state.rooms.filter(room => roomMatchesFilters(room, selectedDate));
      }

      function getVisibleSlotsForDate(dateStr) {
        const slots = getTimeSlots();
        if (!state.ui.remainingTodayOnly) return slots;
        const now = getNowInfo();
        const currentWeek = getWeekDates(state.ui.selectedDate);
        if (!currentWeek.includes(now.date)) return slots;
        if (dateStr < now.date) return [];
        if (dateStr > now.date) return slots;
        return slots.filter(time => timeToMinutes(time) >= now.actualMinutes - (now.actualMinutes % 30 === 0 ? 0 : now.actualMinutes % 30) + (now.actualMinutes % 30 === 0 ? 0 : 30));
      }

      function getWeekTitle(dateStr) {
        const weekDates = getWeekDates(dateStr);
        const first = parseDate(weekDates[0]);
        const last = parseDate(weekDates[6]);
        return `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일`;
      }

      function getAvailableRoomsNow() {
        return Array.isArray(state.summary.availableNow) ? state.summary.availableNow : [];
      }

      function getUpcomingMine() {
        return Array.isArray(state.summary.myUpcoming) ? state.summary.myUpcoming : [];
      }

      function getRemainingFreeBlocksToday() {
        return Array.isArray(state.summary.remainingFree) ? state.summary.remainingFree : [];
      }

      function getBoardHintText(user) {
        const hints = [];
        if (state.ui.teacher !== 'all') hints.push(`예약자 필터: ${state.ui.teacher}`);
        if (state.ui.dept !== 'all') hints.push(`학과 필터: ${state.ui.dept}`);
        if (state.ui.myOnly && user) hints.push(`내 예약만 강조: ${user.id}`);
        if (state.ui.availableNowOnly) hints.push('현재 시각 기준 사용 가능한 강의실만 표시');
        if (state.ui.remainingTodayOnly) hints.push('현재 주에서 오늘 남은 시간대만 표시');
        if (!hints.length) return '빈 칸을 누르면 바로 예약할 수 있고, 색이 있는 칸을 누르면 상세 보기·수정·취소가 가능합니다.';
        return hints.join(' · ');
      }

      function escapeHtml(str) {
        return String(str ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function getCategoryLabel(category) {
        if (category === 'event') return '세미나/행사';
        if (category === 'blocked') return '관리자 차단';
        return '사용 중';
      }

      function getCategoryClass(category) {
        if (category === 'event') return 'res-event';
        if (category === 'blocked') return 'res-blocked';
        return 'res-usage';
      }

      function renderLogin() {
        loginView.innerHTML = `
          <div class="login-shell">
            <div class="login-card">
              <div class="login-left brand-hero">
  <div class="brand-hero-inner">
    <div class="brand-title">대세영어 X 대세국어</div>
    <div class="brand-logo-wrap">
      <img src="/daese_logo.png" alt="대세학원 로고" class="brand-logo">
    </div>
  </div>
</div>
              <div class="login-right">
                <div>
                  <h2>로그인</h2>
                  <p class="help">아이디와 비밀번호를 입력하면 바로 공용 예약 보드로 이동합니다.</p>
                </div>
                <form id="loginForm" class="form-grid">
                  <div class="field">
                    <label for="loginId">아이디</label>
                    <select id="loginId" required>
                      <option value="">선생님을 선택하세요</option>
                      ${state.users.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.id)} (${escapeHtml(u.dept)})</option>`).join('')}
                    </select>
                  </div>
                  <div class="field">
                    <label for="loginPassword">비밀번호</label>
                    <input id="loginPassword" type="password" value="1" placeholder="최초 비밀번호는 1" required />
                  </div>
                  <div class="login-foot">
                    <button type="submit" class="primary">예약 보드 열기</button>
                    <span class="help">관리자: 스텐 / 최초 비밀번호: 1</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        `;

        loginView.querySelectorAll('[data-fill-user]').forEach(el => {
          el.addEventListener('click', () => {
            const value = el.getAttribute('data-fill-user');
            const select = loginView.querySelector('#loginId');
            select.value = value;
            loginView.querySelector('#loginPassword').focus();
          });
        });

        const loginForm = loginView.querySelector('#loginForm');
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const id = loginView.querySelector('#loginId').value.trim();
          const pw = loginView.querySelector('#loginPassword').value;
          try {
            const data = await api('/api/login', {
              method: 'POST',
              body: { loginId: id, password: pw }
            });
            state.me = data.me;
            await refreshAllData();
            showToast(`${id} 선생님으로 로그인했습니다.`, 'success');
            render();
          } catch (error) {
            showToast(error.message || '로그인에 실패했습니다.', 'error');
          }
        });
      }

      function renderApp() {
        const user = getCurrentUser();
        if (!user) return;
        const now = getNowInfo();
        const selectedDate = state.ui.selectedDate;
        const weekDates = getWeekDates(selectedDate);
        const availableNow = getAvailableRoomsNow(isToday(selectedDate) ? selectedDate : now.date);
        const myUpcoming = getUpcomingMine(user);
        const remainingFree = getRemainingFreeBlocksToday();
        const mobileMode = state.ui.forceMobile || window.innerWidth < 900;
        const boardTitle = state.ui.viewMode === 'week'
          ? `${getWeekTitle(selectedDate)} · 주간 시간표`
          : `${formatDateLong(selectedDate)} · 일간 시간표`;

        appView.innerHTML = `
          <header class="app-header">
            <div class="app-header-inner">
              <div class="brand">
                <h1>${escapeHtml(state.appName)}</h1>
                <p>${escapeHtml(state.orgName)} · 6층 1~7번 강의실, 6층 세미나실, 7층 1~5번 강의실 · 30분 단위 예약</p>
              </div>
              <div class="user-toolbar">
                <span class="badge ${user.role === 'admin' ? 'admin' : ''}">${escapeHtml(user.id)} · ${escapeHtml(user.dept)}${user.role === 'admin' ? ' · 관리자' : ''}</span>
                <span class="badge">현재 시각 ${escapeHtml(now.date)} ${escapeHtml(minutesToTime(Math.floor(now.actualMinutes / 60) * 60 + (now.actualMinutes % 60 >= 30 ? 30 : 0)))}</span>
                <button class="ghost" data-action="change-password">비밀번호 변경</button>
                <button class="ghost" data-action="logout">로그아웃</button>
              </div>
            </div>
          </header>
          <div class="app-shell">
            <div class="layout-gap"></div>
            ${user.mustChangePassword ? `
              <section class="card" style="border:1px solid #f3c4c4;background:#fff7f7;padding:16px 18px;">
                <strong style="display:block;margin-bottom:6px;">초기 비밀번호를 사용 중입니다.</strong>
                <span class="help">상단의 ‘비밀번호 변경’ 버튼으로 안전한 비밀번호로 바꿔 주세요.</span>
              </section>
              <div class="layout-gap"></div>
            ` : ''}
            <section class="card toolbar-card">
              <div class="toolbar-row">
                <div class="group">
                  <button data-action="move-date" data-step="-1">${state.ui.viewMode === 'week' ? '◀ 이전 주' : '◀ 이전 날'}</button>
                  <input type="date" id="selectedDateInput" value="${escapeHtml(state.ui.selectedDate)}" />
                  <button data-action="move-date" data-step="1">${state.ui.viewMode === 'week' ? '다음 주 ▶' : '다음 날 ▶'}</button>
                  <button class="ghost" data-action="go-today">오늘로</button>
                </div>
                <div class="group legend">
                  <span class="legend-item"><span class="legend-swatch" style="background: var(--green-bg);"></span>사용 중</span>
                  <span class="legend-item"><span class="legend-swatch" style="background: var(--amber-bg);"></span>세미나/행사</span>
                  <span class="legend-item"><span class="legend-swatch" style="background: var(--red-bg);"></span>관리자 차단</span>
                  <span class="legend-item"><span class="legend-swatch" style="background: var(--gray-bg);"></span>필터 제외 예약</span>
                </div>
              </div>
              <div class="toolbar-row">
                <div class="group">
                  <select id="floorFilter">
                    <option value="all" ${state.ui.floor === 'all' ? 'selected' : ''}>전체 층</option>
                    <option value="6층" ${state.ui.floor === '6층' ? 'selected' : ''}>6층만</option>
                    <option value="7층" ${state.ui.floor === '7층' ? 'selected' : ''}>7층만</option>
                  </select>
                  <select id="teacherFilter">
                    <option value="all">전체 선생님</option>
                    ${state.users.map(u => `<option value="${escapeHtml(u.id)}" ${state.ui.teacher === u.id ? 'selected' : ''}>${escapeHtml(u.id)} (${escapeHtml(u.dept)})</option>`).join('')}
                  </select>
                  <select id="deptFilter">
                    <option value="all" ${state.ui.dept === 'all' ? 'selected' : ''}>전체 학과</option>
                    <option value="영어과" ${state.ui.dept === '영어과' ? 'selected' : ''}>영어과만 보기</option>
                    <option value="국어과" ${state.ui.dept === '국어과' ? 'selected' : ''}>국어과만 보기</option>
                  </select>
                  <select id="viewModeSelect">
                    <option value="week" ${state.ui.viewMode === 'week' ? 'selected' : ''}>주간 보기</option>
                    <option value="day" ${state.ui.viewMode === 'day' ? 'selected' : ''}>일간 보기</option>
                  </select>
                </div>
                <div class="group">
                  <button class="primary" data-action="new-reservation">+ 빈 시간 예약</button>
                  ${user.role === 'admin' ? '<button class="warn" data-action="new-block">관리자 차단 추가</button>' : ''}
                </div>
              </div>
              <div class="toolbar-row">
                <div class="chip-row">
                  <button class="chip ${state.ui.dept === 'all' ? 'active' : ''}" data-action="quick-dept" data-dept="all">전체 보기</button>
                  <button class="chip ${state.ui.dept === '영어과' ? 'active' : ''}" data-action="quick-dept" data-dept="영어과">영어과만 보기</button>
                  <button class="chip ${state.ui.dept === '국어과' ? 'active' : ''}" data-action="quick-dept" data-dept="국어과">국어과만 보기</button>
                </div>
                <div class="group">
                  <label class="toggle-pill"><input type="checkbox" id="availableNowOnly" ${state.ui.availableNowOnly ? 'checked' : ''} /> 지금 비어 있는 강의실만 보기</label>
                  <label class="toggle-pill"><input type="checkbox" id="remainingTodayOnly" ${state.ui.remainingTodayOnly ? 'checked' : ''} /> 오늘 남은 빈 시간만 보기</label>
                  <label class="toggle-pill"><input type="checkbox" id="myOnly" ${state.ui.myOnly ? 'checked' : ''} /> 내가 예약한 것만 보기</label>
                  <label class="toggle-pill"><input type="checkbox" id="forceMobile" ${state.ui.forceMobile ? 'checked' : ''} /> 모바일 화면으로 보기</label>
                </div>
              </div>
            </section>
            <div class="layout-gap"></div>
            <section class="summary-grid">
              <div class="card summary-card">
                <h3>선택 기준</h3>
                <strong>${escapeHtml(VIEW_MODES[state.ui.viewMode])}</strong>
                <p>${state.ui.viewMode === 'week' ? escapeHtml(getWeekTitle(selectedDate)) : escapeHtml(formatDateLong(selectedDate))}</p>
              </div>
              <div class="card summary-card">
                <h3>지금 비어 있는 강의실</h3>
                <strong>${availableNow.length}개</strong>
                <p>${availableNow.slice(0, 5).map(r => r.short).join(', ') || '현재 기준으로 비어 있는 강의실이 없습니다.'}</p>
              </div>
              <div class="card summary-card">
                <h3>오늘 남은 빈 시간</h3>
                <strong>${remainingFree.length}건</strong>
                <p>${remainingFree.slice(0, 2).map(item => `${item.room} ${item.start}~${item.end}`).join(' · ') || '오늘 남은 빈 시간이 없습니다.'}</p>
              </div>
              <div class="card summary-card">
                <h3>내 예약</h3>
                <strong>${myUpcoming.length}건</strong>
                <p>${myUpcoming.slice(0, 2).map(r => `${formatDateLabel(r.date)} ${r.start} ${getRoom(r.roomId)?.short || ''}`).join(' · ') || '예정된 예약이 없습니다.'}</p>
              </div>
            </section>
            <div class="layout-gap"></div>
            <section class="main-grid">
              <div class="card board-card">
                <div class="board-head">
                  <div>
                    <h2>${escapeHtml(boardTitle)}</h2>
                    <p>${escapeHtml(getBoardHintText(user))}</p>
                  </div>
                  <div class="chip-row">
                    <span class="inline-note">예약 단위 30분</span>
                    <span class="inline-note">반복 예약 지원</span>
                    <span class="inline-note">모바일 보기 ${mobileMode ? '활성' : '비활성'}</span>
                  </div>
                </div>
                <div class="board-wrap" id="boardWrap">
                  ${mobileMode ? renderMobileBoard(user) : renderBoard(user)}
                </div>
              </div>
              <aside class="side-stack">
                <section class="card side-card">
                  <h3>내 예약 바로보기</h3>
                  <p class="sub">수정·취소가 필요한 일정은 여기서 바로 확인할 수 있습니다.</p>
                  <div class="list">
                    ${myUpcoming.length ? myUpcoming.map(r => renderSideReservationItem(r)).join('') : '<div class="empty-state">현재 예정된 내 예약이 없습니다.</div>'}
                  </div>
                </section>
                <section class="card side-card">
                  <h3>지금 비어 있는 강의실</h3>
                  <p class="sub">현재 시각 기준으로 바로 선점 가능한 강의실 목록입니다.</p>
                  <div class="list">
                    ${availableNow.length ? availableNow.slice(0, 10).map(room => `
                      <div class="list-item">
                        <strong>${escapeHtml(room.name)}</strong>
                        <small>${escapeHtml(room.floor)} · ${room.type === 'seminar' ? '세미나실' : '일반 강의실'}</small>
                      </div>
                    `).join('') : '<div class="empty-state">현재 비어 있는 강의실이 없습니다.</div>'}
                  </div>
                </section>
                <section class="card side-card">
                  <h3>오늘 남은 빈 시간</h3>
                  <p class="sub">오늘 기준으로 앞으로 남아 있는 가장 가까운 빈 시간대입니다.</p>
                  <div class="list">
                    ${remainingFree.length ? remainingFree.map(item => `
                      <div class="list-item">
                        <strong>${escapeHtml(item.room)}</strong>
                        <small>${escapeHtml(item.start)} ~ ${escapeHtml(item.end)}</small>
                      </div>
                    `).join('') : '<div class="empty-state">오늘 남은 빈 시간이 없습니다.</div>'}
                  </div>
                </section>
              </aside>
            </section>
          </div>
        `;

        bindAppEvents();
      }

      function renderSideReservationItem(r) {
        const room = getRoom(r.roomId);
        return `
          <div class="list-item" data-action="open-reservation" data-res-id="${escapeHtml(r.id)}">
            <strong>${escapeHtml(r.title)}</strong>
            <small>${escapeHtml(formatDateLabel(r.date))} · ${escapeHtml(r.start)}~${escapeHtml(r.end)} · ${escapeHtml(room?.short || '')}</small>
          </div>
        `;
      }

      function renderBoard(user) {
        return state.ui.viewMode === 'week' ? renderWeekBoard(user) : renderDayBoard(user, state.ui.selectedDate);
      }

      function renderWeekBoard(user) {
        const dates = getWeekDates(state.ui.selectedDate);
        const visibleRooms = getVisibleRooms(state.ui.selectedDate);
        if (!visibleRooms.length) {
          return '<div class="empty-state" style="margin: 16px;">현재 필터 조건에 맞는 강의실이 없습니다.</div>';
        }
        const hasAnyVisibleSlot = dates.some(date => getVisibleSlotsForDate(date).length);
        if (!hasAnyVisibleSlot) {
          return '<div class="empty-state" style="margin: 16px;">표시할 시간대가 없습니다. “오늘 남은 빈 시간만 보기”를 해제해 보세요.</div>';
        }
        const now = getNowInfo();
        let headRow1 = '<tr><th class="first-col" rowspan="2">강의실</th>';
        let headRow2 = '<tr>';
        for (const date of dates) {
          const slots = getVisibleSlotsForDate(date);
          if (!slots.length) continue;
          headRow1 += `<th class="day-group" colspan="${slots.length}">${escapeHtml(formatDateLabel(date))}</th>`;
          for (const slot of slots) {
            headRow2 += `<th>${escapeHtml(slot)}</th>`;
          }
        }
        headRow1 += '</tr>';
        headRow2 += '</tr>';

        const rowsHtml = visibleRooms.map(room => renderWeekRoomRow(room, dates, user, now)).join('');
        return `
          <table class="schedule-table week-table">
            <thead>${headRow1}${headRow2}</thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }

      function renderWeekRoomRow(room, dates, user, now) {
        let html = `<tr><th>${escapeHtml(room.short)}<span class="room-sub">${escapeHtml(room.floor)} · ${room.type === 'seminar' ? '세미나실' : '일반 강의실'}</span></th>`;
        for (const date of dates) {
          const slots = getVisibleSlotsForDate(date);
          if (!slots.length) continue;
          const reservations = getReservationsForRoomDate(room.id, date);
          let i = 0;
          while (i < slots.length) {
            const slot = slots[i];
            const reservation = reservations.find(r => timeToMinutes(r.start) <= timeToMinutes(slot) && timeToMinutes(slot) < timeToMinutes(r.end));
            if (reservation) {
              let span = 0;
              while (i + span < slots.length) {
                const slotMin = timeToMinutes(slots[i + span]);
                if (timeToMinutes(reservation.start) <= slotMin && slotMin < timeToMinutes(reservation.end)) span += 1;
                else break;
              }
              html += renderReservationCell(reservation, span, user);
              i += span;
            } else {
              const isNow = date === now.date && timeToMinutes(slot) <= now.actualMinutes && now.actualMinutes < timeToMinutes(slot) + SLOT_MINUTES;
              const past = date < now.date || (date === now.date && timeToMinutes(slot) + SLOT_MINUTES <= now.actualMinutes);
              html += `<td class="empty-slot ${isNow ? 'now-marker' : ''} ${past ? 'past-slot' : ''}" data-action="new-reservation-cell" data-room-id="${escapeHtml(room.id)}" data-date="${escapeHtml(date)}" data-start="${escapeHtml(slot)}"></td>`;
              i += 1;
            }
          }
        }
        html += '</tr>';
        return html;
      }

      function renderDayBoard(user, date) {
        const visibleRooms = getVisibleRooms(date);
        const slots = getVisibleSlotsForDate(date);
        if (!visibleRooms.length) {
          return '<div class="empty-state" style="margin: 16px;">현재 필터 조건에 맞는 강의실이 없습니다.</div>';
        }
        if (!slots.length) {
          return '<div class="empty-state" style="margin: 16px;">표시할 시간대가 없습니다. “오늘 남은 빈 시간만 보기”를 해제해 보세요.</div>';
        }
        const now = getNowInfo();
        const head = `
          <tr>
            <th class="first-col">강의실</th>
            ${slots.map(slot => `<th>${escapeHtml(slot)}</th>`).join('')}
          </tr>
        `;
        const rows = visibleRooms.map(room => {
          const reservations = getReservationsForRoomDate(room.id, date);
          let row = `<tr><th>${escapeHtml(room.short)}<span class="room-sub">${escapeHtml(room.floor)} · ${room.type === 'seminar' ? '세미나실' : '일반 강의실'}</span></th>`;
          let i = 0;
          while (i < slots.length) {
            const slot = slots[i];
            const reservation = reservations.find(r => timeToMinutes(r.start) <= timeToMinutes(slot) && timeToMinutes(slot) < timeToMinutes(r.end));
            if (reservation) {
              let span = 0;
              while (i + span < slots.length) {
                const slotMin = timeToMinutes(slots[i + span]);
                if (timeToMinutes(reservation.start) <= slotMin && slotMin < timeToMinutes(reservation.end)) span += 1;
                else break;
              }
              row += renderReservationCell(reservation, span, user);
              i += span;
            } else {
              const isNow = date === now.date && timeToMinutes(slot) <= now.actualMinutes && now.actualMinutes < timeToMinutes(slot) + SLOT_MINUTES;
              const past = date < now.date || (date === now.date && timeToMinutes(slot) + SLOT_MINUTES <= now.actualMinutes);
              row += `<td class="empty-slot ${isNow ? 'now-marker' : ''} ${past ? 'past-slot' : ''}" data-action="new-reservation-cell" data-room-id="${escapeHtml(room.id)}" data-date="${escapeHtml(date)}" data-start="${escapeHtml(slot)}"></td>`;
              i += 1;
            }
          }
          row += '</tr>';
          return row;
        }).join('');

        return `
          <table class="schedule-table">
            <thead>${head}</thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      }

      function renderReservationCell(reservation, span, user) {
        const room = getRoom(reservation.roomId);
        const matchesFilter = isReservationMatchingFilters(reservation, user);
        const baseClass = matchesFilter ? getCategoryClass(reservation.category) : 'res-filtered';
        const ownClass = user && reservation.ownerId === user.id ? 'res-own' : '';
        const shortTitle = matchesFilter ? escapeHtml(reservation.title) : '사용 중';
        const subText = matchesFilter
          ? `${escapeHtml(reservation.ownerId)} · ${escapeHtml(reservation.start)}~${escapeHtml(reservation.end)}`
          : `${escapeHtml(getCategoryLabel(reservation.category))} · ${escapeHtml(reservation.start)}~${escapeHtml(reservation.end)}`;
        return `
          <td colspan="${span}">
            <div class="res-box ${baseClass} ${ownClass}" data-action="open-reservation" data-res-id="${escapeHtml(reservation.id)}" title="${escapeHtml(room?.name || '')} / ${escapeHtml(reservation.title)} / ${escapeHtml(reservation.ownerId)}">
              <div>
                <span class="tiny-tag">${escapeHtml(matchesFilter ? getCategoryLabel(reservation.category) : '필터 제외')}</span>
                <strong>${shortTitle}</strong>
              </div>
              <small>${subText}</small>
            </div>
          </td>
        `;
      }

      function renderMobileBoard(user) {
        const weekDates = getWeekDates(state.ui.selectedDate);
        if (!weekDates.includes(state.ui.mobileSelectedDate)) {
          state.ui.mobileSelectedDate = state.ui.selectedDate;
        }
        const targetDate = state.ui.viewMode === 'day' ? state.ui.selectedDate : state.ui.mobileSelectedDate;
        const visibleRooms = getVisibleRooms(targetDate);
        if (!visibleRooms.length) {
          return '<div class="mobile-board"><div class="empty-state">현재 필터 조건에 맞는 강의실이 없습니다.</div></div>';
        }
        const now = getNowInfo();
        return `
          <div class="mobile-board">
            ${state.ui.viewMode === 'week' ? `
              <div class="mobile-day-tabs">
                ${weekDates.map(date => `<button class="mobile-tab ${state.ui.mobileSelectedDate === date ? 'active' : ''}" data-action="mobile-select-date" data-date="${escapeHtml(date)}">${escapeHtml(formatDateLabel(date))}</button>`).join('')}
              </div>
            ` : ''}
            ${visibleRooms.map(room => {
              const reservations = getReservationsForRoomDate(room.id, targetDate);
              const activeNow = reservations.find(r => timeToMinutes(r.start) <= now.actualMinutes && now.actualMinutes < timeToMinutes(r.end) && targetDate === now.date);
              const filteredReservations = reservations.map(r => ({ res: r, visible: isReservationMatchingFilters(r, user) }));
              return `
                <div class="room-mobile-card">
                  <div class="room-mobile-head">
                    <div>
                      <h4>${escapeHtml(room.name)}</h4>
                      <div class="help">${escapeHtml(formatDateLong(targetDate))}</div>
                    </div>
                    <span class="status-pill ${activeNow ? 'busy' : 'free'}">${activeNow ? '사용 중' : '지금 사용 가능'}</span>
                  </div>
                  <div class="chip-row">
                    <button class="success" data-action="new-reservation-room" data-room-id="${escapeHtml(room.id)}" data-date="${escapeHtml(targetDate)}">이 강의실 예약</button>
                  </div>
                  <div class="mobile-res-list">
                    ${filteredReservations.length ? filteredReservations.map(({ res, visible }) => `
                      <div class="mobile-res-item ${visible ? res.category : 'filtered'}" data-action="open-reservation" data-res-id="${escapeHtml(res.id)}">
                        <strong>${escapeHtml(visible ? res.title : '사용 중')}</strong>
                        <div class="help">${escapeHtml(res.start)} ~ ${escapeHtml(res.end)} · ${escapeHtml(visible ? `${res.ownerId} (${res.ownerDept})` : '필터 제외 예약')}</div>
                      </div>
                    `).join('') : '<div class="empty-state">예약이 없습니다. 바로 선점해서 사용할 수 있습니다.</div>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      function bindAppEvents() {
        appView.querySelector('#selectedDateInput').addEventListener('change', async (e) => {
          state.ui.selectedDate = e.target.value;
          state.ui.mobileSelectedDate = e.target.value;
          saveUiState();
          try {
            await refreshBoardData();
            render();
          } catch (error) {
            showToast(error.message || '일정을 불러오지 못했습니다.', 'error');
          }
        });
        appView.querySelector('#floorFilter').addEventListener('change', async (e) => {
          state.ui.floor = e.target.value;
          saveUiState();
          try {
            await refreshSummaryData();
            render();
          } catch (error) {
            showToast(error.message || '요약 정보를 불러오지 못했습니다.', 'error');
          }
        });
        appView.querySelector('#teacherFilter').addEventListener('change', (e) => {
          state.ui.teacher = e.target.value;
          saveUiState();
          render();
        });
        appView.querySelector('#deptFilter').addEventListener('change', (e) => {
          state.ui.dept = e.target.value;
          saveUiState();
          render();
        });
        appView.querySelector('#viewModeSelect').addEventListener('change', async (e) => {
          state.ui.viewMode = e.target.value;
          saveUiState();
          try {
            await refreshBoardData();
            render();
          } catch (error) {
            showToast(error.message || '일정을 불러오지 못했습니다.', 'error');
          }
        });
        ['availableNowOnly', 'remainingTodayOnly', 'myOnly', 'forceMobile'].forEach(key => {
          appView.querySelector(`#${key}`).addEventListener('change', (e) => {
            state.ui[key] = e.target.checked;
            saveUiState();
            render();
          });
        });

        appView.querySelectorAll('[data-action]').forEach(el => {
          el.addEventListener('click', handleActionClick);
        });
      }

      async function handleActionClick(e) {
        const action = e.currentTarget.getAttribute('data-action');
        if (!action) return;
        const user = getCurrentUser();
        if (!user) return;
        switch (action) {
          case 'logout':
            try {
              await api('/api/logout', { method: 'POST' });
            } catch (error) {
              // 로그아웃은 쿠키를 비우는 성격이라 오류가 나도 화면은 정리합니다.
            }
            state.me = null;
            state.reservations = [];
            state.summary = { availableNow: [], remainingFree: [], myUpcoming: [], now: null };
            closeModal();
            showToast('로그아웃했습니다.');
            render();
            return;
          case 'change-password':
            openPasswordModal();
            return;
          case 'go-today':
            state.ui.selectedDate = formatDate(new Date());
            state.ui.mobileSelectedDate = state.ui.selectedDate;
            saveUiState();
            try {
              await refreshBoardData();
              render();
            } catch (error) {
              showToast(error.message || '일정을 불러오지 못했습니다.', 'error');
            }
            return;
          case 'move-date': {
            const step = Number(e.currentTarget.getAttribute('data-step')) || 0;
            const delta = state.ui.viewMode === 'week' ? step * 7 : step;
            state.ui.selectedDate = formatDate(addDays(parseDate(state.ui.selectedDate), delta));
            state.ui.mobileSelectedDate = state.ui.selectedDate;
            saveUiState();
            try {
              await refreshBoardData();
              render();
            } catch (error) {
              showToast(error.message || '일정을 불러오지 못했습니다.', 'error');
            }
            return;
          }
          case 'quick-dept':
            state.ui.dept = e.currentTarget.getAttribute('data-dept') || 'all';
            saveUiState();
            render();
            return;
          case 'new-reservation':
            openReservationModal({
              mode: 'create',
              date: state.ui.selectedDate,
              roomId: getVisibleRooms(state.ui.selectedDate)[0]?.id || state.rooms[0]?.id,
              start: '09:00'
            });
            return;
          case 'new-block':
            openReservationModal({
              mode: 'create',
              category: 'blocked',
              date: state.ui.selectedDate,
              roomId: getVisibleRooms(state.ui.selectedDate)[0]?.id || state.rooms[0]?.id,
              start: '09:00'
            });
            return;
          case 'new-reservation-cell':
            openReservationModal({
              mode: 'create',
              roomId: e.currentTarget.getAttribute('data-room-id'),
              date: e.currentTarget.getAttribute('data-date'),
              start: e.currentTarget.getAttribute('data-start')
            });
            return;
          case 'new-reservation-room':
            openReservationModal({
              mode: 'create',
              roomId: e.currentTarget.getAttribute('data-room-id'),
              date: e.currentTarget.getAttribute('data-date'),
              start: '09:00'
            });
            return;
          case 'open-reservation': {
            const resId = e.currentTarget.getAttribute('data-res-id');
            const reservation = state.reservations.find(r => r.id === resId) || state.summary.myUpcoming.find(r => r.id === resId);
            if (reservation) openReservationDetailModal(reservation);
            return;
          }
          case 'mobile-select-date':
            state.ui.mobileSelectedDate = e.currentTarget.getAttribute('data-date');
            saveUiState();
            render();
            return;
        }
      }

      function openPasswordModal() {
        const user = getCurrentUser();
        if (!user) return;
        openModal(`
          <div class="modal">
            <h2>비밀번호 변경</h2>
            <p class="sub">최초 비밀번호 1은 여기서 바로 변경할 수 있습니다.</p>
            <form id="passwordForm" class="modal-grid">
              <div class="field full">
                <label>아이디</label>
                <input value="${escapeHtml(user.id)}" disabled />
              </div>
              <div class="field full">
                <label for="currentPw">현재 비밀번호</label>
                <input id="currentPw" type="password" required />
              </div>
              <div class="field">
                <label for="newPw">새 비밀번호</label>
                <input id="newPw" type="password" required />
              </div>
              <div class="field">
                <label for="confirmPw">새 비밀번호 확인</label>
                <input id="confirmPw" type="password" required />
              </div>
              <div class="modal-actions full">
                <button type="button" data-modal-close>취소</button>
                <button type="submit" class="primary">변경 저장</button>
              </div>
            </form>
          </div>
        `, (modal) => {
          modal.querySelector('#passwordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPw = modal.querySelector('#currentPw').value;
            const newPw = modal.querySelector('#newPw').value;
            const confirmPw = modal.querySelector('#confirmPw').value;
            if (!newPw) {
              showToast('새 비밀번호를 입력해 주세요.', 'error');
              return;
            }
            if (newPw !== confirmPw) {
              showToast('새 비밀번호 확인이 일치하지 않습니다.', 'error');
              return;
            }
            try {
              await api('/api/change-password', {
                method: 'POST',
                body: { currentPassword: currentPw, newPassword: newPw }
              });
              if (state.me) state.me.mustChangePassword = false;
              closeModal();
              showToast('비밀번호를 변경했습니다.', 'success');
              render();
            } catch (error) {
              showToast(error.message || '비밀번호를 변경하지 못했습니다.', 'error');
            }
          });
        });
      }

      function openReservationModal(options) {
        const user = getCurrentUser();
        if (!user) return;
        const isEdit = options.mode === 'edit';
        const existing = isEdit ? (state.reservations.find(r => r.id === options.reservationId) || state.summary.myUpcoming.find(r => r.id === options.reservationId)) : null;
        const startValue = options.start || existing?.start || '09:00';
        const dateValue = options.date || existing?.date || state.ui.selectedDate;
        const roomValue = options.roomId || existing?.roomId || state.rooms[0].id;
        const initialCategory = options.category || existing?.category || 'usage';
        const endOptions = getEndTimeOptions();
        const defaultEnd = endOptions.find(time => timeToMinutes(time) > timeToMinutes(startValue)) || endOptions[endOptions.length - 1];
        const endValue = existing?.end || defaultEnd;
        const recurring = !!existing?.recurringGroupId;
        const ownerValue = existing?.ownerId || user.id;
        const deptValue = getUser(ownerValue)?.dept || user.dept;
        const repeatCountDefault = 4;

        openModal(`
          <div class="modal">
            <h2>${isEdit ? '예약 수정' : '새 예약 만들기'}</h2>
            <p class="sub">빈 시간은 바로 예약할 수 있고, 반복 예약은 매주 같은 시간대로 한 번에 넣을 수 있습니다.</p>
            <form id="reservationForm" class="modal-grid">
              <div class="field">
                <label for="resDate">날짜</label>
                <input id="resDate" type="date" value="${escapeHtml(dateValue)}" required />
              </div>
              <div class="field">
                <label for="resRoom">강의실</label>
                <select id="resRoom" required>
                  ${state.rooms.map(room => `<option value="${escapeHtml(room.id)}" ${room.id === roomValue ? 'selected' : ''}>${escapeHtml(room.name)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="resStart">시작 시간</label>
                <select id="resStart" required>
                  ${getTimeSlots().map(time => `<option value="${escapeHtml(time)}" ${time === startValue ? 'selected' : ''}>${escapeHtml(time)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="resEnd">종료 시간</label>
                <select id="resEnd" required>
                  ${endOptions.map(time => `<option value="${escapeHtml(time)}" ${time === endValue ? 'selected' : ''}>${escapeHtml(time)}</option>`).join('')}
                </select>
              </div>
              <div class="field ${user.role === 'admin' ? '' : 'full'}">
                <label for="resCategory">구분</label>
                <select id="resCategory" required>
                  <option value="usage" ${initialCategory === 'usage' ? 'selected' : ''}>사용 중</option>
                  <option value="event" ${initialCategory === 'event' ? 'selected' : ''}>세미나/행사</option>
                  ${user.role === 'admin' ? `<option value="blocked" ${initialCategory === 'blocked' ? 'selected' : ''}>관리자 차단</option>` : ''}
                </select>
              </div>
              ${user.role === 'admin' ? `
                <div class="field">
                  <label for="resOwner">예약자</label>
                  <select id="resOwner">
                    ${state.users.map(u => `<option value="${escapeHtml(u.id)}" ${u.id === ownerValue ? 'selected' : ''}>${escapeHtml(u.id)} (${escapeHtml(u.dept)})</option>`).join('')}
                  </select>
                </div>
              ` : `
                <div class="field full">
                  <label>예약자</label>
                  <input value="${escapeHtml(ownerValue)} (${escapeHtml(deptValue)})" disabled />
                </div>
              `}
              <div class="field full">
                <label for="resTitle">용도 / 제목</label>
                <input id="resTitle" type="text" value="${escapeHtml(existing?.title || '')}" placeholder="예: 영어 독해, 국어 논술, 학과 회의" required />
              </div>
              <div class="field full">
                <label for="resNote">메모</label>
                <textarea id="resNote" placeholder="수업 목적, 학년, 준비물, 비고 등을 적어두면 편합니다.">${escapeHtml(existing?.note || '')}</textarea>
              </div>
              <div class="field full">
                <label class="toggle-pill" style="width: fit-content;"><input type="checkbox" id="repeatWeekly" ${isEdit ? 'disabled' : ''} ${recurring ? 'checked' : ''}/> 매주 반복 예약</label>
                <div class="help">체크하면 같은 요일·같은 시간으로 다음 주들까지 한 번에 생성합니다. 관리자 차단도 반복 생성할 수 있습니다.${isEdit ? ' 수정 화면에서는 개별 일정만 변경됩니다.' : ''}</div>
              </div>
              <div class="field full" id="repeatCountField" style="${(isEdit || !recurring) ? 'display:none;' : ''}">
                <label for="repeatCount">반복 횟수</label>
                <select id="repeatCount">
                  ${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === repeatCountDefault ? 'selected' : ''}>총 ${n}회</option>`).join('')}
                </select>
              </div>
              <div class="modal-actions full">
                <button type="button" data-modal-close>취소</button>
                <button type="submit" class="primary">${isEdit ? '수정 저장' : '예약 저장'}</button>
              </div>
            </form>
          </div>
        `, (modal) => {
          const startSelect = modal.querySelector('#resStart');
          const endSelect = modal.querySelector('#resEnd');
          const repeatToggle = modal.querySelector('#repeatWeekly');
          const repeatCountField = modal.querySelector('#repeatCountField');
          if (repeatToggle) {
            repeatToggle.addEventListener('change', () => {
              repeatCountField.style.display = repeatToggle.checked ? '' : 'none';
            });
          }
          startSelect.addEventListener('change', () => {
            const startMin = timeToMinutes(startSelect.value);
            const options = Array.from(endSelect.options);
            const firstValid = options.find(o => timeToMinutes(o.value) > startMin);
            if (timeToMinutes(endSelect.value) <= startMin && firstValid) {
              endSelect.value = firstValid.value;
            }
          });
          modal.querySelector('#reservationForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const roomId = modal.querySelector('#resRoom').value;
            const date = modal.querySelector('#resDate').value;
            const start = modal.querySelector('#resStart').value;
            const end = modal.querySelector('#resEnd').value;
            const title = modal.querySelector('#resTitle').value.trim();
            const note = modal.querySelector('#resNote').value.trim();
            const category = modal.querySelector('#resCategory').value;
            const ownerId = user.role === 'admin' ? modal.querySelector('#resOwner').value : user.id;
            const repeatCount = !isEdit && repeatToggle && repeatToggle.checked ? Number(modal.querySelector('#repeatCount').value) : 1;

            if (!date || !roomId || !start || !end || !title) {
              showToast('날짜, 강의실, 시간, 용도를 모두 입력해 주세요.', 'error');
              return;
            }
            if (timeToMinutes(end) <= timeToMinutes(start)) {
              showToast('종료 시간은 시작 시간보다 뒤여야 합니다.', 'error');
              return;
            }

            const payload = {
              roomId,
              date,
              start,
              end,
              title,
              note,
              category,
              ownerId,
              repeatCount
            };

            try {
              if (isEdit) {
                await api(`/api/reservations/${encodeURIComponent(existing.id)}`, {
                  method: 'PUT',
                  body: payload
                });
                showToast('예약을 수정했습니다.', 'success');
              } else {
                const result = await api('/api/reservations', {
                  method: 'POST',
                  body: payload
                });
                showToast(`${result.insertedCount || repeatCount}건의 예약을 저장했습니다.`, 'success');
              }
              await refreshAllData();
              closeModal();
              render();
            } catch (error) {
              const conflict = error.data?.conflict;
              if (conflict) {
                showToast(`중복 예약이 있어 저장할 수 없습니다. ${conflict.date} ${conflict.start}~${conflict.end} / ${conflict.room} / ${conflict.title}`, 'error');
                return;
              }
              showToast(error.message || '예약을 저장하지 못했습니다.', 'error');
            }
          });
        });
      }

      function openReservationDetailModal(reservation) {
        const user = getCurrentUser();
        const room = getRoom(reservation.roomId);
        const owner = getUser(reservation.ownerId);
        const canEdit = canEditReservation(reservation, user);
        const seriesCount = reservation.recurringGroupId ? state.reservations.filter(r => r.recurringGroupId === reservation.recurringGroupId).length : 0;
        openModal(`
          <div class="modal">
            <h2>${escapeHtml(reservation.title)}</h2>
            <p class="sub">예약 상세 정보입니다. ${canEdit ? '권한이 있어 수정·취소할 수 있습니다.' : '이 예약은 조회만 가능합니다.'}</p>
            <div>
              <span class="inline-note">${escapeHtml(getCategoryLabel(reservation.category))}</span>
              <span class="inline-note">${escapeHtml(owner?.dept || reservation.ownerDept)}</span>
              ${reservation.recurringGroupId ? `<span class="inline-note">반복 예약 ${seriesCount}건</span>` : ''}
            </div>
            <div class="detail-grid">
              <div class="item"><strong>강의실</strong>${escapeHtml(room?.name || '')}</div>
              <div class="item"><strong>예약자</strong>${escapeHtml(reservation.ownerId)}${owner?.role === 'admin' ? ' (관리자)' : ''}</div>
              <div class="item"><strong>날짜</strong>${escapeHtml(formatDateLong(reservation.date))}</div>
              <div class="item"><strong>시간</strong>${escapeHtml(reservation.start)} ~ ${escapeHtml(reservation.end)}</div>
              <div class="item"><strong>용도</strong>${escapeHtml(getCategoryLabel(reservation.category))}</div>
              <div class="item"><strong>메모</strong>${escapeHtml(reservation.note || '메모 없음')}</div>
            </div>
            <div class="modal-actions">
              <button type="button" data-modal-close>닫기</button>
              ${canEdit ? `<button type="button" class="ghost" id="editReservationBtn">수정</button>` : ''}
              ${canEdit ? `<button type="button" class="warn" id="deleteReservationBtn">이번 일정 취소</button>` : ''}
              ${canEdit && reservation.recurringGroupId ? `<button type="button" class="warn" id="deleteSeriesBtn">반복 예약 전체 취소</button>` : ''}
            </div>
          </div>
        `, (modal) => {
          if (canEdit) {
            modal.querySelector('#editReservationBtn')?.addEventListener('click', () => {
              closeModal();
              openReservationModal({ mode: 'edit', reservationId: reservation.id });
            });
            modal.querySelector('#deleteReservationBtn')?.addEventListener('click', async () => {
              if (!confirm('이 예약을 취소할까요?')) return;
              try {
                await api(`/api/reservations/${encodeURIComponent(reservation.id)}?scope=single`, { method: 'DELETE' });
                await refreshAllData();
                closeModal();
                showToast('예약을 취소했습니다.', 'success');
                render();
              } catch (error) {
                showToast(error.message || '예약을 취소하지 못했습니다.', 'error');
              }
            });
            modal.querySelector('#deleteSeriesBtn')?.addEventListener('click', async () => {
              if (!confirm('반복 예약 전체를 취소할까요?')) return;
              try {
                await api(`/api/reservations/${encodeURIComponent(reservation.id)}?scope=series`, { method: 'DELETE' });
                await refreshAllData();
                closeModal();
                showToast('반복 예약 전체를 취소했습니다.', 'success');
                render();
              } catch (error) {
                showToast(error.message || '반복 예약 전체를 취소하지 못했습니다.', 'error');
              }
            });
          }
        });
      }

      function openModal(html, afterOpen) {
        modalBackdrop.innerHTML = html;
        modalBackdrop.classList.add('show');
        modalBackdrop.querySelectorAll('[data-modal-close]').forEach(el => {
          el.addEventListener('click', closeModal);
        });
        modalBackdrop.addEventListener('click', backdropCloseHandler);
        if (afterOpen) afterOpen(modalBackdrop.querySelector('.modal'));
      }

      function closeModal() {
        modalBackdrop.classList.remove('show');
        modalBackdrop.innerHTML = '';
        modalBackdrop.removeEventListener('click', backdropCloseHandler);
      }

      function backdropCloseHandler(e) {
        if (e.target === modalBackdrop) closeModal();
      }

      function showToast(message, type = '') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`.trim();
        toast.textContent = message;
        toastWrap.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(8px)';
        }, 2600);
        setTimeout(() => toast.remove(), 3000);
      }

      function render() {
        ensureSessionStillValid();
        const user = getCurrentUser();
        if (!user) {
          loginView.classList.remove('hidden');
          appView.classList.add('hidden');
          closeModal();
          renderLogin();
          return;
        }
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        renderApp();
      }

      window.addEventListener('resize', () => {
        const user = getCurrentUser();
        if (user) renderApp();
      });

      (async () => {
        try {
          await loadBootstrap();
          if (state.me) {
            await refreshAllData();
          }
        } catch (error) {
          showToast(error.message || '초기 데이터를 불러오지 못했습니다.', 'error');
        }
        render();
      })();
    })();
