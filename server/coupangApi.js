/**
 * coupangApi.js — 쿠팡 Partners API 래퍼
 *
 * 쿠팡 파트너스 (제휴마케팅 프로그램) 승인 후 발급받은
 * ACCESS_KEY / SECRET_KEY 로 HMAC-SHA256 서명하여 호출.
 *
 * 발급 방법:
 *   1. https://partners.coupang.com 에서 가입·채널 등록 후 승인 대기
 *   2. "개발자 센터 > API Key 관리"에서 ACCESS_KEY / SECRET_KEY 발급
 *   3. .env 에 COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY 저장
 *
 * 키가 없으면 COUPANG_API_KEY_MISSING 을 throw → productMapper가
 * 조용히 폴백(딥링크 검색) 처리.
 *
 * 주의: Partners API 는 상품 가격·이미지·딥링크(productUrl) 는 제공하지만
 *       별점/후기 수는 반환하지 않음. 후기는 productUrl 로 이동해 확인.
 */

const crypto = require("crypto");

const DOMAIN = "https://api-gateway.coupang.com";
const PATH   = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";

/**
 * HMAC 서명 생성
 * 서명 대상 문자열: `${datetime}${method}${path}${query}`
 * datetime 포맷: yyMMdd'T'HHmmss'Z' (UTC, 2자리 연도)
 */
function generateHmac(method, path, query, accessKey, secretKey) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yy  = String(now.getUTCFullYear()).slice(2);
  const datetime =
    yy +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";

  const message   = datetime + method + path + query;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * 쿠팡 상품 검색
 * @param {string} keyword
 * @param {number} limit    - 가져올 결과 수 (기본 1)
 * @returns {Promise<Array>} productData 배열 (items 각각에 productName / productPrice / productImage / productUrl / isRocket / isFreeShipping 포함)
 */
async function searchCoupang(keyword, limit = 1) {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error("COUPANG_API_KEY_MISSING");
  }

  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const auth  = generateHmac("GET", PATH, query, accessKey, secretKey);

  const response = await fetch(`${DOMAIN}${PATH}?${query}`, {
    headers: {
      Authorization: auth,
      "Content-Type": "application/json;charset=UTF-8",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Coupang API ${response.status}: ${text}`);
  }

  const body = await response.json();
  return (body && body.data && body.data.productData) || [];
}

module.exports = { searchCoupang };
