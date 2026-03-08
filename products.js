// 군입대 준비물 제품 데이터베이스
// priority: 'essential' | 'recommended' | 'optional'
// conditions: 해당 제품이 특히 필요한 특이사항 목록

const PRODUCTS = {
  insoles: {
    category: "깔창",
    icon: "👟",
    items: [
      {
        id: "insole_flat_premium",
        name: "닥터숄 기능성 아치지지 깔창",
        price: 18000,
        priority: "essential",
        conditions: ["flatFoot"],
        description: "평발용 아치 지지 설계. 장거리 행군 시 발바닥 통증 완화.",
        tags: ["평발", "행군", "통증완화"],
        minFootSize: 220,
        maxFootSize: 300,
      },
      {
        id: "insole_cushion_standard",
        name: "에어워크 쿠션 군화 깔창",
        price: 8000,
        priority: "essential",
        conditions: [],
        description: "군화 전용 충격 흡수 깔창. 장시간 착용 피로도 감소.",
        tags: ["기본", "충격흡수"],
        minFootSize: 230,
        maxFootSize: 295,
      },
      {
        id: "insole_gel_premium",
        name: "젤 쿠션 프리미엄 깔창",
        price: 22000,
        priority: "recommended",
        conditions: ["kneeIssue", "backIssue"],
        description: "젤 소재로 관절 충격 흡수 극대화. 무릎·허리 통증 예방.",
        tags: ["젤", "관절보호", "프리미엄"],
        minFootSize: 230,
        maxFootSize: 290,
      },
    ],
  },

  kneeGuard: {
    category: "무릎 보호대",
    icon: "🦵",
    items: [
      {
        id: "knee_basic",
        name: "맥다비드 기본 무릎 보호대",
        price: 15000,
        priority: "recommended",
        conditions: ["kneeIssue"],
        description: "압박형 무릎 보호대. 훈련 중 무릎 안정화.",
        tags: ["무릎", "압박", "훈련"],
      },
      {
        id: "knee_hinged",
        name: "관절 힌지 무릎 보호대",
        price: 35000,
        priority: "essential",
        conditions: ["kneeIssue"],
        description: "힌지 구조로 강한 측면 지지력 제공. 심한 무릎 통증에 권장.",
        tags: ["힌지", "고급", "무릎통증"],
      },
    ],
  },

  backSupport: {
    category: "허리 보호대",
    icon: "🔒",
    items: [
      {
        id: "back_basic",
        name: "허리 복대 (기본형)",
        price: 12000,
        priority: "recommended",
        conditions: ["backIssue"],
        description: "훈련 및 무거운 군장 착용 시 허리 지지.",
        tags: ["허리", "군장", "복대"],
      },
      {
        id: "back_premium",
        name: "의료용 요추 보호대",
        price: 28000,
        priority: "essential",
        conditions: ["backIssue"],
        description: "의료용 등급 요추 지지. 디스크 예방 효과.",
        tags: ["의료용", "요추", "디스크"],
      },
    ],
  },

  earplugs: {
    category: "귀마개",
    icon: "👂",
    items: [
      {
        id: "earplug_foam_basic",
        name: "3M 스탠다드 폼 귀마개 (20개입)",
        price: 5000,
        priority: "essential",
        conditions: [],
        description: "SNR 37dB 차음. 사격 훈련·취침 시 필수.",
        tags: ["사격", "소음차단", "기본"],
      },
      {
        id: "earplug_sleep",
        name: "수면 전용 실리콘 귀마개",
        price: 9000,
        priority: "recommended",
        conditions: ["loudSnorer", "lightSleeper"],
        description: "부드러운 실리콘 소재로 장시간 착용 편안. 코골이 차단.",
        tags: ["수면", "실리콘", "코골이"],
      },
      {
        id: "earplug_reusable",
        name: "재사용 가능 필터 귀마개",
        price: 18000,
        priority: "recommended",
        conditions: ["lightSleeper"],
        description: "필터 방식으로 소음 선택 차단. 위험 소리는 들리고 생활 소음은 차단.",
        tags: ["재사용", "필터", "스마트"],
      },
    ],
  },

  eyeCare: {
    category: "눈 관리",
    icon: "👁️",
    items: [
      {
        id: "eye_drops",
        name: "히알루론산 인공눈물 (30개입)",
        price: 12000,
        priority: "essential",
        conditions: ["dryEyes"],
        description: "보존제 없는 단회용 인공눈물. 건조한 막사 환경 대응.",
        tags: ["인공눈물", "안구건조", "보습"],
      },
      {
        id: "eye_mask",
        name: "3D 수면 안대",
        price: 7000,
        priority: "recommended",
        conditions: ["lightSleeper"],
        description: "눈 압박 없는 3D 구조. 빛 차단으로 숙면 도움.",
        tags: ["안대", "수면", "빛차단"],
      },
    ],
  },

  skinCare: {
    category: "피부 관리",
    icon: "🧴",
    items: [
      {
        id: "sunscreen",
        name: "선크림 SPF50+ (100ml)",
        price: 13000,
        priority: "essential",
        conditions: [],
        description: "야외 훈련 시 자외선 차단 필수. 땀에 강한 워터프루프 타입.",
        tags: ["선크림", "야외훈련", "자외선"],
      },
      {
        id: "lip_balm",
        name: "바세린 립밤",
        price: 4000,
        priority: "recommended",
        conditions: [],
        description: "건조한 환경에서 입술 보호. 소형으로 휴대 편리.",
        tags: ["립밤", "보습", "소형"],
      },
      {
        id: "lotion",
        name: "무향 보습 로션 (200ml)",
        price: 8000,
        priority: "recommended",
        conditions: [],
        description: "군 생활 중 피부 보습. 향이 없어 단체 생활에 적합.",
        tags: ["로션", "보습", "무향"],
      },
    ],
  },

  stationery: {
    category: "문구 / 생활",
    icon: "📎",
    items: [
      {
        id: "notebook",
        name: "군용 전술 노트 (방수)",
        price: 6000,
        priority: "recommended",
        conditions: [],
        description: "방수 처리된 소형 노트. 야외에서도 메모 가능.",
        tags: ["노트", "방수", "메모"],
      },
      {
        id: "pen_set",
        name: "볼펜 세트 (10자루)",
        price: 3000,
        priority: "essential",
        conditions: [],
        description: "각종 서류 작성용. 여유 있게 챙겨야 합니다.",
        tags: ["볼펜", "서류", "필수"],
      },
      {
        id: "nail_clipper",
        name: "손발톱 깎이 세트",
        price: 5000,
        priority: "essential",
        conditions: [],
        description: "손·발톱 정기 관리 필수. 세트 구성으로 편리.",
        tags: ["위생", "필수", "관리"],
      },
    ],
  },

  healthSupplements: {
    category: "건강보조식품",
    icon: "💊",
    items: [
      {
        id: "vitamin_c",
        name: "비타민 C 1000mg (30정)",
        price: 8000,
        priority: "recommended",
        conditions: [],
        description: "면역력 강화. 훈련으로 체력 소모가 많을 때 도움.",
        tags: ["비타민", "면역", "건강"],
      },
      {
        id: "joint_supplement",
        name: "글루코사민 관절 영양제 (30정)",
        price: 15000,
        priority: "recommended",
        conditions: ["kneeIssue", "backIssue"],
        description: "관절 연골 보호. 장거리 행군 전 복용 권장.",
        tags: ["관절", "글루코사민", "행군"],
      },
      {
        id: "protein",
        name: "단백질 보충제 (1kg)",
        price: 35000,
        priority: "optional",
        conditions: [],
        description: "훈련 후 근육 회복 촉진. 체중 관리에도 도움.",
        tags: ["단백질", "근육", "회복"],
        minWeight: 0,
      },
    ],
  },
};

// BMI 기반 체형 분류
function getBodyType(height, weight) {
  const bmi = weight / ((height / 100) ** 2);
  if (bmi < 18.5) return "underweight";
  if (bmi < 23) return "normal";
  if (bmi < 25) return "overweight";
  return "obese";
}
