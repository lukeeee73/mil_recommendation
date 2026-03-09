/**
 * ontology.js — 군입대 준비물 추천 온톨로지
 *
 * 구조:
 *  classes      : 개념 계층 (Thing > Person > MilitaryRecruit 등)
 *  objectProperties : 개체 간 관계 (domain/range/inverseOf)
 *  dataProperties   : 개체-값 관계 (domain/range/restrictions)
 *  individuals  : 명명된 개체 (제품 인스턴스)
 *  rules        : 추론 규칙 (SWRL 스타일, JS 함수로 표현)
 */

const ONTOLOGY = {

  /* =========================================================
     1. 클래스 계층 (rdfs:subClassOf)
     ========================================================= */
  classes: {
    Thing: { superClass: null },

    // 사람
    Person:           { superClass: "Thing" },
    MilitaryRecruit:  { superClass: "Person" },  // 입대 예정자

    // 신체 상태 (BMI 기반 추론)
    BodyCondition:    { superClass: "Thing" },
    Underweight:      { superClass: "BodyCondition" },
    NormalWeight:     { superClass: "BodyCondition" },
    Overweight:       { superClass: "BodyCondition" },
    Obese:            { superClass: "BodyCondition" },

    // 건강 특이사항
    HealthCondition:  { superClass: "Thing" },
    FlatFoot:         { superClass: "HealthCondition" },
    KneeIssue:        { superClass: "HealthCondition" },
    BackIssue:        { superClass: "HealthCondition" },
    LoudSnorer:       { superClass: "HealthCondition" },
    LightSleeper:     { superClass: "HealthCondition" },
    DryEyes:          { superClass: "HealthCondition" },

    // 제품 분류
    Product:          { superClass: "Thing" },
    FootCare:         { superClass: "Product" },   // 깔창
    JointProtection:  { superClass: "Product" },   // 관절 보호
    KneeGuard:        { superClass: "JointProtection" },
    BackSupport:      { superClass: "JointProtection" },
    SleepAid:         { superClass: "Product" },   // 수면 보조
    Earplug:          { superClass: "SleepAid" },
    EyeMask:          { superClass: "SleepAid" },
    EyeCare:          { superClass: "Product" },   // 눈 관리
    SkinCare:         { superClass: "Product" },   // 피부 관리
    Stationery:       { superClass: "Product" },   // 문구
    HealthSupplement: { superClass: "Product" },   // 건강보조

    // 우선도
    PriorityLevel:    { superClass: "Thing" },
    Essential:        { superClass: "PriorityLevel" },   // 필수
    Recommended:      { superClass: "PriorityLevel" },   // 추천
    Optional:         { superClass: "PriorityLevel" },   // 선택
  },

  /* =========================================================
     2. 객체 속성 (Object Properties)
     ========================================================= */
  objectProperties: {
    // Person ←→ Condition
    hasHealthCondition: { domain: "Person",  range: "HealthCondition" },
    hasBodyCondition:   { domain: "Person",  range: "BodyCondition",
                          comment: "BMI 규칙으로 자동 추론됨" },

    // Product ← 관계
    hasPriority:        { domain: "Product", range: "PriorityLevel" },
    indicatedForCondition: {
      domain: "Product", range: "HealthCondition",
      comment: "이 제품이 특히 권장되는 건강 상태",
    },
    indicatedForBodyCondition: {
      domain: "Product", range: "BodyCondition",
    },
    productType:        { domain: "Product", range: "Product",
                          comment: "개체가 속하는 제품 클래스" },

    // 추천 관계 (추론 결과로 생성)
    isRecommendedTo: { domain: "Product", range: "Person",
                       inverseOf: "hasRecommendation" },
    hasRecommendation: { domain: "Person",  range: "Product" },
  },

  /* =========================================================
     3. 데이터 속성 (Data Properties)
     ========================================================= */
  dataProperties: {
    // Person
    height:   { domain: "Person",  range: "xsd:float",   minInclusive: 140, maxInclusive: 220 },
    weight:   { domain: "Person",  range: "xsd:float",   minInclusive: 40,  maxInclusive: 150 },
    footSize: { domain: "Person",  range: "xsd:integer", minInclusive: 220, maxInclusive: 300 },
    budget:   { domain: "Person",  range: "xsd:float",   minInclusive: 0 },
    bmi:      { domain: "Person",  range: "xsd:float",   comment: "BMI 규칙으로 자동 계산" },

    // Product
    productName:   { domain: "Product", range: "xsd:string" },
    price:         { domain: "Product", range: "xsd:integer", minInclusive: 0 },
    description:   { domain: "Product", range: "xsd:string" },
    tags:          { domain: "Product", range: "xsd:string", isArray: true },
    minFootSize:   { domain: "Product", range: "xsd:integer" },
    maxFootSize:   { domain: "Product", range: "xsd:integer" },
    searchKeyword: { domain: "Product", range: "xsd:string",
                     comment: "네이버 쇼핑 검색 시 사용할 검색어" },
  },

  /* =========================================================
     4. 명명된 개체 (Named Individuals — 제품 목록)
     ========================================================= */
  individuals: {
    // ── 깔창 (FootCare) ──────────────────────────────────────
    InsoleArcSupport: {
      type: "FootCare",
      productName: "아치지지 깔창 (평발용)",
      price: 18000,
      hasPriority: "Essential",
      indicatedForCondition: ["FlatFoot"],
      description: "평발용 아치 지지 설계. 장거리 행군 시 발바닥 통증 완화.",
      tags: ["평발", "행군", "통증완화"],
      minFootSize: 220, maxFootSize: 300,
      searchKeyword: "군화 깔창 평발 아치지지",
    },
    InsoleCushionStandard: {
      type: "FootCare",
      productName: "쿠션 군화 깔창",
      price: 8000,
      hasPriority: "Essential",
      indicatedForCondition: [],
      description: "군화 전용 충격 흡수 깔창. 장시간 착용 피로도 감소.",
      tags: ["기본", "충격흡수"],
      minFootSize: 230, maxFootSize: 295,
      searchKeyword: "군화 깔창 충격흡수",
    },
    InsoleGelPremium: {
      type: "FootCare",
      productName: "젤 쿠션 프리미엄 깔창",
      price: 22000,
      hasPriority: "Recommended",
      indicatedForCondition: ["KneeIssue", "BackIssue"],
      description: "젤 소재로 관절 충격 흡수 극대화. 무릎·허리 통증 예방.",
      tags: ["젤", "관절보호", "프리미엄"],
      minFootSize: 230, maxFootSize: 290,
      searchKeyword: "젤 깔창 관절보호 충격흡수",
    },

    // ── 무릎 보호대 (KneeGuard) ──────────────────────────────
    KneeGuardBasic: {
      type: "KneeGuard",
      productName: "기본 무릎 보호대",
      price: 15000,
      hasPriority: "Recommended",
      indicatedForCondition: ["KneeIssue"],
      description: "압박형 무릎 보호대. 훈련 중 무릎 안정화.",
      tags: ["무릎", "압박", "훈련"],
      searchKeyword: "무릎 보호대 운동 훈련",
    },
    KneeGuardHinged: {
      type: "KneeGuard",
      productName: "관절 힌지 무릎 보호대",
      price: 35000,
      hasPriority: "Essential",
      indicatedForCondition: ["KneeIssue"],
      indicatedForBodyCondition: ["Overweight", "Obese"],
      description: "힌지 구조로 강한 측면 지지력 제공. 심한 무릎 통증·과체중에 권장.",
      tags: ["힌지", "고급", "무릎통증"],
      searchKeyword: "힌지 무릎 보호대 관절 지지",
    },

    // ── 허리 보호대 (BackSupport) ────────────────────────────
    BackSupportBasic: {
      type: "BackSupport",
      productName: "허리 복대 보호대",
      price: 12000,
      hasPriority: "Recommended",
      indicatedForCondition: ["BackIssue"],
      description: "훈련 및 무거운 군장 착용 시 허리 지지.",
      tags: ["허리", "군장", "복대"],
      searchKeyword: "허리 복대 보호대 운동",
    },
    BackSupportPremium: {
      type: "BackSupport",
      productName: "의료용 요추 보호대",
      price: 28000,
      hasPriority: "Essential",
      indicatedForCondition: ["BackIssue"],
      description: "의료용 등급 요추 지지. 디스크 예방 효과.",
      tags: ["의료용", "요추", "디스크"],
      searchKeyword: "의료용 요추 보호대 허리디스크",
    },

    // ── 귀마개 (Earplug) ─────────────────────────────────────
    EarplugFoam: {
      type: "Earplug",
      productName: "폼 귀마개 소음차단 (다량입)",
      price: 5000,
      hasPriority: "Essential",
      indicatedForCondition: [],
      description: "고차음 폼 귀마개. 사격 훈련·취침 시 필수.",
      tags: ["사격", "소음차단", "기본"],
      searchKeyword: "귀마개 소음차단 폼 사격",
    },
    EarplugSilicone: {
      type: "Earplug",
      productName: "수면용 실리콘 귀마개",
      price: 9000,
      hasPriority: "Recommended",
      indicatedForCondition: ["LoudSnorer", "LightSleeper"],
      description: "부드러운 실리콘 소재로 장시간 착용 편안. 코골이 차단.",
      tags: ["수면", "실리콘", "코골이"],
      searchKeyword: "수면 귀마개 실리콘 코골이 차단",
    },
    EarplugFilter: {
      type: "Earplug",
      productName: "재사용 필터 귀마개",
      price: 18000,
      hasPriority: "Recommended",
      indicatedForCondition: ["LightSleeper"],
      description: "필터 방식 선택적 소음 차단. 위험 소리는 인지 가능.",
      tags: ["재사용", "필터", "스마트"],
      searchKeyword: "필터 귀마개 재사용 소음 선택차단",
    },

    // ── 눈 관리 (EyeCare / EyeMask) ─────────────────────────
    EyeDrops: {
      type: "EyeCare",
      productName: "히알루론산 인공눈물 (단회용)",
      price: 12000,
      hasPriority: "Essential",
      indicatedForCondition: ["DryEyes"],
      description: "보존제 없는 단회용 인공눈물. 건조한 막사 환경 대응.",
      tags: ["인공눈물", "안구건조", "보습"],
      searchKeyword: "인공눈물 히알루론산 단회용 안구건조",
    },
    EyeMaskSleep: {
      type: "EyeMask",
      productName: "3D 수면 안대",
      price: 7000,
      hasPriority: "Recommended",
      indicatedForCondition: ["LightSleeper"],
      description: "눈 압박 없는 3D 구조. 빛 차단으로 숙면 도움.",
      tags: ["안대", "수면", "빛차단"],
      searchKeyword: "3D 수면 안대 빛차단 숙면",
    },

    // ── 피부 관리 (SkinCare) ─────────────────────────────────
    Sunscreen: {
      type: "SkinCare",
      productName: "선크림 SPF50+ 워터프루프",
      price: 13000,
      hasPriority: "Essential",
      indicatedForCondition: [],
      description: "야외 훈련 시 자외선 차단 필수. 땀에 강한 워터프루프 타입.",
      tags: ["선크림", "야외훈련", "자외선"],
      searchKeyword: "선크림 SPF50 워터프루프 야외활동",
    },
    LipBalm: {
      type: "SkinCare",
      productName: "보습 립밤",
      price: 4000,
      hasPriority: "Recommended",
      indicatedForCondition: [],
      description: "건조한 환경에서 입술 보호. 소형으로 휴대 편리.",
      tags: ["립밤", "보습", "소형"],
      searchKeyword: "립밤 보습 촉촉 입술보호",
    },
    Lotion: {
      type: "SkinCare",
      productName: "무향 보습 로션",
      price: 8000,
      hasPriority: "Recommended",
      indicatedForCondition: [],
      description: "군 생활 중 피부 보습. 향이 없어 단체 생활에 적합.",
      tags: ["로션", "보습", "무향"],
      searchKeyword: "무향 보습 로션 피부 건조",
    },

    // ── 문구 (Stationery) ────────────────────────────────────
    WaterproofNotebook: {
      type: "Stationery",
      productName: "방수 소형 노트",
      price: 6000,
      hasPriority: "Recommended",
      indicatedForCondition: [],
      description: "방수 처리된 소형 노트. 야외에서도 메모 가능.",
      tags: ["노트", "방수", "메모"],
      searchKeyword: "방수 노트 소형 야외 메모",
    },
    PenSet: {
      type: "Stationery",
      productName: "볼펜 세트",
      price: 3000,
      hasPriority: "Essential",
      indicatedForCondition: [],
      description: "각종 서류 작성용. 여유 있게 챙겨야 합니다.",
      tags: ["볼펜", "서류", "필수"],
      searchKeyword: "볼펜 세트 10개입",
    },
    NailClipper: {
      type: "Stationery",
      productName: "손발톱 깎이 세트",
      price: 5000,
      hasPriority: "Essential",
      indicatedForCondition: [],
      description: "손·발톱 정기 관리 필수. 세트 구성으로 편리.",
      tags: ["위생", "필수", "관리"],
      searchKeyword: "손발톱 깎이 세트 위생",
    },

    // ── 건강보조식품 (HealthSupplement) ─────────────────────
    VitaminC: {
      type: "HealthSupplement",
      productName: "비타민 C 1000mg",
      price: 8000,
      hasPriority: "Recommended",
      indicatedForCondition: [],
      description: "면역력 강화. 훈련으로 체력 소모가 많을 때 도움.",
      tags: ["비타민", "면역", "건강"],
      searchKeyword: "비타민C 1000mg 면역력 영양제",
    },
    GlucosamineSupplement: {
      type: "HealthSupplement",
      productName: "글루코사민 관절 영양제",
      price: 15000,
      hasPriority: "Recommended",
      indicatedForCondition: ["KneeIssue", "BackIssue"],
      description: "관절 연골 보호. 장거리 행군 전 복용 권장.",
      tags: ["관절", "글루코사민", "행군"],
      searchKeyword: "글루코사민 관절 영양제 연골",
    },
    ProteinPowder: {
      type: "HealthSupplement",
      productName: "단백질 보충제",
      price: 35000,
      hasPriority: "Optional",
      indicatedForCondition: [],
      indicatedForBodyCondition: ["Underweight"],
      description: "훈련 후 근육 회복 촉진. 저체중 훈련병에게 특히 권장.",
      tags: ["단백질", "근육", "회복"],
      searchKeyword: "단백질 보충제 프로틴 근육 회복",
    },
  },

  /* =========================================================
     5. 공리 / 추론 규칙 (Axioms & SWRL-style Rules)
     ========================================================= */
  rules: [
    // ── BMI 분류 규칙 ──────────────────────────────────────
    {
      id: "R-BMI-UNDER",
      label: "저체중 분류",
      comment: "BMI < 18.5 → Underweight",
      when: (kb) => kb.bmi < 18.5,
      then: (kb) => kb.assert("hasBodyCondition", "Underweight"),
    },
    {
      id: "R-BMI-NORMAL",
      label: "정상 체중 분류",
      comment: "18.5 ≤ BMI < 23 → NormalWeight",
      when: (kb) => kb.bmi >= 18.5 && kb.bmi < 23,
      then: (kb) => kb.assert("hasBodyCondition", "NormalWeight"),
    },
    {
      id: "R-BMI-OVER",
      label: "과체중 분류",
      comment: "23 ≤ BMI < 25 → Overweight",
      when: (kb) => kb.bmi >= 23 && kb.bmi < 25,
      then: (kb) => kb.assert("hasBodyCondition", "Overweight"),
    },
    {
      id: "R-BMI-OBESE",
      label: "비만 분류",
      comment: "BMI ≥ 25 → Obese",
      when: (kb) => kb.bmi >= 25,
      then: (kb) => kb.assert("hasBodyCondition", "Obese"),
    },

    // ── 제품 추천 규칙 ──────────────────────────────────────
    {
      id: "R-PROD-CONDITION",
      label: "건강 상태 기반 제품 추천",
      comment: "indicatedForCondition 일치 시 우선도 상향 추천",
      when: (kb, prod) =>
        (prod.indicatedForCondition || []).some((c) => kb.hasHealthCondition.has(c)),
      then: (kb, prod) => kb.recommend(prod, "conditionMatch"),
    },
    {
      id: "R-PROD-BODY",
      label: "체형 기반 제품 추천",
      comment: "indicatedForBodyCondition 일치 시 추천",
      when: (kb, prod) =>
        (prod.indicatedForBodyCondition || []).some((c) => kb.hasBodyCondition === c),
      then: (kb, prod) => kb.recommend(prod, "bodyMatch"),
    },
    {
      id: "R-PROD-ESSENTIAL",
      label: "필수 제품 기본 추천",
      comment: "모든 입대 예정자에게 Essential 제품 추천",
      when: (kb, prod) => prod.hasPriority === "Essential",
      then: (kb, prod) => kb.recommend(prod, "essential"),
    },
    {
      id: "R-PROD-FOOTSIZE",
      label: "발 사이즈 적합성 검사",
      comment: "발 사이즈 범위 벗어나면 추천 목록에서 제외",
      when: (kb, prod) =>
        prod.minFootSize != null &&
        (kb.footSize < prod.minFootSize || kb.footSize > prod.maxFootSize),
      then: (kb, prod) => kb.exclude(prod, "footSizeMismatch"),
    },

    // ── 복합 규칙 ───────────────────────────────────────────
    {
      id: "R-KNEE-OBESE",
      label: "비만+무릎통증 → 힌지 보호대 필수로 격상",
      comment: "Obese ∧ KneeIssue → KneeGuardHinged priority = Essential",
      when: (kb, prod) =>
        prod._id === "KneeGuardHinged" &&
        kb.hasBodyCondition === "Obese" &&
        kb.hasHealthCondition.has("KneeIssue"),
      then: (kb, prod) => kb.upgradePriority(prod, "Essential", "R-KNEE-OBESE"),
    },
    {
      id: "R-BACK-HEAVY",
      label: "과체중/비만 + 허리 통증 → 의료용 요추 보호대 필수 격상",
      when: (kb, prod) =>
        prod._id === "BackSupportPremium" &&
        ["Overweight", "Obese"].includes(kb.hasBodyCondition) &&
        kb.hasHealthCondition.has("BackIssue"),
      then: (kb, prod) => kb.upgradePriority(prod, "Essential", "R-BACK-HEAVY"),
    },
  ],
};

// Node.js 환경에서도 require()로 불러올 수 있도록
// 브라우저에서는 이 줄이 무시됨
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ONTOLOGY };
}
