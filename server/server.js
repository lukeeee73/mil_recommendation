/**
 * server.js — Express 백엔드 서버
 *
 * 하는 일:
 *  1. 프론트엔드(HTML/CSS/JS) 정적 파일 제공
 *  2. POST /api/recommend — 추천 API 엔드포인트
 *     - 온톨로지 추론 실행 (Reasoner)
 *     - 네이버 쇼핑 API로 실제 제품 정보 보강
 *     - 결과 반환
 *
 * 실행 방법:
 *   npm start          (일반 실행)
 *   npm run dev        (코드 변경 시 자동 재시작, Node.js 18+)
 */

require("dotenv").config(); // .env 파일에서 환경 변수 읽기
const express = require("express");
const path    = require("path");

// ── 온톨로지 & 추론 엔진 로드 ──────────────────────────────
const { ONTOLOGY } = require("../ontology.js");
const { Reasoner, CATEGORY_META, CONDITION_LABEL, BODY_LABEL } = require("../reasoner.js");
const { enrichWithNaverData } = require("./productMapper.js");

const app     = express();
const PORT    = process.env.PORT || 3000;
const reasoner = new Reasoner(ONTOLOGY); // 서버 시작 시 한 번만 생성

// ── 미들웨어 설정 ──────────────────────────────────────────
app.use(express.json());                          // JSON 요청 파싱
app.use(express.static(path.join(__dirname, ".."))); // 프론트엔드 파일 제공

// ── API 엔드포인트 ─────────────────────────────────────────

/**
 * POST /api/recommend
 *
 * 요청 (Request Body):
 *   {
 *     "height":     175,
 *     "weight":     70,
 *     "footSize":   270,
 *     "budget":     50000,
 *     "conditions": ["FlatFoot", "KneeIssue"]
 *   }
 *
 * 응답 (Response):
 *   {
 *     "affordable":    [...],   // 예산 내 추천 제품
 *     "overBudget":    [...],   // 예산 초과 제품
 *     "remaining":     12000,   // 남은 예산
 *     "budget":        50000,
 *     "totalCost":     38000,
 *     "bmi":           22.9,
 *     "bodyCondition": "NormalWeight",
 *     "source":        "naver"  // "naver" 또는 "fallback"
 *   }
 */
app.post("/api/recommend", async (req, res) => {
  try {
    const { height, weight, footSize, budget, conditions } = req.body;

    // 입력값 검증
    if (!height || !weight || !footSize || budget == null) {
      return res.status(400).json({ error: "height, weight, footSize, budget 는 필수입니다." });
    }

    // ── Step 1: 온톨로지 추론 실행 ─────────────────────────
    // 정적 데이터 기반으로 추천 제품 카테고리와 우선도 결정
    const staticResult = reasoner.reason({
      height:     parseFloat(height),
      weight:     parseFloat(weight),
      footSize:   parseFloat(footSize),
      budget:     parseFloat(budget),
      conditions: Array.isArray(conditions) ? conditions : [],
    });

    // ── Step 2: 네이버 API로 실제 제품 정보 보강 ───────────
    // API 키가 없으면 자동으로 정적 데이터 폴백
    const enrichedResult = await enrichWithNaverData(staticResult);

    // ── Step 3: 프론트엔드가 쓸 수 있도록 메타데이터 첨부 ──
    res.json({
      ...enrichedResult,
      bmi:           staticResult.bmi,
      bodyCondition: staticResult.bodyCondition,
      meta: {
        categoryMeta:    CATEGORY_META,
        conditionLabels: CONDITION_LABEL,
        bodyLabels:      BODY_LABEL,
      },
    });
  } catch (err) {
    console.error("[/api/recommend] 오류:", err);
    res.status(500).json({ error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
  }
});

// ── 서버 시작 ──────────────────────────────────────────────
app.listen(PORT, () => {
  const hasNaverKey = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
  console.log(`\n🪖  군입대 준비물 추천 서버 실행 중`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   네이버 API: ${hasNaverKey ? "✅ 연결됨 (실시간 가격)" : "⚠️  미설정 (정적 데이터 폴백)"}`);
  if (!hasNaverKey) {
    console.log(`   → .env 파일에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 를 입력하세요.\n`);
  }
});
