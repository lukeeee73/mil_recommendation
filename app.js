/**
 * app.js — UI ↔ 백엔드 연결
 *
 * 이전과 달라진 점:
 *  - 브라우저에서 직접 추론하던 것을 백엔드 서버에 위임
 *  - POST /api/recommend 로 요청 → 서버가 추론 + 네이버 API 처리
 *  - 결과 카드에 실제 이미지, 구매 링크, 판매처 표시 추가
 */

// ── 폼 제출 ───────────────────────────────────────────────
document.getElementById("userForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const submitBtn = document.querySelector(".btn-primary");
  submitBtn.textContent = "추천 검색 중...";
  submitBtn.disabled = true;

  const userInput = {
    height:     parseFloat(document.getElementById("height").value),
    weight:     parseFloat(document.getElementById("weight").value),
    footSize:   parseFloat(document.getElementById("footSize").value),
    budget:     parseFloat(document.getElementById("budget").value),
    conditions: Array.from(
      document.querySelectorAll('input[name="conditions"]:checked')
    ).map((el) => el.value),
  };

  try {
    // 백엔드 API 호출 (온톨로지 추론 + 네이버 검색을 서버에서 처리)
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
    submitBtn.textContent = "추천 받기";
    submitBtn.disabled = false;
  }
});

// ── 결과 렌더링 ───────────────────────────────────────────
function renderResults(result) {
  const { affordable, overBudget, remaining, budget, totalCost,
          bmi, bodyCondition, source, meta } = result;

  // 서버에서 메타데이터 받아서 사용 (없으면 기본값)
  const CATEGORY_META   = meta?.categoryMeta    || {};
  const CONDITION_LABEL = meta?.conditionLabels || {};
  const BODY_LABEL      = meta?.bodyLabels      || {};

  renderBudgetBar(budget, totalCost, remaining, bmi, bodyCondition, source, BODY_LABEL);
  renderCards([...affordable, ...overBudget], CATEGORY_META, CONDITION_LABEL);
  document.getElementById("budgetWarning").classList.toggle("hidden", overBudget.length === 0);
}

function renderBudgetBar(budget, totalCost, remaining, bmi, bodyCondition, source, BODY_LABEL) {
  const percent   = budget > 0 ? Math.min(Math.round((totalCost / budget) * 100), 100) : 0;
  const sourceBadge = source === "naver"
    ? '<span class="source-badge source-naver">네이버 실시간 가격</span>'
    : '<span class="source-badge source-fallback">기본 예상 가격</span>';

  document.getElementById("budgetSummary").innerHTML = `
    <div class="summary-top">
      <div class="bmi-badge">
        BMI <strong>${bmi.toFixed(1)}</strong>
        <span class="body-label">(${BODY_LABEL[bodyCondition] || "-"})</span>
      </div>
      ${sourceBadge}
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

function renderCards(entries, CATEGORY_META, CONDITION_LABEL) {
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
    const meta    = CATEGORY_META[catKey] || { label: catKey, icon: "📦" };
    const section = document.createElement("div");
    section.className = "result-category";
    section.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${meta.icon}</span>
        <h3>${meta.label}</h3>
      </div>
      <div class="category-items">${items.map((e) => productCardHTML(e, CONDITION_LABEL)).join("")}</div>
    `;
    container.appendChild(section);
  }
}

function productCardHTML({ prod, priority, reasons, withinBudget }, CONDITION_LABEL) {
  const PRIORITY_BADGE = {
    Essential:   '<span class="badge badge-essential">필수</span>',
    Recommended: '<span class="badge badge-recommended">추천</span>',
    Optional:    '<span class="badge badge-optional">선택</span>',
  };

  const reasonLabels = {
    essential:      "필수 품목",
    conditionMatch: "특이사항 일치",
    bodyMatch:      "체형 적합",
    "priority_upgraded:R-KNEE-OBESE": "비만+무릎통증 → 필수 격상",
    "priority_upgraded:R-BACK-HEAVY": "과체중+허리통증 → 필수 격상",
  };

  const conditionTags = (prod.indicatedForCondition || [])
    .filter((c) => reasons.includes("conditionMatch"))
    .map((c) => CONDITION_LABEL[c])
    .filter(Boolean)
    .map((l) => `<span class="condition-tag">${l}</span>`)
    .join("");

  const reasonHtml = [...new Set(reasons)]
    .map((r) => reasonLabels[r] ? `<span class="reason-tag">💡 ${reasonLabels[r]}</span>` : "")
    .join("");

  const tagsHtml = (prod.tags || []).map((t) => `<span class="tag">#${t}</span>`).join("");

  // 실제 이미지 (네이버 API 연동 시)
  const imageHtml = prod.image
    ? `<img class="product-img" src="${prod.image}" alt="${prod.productName}" loading="lazy" />`
    : "";

  // 구매 링크 (네이버 API 연동 시)
  const buyHtml = prod.link
    ? `<a href="${prod.link}" target="_blank" rel="noopener noreferrer" class="btn-buy">
         ${prod.mallName || "구매하기"} →
       </a>`
    : "";

  const brandHtml = prod.brand ? `<span class="product-brand">${prod.brand}</span>` : "";

  return `
    <div class="product-card ${withinBudget ? "" : "out-of-budget"}">
      ${imageHtml}
      <div class="product-body">
        <div class="product-header">
          <div>
            ${brandHtml}
            <span class="product-name">${prod.productName}</span>
          </div>
          <div class="product-badges">
            ${PRIORITY_BADGE[priority] || ""}
            ${withinBudget ? "" : '<span class="badge badge-over">예산초과</span>'}
          </div>
        </div>
        ${conditionTags ? `<div class="condition-tags">${conditionTags}</div>` : ""}
        ${reasonHtml    ? `<div class="reason-tags">${reasonHtml}</div>`       : ""}
        <p class="product-desc">${prod.description}</p>
        <div class="product-footer">
          <div class="tags">${tagsHtml}</div>
          <div class="product-price-wrap">
            <span class="product-price">
              ${prod.isRealProduct ? "최저 " : "약 "}${prod.price.toLocaleString()}원
            </span>
            ${buyHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}
