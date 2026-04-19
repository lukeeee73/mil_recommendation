/**
 * platformLinks.js — 쇼핑몰 검색 딥링크 빌더 (클라이언트 전용)
 *
 * 서버 보강이 불가능한 경우(정적 모드 또는 API 키 없음)에도
 * 각 품목 카드에서 네이버 쇼핑 · 쿠팡 검색 결과 페이지로 바로 이동할 수 있도록
 * 검색 URL 을 생성한다.
 */
(function () {
  window.buildPlatformLinks = function (name) {
    var q = encodeURIComponent(name);
    return {
      naver:   "https://search.shopping.naver.com/search/all?query=" + q,
      coupang: "https://www.coupang.com/np/search?q=" + q + "&channel=user",
    };
  };
})();
