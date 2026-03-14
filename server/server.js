/**
 * server.js — Express 백엔드 서버 (MVP)
 *
 * MVP 버전:
 *  - 네이버 API 연동 없음 (체크리스트 + 예상 가격대만 제공)
 *  - 추후 실제 제품 정보 연동 예정
 */

require("dotenv").config();
const express = require("express");
const path    = require("path");

const { ONTOLOGY } = require("../ontology.js");
const { Reasoner, CATEGORY_META, CONDITION_LABEL, SITUATION_LABEL, BODY_LABEL } = require("../reasoner.js");

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
 *     "height": 175, "weight": 70, "footSize": 270,
 *     "budget": 200000,
 *     "conditions": ["FlatFoot", "KneeIssue"],
 *     "situations": ["WinterEnlistment", "HasGirlfriend"]
 *   }
 *
 * 응답: 맞춤 체크리스트 + 예상 가격
 */
app.post("/api/recommend", (req, res) => {
  try {
    const { height, weight, footSize, budget, conditions, situations } = req.body;

    if (!height || !weight || !footSize || budget == null) {
      return res.status(400).json({ error: "height, weight, footSize, budget 는 필수입니다." });
    }

    const result = reasoner.reason({
      height:     parseFloat(height),
      weight:     parseFloat(weight),
      footSize:   parseFloat(footSize),
      budget:     parseFloat(budget),
      conditions: Array.isArray(conditions) ? conditions : [],
      situations: Array.isArray(situations) ? situations : [],
    });

    res.json({
      ...result,
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
  console.log(`\n🪖  군입대 준비물 체크리스트 서버 실행 중`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   MVP 모드: 체크리스트 + 예상 가격대 (실제 제품 연동 예정)\n`);
});
