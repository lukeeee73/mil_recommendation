/**
 * productMapper.js — 온톨로지 개체 ↔ 쇼핑 플랫폼(네이버·쿠팡) 결과 변환
 *
 * 역할:
 *  1. 추론 결과(온톨로지 개체 기반)의 각 추천 제품에 대해
 *     네이버 쇼핑 API 와 쿠팡 파트너스 API 를 병렬 호출
 *  2. 각 플랫폼이 반환한 실제 제품 정보(이름·가격·이미지·링크·판매처)를
 *     `naverHero`, `coupangHero` 라는 별개 필드로 entry 에 부착
 *  3. 예산 재분류용 `prod.price` 는 실제 최저가(두 플랫폼 중 더 싼 쪽)로 갱신
 *  4. 두 플랫폼 모두 실패해도 온톨로지 정적 데이터로 자연스럽게 폴백
 *
 * 핵심 개념: "온톨로지 = 개념 정의", "네이버·쿠팡 API = 실제 판매 제품"
 */

const { searchNaverShopping } = require("./naverApi.js");
const { searchCoupang }       = require("./coupangApi.js");
const { fetchReviews }        = require("./reviewScraper.js");
const cache                   = require("./cache.js");

const NAVER_TTL   = 60 * 60 * 1000; // 1시간
const COUPANG_TTL = 60 * 60 * 1000; // 1시간

// 후기 스크레이프는 ENABLE_REVIEW_SCRAPE=1 이거나 JINA_API_KEY 가 있을 때만 활성화.
// 익명 호출은 분당 20건 제한 — 카드 수가 많으면 빠르게 소진되므로 기본 OFF.
const REVIEW_SCRAPE_ENABLED =
  !!process.env.JINA_API_KEY ||
  process.env.ENABLE_REVIEW_SCRAPE === "1" ||
  process.env.ENABLE_REVIEW_SCRAPE === "true";

/**
 * 추론 결과 전체를 실제 판매 데이터로 보강
 *
 * @param {{ affordable: Array, overBudget: Array, remaining: number, budget: number, totalCost: number }} staticResult
 * @returns {Promise<object>} 네이버/쿠팡 hero 포함 결과
 */
async function enrichWithNaverData(staticResult) {
  const allEntries = [...staticResult.affordable, ...staticResult.overBudget];

  // 모든 제품을 병렬로 두 플랫폼에 검색
  const enrichedEntries = await Promise.all(
    allEntries.map((entry) => enrichSingleProduct(entry))
  );

  // 예산 내/초과 재분류 (실제 가격이 다를 수 있으므로 재계산)
  let remaining = staticResult.budget;
  const affordable = [];
  const overBudget = [];

  // 우선도 순서 유지 (Essential 먼저)
  const priorityOrder = { Essential: 0, Recommended: 1, Optional: 2 };
  enrichedEntries.sort((a, b) =>
    (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  );

  for (const entry of enrichedEntries) {
    if (remaining >= entry.prod.price) {
      remaining -= entry.prod.price;
      affordable.push({ ...entry, withinBudget: true });
    } else {
      overBudget.push({ ...entry, withinBudget: false });
    }
  }

  return {
    ...staticResult,
    affordable,
    overBudget,
    remaining,
    totalCost: staticResult.budget - remaining,
    source: {
      naver:   !!process.env.NAVER_CLIENT_ID,
      coupang: !!process.env.COUPANG_ACCESS_KEY,
      reviews: REVIEW_SCRAPE_ENABLED,
    },
  };
}

/**
 * 개별 제품 하나를 네이버·쿠팡 데이터로 보강
 * 플랫폼별 캐시 → 실패는 조용히 null (다음 호출 때 재시도)
 */
async function enrichSingleProduct(entry) {
  const { prod } = entry;
  const keyword = prod.searchKeyword || prod.productName;

  const [naverHero, coupangHero] = await Promise.all([
    fetchNaverHero(keyword, prod),
    fetchCoupangHero(keyword),
  ]);

  // 예산 계산에 쓸 대표가: 두 플랫폼 중 더 싼 쪽. 둘 다 없으면 온톨로지 가격 유지.
  const heroPrices = [naverHero?.price, coupangHero?.price].filter(
    (p) => Number.isFinite(p) && p > 0
  );
  const effectivePrice = heroPrices.length > 0 ? Math.min(...heroPrices) : prod.price;

  const enrichedProd = {
    ...prod,
    price: effectivePrice,
    isRealProduct: !!(naverHero || coupangHero),
  };

  // 후기 스크레이프: 네이버 hero 우선(쿠팡은 봇 차단으로 거의 실패).
  // 비용을 아끼기 위해 우선순위 Essential·Recommended 만 보강.
  const reviewSource = naverHero?.link || coupangHero?.link || null;
  const shouldFetchReview =
    REVIEW_SCRAPE_ENABLED &&
    reviewSource &&
    (entry.priority === "Essential" || entry.priority === "Recommended");

  const reviews = shouldFetchReview ? await fetchReviews(reviewSource) : null;

  return { ...entry, prod: enrichedProd, naverHero, coupangHero, reviews };
}

async function fetchNaverHero(keyword, originalProd) {
  const cacheKey = `naver:${keyword}`;
  const cached   = cache.get(cacheKey);
  if (cached !== null) return cached; // null 은 "미 캐시" / 객체는 히트

  try {
    const result = await searchNaverShopping(keyword, 1);
    if (result.items && result.items.length > 0) {
      const hero = mapNaverItemToProduct(result.items[0], originalProd);
      cache.set(cacheKey, hero, NAVER_TTL);
      return hero;
    }
  } catch (err) {
    if (err.message !== "NAVER_API_KEY_MISSING") {
      console.warn(`[productMapper] Naver API 실패 (${keyword}):`, err.message);
    }
  }
  return null;
}

async function fetchCoupangHero(keyword) {
  const cacheKey = `coupang:${keyword}`;
  const cached   = cache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const items = await searchCoupang(keyword, 1);
    if (items && items.length > 0) {
      const hero = mapCoupangItemToProduct(items[0]);
      cache.set(cacheKey, hero, COUPANG_TTL);
      return hero;
    }
  } catch (err) {
    if (err.message !== "COUPANG_API_KEY_MISSING") {
      console.warn(`[productMapper] Coupang API 실패 (${keyword}):`, err.message);
    }
  }
  return null;
}

/**
 * 네이버 API 응답 아이템 → hero 객체
 * 네이버는 title 에 <b> 태그를 포함하므로 제거 필요.
 */
function mapNaverItemToProduct(naverItem, originalProd) {
  const cleanName = naverItem.title.replace(/<[^>]+>/g, "");
  const price     = parseInt(naverItem.lprice, 10);

  return {
    platform:    "naver",
    productName: cleanName,
    price:       Number.isFinite(price) ? price : originalProd.price,
    link:        naverItem.link,
    image:       naverItem.image,
    mallName:    naverItem.mallName || "네이버쇼핑",
    brand:       naverItem.brand || null,
  };
}

/**
 * 쿠팡 Partners API 아이템 → hero 객체
 * Partners 는 별점/후기 수를 반환하지 않으므로 link 에만 의존.
 */
function mapCoupangItemToProduct(item) {
  const rocketLabel = item.isRocket ? "로켓배송" : "";

  return {
    platform:    "coupang",
    productName: item.productName,
    price:       Number.isFinite(item.productPrice) ? item.productPrice : 0,
    link:        item.productUrl,
    image:       item.productImage,
    mallName:    ["쿠팡", rocketLabel].filter(Boolean).join(" · "),
    isRocket:    !!item.isRocket,
    isFreeShipping: !!item.isFreeShipping,
  };
}

module.exports = { enrichWithNaverData };
