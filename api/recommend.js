/**
 * api/recommend.js — Vercel Serverless Function
 *
 * POST /api/recommend
 *   Body: { height, weight, budget?, conditions?, situations? }
 *
 * 동작:
 *   1. 온톨로지 기반 정적 추론 (reasoner)
 *   2. NAVER_CLIENT_ID 가 있으면 네이버 쇼핑 API 로 실제 제품 보강
 *   3. budget 미지정 시(전체 추천) affordable 에 모든 품목 반환
 */

const { ONTOLOGY } = require("../ontology.js");
const {
  Reasoner,
  CATEGORY_META,
  CONDITION_LABEL,
  SITUATION_LABEL,
  BODY_LABEL,
} = require("../reasoner.js");
const { enrichWithNaverData } = require("../server/productMapper.js");

const reasoner = new Reasoner(ONTOLOGY);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { height, weight, budget, conditions, situations } = req.body || {};

    if (!height || !weight) {
      return res.status(400).json({ error: "height, weight 는 필수입니다." });
    }

    const parsedBudget =
      budget == null || budget === "" ? null : parseFloat(budget);

    const staticResult = reasoner.reason({
      height:     parseFloat(height),
      weight:     parseFloat(weight),
      budget:     parsedBudget,
      conditions: Array.isArray(conditions) ? conditions : [],
      situations: Array.isArray(situations) ? situations : [],
    });

    let result = staticResult;
    if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
      result = await enrichWithNaverData(staticResult);
    }

    // budget 미지정: productMapper 가 모두 overBudget 에 몰아넣었을 수 있으므로 원복
    if (parsedBudget == null) {
      const all = [...(result.affordable || []), ...(result.overBudget || [])];
      result = {
        ...result,
        affordable: all,
        overBudget: [],
        remaining:  null,
        totalCost:  all.reduce((s, e) => s + (e.prod.price || 0), 0),
      };
    }

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
};
