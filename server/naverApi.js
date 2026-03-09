/**
 * naverApi.js — 네이버 쇼핑 검색 API 래퍼
 *
 * 네이버 개발자 센터에서 앱을 등록하면 무료로 사용할 수 있습니다.
 * https://developers.naver.com/apps/#/register
 *
 * 일 25,000건 무료 제공 (2024년 기준)
 */

const NAVER_API_URL = "https://openapi.naver.com/v1/search/shop.json";

/**
 * 네이버 쇼핑 검색
 * @param {string} query - 검색어 (예: "군화 깔창 평발")
 * @param {number} display - 가져올 결과 수 (기본 3개)
 * @returns {Promise<{items: Array}>}
 */
async function searchNaverShopping(query, display = 3) {
  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NAVER_API_KEY_MISSING");
  }

  const url = `${NAVER_API_URL}?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id":     clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Naver API ${response.status}: ${text}`);
  }

  return response.json();
  // 응답 형태:
  // {
  //   "lastBuildDate": "...",
  //   "total": 1234,
  //   "start": 1,
  //   "display": 3,
  //   "items": [
  //     {
  //       "title":       "<b>군화</b> 깔창",   ← HTML 태그 포함
  //       "link":        "https://...",
  //       "image":       "https://shopping-phinf.pstatic.net/...",
  //       "lprice":      "7500",               ← 최저가 (문자열)
  //       "hprice":      "12000",              ← 최고가 (문자열, 없으면 "")
  //       "mallName":    "스마트스토어",
  //       "productId":   "123456789",
  //       "brand":       "브랜드명",
  //       "category1":   "스포츠/레저",
  //       ...
  //     }
  //   ]
  // }
}

module.exports = { searchNaverShopping };
