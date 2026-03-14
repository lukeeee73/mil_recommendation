/**
 * reasoner.js — 전방향 연쇄 추론 엔진 (Forward-Chaining Reasoner)
 *
 * MVP 버전:
 *  - 사용자의 상황·건강 상태에 맞춘 체크리스트 생성
 *  - 예산 제약 적용
 *  - 상황 조건(계절, 여자친구 등) 지원
 */

var KnowledgeBase = class KnowledgeBase {
  constructor(userInput) {
    const { height, weight, footSize, budget, conditions, situations } = userInput;

    this.height   = height;
    this.weight   = weight;
    this.footSize = footSize;
    this.budget   = budget;
    this.bmi      = weight / ((height / 100) ** 2);

    // 건강 특이사항 집합
    this._healthConditions = new Set(conditions || []);

    // 상황 조건 집합 (계절, 여자친구 등)
    this._situations = new Set(situations || []);

    // 추론될 체형
    this.hasBodyCondition = null;

    // 추천 결과 맵
    this._recommendations = new Map();
    this._excluded = new Set();
    this.trace = [];
  }

  /** 건강 상태 확인 */
  hasCondition(condition) {
    return this._healthConditions.has(condition);
  }

  /** 상황 조건 확인 */
  hasSituation(situation) {
    return this._situations.has(situation);
  }

  /** 사실 추가 */
  assert(property, value) {
    if (property === "hasBodyCondition") {
      this.hasBodyCondition = value;
    }
  }

  /** 추천 추가 */
  recommend(prod, reason) {
    if (this._excluded.has(prod._id)) return;
    const existing = this._recommendations.get(prod._id);
    if (existing) {
      existing.reasons.push(reason);
    } else {
      this._recommendations.set(prod._id, {
        prod,
        priority: prod.hasPriority,
        reasons: [reason],
      });
    }
  }

  /** 추천 제거 */
  exclude(prod, reason) {
    this._excluded.add(prod._id);
    this._recommendations.delete(prod._id);
    this.trace.push({ type: "exclude", prod: prod._id, reason });
  }

  /** 우선도 격상 */
  upgradePriority(prod, newPriority, ruleId) {
    const entry = this._recommendations.get(prod._id);
    if (entry) {
      const old = entry.priority;
      entry.priority = newPriority;
      entry.reasons.push(`priority_upgraded:${ruleId}`);
      this.trace.push({ type: "upgrade", prod: prod._id, from: old, to: newPriority, rule: ruleId });
    }
  }

  /** 최종 추천 목록 반환 */
  getRecommendations() {
    return Array.from(this._recommendations.values());
  }
};

/* =========================================================
   추론 엔진
   ========================================================= */
var Reasoner = class Reasoner {
  constructor(ontology) {
    this.ontology = ontology;
    this.individuals = Object.entries(ontology.individuals).map(([id, ind]) => ({
      ...ind,
      _id: id,
    }));
  }

  reason(userInput) {
    const kb = new KnowledgeBase(userInput);

    // 1단계: 전역 규칙 (BMI 분류 등)
    for (const rule of this.ontology.rules) {
      if (rule.when.length === 1) {
        if (rule.when(kb)) {
          rule.then(kb);
          kb.trace.push({ type: "rule", id: rule.id, label: rule.label });
        }
      }
    }

    // 2단계: 각 제품별 규칙 적용
    for (const prod of this.individuals) {
      for (const rule of this.ontology.rules) {
        if (rule.when.length === 2) {
          try {
            if (rule.when(kb, prod)) {
              rule.then(kb, prod);
              kb.trace.push({ type: "rule", id: rule.id, prod: prod._id });
            }
          } catch (_) { /* 속성 없는 제품 무시 */ }
        }
      }
    }

    // 3단계: 예산 제약 적용
    const result = this._applyBudget(kb);
    result.trace = kb.trace;
    result.bmi = kb.bmi;
    result.bodyCondition = kb.hasBodyCondition;
    return result;
  }

  _applyBudget(kb) {
    const priorityOrder = { Essential: 0, Recommended: 1, Optional: 2 };

    const sorted = kb.getRecommendations().sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 3;
      const pb = priorityOrder[b.priority] ?? 3;
      return pa !== pb ? pa - pb : a.prod.price - b.prod.price;
    });

    let remaining = kb.budget;
    const affordable = [];
    const overBudget = [];

    for (const entry of sorted) {
      if (remaining >= entry.prod.price) {
        remaining -= entry.prod.price;
        affordable.push({ ...entry, withinBudget: true });
      } else {
        overBudget.push({ ...entry, withinBudget: false });
      }
    }

    return {
      affordable,
      overBudget,
      remaining,
      budget: kb.budget,
      totalCost: kb.budget - remaining,
    };
  }

  getSuperClasses(className) {
    const chain = [];
    let cur = className;
    while (cur) {
      const cls = this.ontology.classes[cur];
      if (!cls) break;
      chain.push(cur);
      cur = cls.superClass;
    }
    return chain;
  }

  getProductCategory(prod) {
    const chain = this.getSuperClasses(prod.type);
    const productIdx = chain.indexOf("Product");
    return productIdx > 0 ? chain[productIdx - 1] : prod.type;
  }
};

/* 카테고리 메타 */
var CATEGORY_META = {
  BasicLiving:      { label: "기본 생활용품",     icon: "🏠" },
  Hygiene:          { label: "위생용품",          icon: "🧼" },
  Medicine:         { label: "의약품",            icon: "💊" },
  FootCare:         { label: "발 관리",           icon: "👟" },
  SkinCare:         { label: "피부 관리",         icon: "🧴" },
  JointProtection:  { label: "관절 보호",         icon: "🦴" },
  KneeGuard:        { label: "무릎 보호대",       icon: "🦵" },
  BackSupport:      { label: "허리 보호대",       icon: "🔒" },
  SleepAid:         { label: "수면 보조",         icon: "😴" },
  Earplug:          { label: "귀마개",            icon: "👂" },
  EyeMask:          { label: "수면 안대",         icon: "😴" },
  EyeCare:          { label: "눈 관리",           icon: "👁️" },
  LetterWriting:    { label: "편지 / 소통",       icon: "💌" },
  Stationery:       { label: "문구 / 필기",       icon: "✏️" },
  HealthSupplement: { label: "건강보조식품",       icon: "💪" },
  WinterGear:       { label: "방한용품 (겨울)",    icon: "🧣" },
  SummerGear:       { label: "여름용품",           icon: "☀️" },
  Convenience:      { label: "편의용품",           icon: "🔧" },
  Snacks:           { label: "간식 / 식품",        icon: "🍫" },
  MentalHealth:     { label: "정신건강 / 취미",    icon: "📖" },
};

var CONDITION_LABEL = {
  FlatFoot:       "평발",
  KneeIssue:      "무릎통증",
  BackIssue:      "허리통증",
  LoudSnorer:     "코골이",
  LightSleeper:   "예민한수면",
  DryEyes:        "안구건조",
  SensitiveSkin:  "민감성피부",
  SweatyFeet:     "발에땀많음",
  WeakStomach:    "소화약함",
  Acne:           "여드름",
  WearsGlasses:   "안경착용",
  FrequentCramps: "쥐잘남",
  Allergies:      "알레르기",
};

var SITUATION_LABEL = {
  WinterEnlistment: "겨울입대",
  SummerEnlistment: "여름입대",
  HasGirlfriend:    "여자친구있음",
};

var BODY_LABEL = {
  Underweight:  "저체중",
  NormalWeight: "정상",
  Overweight:   "과체중",
  Obese:        "비만",
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Reasoner, KnowledgeBase, CATEGORY_META, CONDITION_LABEL, SITUATION_LABEL, BODY_LABEL };
}
