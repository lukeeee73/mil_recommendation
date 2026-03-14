/**
 * app.js — 군입대 준비물 체크리스트 MVP
 *
 * 체크리스트 스타일 UI (제품 링크 없음, 준비물 안내에 집중)
 */

// ── 폼 제출 ───────────────────────────────────────────────
document.getElementById("userForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const submitBtn = document.querySelector(".btn-primary");
  submitBtn.textContent = "체크리스트 생성 중...";
  submitBtn.disabled = true;

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

  try {
    const response = await fetch("/api/recommend", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(userInput),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "서버 오류");
    }

    const result = await response.json();
    renderResults(result);

    document.getElementById("results").classList.remove("hidden");
    document.getElementById("results").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    alert(`오류: ${err.message}`);
  } finally {
    submitBtn.textContent = "체크리스트 생성";
    submitBtn.disabled = false;
  }
});

// ── 결과 렌더링 ───────────────────────────────────────────
function renderResults(result) {
  const { affordable, overBudget, remaining, budget, totalCost,
          bmi, bodyCondition, meta } = result;

  const CATEGORY_META   = meta?.categoryMeta    || {};
  const CONDITION_LABEL = meta?.conditionLabels  || {};
  const SITUATION_LABEL = meta?.situationLabels  || {};
  const BODY_LABEL      = meta?.bodyLabels       || {};

  renderProfile(bmi, bodyCondition, BODY_LABEL, result);
  renderBudgetBar(budget, totalCost, remaining);
  renderChecklist([...affordable, ...overBudget], CATEGORY_META, CONDITION_LABEL, SITUATION_LABEL);
  document.getElementById("budgetWarning").classList.toggle("hidden", overBudget.length === 0);
}

function renderProfile(bmi, bodyCondition, BODY_LABEL, result) {
  const allItems = [...(result.affordable || []), ...(result.overBudget || [])];
  const essentialCount = allItems.filter(e => e.priority === "Essential").length;
  const totalCount = allItems.length;

  document.getElementById("profileSummary").innerHTML = `
    <div class="profile-badges">
      <div class="profile-badge">
        <span class="profile-badge-label">BMI</span>
        <span class="profile-badge-value">${bmi.toFixed(1)}</span>
        <span class="profile-badge-desc">${BODY_LABEL[bodyCondition] || "-"}</span>
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

function renderChecklist(entries, CATEGORY_META, CONDITION_LABEL, SITUATION_LABEL) {
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
    const meta = CATEGORY_META[catKey] || { label: catKey, icon: "📦" };
    const section = document.createElement("div");
    section.className = "result-category";

    // 카테고리 내 필수 개수
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
        ${items.map((e) => checklistItemHTML(e, CONDITION_LABEL, SITUATION_LABEL)).join("")}
      </div>
    `;
    container.appendChild(section);
  }
}

function checklistItemHTML({ prod, priority, reasons, withinBudget }, CONDITION_LABEL, SITUATION_LABEL) {
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

  // 매칭된 조건 태그
  const conditionTags = (prod.indicatedForCondition || [])
    .map((c) => CONDITION_LABEL[c])
    .filter(Boolean)
    .map((l) => `<span class="condition-tag">${l}</span>`)
    .join("");

  const situationTags = (prod.indicatedForSituation || [])
    .map((s) => SITUATION_LABEL[s])
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
