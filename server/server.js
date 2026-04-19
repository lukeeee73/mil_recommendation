/**
 * server.js — Express 백엔드 서버
 *
 *  - 정적 추론(ontology + reasoner) 결과를 네이버 쇼핑 / 쿠팡 Partners API 로 보강
 *  - 각 API 키가 없거나 호출 실패 시 조용히 폴백 (정적 데이터 유지)
 */

require("dotenv").config();
const express = require("express");
const path    = require("path");

const { ONTOLOGY } = require("../ontology.js");
const { Reasoner, CATEGORY_META, CONDITION_LABEL, SITUATION_LABEL, BODY_LABEL } = require("../reasoner.js");
const { enrichWithNaverData } = require("./productMapper.js");

const app      = express();
const PORT     = process.env.PORT || 3000;
const reasoner = new Reasoner(ONTOLOGY);

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

/**
 * POST /api/recommend
 *
 * 요청:
 *   {
 *     "height": 175, "weight": 70,
 *     "budget": 200000,
 *     "conditions": ["FlatFoot", "KneeIssue"],
 *     "situations": ["WinterEnlistment", "HasGirlfriend"]
 *   }
 *
 * 응답: 맞춤 체크리스트 + 각 품목에 naverHero / coupangHero 부착
 */
app.post("/api/recommend", async (req, res) => {
  try {
    const { height, weight, budget, conditions, situations } = req.body;

    if (!height || !weight || budget == null) {
      return res.status(400).json({ error: "height, weight, budget 는 필수입니다." });
    }

    const result = reasoner.reason({
      height:     parseFloat(height),
      weight:     parseFloat(weight),
      budget:     parseFloat(budget),
      conditions: Array.isArray(conditions) ? conditions : [],
      situations: Array.isArray(situations) ? situations : [],
    });

    const enriched = await enrichWithNaverData(result).catch((err) => {
      console.warn("[/api/recommend] 보강 실패, 폴백:", err.message);
      return result;
    });

    res.json({
      ...enriched,
      bmi:           result.bmi,
      bodyCondition: result.bodyCondition,
      meta: {
        categoryMeta:    CATEGORY_META,
        conditionLabels: CONDITION_LABEL,
        situationLabels: SITUATION_LABEL,
        bodyLabels:      BODY_LABEL,
      },
    });
  } catch (err) {
    console.error("[/api/recommend] 오류:", err);
    res.status(500).json({ error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
  }
});

app.listen(PORT, () => {
  const naverOn   = !!process.env.NAVER_CLIENT_ID;
  const coupangOn = !!process.env.COUPANG_ACCESS_KEY;
  console.log(`\n🪖  군입대 준비물 체크리스트 서버 실행 중`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   네이버 쇼핑 API: ${naverOn ? "ON" : "OFF (딥링크 폴백)"}`);
  console.log(`   쿠팡 Partners API: ${coupangOn ? "ON" : "OFF (딥링크 폴백)"}\n`);
});
