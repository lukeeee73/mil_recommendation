/**
 * app.js — UI ↔ Reasoner 연결
 *
 * 온톨로지와 추론 엔진은 건드리지 않고 이 파일만 수정해
 * UI 변경을 자유롭게 할 수 있습니다.
 */

const reasoner = new Reasoner(ONTOLOGY);

/* ── 폼 제출 ─────────────────────────────────────────────── */
document.getElementById("userForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const userInput = {
    height:     parseFloat(document.getElementById("height").value),
    weight:     parseFloat(document.getElementById("weight").value),
    footSize:   parseFloat(document.getElementById("footSize").value),
    budget:     parseFloat(document.getElementById("budget").value),
    conditions: Array.from(
      document.querySelectorAll('input[name="conditions"]:checked')
    ).map((el) => el.value),
  };

  const result = reasoner.reason(userInput);
  renderResults(result);

  document.getElementById("results").classList.remove("hidden");
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });
});

/* ── 결과 렌더링 ──────────────────────────────────────────── */
function renderResults(result) {
  const { affordable, overBudget, remaining, budget, totalCost, bmi, bodyCondition } = result;
  renderBudgetBar(budget, totalCost, remaining, bmi, bodyCondition);
  renderCards([...affordable, ...overBudget]);
  document.getElementById("budgetWarning").classList.toggle("hidden", overBudget.length === 0);
}

function renderBudgetBar(budget, totalCost, remaining, bmi, bodyCondition) {
  const percent = budget > 0 ? Math.min(Math.round((totalCost / budget) * 100), 100) : 0;
  document.getElementById("budgetSummary").innerHTML = `
    <div class="bmi-badge">
      BMI <strong>${bmi.toFixed(1)}</strong>
      <span class="body-label">(${BODY_LABEL[bodyCondition] || "-"})</span>
    </div>
    <div class="budget-bar-wrap">
      <div class="budget-bar">
        <div class="budget-bar-fill" style="width:${percent}%"></div>
      </div>
      <span class="budget-text">
        예산 <strong>${budget.toLocaleString()}원</strong> 중
        <strong>${totalCost.toLocaleString()}원</strong> 사용
        &nbsp;|&nbsp; 잔액 <strong>${remaining.toLocaleString()}원</strong>
      </span>
    </div>
  `;
}

function renderCards(entries) {
  const container = document.getElementById("resultCards");
  container.innerHTML = "";

  // 카테고리별 그룹핑
  const groups = new Map();
  for (const entry of entries) {
    const catKey = reasoner.getProductCategory(entry.prod);
    if (!groups.has(catKey)) groups.set(catKey, []);
    groups.get(catKey).push(entry);
  }

  for (const [catKey, items] of groups) {
    const meta = CATEGORY_META[catKey] || { label: catKey, icon: "📦" };
    const section = document.createElement("div");
    section.className = "result-category";
    section.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${meta.icon}</span>
        <h3>${meta.label}</h3>
      </div>
      <div class="category-items">${items.map(productCardHTML).join("")}</div>
    `;
    container.appendChild(section);
  }
}

function productCardHTML({ prod, priority, reasons, withinBudget }) {
  const PRIORITY_BADGE = {
    Essential:   '<span class="badge badge-essential">필수</span>',
    Recommended: '<span class="badge badge-recommended">추천</span>',
    Optional:    '<span class="badge badge-optional">선택</span>',
  };

  const conditionTags = (prod.indicatedForCondition || [])
    .filter((c) => reasoner.individuals /* always true */ && reasons.some((r) => r === "conditionMatch"))
    .map((c) => CONDITION_LABEL[c])
    .filter(Boolean)
    .map((l) => `<span class="condition-tag">${l}</span>`)
    .join("");

  // 추론 근거 표시 (설명 가능성)
  const reasonLabels = {
    essential:       "필수 품목",
    conditionMatch:  "특이사항 일치",
    bodyMatch:       "체형 적합",
    "priority_upgraded:R-KNEE-OBESE":  "비만+무릎통증 → 필수 격상",
    "priority_upgraded:R-BACK-HEAVY":  "과체중+허리통증 → 필수 격상",
  };
  const uniqueReasons = [...new Set(reasons)];
  const reasonHtml = uniqueReasons
    .map((r) => reasonLabels[r] ? `<span class="reason-tag">💡 ${reasonLabels[r]}</span>` : "")
    .join("");

  const tagsHtml = (prod.tags || []).map((t) => `<span class="tag">#${t}</span>`).join("");
  const overClass = withinBudget ? "" : "out-of-budget";
  const overBadge = withinBudget ? "" : '<span class="badge badge-over">예산초과</span>';

  return `
    <div class="product-card ${overClass}">
      <div class="product-header">
        <span class="product-name">${prod.productName}</span>
        <div class="product-badges">${PRIORITY_BADGE[priority] || ""}${overBadge}</div>
      </div>
      ${conditionTags ? `<div class="condition-tags">${conditionTags}</div>` : ""}
      ${reasonHtml ? `<div class="reason-tags">${reasonHtml}</div>` : ""}
      <p class="product-desc">${prod.description}</p>
      <div class="product-footer">
        <div class="tags">${tagsHtml}</div>
        <span class="product-price">약 ${prod.price.toLocaleString()}원</span>
      </div>
    </div>
  `;
}
