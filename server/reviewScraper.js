/**
 * reviewScraper.js — Jina Reader 기반 상품 후기/가격 보강 스크레이퍼
 *
 * 동작:
 *   1. 상품 상세 URL 을 Jina Reader (https://r.jina.ai/) 에 넘긴다.
 *   2. Jina 가 페이지를 크롤·렌더해서 깨끗한 markdown 으로 돌려준다.
 *   3. markdown 에서 별점/후기 수/대표 후기 스니펫을 정규식으로 발췌.
 *   4. 24h 캐시 (`cache.js`) 에 저장. 실패 시 조용히 null.
 *
 * 왜 Jina 인가?
 *   - 키 없이 호출 가능 (분당 20회 / 익명).
 *   - JINA_API_KEY 가 있으면 Authorization 헤더로 한도 상승 (1M tok/월 무료).
 *   - 봇 차단(쿠팡 Akamai, 네이버 동적 렌더)을 Jina 측이 처리.
 *   - Vercel Serverless·Claude Code Sandbox 어디서든 외부 fetch 만 되면 동작.
 *
 * 한계:
 *   - 쿠팡은 Jina 도 자주 막힌다. 네이버 스마트스토어는 비교적 안정적.
 *   - 후기 텍스트는 페이지 구조에 의존 → 정규식이 깨질 수 있음. 실패해도 가격 표시는 유지됨.
 */

const cache = require("./cache.js");

const JINA_BASE = "https://r.jina.ai/";
const REVIEW_TTL = 24 * 60 * 60 * 1000; // 24시간 — 후기는 자주 변하지 않음
const FETCH_TIMEOUT_MS = 8000;

/**
 * 상품 상세 URL 에서 후기 정보를 가져온다.
 * @param {string} url - 네이버/쿠팡 상품 상세 URL
 * @returns {Promise<{rating:number|null, count:number|null, snippets:string[]}|null>}
 */
async function fetchReviews(url) {
  if (!url || typeof url !== "string") return null;

  const cacheKey = `review:${url}`;
  const cached = cache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const markdown = await jinaRead(url);
    if (!markdown) {
      cache.set(cacheKey, null, REVIEW_TTL);
      return null;
    }

    const reviews = extractReviews(markdown);
    cache.set(cacheKey, reviews, REVIEW_TTL);
    return reviews;
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn(`[reviewScraper] Jina 실패 (${url}):`, err.message);
    }
    // 실패도 짧게 캐시 — 같은 URL 을 즉시 재호출 방지
    cache.set(cacheKey, null, 10 * 60 * 1000);
    return null;
  }
}

/**
 * Jina Reader 호출.
 * URL 은 path 에 그대로 붙이는 형식: `https://r.jina.ai/https://shopping.naver.com/...`
 */
async function jinaRead(targetUrl) {
  const apiKey = process.env.JINA_API_KEY;
  const headers = {
    Accept: "text/plain",
    // markdown 본문만 받고, 이미지/링크는 텍스트로 인라인 — 후기 추출에는 충분
    "X-Return-Format": "markdown",
    "X-Locale": "ko-KR",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(JINA_BASE + targetUrl, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Jina ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * markdown 에서 별점·후기 수·대표 후기 스니펫 추출.
 *
 * 패턴 선택 근거:
 *   - 네이버 스마트스토어: "리뷰 1,234", "★ 4.8", "평점 4.8/5", 후기 본문은 짧은 줄
 *   - 쿠팡: "별점 4.5", "리뷰 1234개", 후기 줄에 "도움돼요" 가 자주 따라붙음
 *
 * 한 패턴이 깨져도 다른 패턴이 잡도록 OR 형태로 시도한다.
 */
function extractReviews(markdown) {
  return {
    rating: extractRating(markdown),
    count: extractReviewCount(markdown),
    snippets: extractSnippets(markdown),
  };
}

function extractRating(md) {
  // "4.8/5", "★ 4.8", "별점 4.8", "평점 4.8" 등
  const patterns = [
    /(?:별점|평점|review\s*rating)[\s:]*([0-5](?:\.\d)?)/i,
    /★\s*([0-5](?:\.\d)?)/,
    /([0-5]\.\d)\s*\/\s*5/,
  ];
  for (const re of patterns) {
    const m = md.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (n >= 0 && n <= 5) return n;
    }
  }
  return null;
}

function extractReviewCount(md) {
  // "리뷰 1,234", "후기 1234개", "review 1234"
  const patterns = [
    /(?:리뷰|후기|review)s?[\s:]*([\d,]+)\s*(?:개|건)?/i,
    /\(\s*([\d,]+)\s*(?:개|건)\s*\)/, // "(1,234개)"
  ];
  for (const re of patterns) {
    const m = md.match(re);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n > 0 && n < 10_000_000) return n;
    }
  }
  return null;
}

/**
 * 본문에서 그럴듯한 후기 한 줄들을 골라낸다.
 *  - 한국어 자모를 5자 이상 포함하고
 *  - 길이가 8~120자 사이이고
 *  - 마크다운 헤더/표/링크가 아닌 순수 텍스트 줄
 */
function extractSnippets(md, max = 3) {
  const lines = md.split(/\r?\n/);
  const candidates = [];
  const seen = new Set();

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 8 || line.length > 120) continue;
    if (/^[#>*\-=|`!\[]/.test(line)) continue; // 마크다운 구조
    if (/https?:\/\//.test(line)) continue;
    if (/^\d+\s*[원$₩]/.test(line)) continue; // 가격 줄
    const koreanChars = (line.match(/[가-힣]/g) || []).length;
    if (koreanChars < 5) continue;

    // 후기 같은 신호어가 있으면 가산점
    const score =
      koreanChars +
      (/(좋|만족|추천|괜찮|편함|배송|최고|별로|아쉽|불만)/.test(line) ? 20 : 0);

    if (seen.has(line)) continue;
    seen.add(line);
    candidates.push({ line, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, max).map((c) => c.line);
}

module.exports = { fetchReviews };
