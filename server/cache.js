/**
 * cache.js — TTL 메모리 캐시
 *
 * 왜 캐시가 필요한가?
 * - 네이버 API는 하루 25,000건 제한이 있음
 * - 같은 검색어를 1시간 안에 여러 번 부르는 것은 낭비
 * - 캐시: "이미 검색한 결과를 잠시 저장해두는 임시 메모"
 *
 * 예시:
 *   set("군화 깔창", [...results], 3600000)  → 1시간 저장
 *   get("군화 깔창")                          → 저장된 결과 반환 (API 호출 없음)
 *   get("존재안함")                           → null (API 호출 필요)
 */

const store = new Map();
// Map = 키-값 쌍 저장소. { "군화 깔창": { value: [...], expiresAt: 1234567890 } }

/**
 * 캐시에서 값 꺼내기
 * @param {string} key - 캐시 키
 * @returns {any|null} 저장된 값, 없거나 만료됐으면 null
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;

  // 만료 시간 지났으면 자동 삭제
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * 캐시에 값 저장
 * @param {string} key    - 캐시 키
 * @param {any}    value  - 저장할 값
 * @param {number} ttlMs  - 유효 시간 (밀리초), 기본 1시간
 */
function set(key, value, ttlMs = 60 * 60 * 1000) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/** 캐시 전체 비우기 (테스트용) */
function clear() {
  store.clear();
}

/** 현재 캐시에 몇 개 저장돼 있는지 */
function size() {
  return store.size;
}

module.exports = { get, set, clear, size };
