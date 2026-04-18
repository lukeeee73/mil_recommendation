/**
 * app.js — 군입대 준비물 체크리스트 MVP (정적 사이트 버전)
 *
 * 흐름:
 *  1. 사용자가 필요 항목(신체/건강/상황)만 선택해 추천 리스트 생성
 *  2. 전체 추천 리스트의 예상 총 비용을 보여줌
 *  3. 가용 예산을 여러 번 입력 → 각 예산별 "시나리오" 저장
 *  4. 두 시나리오를 비교해 추가/제외된 품목을 확인
 *
 * ontology.js, reasoner.js 를 먼저 로드해야 함.
 */

const reasoner = new Reasoner(ONTOLOGY);
const STORAGE_KEY = "milchecklist:lastInput";

// ── 전역 상태 ─────────────────────────────────────────────
let baseItems = [];           // 예산 제약 없는 전체 추천 품목
let baseMeta  = null;         // { bmi, bodyCondition, totalCost }
let scenarios = [];           // [{ id, budget, affordable, overBudget, remaining, totalCost }]
let activeView = "all";       // "all" 또는 scenario.id
let nextScenarioId = 1;

// ── 뷰 전환 ───────────────────────────────────────────────
document.getElementById("backToForm").addEventListener("click", function () {
  document.getElementById("results").classList.add("hidden");
  document.getElementById("formSection").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ── 상태 직렬화 (공유/저장 공용) ───────────────────────────
function collectUserInput() {
  const conditions = Array.from(
    document.querySelectorAll('input[name="conditions"]:checked')
  ).map((el) => el.value);

  const selectedSituations = Array.from(
    document.querySelectorAll('input[name="situations"]:checked')
  ).map((el) => el.value);

  const seasonEl = document.querySelector('input[name="season"]:checked');
  const season = seasonEl ? seasonEl.value : null;

  return {
    height:     parseFloat(document.getElementById("height").value),
    weight:     parseFloat(document.getElementById("weight").value),
    conditions,
    situations: selectedSituations,
    season,
  };
}

function populateForm(input) {
  if (!input) return;
  if (Number.isFinite(input.height)) document.getElementById("height").value = input.height;
  if (Number.isFinite(input.weight)) document.getElementById("weight").value = input.weight;

  document.querySelectorAll('input[name="conditions"]').forEach(function (el) {
    el.checked = Array.isArray(input.conditions) && input.conditions.indexOf(el.value) !== -1;
  });
  document.querySelectorAll('input[name="situations"]').forEach(function (el) {
    el.checked = Array.isArray(input.situations) && input.situations.indexOf(el.value) !== -1;
  });
  if (input.season) {
    const seasonEl = document.querySelector('input[name="season"][value="' + input.season + '"]');
    if (seasonEl) seasonEl.checked = true;
  }
}

function saveInput(input) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(input)); } catch (_) {}
}

function loadSavedInput() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// Unicode-safe base64 (Korean 텍스트 대응)
function encodeState(input) {
  const json = JSON.stringify(input);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeState(s) {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch (_) { return null; }
}

// ── 추천 실행 ─────────────────────────────────────────────
function runRecommendation(input) {
  const situations = (input.situations || []).slice();
  if (input.season && situations.indexOf(input.season) === -1) {
    situations.push(input.season);
  }

  // 예산 제약 없이 모든 추천을 구함 (로컬 즉시 실행)
  const result = reasoner.reason({
    height:     input.height,
    weight:     input.weight,
    budget:     null,
    conditions: input.conditions || [],
    situations: situations,
  });

  baseItems = [...result.affordable, ...result.overBudget];
  baseMeta = {
    bmi:           result.bmi,
    bodyCondition: result.bodyCondition,
    totalCost:     baseItems.reduce((s, e) => s + (e.prod.price || 0), 0),
  };

  // 폼을 다시 제출하면 시나리오 초기화
  scenarios = [];
  nextScenarioId = 1;
  activeView = "all";

  renderProfile();
  renderScenariosPanel();
  renderActiveView();

  document.getElementById("formSection").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // 백그라운드에서 네이버 실시간 데이터로 보강
  fetchNaverEnrichment({
    height:     input.height,
    weight:     input.weight,
    conditions: input.conditions || [],
    situations: situations,
  });
}

// ── 네이버 실시간 데이터 보강 ────────────────────────────
function setNaverStatus(state) {
  const el = document.getElementById("naverStatus");
  if (!el) return;
  el.className = "naver-status";
  if (state === "loading") {
    el.textContent = "⏳ 네이버 실시간 가격 불러오는 중...";
    el.classList.add("naver-loading");
  } else if (state === "success") {
    el.textContent = "✓ 네이버 실시간 가격 반영됨";
    el.classList.add("naver-success");
    setTimeout(function () { el.classList.add("naver-fade"); }, 3000);
  } else {
    el.classList.add("hidden");
  }
}

function fetchNaverEnrichment(serverInput) {
  setNaverStatus("loading");

  fetch("/api/recommend", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(serverInput),
  })
    .then(function (res) {
      if (!res.ok) throw new Error("server " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data.source !== "naver") {
        // 서버는 응답했지만 Naver API 키가 없는 경우 → 폴백
        setNaverStatus("hidden");
        return;
      }

      const enrichedItems = [...(data.affordable || []), ...(data.overBudget || [])];
      if (enrichedItems.length === 0) return;

      // baseItems 를 Naver 데이터로 교체 (prod._id 기준 매핑)
      const byId = new Map(enrichedItems.map((e) => [e.prod._id, e.prod]));
      baseItems = baseItems.map(function (entry) {
        const naverProd = byId.get(entry.prod._id);
        return naverProd ? { ...entry, prod: naverProd } : entry;
      });

      baseMeta.totalCost = baseItems.reduce((s, e) => s + (e.prod.price || 0), 0);

      // 기존 시나리오도 새 가격으로 재계산
      scenarios = scenarios.map(function (s) {
        const r = reasoner.applyBudget(baseItems, s.budget);
        return { ...s, affordable: r.affordable, overBudget: r.overBudget,
                 remaining: r.remaining, totalCost: r.totalCost };
      });

      renderProfile();
      renderScenariosPanel();
      renderActiveView();
      setNaverStatus("success");
    })
    .catch(function () {
      setNaverStatus("hidden");
    });
}

// ── 폼 제출 ───────────────────────────────────────────────
document.getElementById("userForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const input = collectUserInput();
  saveInput(input);
  runRecommendation(input);
});

// ── 예산 시나리오 추가 ───────────────────────────────────
document.getElementById("budgetForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const input = document.getElementById("budgetInput");
  const budget = parseFloat(input.value);
  if (!Number.isFinite(budget) || budget <= 0) return;

  // 동일 예산 시나리오는 기존 것을 활성화만
  const dup = scenarios.find((s) => s.budget === budget);
  if (dup) {
    activeView = dup.id;
  } else {
    const r = reasoner.applyBudget(baseItems, budget);
    const scenario = {
      id: nextScenarioId++,
      budget,
      affordable: r.affordable,
      overBudget: r.overBudget,
      remaining:  r.remaining,
      totalCost:  r.totalCost,
    };
    scenarios.push(scenario);
    activeView = scenario.id;
  }

  input.value = "";
  renderScenariosPanel();
  renderActiveView();
});

// ── 공유하기 ──────────────────────────────────────────────
document.getElementById("shareLink").addEventListener("click", function () {
  const input = collectUserInput();
  const url = location.origin + location.pathname + "#s=" + encodeState(input);
  const feedback = document.getElementById("shareFeedback");

  const showFeedback = function (msg) {
    feedback.textContent = msg;
    feedback.classList.add("visible");
    setTimeout(function () { feedback.classList.remove("visible"); }, 2200);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(function () { showFeedback("링크 복사됨!"); })
      .catch(function () { window.prompt("아래 링크를 복사하세요:", url); });
  } else {
    window.prompt("아래 링크를 복사하세요:", url);
  }
});

// ── 초기 로드: URL 해시 → localStorage 순으로 복원 ────────
(function initFromStoredState() {
  const hash = location.hash || "";
  const match = hash.match(/[#&]s=([^&]+)/);
  if (match) {
    const fromHash = decodeState(match[1]);
    if (fromHash) {
      populateForm(fromHash);
      runRecommendation(fromHash);
      return;
    }
  }
  const saved = loadSavedInput();
  if (saved) populateForm(saved);
})();

// ── 렌더링: 프로필 ───────────────────────────────────────
function renderProfile() {
  const essentialCount = baseItems.filter((e) => e.priority === "Essential").length;
  const totalCount = baseItems.length;

  document.getElementById("profileSummary").innerHTML = `
    <div class="profile-badges">
      <div class="profile-badge">
        <span class="profile-badge-label">BMI</span>
        <span class="profile-badge-value">${baseMeta.bmi.toFixed(1)}</span>
        <span class="profile-badge-desc">${BODY_LABEL[baseMeta.bodyCondition] || "-"}</span>
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

// ── 렌더링: 시나리오 패널 ────────────────────────────────
function renderScenariosPanel() {
  document.getElementById("totalCostDisplay").textContent =
    baseMeta.totalCost.toLocaleString() + "원";
  renderTabs();
  renderCompareSection();
}

function renderTabs() {
  const container = document.getElementById("scenariosTabs");
  const tabs = [
    {
      key: "all",
      label: "전체 추천",
      sub: baseItems.length + "개 · " + baseMeta.totalCost.toLocaleString() + "원",
      removable: false,
    },
    ...scenarios.map((s) => ({
      key: s.id,
      label: s.budget.toLocaleString() + "원",
      sub: s.affordable.length + "개 포함 · 잔액 " + s.remaining.toLocaleString() + "원",
      removable: true,
    })),
  ];

  container.innerHTML = tabs.map((t) => `
    <button type="button" class="scenario-tab ${activeView === t.key ? "active" : ""}"
            data-key="${t.key}" role="tab">
      <span class="scenario-tab-label">${t.label}</span>
      <span class="scenario-tab-sub">${t.sub}</span>
      ${t.removable
        ? `<span class="scenario-remove" data-remove="${t.key}" role="button" aria-label="시나리오 삭제">×</span>`
        : ""}
    </button>
  `).join("");

  container.querySelectorAll(".scenario-tab").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      if (e.target.classList.contains("scenario-remove")) return;
      const key = btn.dataset.key;
      activeView = key === "all" ? "all" : parseInt(key, 10);
      renderTabs();
      renderActiveView();
    });
  });
  container.querySelectorAll(".scenario-remove").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      const id = parseInt(el.dataset.remove, 10);
      scenarios = scenarios.filter((s) => s.id !== id);
      if (activeView === id) activeView = "all";
      renderScenariosPanel();
      renderActiveView();
    });
  });
}

// ── 활성 뷰(전체 추천 또는 특정 시나리오) 렌더링 ──────────
function renderActiveView() {
  const infoEl = document.getElementById("activeScenarioInfo");

  if (activeView === "all") {
    infoEl.innerHTML = `
      <div class="active-view-label">
        <span class="view-dot view-dot-all"></span>
        예산 제약 없이 <strong>추천된 전체 ${baseItems.length}개 품목</strong>을 보고 있어요.
      </div>
    `;
    renderChecklist(baseItems);
    document.getElementById("budgetWarning").classList.add("hidden");
  } else {
    const s = scenarios.find((x) => x.id === activeView);
    if (!s) return;
    const pct = Math.min(Math.round((s.totalCost / s.budget) * 100), 100);
    infoEl.innerHTML = `
      <div class="active-view-label">
        <span class="view-dot view-dot-scenario"></span>
        예산 <strong>${s.budget.toLocaleString()}원</strong> 시나리오 · 포함 ${s.affordable.length}개 / 제외 ${s.overBudget.length}개
      </div>
      <div class="budget-bar-wrap">
        <div class="budget-bar">
          <div class="budget-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="budget-text">
          예산 <strong>${s.budget.toLocaleString()}원</strong> 중
          <strong>${s.totalCost.toLocaleString()}원</strong> 사용 &nbsp;|&nbsp;
          잔액 <strong>${s.remaining.toLocaleString()}원</strong>
        </span>
      </div>
    `;
    renderChecklist([...s.affordable, ...s.overBudget]);
    document.getElementById("budgetWarning").classList.toggle("hidden", s.overBudget.length === 0);
  }
}

// ── 렌더링: 비교 섹션 ────────────────────────────────────
function renderCompareSection() {
  const compareEl = document.getElementById("scenarioCompare");
  if (scenarios.length < 2) {
    compareEl.classList.add("hidden");
    return;
  }
  compareEl.classList.remove("hidden");

  const options = scenarios.map((s) =>
    `<option value="${s.id}">${s.budget.toLocaleString()}원 시나리오</option>`
  ).join("");

  const selA = document.getElementById("compareA");
  const selB = document.getElementById("compareB");
  const prevA = parseInt(selA.value, 10);
  const prevB = parseInt(selB.value, 10);

  selA.innerHTML = options;
  selB.innerHTML = options;

  const hasA = scenarios.some((s) => s.id === prevA);
  const hasB = scenarios.some((s) => s.id === prevB);
  selA.value = hasA ? prevA : scenarios[scenarios.length - 2].id;
  selB.value = hasB ? prevB : scenarios[scenarios.length - 1].id;

  selA.onchange = renderCompareResult;
  selB.onchange = renderCompareResult;
  renderCompareResult();
}

function renderCompareResult() {
  const idA = parseInt(document.getElementById("compareA").value, 10);
  const idB = parseInt(document.getElementById("compareB").value, 10);
  const a = scenarios.find((s) => s.id === idA);
  const b = scenarios.find((s) => s.id === idB);
  const container = document.getElementById("compareResult");
  if (!a || !b) { container.innerHTML = ""; return; }

  const aIds = new Set(a.affordable.map((e) => e.prod._id));
  const bIds = new Set(b.affordable.map((e) => e.prod._id));
  const onlyA = a.affordable.filter((e) => !bIds.has(e.prod._id));
  const onlyB = b.affordable.filter((e) => !aIds.has(e.prod._id));

  const renderList = (items) => {
    if (items.length === 0) return '<p class="compare-empty">변동 없음</p>';
    return '<ul class="compare-list">' + items.map((e) =>
      `<li>
        <span class="compare-item-name">${e.prod.productName}</span>
        <span class="compare-item-price">${(e.prod.price || 0).toLocaleString()}원</span>
      </li>`
    ).join("") + '</ul>';
  };

  const labelA = a.budget.toLocaleString() + "원";
  const labelB = b.budget.toLocaleString() + "원";

  container.innerHTML = `
    <div class="compare-grid">
      <div class="compare-column compare-only-a">
        <h5><span class="compare-badge removed">${labelA} 전용</span> <span class="compare-count">${onlyA.length}개</span></h5>
        <p class="compare-hint">${labelB} 기준으로는 <strong>제외</strong>되는 품목</p>
        ${renderList(onlyA)}
      </div>
      <div class="compare-column compare-only-b">
        <h5><span class="compare-badge added">${labelB} 전용</span> <span class="compare-count">${onlyB.length}개</span></h5>
        <p class="compare-hint">${labelA} 대비 <strong>추가</strong>되는 품목</p>
        ${renderList(onlyB)}
      </div>
    </div>
  `;
}

// ── 체크리스트 렌더링 ────────────────────────────────────
function renderChecklist(entries) {
  const CAT_META = CATEGORY_META;
  const COND_LBL = CONDITION_LABEL;
  const SIT_LBL  = SITUATION_LABEL;

  var container = document.getElementById("resultCards");
  container.innerHTML = "";

  // 카테고리별 그룹핑
  var groups = new Map();
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var catKey = entry.prod.type;
    if (!groups.has(catKey)) groups.set(catKey, []);
    groups.get(catKey).push(entry);
  }

  groups.forEach(function (items, catKey) {
    var meta = CAT_META[catKey] || { label: catKey, icon: "📦" };
    var section = document.createElement("div");
    section.className = "result-category";

    var essentialInCat = items.filter(function (e) { return e.priority === "Essential"; }).length;
    var recommendedInCat = items.filter(function (e) { return e.priority === "Recommended"; }).length;
    var catSubtotal = items.reduce(function (sum, e) { return sum + (e.prod.price || 0); }, 0);

    var summaryParts = [];
    if (essentialInCat > 0) summaryParts.push('<span class="cat-count essential-count">필수 ' + essentialInCat + '</span>');
    if (recommendedInCat > 0) summaryParts.push('<span class="cat-count recommended-count">추천 ' + recommendedInCat + '</span>');

    var itemNames = items.map(function (e) { return e.prod.productName; }).join(", ");

    var hasEssential = essentialInCat > 0;
    if (hasEssential) section.classList.add("expanded");

    section.innerHTML =
      '<div class="category-header" onclick="toggleCategory(this)">' +
        '<span class="category-icon">' + meta.icon + '</span>' +
        '<h3>' + meta.label + '</h3>' +
        summaryParts.join("") +
        '<span class="cat-count total-count">' + items.length + '개</span>' +
        '<span class="cat-subtotal">' + catSubtotal.toLocaleString() + '원</span>' +
        '<span class="category-chevron">▸</span>' +
      '</div>' +
      '<div class="category-preview' + (hasEssential ? ' collapsed' : '') + '">' +
        '<span class="preview-items">' + itemNames + '</span>' +
      '</div>' +
      '<div class="category-items' + (hasEssential ? '' : ' collapsed') + '">' +
        items.map(function (e) { return checklistItemHTML(e, COND_LBL, SIT_LBL); }).join("") +
      '</div>';
    container.appendChild(section);
  });

  syncToggleAllButton();
}

// ── 전체 펼치기/접기 ─────────────────────────────────────
function setAllCategoriesExpanded(expand) {
  var categories = document.querySelectorAll(".result-category");
  categories.forEach(function (section) {
    var items = section.querySelector(".category-items");
    var preview = section.querySelector(".category-preview");
    if (!items || !preview) return;
    if (expand) {
      items.classList.remove("collapsed");
      preview.classList.add("collapsed");
      section.classList.add("expanded");
    } else {
      items.classList.add("collapsed");
      preview.classList.remove("collapsed");
      section.classList.remove("expanded");
    }
  });
  syncToggleAllButton();
}

function syncToggleAllButton() {
  var btn = document.getElementById("toggleAll");
  if (!btn) return;
  var categories = document.querySelectorAll(".result-category");
  if (categories.length === 0) return;
  var allExpanded = Array.prototype.every.call(categories, function (s) {
    return s.classList.contains("expanded");
  });
  btn.dataset.expanded = allExpanded ? "true" : "false";
  btn.textContent = allExpanded ? "모두 접기" : "모두 펼치기";
}

(function bindToggleAll() {
  var btn = document.getElementById("toggleAll");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var shouldExpand = btn.dataset.expanded !== "true";
    setAllCategoriesExpanded(shouldExpand);
  });
})();

function toggleItemDone(el) {
  var item = el.closest(".checklist-item");
  if (!item) return;
  var isDone = item.classList.toggle("is-done");
  el.classList.toggle("is-checked", isDone);
  el.textContent = isDone ? "☑" : "☐";
}

function toggleCategory(header) {
  var section = header.parentElement;
  var items = section.querySelector(".category-items");
  var preview = section.querySelector(".category-preview");
  var isOpen = !items.classList.contains("collapsed");

  if (isOpen) {
    items.classList.add("collapsed");
    preview.classList.remove("collapsed");
    section.classList.remove("expanded");
  } else {
    items.classList.remove("collapsed");
    preview.classList.add("collapsed");
    section.classList.add("expanded");
  }
  syncToggleAllButton();
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

  const isPersonal = prod.priceRange === "개인 보유";
  const shopQuery = encodeURIComponent(prod.productName);

  // Naver 실시간 데이터가 있으면 직접 구매 링크, 없으면 검색 링크
  let shopLinkHtml = "";
  if (!isPersonal) {
    if (prod.isRealProduct && prod.link) {
      shopLinkHtml = `<a class="shop-link shop-link-buy" href="${prod.link}" target="_blank" rel="noopener noreferrer">🛒 바로 구매</a>`;
    } else {
      shopLinkHtml = `<a class="shop-link" href="https://search.shopping.naver.com/search/all?query=${shopQuery}" target="_blank" rel="noopener noreferrer" title="네이버 쇼핑에서 검색">🛒 검색</a>`;
    }
  }

  const thumbnailHtml = (prod.isRealProduct && prod.image)
    ? `<a href="${prod.link || '#'}" target="_blank" rel="noopener noreferrer" class="item-thumbnail-link">
         <img class="item-thumbnail" src="${prod.image}" alt="${prod.productName}" loading="lazy" />
       </a>`
    : "";

  const mallHtml = (prod.isRealProduct && prod.mallName)
    ? `<span class="mall-badge">${prod.mallName}</span>`
    : "";

  const priorityClass = {
    Essential:   "priority-essential",
    Recommended: "priority-recommended",
    Optional:    "priority-optional",
  }[priority] || "priority-optional";

  const priceDisplay = isPersonal
    ? '<span class="badge badge-personal">개인 보유</span>'
    : `<span class="item-price ${prod.isRealProduct ? "item-price-real" : ""}">${
        prod.isRealProduct
          ? prod.price.toLocaleString() + "원"
          : (prod.priceRange || `약 ${prod.price.toLocaleString()}원`)
      }</span>`;

  return `
    <div class="checklist-item ${priorityClass} ${withinBudget ? "" : "out-of-budget"}">
      <div class="item-main">
        <div class="item-header">
          <div class="item-name-wrap">
            <span class="item-checkbox" role="button" tabindex="0" aria-label="준비 완료 체크" onclick="toggleItemDone(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleItemDone(this);}">☐</span>
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
            ${mallHtml}
          </div>
          <div class="item-actions">
            ${thumbnailHtml}
            ${priceDisplay}
            ${shopLinkHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}
