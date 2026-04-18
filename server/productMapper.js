/**
 * productMapper.js — 온톨로지 개체 ↔ 네이버 쇼핑 결과 변환
 *
 * 역할:
 *  1. 추론 결과(온톨로지 개체 기반)의 각 추천 제품에 대해
 *     searchKeyword로 네이버 쇼핑 API를 호출
 *  2. 반환된 실제 제품 정보(이름·가격·링크·이미지)로 교체
 *  3. API 실패 시 원래 온톨로지 데이터로 자연스럽게 폴백(fallback)
 *
 * 핵심 개념: "온톨로지 = 개념 정의", "네이버 API = 실제 판매 제품"
 * productMapper는 개념과 실제 제품을 연결하는 다리 역할
 */

const { searchNaverShopping } = require("./naverApi.js");
const cache = require("./cache.js");

/**
 * 추론 결과 전체를 실제 네이버 제품 데이터로 보강
 *
 * @param {{ affordable: Array, overBudget: Array, remaining: number, budget: number, totalCost: number }} staticResult
 *   - reasoner.reason()이 반환한 정적 추론 결과
 * @returns {Promise<object>} 네이버 실제 데이터로 교체된 결과
 */
async function enrichWithNaverData(staticResult) {
  const allEntries = [...staticResult.affordable, ...staticResult.overBudget];

  const enrichedEntries = await Promise.all(
    allEntries.map((entry) => enrichSingleProduct(entry))
  );

  // 예산이 없으면 전체를 affordable 로 반환 (클라이언트가 예산 필터 담당)
  const totalCost = enrichedEntries.reduce((s, e) => s + (e.prod.price || 0), 0);

  return {
    ...staticResult,
    affordable: enrichedEntries.map((e) => ({ ...e, withinBudget: true })),
    overBudget: [],
    remaining:  null,
    budget:     null,
    totalCost,
    source: process.env.NAVER_CLIENT_ID ? "naver" : "fallback",
  };
}

/**
 * 개별 제품 하나를 네이버 데이터로 보강
 */
async function enrichSingleProduct(entry) {
  const { prod } = entry;
  const keyword = prod.searchKeyword || prod.productName;
  const cacheKey = `naver:${keyword}`;

  // 1. 캐시 확인 (이미 검색한 결과면 바로 반환)
  const cached = cache.get(cacheKey);
  if (cached) {
    return { ...entry, prod: cached };
  }

  // 2. 네이버 API 호출
  try {
    const result = await searchNaverShopping(keyword, 1);

    if (result.items && result.items.length > 0) {
      const naverProd = mapNaverItemToProduct(result.items[0], prod);
      cache.set(cacheKey, naverProd); // 1시간 캐시
      return { ...entry, prod: naverProd };
    }
  } catch (err) {
    // API 키 없거나 호출 실패 → 폴백 (조용히 원본 유지)
    if (err.message !== "NAVER_API_KEY_MISSING") {
      console.warn(`[productMapper] Naver API 실패 (${keyword}):`, err.message);
    }
  }

  // 3. 폴백: 원래 온톨로지 제품 데이터 그대로 사용
  return entry;
}

/**
 * 네이버 API 응답 아이템 → 온톨로지 제품 형식으로 변환
 *
 * 네이버 응답 예시:
 *   { title: "<b>군화</b> 깔창", lprice: "7500", link: "https://...", image: "https://..." }
 *
 * → 우리 형식:
 *   { productName: "군화 깔창", price: 7500, link: "...", image: "...", isRealProduct: true }
 */
function mapNaverItemToProduct(naverItem, originalProd) {
  // HTML 태그 제거: "<b>군화</b> 깔창" → "군화 깔창"
  const cleanName = naverItem.title.replace(/<[^>]+>/g, "");

  // 최저가 파싱 (네이버는 문자열로 반환)
  const price = parseInt(naverItem.lprice, 10);

  return {
    // 온톨로지 메타데이터는 그대로 유지 (type, priority, conditions 등)
    ...originalProd,

    // 네이버 실제 데이터로 덮어쓰기
    productName:   cleanName,
    price:         isNaN(price) ? originalProd.price : price,

    // 네이버에서 추가된 필드
    link:          naverItem.link,
    image:         naverItem.image,
    mallName:      naverItem.mallName || "네이버쇼핑",
    brand:         naverItem.brand || null,
    isRealProduct: true,  // 실제 판매 제품임을 표시
  };
}

module.exports = { enrichWithNaverData };
