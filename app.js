/**
 * app.js — 군입대 준비물 체크리스트 MVP (정적 사이트 버전)
 *
 * 서버 없이 브라우저에서 직접 온톨로지 추론 실행.
 * ontology.js, reasoner.js 를 먼저 로드해야 함.
 */

const reasoner = new Reasoner(ONTOLOGY);
const STORAGE_KEY = "milchecklist:lastInput";

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
    budget:     parseFloat(document.getElementById("budget").value),
    conditions,
    situations: selectedSituations,
    season,
  };
}

function populateForm(input) {
  if (!input) return;
  if (Number.isFinite(input.height)) document.getElementById("height").value = input.height;
  if (Number.isFinite(input.weight)) document.getElementById("weight").value = input.weight;
  if (Number.isFinite(input.budget)) document.getElementById("budget").value = input.budget;

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

function runRecommendation(input) {
  const situations = (input.situations || []).slice();
  if (input.season && situations.indexOf(input.season) === -1) {
    situations.push(input.season);
  }

  const result = reasoner.reason({
    height:     input.height,
    weight:     input.weight,
    budget:     input.budget,
    conditions: input.conditions || [],
    situations: situations,
  });

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

  document.getElementById("formSection").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── 폼 제출 ───────────────────────────────────────────────
document.getElementById("userForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const input = collectUserInput();
  saveInput(input);
  runRecommendation(input);
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
  const shopLinkHtml = isPersonal
    ? ""
    : `<a class="shop-link" href="https://search.shopping.naver.com/search/all?query=${shopQuery}" target="_blank" rel="noopener noreferrer" title="네이버 쇼핑에서 검색">🛒 검색</a>`;

  const priorityClass = {
    Essential:   "priority-essential",
    Recommended: "priority-recommended",
    Optional:    "priority-optional",
  }[priority] || "priority-optional";

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
          </div>
          <div class="item-actions">
            ${isPersonal
              ? '<span class="badge badge-personal">개인 보유</span>'
              : `<span class="item-price">${prod.priceRange || `약 ${prod.price.toLocaleString()}원`}</span>`
            }
            ${shopLinkHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}
