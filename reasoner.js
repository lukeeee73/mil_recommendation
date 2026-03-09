/**
 * reasoner.js — 전방향 연쇄 추론 엔진 (Forward-Chaining Reasoner)
 *
 * 역할:
 *  1. 사용자 입력 → 지식 베이스(KB) 구축
 *  2. 온톨로지 규칙을 순서대로 적용 (추론)
 *  3. 추론된 사실(facts)로부터 추천 목록 생성
 *  4. 예산 제약 적용 → 최종 결과 반환
 */

class KnowledgeBase {
  constructor(userInput) {
    const { height, weight, footSize, budget, conditions } = userInput;

    // ── 기본 사실 ─────────────────────────────────────────
    this.height   = height;
    this.weight   = weight;
    this.footSize = footSize;
    this.budget   = budget;
    this.bmi      = weight / ((height / 100) ** 2);

    // 건강 특이사항 집합
    this.hasHealthCondition = new Set(conditions);

    // 추론될 체형 (BMI 규칙 적용 후 채워짐)
    this.hasBodyCondition = null;

    // 추천 결과 맵: productId → { prod, reasons, priority }
    this._recommendations = new Map();

    // 제외 목록: productId → reason
    this._excluded = new Set();

    // 규칙 실행 추적 (설명 가능성)
    this.trace = [];
  }

  /** 사실 추가 (객체 속성) */
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

  /** 추천 목록에서 제거 */
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
}

/* =========================================================
   추론 엔진
   ========================================================= */
class Reasoner {
  constructor(ontology) {
    this.ontology = ontology;

    // 개체 목록에 _id 주입
    this.individuals = Object.entries(ontology.individuals).map(([id, ind]) => ({
      ...ind,
      _id: id,
    }));
  }

  /**
   * 추론 실행 (Forward Chaining)
   * @param {object} userInput - { height, weight, footSize, budget, conditions }
   * @returns {{ recommendations, budget }} 추론 결과
   */
  reason(userInput) {
    const kb = new KnowledgeBase(userInput);

    // 1단계: 전역 규칙(개체 독립) 적용 — BMI 분류 등
    for (const rule of this.ontology.rules) {
      if (rule.when.length === 1) {           // (kb) only
        if (rule.when(kb)) {
          rule.then(kb);
          kb.trace.push({ type: "rule", id: rule.id, label: rule.label });
        }
      }
    }

    // 2단계: 각 제품(individual)에 대해 제품별 규칙 적용
    for (const prod of this.individuals) {
      for (const rule of this.ontology.rules) {
        if (rule.when.length === 2) {         // (kb, prod)
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
    result.trace  = kb.trace;
    result.bmi    = kb.bmi;
    result.bodyCondition = kb.hasBodyCondition;
    return result;
  }

  /**
   * 예산 내 우선도 정렬 및 분류
   */
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

  /**
   * 클래스 계층에서 superClass 체인 반환 (유틸)
   */
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

  /**
   * 제품의 상위 카테고리 클래스 반환 (표시용)
   */
  getProductCategory(prod) {
    // type → superClass 체인 중 Product 바로 아래 클래스
    const chain = this.getSuperClasses(prod.type);
    const productIdx = chain.indexOf("Product");
    return productIdx > 0 ? chain[productIdx - 1] : prod.type;
  }
}

/* 카테고리 메타 (아이콘/한글 이름) */
const CATEGORY_META = {
  FootCare:         { label: "깔창",         icon: "👟" },
  KneeGuard:        { label: "무릎 보호대",   icon: "🦵" },
  JointProtection:  { label: "관절 보호",     icon: "🦴" },
  BackSupport:      { label: "허리 보호대",   icon: "🔒" },
  Earplug:          { label: "귀마개",        icon: "👂" },
  EyeMask:          { label: "수면 안대",     icon: "😴" },
  SleepAid:         { label: "수면 보조",     icon: "😴" },
  EyeCare:          { label: "눈 관리",       icon: "👁️" },
  SkinCare:         { label: "피부 관리",     icon: "🧴" },
  Stationery:       { label: "문구·생활",     icon: "📎" },
  HealthSupplement: { label: "건강보조식품",  icon: "💊" },
};

const CONDITION_LABEL = {
  FlatFoot:     "평발",
  KneeIssue:    "무릎통증",
  BackIssue:    "허리통증",
  LoudSnorer:   "코골이",
  LightSleeper: "예민한수면",
  DryEyes:      "안구건조",
};

const BODY_LABEL = {
  Underweight:  "저체중",
  NormalWeight: "정상",
  Overweight:   "과체중",
  Obese:        "비만",
};

// Node.js 환경에서도 require()로 불러올 수 있도록
if (typeof module !== "undefined" && module.exports) {
  module.exports = { Reasoner, KnowledgeBase, CATEGORY_META, CONDITION_LABEL, BODY_LABEL };
}
