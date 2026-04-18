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
 *   { "height": 175, "weight": 70, "conditions": [...], "situations": [...] }
 *   budget 은 선택. 없으면 예산 제약 없이 전체 추천을 반환.
 *
 * 응답: 네이버 실시간 가격 + 직접 구매 링크가 포함된 추천 결과
 */
app.post("/api/recommend", async (req, res) => {
  try {
    const { height, weight, conditions, situations } = req.body;

    if (!height || !weight) {
      return res.status(400).json({ error: "height, weight 는 필수입니다." });
    }

    const staticResult = reasoner.reason({
      height:     parseFloat(height),
      weight:     parseFloat(weight),
      budget:     null,
      conditions: Array.isArray(conditions) ? conditions : [],
      situations: Array.isArray(situations) ? situations : [],
    });

    const enriched = await enrichWithNaverData(staticResult);

    res.json({
      ...enriched,
      bmi:           staticResult.bmi,
      bodyCondition: staticResult.bodyCondition,
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
  const hasNaver = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
  console.log(`\n🪖  군입대 준비물 체크리스트 서버 실행 중`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   네이버 API: ${hasNaver ? "✓ 연동됨" : "✗ 미설정 (폴백 모드)"}\n`);
});
