// 추천 알고리즘

function getConditions() {
  return Array.from(document.querySelectorAll('input[name="conditions"]:checked'))
    .map((el) => el.value);
}

function scoreItem(item, { height, weight, footSize, conditions, bodyType }) {
  let score = 0;

  // 우선순위 기본 점수
  const priorityScore = { essential: 100, recommended: 60, optional: 20 };
  score += priorityScore[item.priority] || 0;

  // 특이사항 매칭 점수
  const matchedConditions = item.conditions.filter((c) => conditions.includes(c));
  score += matchedConditions.length * 50;

  // 발 사이즈 범위 체크 (해당 항목만)
  if (item.minFootSize && item.maxFootSize) {
    if (footSize < item.minFootSize || footSize > item.maxFootSize) score -= 200;
  }

  // 체형에 따른 보조 점수
  if (bodyType === "overweight" || bodyType === "obese") {
    if (["kneeIssue", "backIssue"].some((c) => item.conditions.includes(c))) {
      score += 20;
    }
  }

  return score;
}

// 카테고리별로 가장 적합한 제품 선택
function selectBestItems(conditions, userInfo) {
  const selected = [];

  for (const [categoryKey, category] of Object.entries(PRODUCTS)) {
    const scored = category.items
      .map((item) => ({ item, score: scoreItem(item, { ...userInfo, conditions }) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) continue;

    // essential 항목은 조건 무관 항상 포함 (score > 0)
    // 조건에 맞는 항목 중 상위 1~2개 선택
    const hasConditionMatch = scored.some(
      ({ item }) => item.conditions.some((c) => conditions.includes(c))
    );

    if (hasConditionMatch) {
      // 조건 매칭된 최우선 항목 선택
      selected.push({ category, item: scored[0].item, score: scored[0].score });
    } else {
      // 일반 essential / recommended 항목 중 1위만
      const top = scored[0];
      if (top.item.priority === "essential" || top.item.priority === "recommended") {
        selected.push({ category, item: top.item, score: top.score });
      }
    }
  }

  return selected;
}

// 예산 내에서 우선순위 정렬 및 필터
function applyBudget(selectedItems, budget) {
  // essential → recommended → optional 순서로 정렬
  const priorityOrder = { essential: 0, recommended: 1, optional: 2 };
  const sorted = [...selectedItems].sort((a, b) => {
    const pa = priorityOrder[a.item.priority] ?? 3;
    const pb = priorityOrder[b.item.priority] ?? 3;
    return pa !== pb ? pa - pb : b.score - a.score;
  });

  let remaining = budget;
  const affordable = [];
  const overBudget = [];

  for (const entry of sorted) {
    if (remaining >= entry.item.price) {
      remaining -= entry.item.price;
      affordable.push({ ...entry, withinBudget: true });
    } else {
      overBudget.push({ ...entry, withinBudget: false });
    }
  }

  return { affordable, overBudget, remaining };
}

// 추천 결과 렌더링
function renderResults({ affordable, overBudget, remaining, budget, conditions }) {
  const container = document.getElementById("resultCards");
  const budgetSummary = document.getElementById("budgetSummary");
  const budgetWarning = document.getElementById("budgetWarning");

  container.innerHTML = "";

  const totalCost = affordable.reduce((s, e) => s + e.item.price, 0);
  const percent = budget > 0 ? Math.round((totalCost / budget) * 100) : 0;

  budgetSummary.innerHTML = `
    <div class="budget-bar-wrap">
      <div class="budget-bar">
        <div class="budget-bar-fill" style="width: ${Math.min(percent, 100)}%"></div>
      </div>
      <span class="budget-text">
        예산 <strong>${budget.toLocaleString()}원</strong> 중
        <strong>${totalCost.toLocaleString()}원</strong> 사용
        (잔액 <strong>${remaining.toLocaleString()}원</strong>)
      </span>
    </div>
  `;

  if (overBudget.length > 0) {
    budgetWarning.classList.remove("hidden");
  } else {
    budgetWarning.classList.add("hidden");
  }

  // 카테고리 그룹 구성
  const allItems = [
    ...affordable,
    ...overBudget,
  ];

  // 카테고리별로 묶기
  const grouped = {};
  for (const entry of allItems) {
    const key = entry.category.category;
    if (!grouped[key]) grouped[key] = { category: entry.category, items: [] };
    grouped[key].items.push(entry);
  }

  for (const [, { category, items }] of Object.entries(grouped)) {
    const section = document.createElement("div");
    section.className = "result-category";

    const itemsHtml = items.map((entry) => {
      const { item, withinBudget } = entry;
      const priorityLabel = {
        essential: '<span class="badge badge-essential">필수</span>',
        recommended: '<span class="badge badge-recommended">추천</span>',
        optional: '<span class="badge badge-optional">선택</span>',
      }[item.priority] || "";

      const budgetClass = withinBudget ? "" : "out-of-budget";
      const budgetBadge = withinBudget
        ? ""
        : '<span class="badge badge-over">예산초과</span>';

      const conditionTags = item.conditions
        .filter((c) => conditions.includes(c))
        .map((c) => {
          const labels = {
            flatFoot: "평발",
            kneeIssue: "무릎통증",
            backIssue: "허리통증",
            loudSnorer: "코골이",
            lightSleeper: "예민한수면",
            dryEyes: "안구건조",
          };
          return `<span class="condition-tag">${labels[c] || c}</span>`;
        })
        .join("");

      const tagsHtml = item.tags.map((t) => `<span class="tag">#${t}</span>`).join("");

      return `
        <div class="product-card ${budgetClass}">
          <div class="product-header">
            <span class="product-name">${item.name}</span>
            <div class="product-badges">${priorityLabel}${budgetBadge}</div>
          </div>
          ${conditionTags ? `<div class="condition-tags">${conditionTags}</div>` : ""}
          <p class="product-desc">${item.description}</p>
          <div class="product-footer">
            <div class="tags">${tagsHtml}</div>
            <span class="product-price">약 ${item.price.toLocaleString()}원</span>
          </div>
        </div>
      `;
    }).join("");

    section.innerHTML = `
      <div class="category-header">
        <span class="category-icon">${category.icon}</span>
        <h3>${category.category}</h3>
      </div>
      <div class="category-items">${itemsHtml}</div>
    `;

    container.appendChild(section);
  }
}

// 폼 제출 처리
document.getElementById("userForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const height = parseFloat(document.getElementById("height").value);
  const weight = parseFloat(document.getElementById("weight").value);
  const budget = parseFloat(document.getElementById("budget").value);
  const footSize = parseFloat(document.getElementById("footSize").value);
  const conditions = getConditions();
  const bodyType = getBodyType(height, weight);

  const userInfo = { height, weight, footSize, bodyType };

  const selected = selectBestItems(conditions, userInfo);
  const { affordable, overBudget, remaining } = applyBudget(selected, budget);

  const resultsSection = document.getElementById("results");
  resultsSection.classList.remove("hidden");

  renderResults({ affordable, overBudget, remaining, budget, conditions });

  // 스크롤 이동
  resultsSection.scrollIntoView({ behavior: "smooth" });
});
