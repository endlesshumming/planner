// 플래너 위젯 (Scriptable 앱용)
// ─────────────────────────────────────────────────────────────
// 플래너 일정은 구글 캘린더로 가고, 아이폰 캘린더 앱에 구글 계정을 추가해 두면
// 이 위젯이 아이폰 캘린더에서 일정을 읽어 플래너 디자인으로 그려요.
//
// 잠금화면 (반투명은 아이폰이 알아서 그려요)
//   · 직사각형: 이번 주 + 다음 주 작은 달력 (오늘은 동그라미, 일정 있는 날은 점)
//       위젯 '매개변수(Parameter)'에 '달력' → 이번 달 전체, '일정' → 오늘 남은 일정
//   · 원형: 오늘 요일 + 날짜
//   · 달력 위 한 줄: 날짜 · 다음 일정
// 홈 화면
//   · 작은: 큰 달 숫자 + 이번 달 달력
//   · 중간: 2026 · 11 · 남은 일정 + 이번 달 달력 (플래너 맨 위와 같은 배치)
//   · 큰: 위 + 큰 달력 + 오늘 남은 일정
// 위젯을 누르면 플래너가 열려요.
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // 비워 두면 아이폰의 모든 캘린더를 써요. 플래너 캘린더만 보려면 구글 캘린더 이름(보통 gmail 주소)을 넣어요.
  // 예: calendars: ['me@gmail.com', '대한민국의 휴일'],
  calendars: [],
  url: 'https://endlesshumming.github.io/planner/',
};

const C = { ink: '#1d1d1f', olive: '#6b744f', faint: '#c0c0c5', mute: '#8e8e93', teal: '#5fcfc4', tealD: '#3dbdb1', paper: '#ffffff' };
const DOW_K = ['일', '월', '화', '수', '목', '금', '토'];
const DOW_E = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const F = {
  thin: s => new Font('HelveticaNeue-Thin', s),
  light: s => new Font('HelveticaNeue-Light', s),
  reg: s => new Font('HelveticaNeue', s),
  med: s => new Font('HelveticaNeue-Medium', s),
  bold: s => new Font('HelveticaNeue-Bold', s),
};
const col = (hex, a = 1) => new Color(hex, a);

const now = new Date();
const today0 = startOfDay(now);
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function key(d) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function hm(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
const isHoliCal = e => /휴일|holiday/i.test((e.calendar && e.calendar.title) || '');
const isDone = e => /^✓/.test(e.title || '');

/* ---------- 일정 읽기 ---------- */
async function loadEvents(from, to) {
  let cals = [];
  if (CONFIG.calendars.length) {
    const all = await Calendar.forEvents();
    cals = all.filter(c => CONFIG.calendars.includes(c.title));
  }
  return await CalendarEvent.between(from, to, cals);
}
// 날짜별: 일정 수 · 휴일인지
function dayMap(events) {
  const m = new Map();
  for (const e of events) {
    const s = startOfDay(e.startDate);
    const endT = new Date(Math.max(e.startDate.getTime(), e.endDate.getTime() - 1));
    const last = startOfDay(endT), holi = isHoliCal(e);
    for (let d = s, k = 0; d <= last && k < 62; d = addDays(d, 1), k++) {
      const v = m.get(key(d)) || { n: 0, holi: false };
      if (holi) v.holi = true; else v.n++;
      m.set(key(d), v);
    }
  }
  return m;
}
// 오늘 남은 일정 (완료 ✓ · 휴일은 빼요)
function upcoming(events, limit) {
  return events
    .filter(e => !isDone(e) && !isHoliCal(e))
    .filter(e => e.isAllDay
      ? startOfDay(e.startDate) <= today0 && e.endDate > today0
      : e.endDate > now && startOfDay(e.startDate).getTime() === today0.getTime())
    .sort((a, b) => (a.isAllDay ? 0 : 1) - (b.isAllDay ? 0 : 1) || a.startDate - b.startDate)
    .slice(0, limit);
}
const evLabel = e => (e.isAllDay ? '하루 종일' : hm(e.startDate));

/* ---------- 날짜 모음 ---------- */
function monthDays(base) {
  const y = base.getFullYear(), m = base.getMonth(), off = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
  const out = Array(off).fill(null);
  for (let d = 1; d <= n; d++) out.push(new Date(y, m, d));
  while (out.length % 7) out.push(null);
  return out;
}
function twoWeeks(base) {
  const s = addDays(startOfDay(base), -base.getDay());
  return Array.from({ length: 14 }, (_, i) => addDays(s, i));
}

/* ---------- 달력 그리기 ---------- */
// o: { lock, head, numSize, headSize, dots, map, monthIdx }
function gridImage(days, W, H, o) {
  const dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  const rows = days.length / 7 + (o.head ? 1 : 0), cw = W / 7, rh = H / rows;
  dc.setTextAlignedCenter();
  if (o.head) {
    dc.setFont(F.med(o.headSize));
    DOW_E.forEach((t, i) => {
      dc.setTextColor(o.lock ? col('#ffffff', 0.7) : i === 0 ? col(C.olive) : i === 6 ? col(C.faint) : col(C.ink));
      dc.drawTextInRect(t, new Rect(i * cw, (rh - o.headSize * 1.25) / 2, cw, o.headSize * 1.4));
    });
  }
  days.forEach((d, idx) => {
    if (!d) return;
    const r = Math.floor(idx / 7) + (o.head ? 1 : 0), c = idx % 7, x = c * cw, y = r * rh, cx = x + cw / 2;
    const isT = key(d) === key(today0), past = d < today0, other = o.monthIdx != null && d.getMonth() !== o.monthIdx;
    const info = o.map.get(key(d)), sun = c === 0 || (info && info.holi), ns = o.numSize, lift = o.dots ? 1.5 : 0;
    if (o.lock) {
      if (isT) {
        const s = Math.min(cw, rh) - 1.5;
        dc.setFillColor(Color.white());
        dc.fillEllipse(new Rect(cx - s / 2, y + (rh - s) / 2, s, s));
      }
      dc.setFont(isT ? F.bold(ns) : F.reg(ns));
      dc.setTextColor(isT ? Color.black() : col('#ffffff', past || other ? 0.45 : 1));
    } else {
      dc.setFont(isT ? F.bold(ns) : F.light(ns));
      dc.setTextColor(col(sun ? C.olive : C.ink, other ? 0.35 : past ? 0.5 : 1));
    }
    dc.drawTextInRect(String(d.getDate()), new Rect(x, y + (rh - ns * 1.2) / 2 - lift, cw, ns * 1.35));
    if (o.dots && info && info.n) {
      const ds = Math.max(2.4, ns * 0.2);
      dc.setFillColor(o.lock ? (isT ? Color.black() : col('#ffffff', past ? 0.45 : 0.95)) : col(C.teal));
      dc.fillEllipse(new Rect(cx - ds / 2, y + rh - ds - (o.lock && isT ? 2.5 : 1), ds, ds));
    }
  });
  return dc.getImage();
}
function addGrid(parent, img, w, h) { const wi = parent.addImage(img); wi.imageSize = new Size(w, h); return wi; }
function addT(parent, s, font, color, lines = 1) { const t = parent.addText(s); t.font = font; t.textColor = color; t.lineLimit = lines; return t; }
function eventRows(parent, list, size, emptyText) {
  if (!list.length) { addT(parent, emptyText, F.reg(size - 1), col(C.mute)); return; }
  list.forEach((e, i) => {
    if (i) parent.addSpacer(3);
    const r = parent.addStack(); r.layoutHorizontally(); r.centerAlignContent();
    addT(r, evLabel(e), F.reg(size - 1), col(C.tealD));
    r.addSpacer(5);
    addT(r, e.title || '(제목 없음)', Font.semiboldSystemFont(size), col(C.ink));
  });
}

/* ---------- 위젯 만들기 ---------- */
async function build(fam, param) {
  const w = new ListWidget();
  w.url = CONFIG.url;
  const mIdx = now.getMonth(), M = monthDays(now);
  const from = addDays(M.find(Boolean), -7), to = addDays(M[M.length - 1] || addDays(now, 31), 21);
  const events = await loadEvents(from, to), map = dayMap(events);
  const dateK = `${now.getMonth() + 1}.${now.getDate()} ${DOW_K[now.getDay()]}`;

  if (fam === 'accessoryInline') {
    const nx = upcoming(events, 1)[0];
    w.addText(`${now.getMonth() + 1}월 ${now.getDate()}일 ${DOW_K[now.getDay()]}${nx ? ` · ${evLabel(nx)} ${nx.title}` : ''}`);
  } else if (fam === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    const a = addT(s, DOW_K[now.getDay()], Font.semiboldSystemFont(11), Color.white()); a.centerAlignText();
    const b = addT(s, String(now.getDate()), F.med(24), Color.white()); b.centerAlignText(); b.minimumScaleFactor = 0.6;
  } else if (fam === 'accessoryRectangular') {
    if (/일정|list/i.test(param)) {
      addT(w, dateK, Font.boldSystemFont(13), Color.white());
      w.addSpacer(2);
      const list = upcoming(events, 2);
      if (!list.length) addT(w, '오늘 남은 일정 없음', Font.systemFont(12), col('#ffffff', 0.7));
      list.forEach(e => addT(w, `${evLabel(e)}  ${e.title || ''}`, Font.systemFont(12), Color.white()));
    } else if (/달력|month/i.test(param)) {
      addGrid(w, gridImage(M, 170, 74, { lock: true, head: true, numSize: 7.5, headSize: 6.5, dots: false, map, monthIdx: mIdx }), 170, 74);
    } else {
      addGrid(w, gridImage(twoWeeks(now), 170, 74, { lock: true, head: true, numSize: 13, headSize: 9, dots: true, map }), 170, 74);
    }
  } else {
    // 홈 화면: 종이처럼 흰 배경, 플래너와 같은 글꼴·색
    w.backgroundColor = col(C.paper);
    if (fam === 'small') {
      w.setPadding(12, 12, 10, 12);
      const top = w.addStack(); top.layoutHorizontally(); top.bottomAlignContent();
      addT(top, String(now.getMonth() + 1), F.thin(32), col(C.ink));
      top.addSpacer(6);
      const side = top.addStack(); side.layoutVertically();
      addT(side, String(now.getFullYear()), F.bold(10), col(C.ink));
      addT(side, dateK, F.reg(9), col(C.mute));
      side.addSpacer(4);
      w.addSpacer(4);
      addGrid(w, gridImage(M, 134, 92, { head: true, numSize: 9.5, headSize: 8, dots: true, map, monthIdx: mIdx }), 134, 92);
    } else if (fam === 'large' || fam === 'extraLarge') {
      w.setPadding(16, 18, 14, 18);
      const top = w.addStack(); top.layoutHorizontally(); top.bottomAlignContent();
      const L = top.addStack(); L.layoutVertically();
      addT(L, String(now.getFullYear()), F.bold(12), col(C.ink));
      addT(L, String(now.getMonth() + 1), F.thin(56), col(C.ink));
      top.addSpacer();
      addT(top, dateK, F.reg(12), col(C.mute));
      w.addSpacer(6);
      addGrid(w, gridImage(M, 300, 176, { head: true, numSize: 15, headSize: 12, dots: true, map, monthIdx: mIdx }), 300, 176);
      w.addSpacer(10);
      eventRows(w, upcoming(events, 3), 12, '오늘 남은 일정 없음');
      w.addSpacer();
    } else {
      // medium (기본)
      w.setPadding(14, 16, 12, 16);
      const row = w.addStack(); row.layoutHorizontally();
      const L = row.addStack(); L.layoutVertically(); L.size = new Size(150, 0);
      addT(L, String(now.getFullYear()), F.bold(11), col(C.ink));
      addT(L, String(now.getMonth() + 1), F.thin(50), col(C.ink));
      L.addSpacer();
      eventRows(L, upcoming(events, 2), 11, '오늘 남은 일정 없음');
      row.addSpacer();
      addGrid(row, gridImage(M, 148, 130, { head: true, numSize: 10.5, headSize: 9, dots: true, map, monthIdx: mIdx }), 148, 130);
    }
  }
  // 15분마다, 그리고 자정이 지나면 새로 그려요
  const mid = addDays(today0, 1);
  w.refreshAfterDate = new Date(Math.min(now.getTime() + 15 * 60e3, mid.getTime() + 60e3));
  return w;
}

function errWidget(msg) {
  const w = new ListWidget();
  w.url = CONFIG.url;
  const t = w.addText(msg); t.font = Font.systemFont(11); t.textColor = col(C.mute);
  return w;
}

/* ---------- 실행 ---------- */
const param = String(args.widgetParameter || '').trim();
if (config.runsInWidget || config.runsInAccessoryWidget) {
  let w;
  try { w = await build(config.widgetFamily || 'medium', param); }
  catch (e) { w = errWidget('캘린더를 읽지 못했어요. Scriptable 앱에서 이 스크립트를 한 번 실행해 캘린더 접근을 허락해 주세요.'); }
  Script.setWidget(w);
} else {
  // 앱에서 실행하면: 캘린더 접근을 묻고, 고른 모양을 미리 보여 줘요
  const kinds = [
    ['잠금화면 · 작은 달력 (2주)', 'accessoryRectangular', ''],
    ['잠금화면 · 이번 달 달력', 'accessoryRectangular', '달력'],
    ['잠금화면 · 오늘 남은 일정', 'accessoryRectangular', '일정'],
    ['잠금화면 · 날짜 (원형)', 'accessoryCircular', ''],
    ['잠금화면 · 시계 위 한 줄', 'accessoryInline', ''],
    ['홈 화면 · 작은', 'small', ''],
    ['홈 화면 · 중간', 'medium', ''],
    ['홈 화면 · 큰', 'large', ''],
  ];
  const a = new Alert();
  a.title = '플래너 위젯 미리 보기';
  a.message = '처음 실행이면 캘린더 접근을 허락해 주세요.';
  kinds.forEach(k => a.addAction(k[0]));
  a.addCancelAction('닫기');
  const i = await a.presentSheet();
  if (i >= 0) {
    const [, fam, p] = kinds[i];
    const w = await build(fam, p);
    const show = {
      accessoryRectangular: 'presentAccessoryRectangular', accessoryCircular: 'presentAccessoryCircular', accessoryInline: 'presentAccessoryInline',
      small: 'presentSmall', medium: 'presentMedium', large: 'presentLarge',
    }[fam];
    if (typeof w[show] === 'function') await w[show](); else await w.presentSmall();
  }
}
Script.complete();
