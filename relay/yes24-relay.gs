/**
 * 플래너 책등 중계 (구글 Apps Script)
 * 예스24 Open API는 브라우저에서 바로 부를 수 없어서, 이 코드가 대신 불러 책 정보(표지·책등·쪽수·두께)를 돌려줘요.
 *
 * 쓰는 법
 * 1. 아래 YES24_KEY 따옴표 안에 예스24 Open API 키(yk_live_로 시작)를 붙여 넣고 저장해요.
 * 2. 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나 / 액세스 권한: 모든 사용자 → 배포.
 * 3. 나온 웹 앱 주소(…/exec)를 플래너 설정 → 책 검색 → '예스24 중계 주소'에 붙여 넣어요.
 * 키는 이 코드 안에만 있고 플래너나 GitHub에는 올라가지 않아요.
 */
const YES24_KEY = '여기에_예스24_키를_붙여_넣으세요';

function doGet(e) {
  const p = (e && e.parameter) || {};
  const out = x => ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
  if (!YES24_KEY || YES24_KEY.indexOf('여기에') === 0) return out({ ok: false, error: 'NO_KEY' });
  if (p.ping) return out({ ok: true, pong: 1 });
  const base = 'https://apis.yes24.com/v1/goods/';
  const isbn = String(p.isbn || '').replace(/[^0-9Xx]/g, '');
  let url;
  if (isbn.length === 13) url = base + 'itemDetail?searchType=ISBN13&detail=Y&query=' + isbn;
  else if (p.id) url = base + 'itemDetail?searchType=ItemId&detail=Y&query=' + encodeURIComponent(p.id);
  else if (p.q) url = base + 'itemList?category=BOOK&detail=Y&pageSize=' + Math.min(Number(p.n) || 5, 20) + '&query=' + encodeURIComponent(p.q);
  else return out({ ok: false, error: 'NO_QUERY' });
  const r = UrlFetchApp.fetch(url, { headers: { 'X-Api-Key': YES24_KEY }, muteHttpExceptions: true });
  let j = {};
  try { j = JSON.parse(r.getContentText()); } catch (err) { j = {}; }
  const items = ((j.data && j.data.items) || []).map(function (it) {
    return { id: it.itemId, title: it.title, author: it.author, publisher: it.publisher, isbn13: it.isbn13, cover: it.cover, spine: it.sideCover, link: it.link, pages: it.pages || null, thick: it.height || null, len: it.length || null, wid: it.width || null, date: it.publishDate || '' };
  });
  return out({ ok: r.getResponseCode() === 200 && j.success !== false, code: r.getResponseCode(), error: j.errorCode || null, message: j.message || '', items: items });
}
