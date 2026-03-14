/**
 * app.js — 군입대 준비물 체크리스트 MVP (정적 사이트 버전)
 *
 * 서버 없이 브라우저에서 직접 온톨로지 추론 실행.
 * ontology.js, reasoner.js 를 먼저 로드해야 함.
 */

const reasoner = new Reasoner(ONTOLOGY);

// ── 폼 제출 ───────────────────────────────────────────────
document.getElementById("userForm").addEventListener("submit", function (e) {
  e.preventDefault();

  // 건강 조건
  const conditions = Array.from(
    document.querySelectorAll('input[name="conditions"]:checked')
  ).map((el) => el.value);

  // 상황 조건
  const situations = Array.from(
    document.querySelectorAll('input[name="situations"]:checked')
  ).map((el) => el.value);

  // 계절 (라디오)
  const seasonEl = document.querySelector('input[name="season"]:checked');
  if (seasonEl) situations.push(seasonEl.value);

  const userInput = {
    height:     parseFloat(document.getElementById("height").value),
    weight:     parseFloat(document.getElementById("weight").value),
    footSize:   parseFloat(document.getElementById("footSize").value),
    budget:     parseFloat(document.getElementById("budget").value),
    conditions,
    situations,
  };

  // 브라우저에서 직접 추론 실행
  const result = reasoner.reason(userInput);

  renderResults({
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

  document.getElementById("results").classList.remove("hidden");
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });
});

// ── 결과 렌더링 ───────────────────────────────────────────
function renderResults(result) {
  const { affordable, overBudget, remaining, budget, totalCost,
          bmi, bodyCondition, meta } = result;

  const CAT_META  = meta?.categoryMeta    || {};
  const COND_LBL  = meta?.conditionLabels  || {};
  const SIT_LBL   = meta?.situationLabels  || {};
  const BODY_LBL  = meta?.bodyLabels       || {};

  renderProfile(bmi, bodyCondition, BODY_LBL, result);
  renderBudgetBar(budget, totalCost, remaining);
  renderChecklist([...affordable, ...overBudget], CAT_META, COND_LBL, SIT_LBL);
  document.getElementById("budgetWarning").classList.toggle("hidden", overBudget.length === 0);
}

function renderProfile(bmi, bodyCondition, BODY_LBL, result) {
  const allItems = [...(result.affordable || []), ...(result.overBudget || [])];
  const essentialCount = allItems.filter(e => e.priority === "Essential").length;
  const totalCount = allItems.length;

  document.getElementById("profileSummary").innerHTML = `
    <div class="profile-badges">
      <div class="profile-badge">
        <span class="profile-badge-label">BMI</span>
        <span class="profile-badge-value">${bmi.toFixed(1)}</span>
        <span class="profile-badge-desc">${BODY_LBL[bodyCondition] || "-"}</span>
      </div>
      <div class="profile-badge">
        <span class="profile-badge-label">필수 품목</span>
        <span class="profile-badge-value">${essentialCount}개</span>
      </div>
      <div class="profile-badge">
        <span class="profile-badge-label">전체 추천</span>
        <span class="profile-badge-value">${totalCount}개</span>
      </div>
    </div>
  `;
}

function renderBudgetBar(budget, totalCost, remaining) {
  const percent = budget > 0 ? Math.min(Math.round((totalCost / budget) * 100), 100) : 0;
  const isOver = remaining < 0;

  document.getElementById("budgetSummary").innerHTML = `
    <div class="budget-bar-wrap">
      <div class="budget-bar">
        <div class="budget-bar-fill ${isOver ? 'budget-over' : ''}" style="width:${percent}%"></div>
      </div>
      <span class="budget-text">
        예산 <strong>${budget.toLocaleString()}원</strong> 중
        <strong>${totalCost.toLocaleString()}원</strong> 예상
        &nbsp;|&nbsp; 잔액 <strong>${remaining.toLocaleString()}원</strong>
      </span>
    </div>
  `;
}

function renderChecklist(entries, CAT_META, COND_LBL, SIT_LBL) {
  const container = document.getElementById("resultCards");
  container.innerHTML = "";

  // 카테고리별 그룹핑
  const groups = new Map();
  for (const entry of entries) {
    const catKey = entry.prod.type;
    if (!groups.has(catKey)) groups.set(catKey, []);
    groups.get(catKey).push(entry);
  }

  for (const [catKey, items] of groups) {
    const meta = CAT_META[catKey] || { label: catKey, icon: "📦" };
    const section = document.createElement("div");
    section.className = "result-category";

    const essentialInCat = items.filter(e => e.priority === "Essential").length;
    const countBadge = essentialInCat > 0
      ? `<span class="cat-count essential-count">필수 ${essentialInCat}</span>`
      : "";

    section.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${meta.icon}</span>
        <h3>${meta.label}</h3>
        ${countBadge}
        <span class="cat-count total-count">${items.length}개</span>
      </div>
      <div class="category-items">
        ${items.map((e) => checklistItemHTML(e, COND_LBL, SIT_LBL)).join("")}
      </div>
    `;
    container.appendChild(section);
  }
}

function checklistItemHTML({ prod, priority, reasons, withinBudget }, COND_LBL, SIT_LBL) {
  const PRIORITY_BADGE = {
    Essential:   '<span class="badge badge-essential">필수</span>',
    Recommended: '<span class="badge badge-recommended">추천</span>',
    Optional:    '<span class="badge badge-optional">선택</span>',
  };

  const reasonLabels = {
    essential:            "모든 입대자 필수",
    situationEssential:   "상황별 필수",
    conditionMatch:       "건강상태 맞춤",
    bodyMatch:            "체형 맞춤",
    situationMatch:       "상황 맞춤",
    "priority_upgraded:R-KNEE-OBESE":        "비만+무릎 → 필수",
    "priority_upgraded:R-SWEATY-FOOTCARE":   "발 땀 → 필수",
    "priority_upgraded:R-GIRLFRIEND-LETTER": "여자친구 → 필수",
    "priority_upgraded:R-GLASSES-ESSENTIAL": "안경착용 → 필수",
    "priority_upgraded:R-SENSITIVE-SKIN-CARE": "민감피부 → 필수",
  };

  const conditionTags = (prod.indicatedForCondition || [])
    .map((c) => COND_LBL[c])
    .filter(Boolean)
    .map((l) => `<span class="condition-tag">${l}</span>`)
    .join("");

  const situationTags = (prod.indicatedForSituation || [])
    .map((s) => SIT_LBL[s])
    .filter(Boolean)
    .map((l) => `<span class="situation-tag">${l}</span>`)
    .join("");

  const reasonHtml = [...new Set(reasons)]
    .map((r) => reasonLabels[r] ? `<span class="reason-tag">${reasonLabels[r]}</span>` : "")
    .filter(Boolean)
    .join("");

  const tipHtml = prod.tip
    ? `<div class="item-tip"><strong>TIP</strong> ${prod.tip}</div>`
    : "";

  const quantityHtml = prod.quantity
    ? `<span class="item-quantity">권장: ${prod.quantity}</span>`
    : "";

  return `
    <div class="checklist-item ${withinBudget ? "" : "out-of-budget"}">
      <div class="item-main">
        <div class="item-header">
          <div class="item-name-wrap">
            <span class="item-checkbox">${withinBudget ? "☑" : "☐"}</span>
            <span class="item-name">${prod.productName}</span>
          </div>
          <div class="item-badges">
            ${PRIORITY_BADGE[priority] || ""}
            ${withinBudget ? "" : '<span class="badge badge-over">예산초과</span>'}
          </div>
        </div>
        ${conditionTags || situationTags ? `<div class="match-tags">${conditionTags}${situationTags}</div>` : ""}
        ${reasonHtml ? `<div class="reason-tags">${reasonHtml}</div>` : ""}
        <p class="item-desc">${prod.description}</p>
        ${tipHtml}
        <div class="item-footer">
          <div class="item-meta">
            ${quantityHtml}
          </div>
          <span class="item-price">${prod.priceRange || `약 ${prod.price.toLocaleString()}원`}</span>
        </div>
      </div>
    </div>
  `;
}
