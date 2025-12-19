// =========================================
// MODERN REDESIGN - Main JavaScript
// =========================================

const DATA_URL = "data/posts_processed.json";
const INSIGHTS_URL = "data/insights.json";
const MANIFEST_URL = "files/manifest.json";
const THEME_KEY = "spa-theme-mode";

// Use the stable UMD build to avoid ESM/worker incompatibilities across browsers.
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const state = {
  allPosts: [],
  filtered: [],
  filesManifest: {},
  insights: null,
  currentModalPost: null,
  activeThreadPost: null,
  qaMessages: [],
  qaEngine: null,
  qaWebllm: null,
  qaGenerating: false,
  pdfLib: null,
  pdfLibLoading: null,
  pdfRenderToken: 0,
  // New state
  activeFilters: {
    homework: null,
    model: null,
    search: ""
  },
  currentView: "grid",
  currentSection: "home",
  availableTags: {
    homeworks: new Set(),
    models: new Set()
  },
  bookmarks: new Set(),
  shareUrl: null
};

const els = {};
let lastFocusedElement = null;

// =========================================
// ELEMENT CACHING
// =========================================
function cacheElements() {
  // Navigation
  els.navLinks = document.querySelectorAll(".nav-link");
  els.sections = document.querySelectorAll(".section");
  
  // Hero/Search
  els.heroSearchInput = document.getElementById("hero-search-input");
  els.searchClear = document.getElementById("search-clear");
  
  // Stats
  els.statTotal = document.getElementById("stat-total");
  els.statModels = document.getElementById("stat-models");
  els.statHomeworks = document.getElementById("stat-homeworks");
  els.statAuthors = document.getElementById("stat-authors");
  
  // Browse
  els.filterHomework = document.getElementById("filter-homework");
  els.filterModel = document.getElementById("filter-model");
  els.filterTags = document.getElementById("filter-tags");
  els.viewButtons = document.querySelectorAll(".view-btn");
  els.sortSelect = document.getElementById("sort-select");
  els.resultsSummary = document.getElementById("results-summary");
  els.resultsCount = document.getElementById("results-count");
  els.resultsFilters = document.getElementById("results-filters");
  els.resultsClearSearch = document.getElementById("results-clear-search");
  els.postsGrid = document.getElementById("posts-grid");
  els.emptyState = document.getElementById("empty-state");
  
  // Modal
  els.postModalBackdrop = document.getElementById("post-modal-backdrop");
  els.postModal = document.getElementById("post-modal");
  els.postModalTitle = document.getElementById("post-modal-title");
  els.postModalMeta = document.getElementById("post-modal-meta");
  els.postModalBadges = document.getElementById("post-modal-badges");
  els.postModalBody = document.getElementById("post-modal-body");
  els.postModalFiles = document.getElementById("post-modal-files");
  els.postModalClose = document.getElementById("post-modal-close");
  
  // QA
  els.qaForm = document.getElementById("qa-form");
  els.qaInput = document.getElementById("qa-input");
  els.qaSend = document.getElementById("qa-send");
  els.qaMessages = document.getElementById("qa-messages");
  els.qaStatus = document.getElementById("qa-status");
  
  // Homework & Similar Posts
  els.homeworkLinkContainer = document.getElementById("homework-link-container");
  els.homeworkPreviewContainer = document.getElementById("homework-preview-container");
  els.similarPostsContainer = document.getElementById("similar-posts-container");
  
  // Comparison
  els.compareHomework = document.getElementById("compare-homework");
  els.compareModelA = document.getElementById("compare-model-a");
  els.compareModelB = document.getElementById("compare-model-b");
  els.compareHomeworkTitle = document.getElementById("compare-homework-title");
  els.compareResults = document.getElementById("compare-results");
  els.comparePostsGrid = document.getElementById("compare-posts-grid");
  els.compareEmpty = document.getElementById("compare-empty");
  
  // Export & Share
  els.exportBtn = document.getElementById("export-btn");
  els.shareBtn = document.getElementById("share-btn");
  els.bookmarkToggle = document.getElementById("bookmark-toggle");
  
  // Analytics
  els.homeworkChart = document.getElementById("homework-chart");
  els.modelChart = document.getElementById("model-chart");
  els.timelineChart = document.getElementById("timeline-chart");
  els.contributorsList = document.getElementById("contributors-list");
  els.keywordsCloud = document.getElementById("keywords-cloud");
  
  // Assistant (new section)
  els.assistantStatus = document.getElementById("assistant-status");
  els.assistantMessages = document.getElementById("assistant-messages");
  els.assistantForm = document.getElementById("assistant-form");
  els.assistantInput = document.getElementById("assistant-input");
  els.assistantSend = document.getElementById("assistant-send");
  els.assistantLoading = document.getElementById("assistant-loading");
  els.assistantLoadingText = document.getElementById("assistant-loading-text");
  els.assistantProgressFill = document.getElementById("assistant-progress-fill");
  els.assistantClear = document.getElementById("assistant-clear");
  els.backToTop = document.getElementById("back-to-top");
  
  // Theme
  els.appearanceButtons = document.querySelectorAll(".appearance-btn");
}

// =========================================
// DATA LOADING
// =========================================
async function loadData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${DATA_URL} (status ${res.status}). Did you run process_data.py?`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("Expected an array of posts in posts_processed.json");
  }
  return json;
}

async function loadFilesManifest() {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    console.warn("Could not load files manifest:", err);
    return {};
  }
}

async function loadInsights() {
  try {
    const res = await fetch(INSIGHTS_URL, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Could not load insights:", err);
    return null;
  }
}

// =========================================
// NAVIGATION
// =========================================
function setupNavigation() {
  els.navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      switchSection(section);
    });
  });
  
  // Handle hash changes
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.slice(1) || "home";
    switchSection(hash);
  });
  
  // Initial section from hash
  const hash = window.location.hash.slice(1) || "home";
  switchSection(hash);
}

function switchSection(sectionName) {
  // AI Assistant is temporarily disabled in the UI.
  if (sectionName === "assistant") {
    sectionName = "home";
  }

  state.currentSection = sectionName;
  
  // Update nav links
  els.navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.section === sectionName);
  });
  
  // Show/hide sections
  els.sections.forEach(section => {
    const isActive = section.id === sectionName;
    section.classList.toggle("active", isActive);
  });
  
  // Update URL
  window.history.replaceState(null, "", `#${sectionName}`);
  
  // If switching to browse, ensure posts are rendered
  if (sectionName === "browse" && state.allPosts.length > 0) {
    applyFiltersAndRender();
  }
  
    // If switching to analytics, render charts
    if (sectionName === "analytics" && state.allPosts.length > 0) {
      renderAnalytics();
    }
    
    // If switching to compare, populate dropdowns
    if (sectionName === "compare" && state.allPosts.length > 0) {
      populateComparisonDropdowns();
    }
    
    // If switching to assistant, initialize if needed
    if (sectionName === "assistant") {
      initAssistantEngine();
    }
}

// =========================================
// STATISTICS DASHBOARD
// =========================================
function updateStatistics() {
  const posts = state.allPosts;
  const homeworks = new Set();
  const homeworksKnown = new Set();
  const models = new Set();
  const authors = new Set();

  posts.forEach(post => {
    const m = post.metrics || {};
    if (m.homework_id) {
      const hw = String(m.homework_id).trim();
      homeworks.add(hw);
      if (hw.toLowerCase() !== "unknown") {
        homeworksKnown.add(hw);
      }
    }
    if (m.model_name) models.add(m.model_name);
    if (post.user?.name) authors.add(post.user.name);
  });
  
  if (els.statTotal) els.statTotal.textContent = posts.length.toLocaleString();
  if (els.statModels) els.statModels.textContent = models.size;
  if (els.statHomeworks) els.statHomeworks.textContent = homeworksKnown.size;
  if (els.statAuthors) els.statAuthors.textContent = authors.size;
  
  // Store for tag generation
  state.availableTags.homeworks = homeworks;
  state.availableTags.models = models;
}

// =========================================
// DROPDOWN FILTERS
// =========================================
function setupFilterDropdowns() {
  if (!els.filterHomework || !els.filterModel) return;
  
  // Populate homework dropdown
  const sortedHomeworks = Array.from(state.availableTags.homeworks).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });
  
  els.filterHomework.innerHTML = '<option value="">All Homeworks</option>' + 
    sortedHomeworks.map(hw => 
      `<option value="${escapeAttribute(hw)}" ${state.activeFilters.homework === hw ? 'selected' : ''}>${escapeHtml(hw)}</option>`
    ).join("");
  
  // Populate model dropdown
  const sortedModels = Array.from(state.availableTags.models).sort();
  els.filterModel.innerHTML = '<option value="">All LLMs</option>' + 
    sortedModels.map(model => 
      `<option value="${escapeAttribute(model)}" ${state.activeFilters.model === model ? 'selected' : ''}>${escapeHtml(model)}</option>`
    ).join("");
  
  // Add change handlers
  els.filterHomework.addEventListener("change", (e) => {
    state.activeFilters.homework = e.target.value || null;
    applyFiltersAndRender();
  });
  
  els.filterModel.addEventListener("change", (e) => {
    state.activeFilters.model = e.target.value || null;
    applyFiltersAndRender();
  });
}

// =========================================
// TAG-BASED FILTERING
// =========================================
function buildFilterTags() {
  if (!els.filterTags) return;

  const renderTagButton = (tag) => `
    <button class="filter-tag ${tag.active ? 'active' : ''}"
            data-type="${tag.type}"
            data-value="${escapeAttribute(tag.value)}">
      ${escapeHtml(tag.label)}
    </button>
  `;

  // Homework tags
  const sortedHomeworks = Array.from(state.availableTags.homeworks).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const homeworkTagsHtml = sortedHomeworks.map(hw => renderTagButton({
    type: "homework",
    value: hw,
    label: hw,
    active: state.activeFilters.homework === hw
  })).join("");

  // Model tags
  const sortedModels = Array.from(state.availableTags.models).sort();
  const modelTagsHtml = sortedModels.map(model => renderTagButton({
    type: "model",
    value: model,
    label: model,
    active: state.activeFilters.model === model
  })).join("");

  // Render as two independent wrapping rows so they never mix
  els.filterTags.innerHTML = `
    <div class="filter-tags-group" data-group="homework">${homeworkTagsHtml}</div>
    <div class="filter-tags-group" data-group="model">${modelTagsHtml}</div>
  `;
  
  // Add click handlers
  els.filterTags.querySelectorAll(".filter-tag").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const value = btn.dataset.value;
      
      if (type === "homework") {
        state.activeFilters.homework = state.activeFilters.homework === value ? null : value;
      } else if (type === "model") {
        state.activeFilters.model = state.activeFilters.model === value ? null : value;
      }
      
      // Sync dropdowns
      if (els.filterHomework) els.filterHomework.value = state.activeFilters.homework || "";
      if (els.filterModel) els.filterModel.value = state.activeFilters.model || "";
      
      applyFiltersAndRender();
      });
    });
  }

// =========================================
// SEARCH FUNCTIONALITY
// =========================================
function setupSearch() {
  if (!els.heroSearchInput) return;

  const syncSearchClearVisibility = () => {
    const hasSearch = !!state.activeFilters.search;
    if (els.searchClear) els.searchClear.hidden = !hasSearch;
    if (els.resultsClearSearch) els.resultsClearSearch.hidden = !hasSearch;
  };

  const clearSearch = () => {
    state.activeFilters.search = "";
    if (els.heroSearchInput) els.heroSearchInput.value = "";
    syncSearchClearVisibility();
  };
  
  let searchTimeout;
  els.heroSearchInput.addEventListener("input", (e) => {
    const nextSearch = e.target.value.toLowerCase().trim();
    state.activeFilters.search = nextSearch;
    syncSearchClearVisibility();

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (state.currentSection === "browse") {
        applyFiltersAndRender();
      }
    }, 300);
  });

  els.heroSearchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    state.activeFilters.search = els.heroSearchInput.value.toLowerCase().trim();
    if (els.searchClear) {
      els.searchClear.hidden = !state.activeFilters.search;
    }
    switchSection("browse");
  });
  
  if (els.searchClear) {
    els.searchClear.addEventListener("click", () => {
      clearSearch();
      if (state.currentSection === "browse") {
        applyFiltersAndRender();
      }
    });
  }

  if (els.resultsClearSearch) {
    els.resultsClearSearch.addEventListener("click", () => {
      clearSearch();
      if (state.currentSection === "browse") {
        applyFiltersAndRender();
      }
    });
  }
}

// =========================================
// VIEW MODES
// =========================================
function setupViewModes() {
  els.viewButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      els.viewButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      state.currentView = btn.dataset.view;
      if (els.postsGrid) {
        els.postsGrid.setAttribute("data-view", state.currentView);
      }
      applyFiltersAndRender();
    });
  });
}

// =========================================
// FILTERING & RENDERING
// =========================================
function applyFiltersAndRender() {
  let results = [...state.allPosts];
  
  // Apply filters
  results = results.filter(post => {
  const m = post.metrics || {};
    
    // Homework filter
    if (state.activeFilters.homework && m.homework_id !== state.activeFilters.homework) {
      return false;
    }
    
    // Model filter
    if (state.activeFilters.model && m.model_name !== state.activeFilters.model) {
      return false;
    }
    
    // Search filter
    if (state.activeFilters.search) {
      const searchText = state.activeFilters.search;
      const haystack = `${post.title || ""}\n${post.document || ""}\n${post.user?.name || ""}\n${m.model_name || ""}`.toLowerCase();
      if (!haystack.includes(searchText)) {
        return false;
      }
    }
    
    return true;
  });

  // Sort results
  results = sortResults(results, els.sortSelect?.value || "newest");
  
  state.filtered = results;
  renderPosts();
  updateResultsSummary();
  buildFilterTags();
  setupFilterDropdowns();
}

function sortResults(list, order) {
  const arr = [...list];
  
  if (order === "homework") {
    arr.sort((a, b) => {
      const hwA = a.metrics?.homework_id || "";
      const hwB = b.metrics?.homework_id || "";
      const numA = parseInt(hwA.replace(/\D/g, '')) || 0;
      const numB = parseInt(hwB.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  } else if (order === "model") {
    arr.sort((a, b) => {
      const modelA = a.metrics?.model_name || "";
      const modelB = b.metrics?.model_name || "";
      return modelA.localeCompare(modelB);
    });
  } else if (order === "oldest") {
    arr.sort((a, b) => {
      const da = postDate(a);
      const db = postDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  } else {
    // newest (default)
    arr.sort((a, b) => {
      const da = postDate(a);
      const db = postDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
  }
  
  return arr;
}

function postDate(post) {
  if (!post.created_at) return null;
  const d = new Date(post.created_at);
  return isNaN(d.getTime()) ? null : d;
}

function updateResultsSummary() {
  if (!els.resultsCount) return;
  
  const count = state.filtered.length;
  els.resultsCount.textContent = `${count} ${count === 1 ? 'post' : 'posts'}`;
  
  if (els.resultsFilters) {
    const activeFilters = [];
    if (state.activeFilters.homework) activeFilters.push(state.activeFilters.homework);
    if (state.activeFilters.model) activeFilters.push(state.activeFilters.model);
    if (state.activeFilters.search) activeFilters.push(`"${state.activeFilters.search}"`);
    
    els.resultsFilters.textContent = activeFilters.length > 0 
      ? activeFilters.join(", ")
      : "All posts";

    if (els.resultsClearSearch) {
      els.resultsClearSearch.hidden = !state.activeFilters.search;
    }
  }
}

// =========================================
// POST RENDERING
// =========================================
function renderPosts() {
  if (!els.postsGrid) return;
  
  if (state.filtered.length === 0) {
    els.postsGrid.innerHTML = "";
    if (els.emptyState) els.emptyState.hidden = false;
    return;
  }
  
  if (els.emptyState) els.emptyState.hidden = true;
  
  const postsHtml = state.filtered.map((post, index) => renderPostCard(post, index)).join("");
  els.postsGrid.innerHTML = postsHtml;

  wirePostCardInteractions(els.postsGrid, state.filtered);
}

function wirePostCardInteractions(containerEl, postsRef) {
  if (!containerEl) return;

  // Add click handlers
  containerEl.querySelectorAll(".post-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("a") || e.target.closest("button")) return;
      const index = parseInt(card.dataset.index);
      if (!isNaN(index) && postsRef[index]) {
        openPostModal(postsRef[index]);
      }
    });
  });

  // Add bookmark handlers
  containerEl.querySelectorAll(".post-bookmark-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const postId = btn.dataset.postId;
      toggleBookmark(postId);
      renderPosts();
    });
  });

  // Add copy link handlers
  containerEl.querySelectorAll(".post-copy-link-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const postId = btn.dataset.postId;
      const post = state.allPosts.find(p => String(p.number || p.id) === String(postId));
      if (post) {
        await copyPostLink(post);
      }
    });
  });
}

function calculateReadingTime(text) {
  if (!text) return 0;
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  return minutes;
}

function renderPostCard(post, index) {
  const m = post.metrics || {};
  const hw = m.homework_id || "Unknown";
  const model = m.model_name || "Unknown";
  const createdStr = formatCardDate(post.created_at);
  const author = post.user?.name || "Unknown";
  const preview = (post.document || "").substring(0, 150).replace(/\n/g, " ");
  const readingTime = calculateReadingTime(post.document || "");
  const postId = post.number || post.id || index;
  const isBookmarked = (state.bookmarks instanceof Set) && state.bookmarks.has(String(postId));

  const metaItems = [];
  if (createdStr) metaItems.push({ text: createdStr, className: "post-card-meta-item" });
  if (author) metaItems.push({ text: author, className: "post-card-meta-item post-card-meta-author" });
  const metaHtml = metaItems
    .map(i => `<span class="${i.className}">${escapeHtml(i.text)}</span>`)
    .join('<span class="post-card-meta-sep">•</span>');

  const footerLeftParts = [];
  if (typeof post.view_count === "number") footerLeftParts.push(`${post.view_count} views`);
  if (readingTime > 0) footerLeftParts.push(`${readingTime} min read`);
  const footerLeft = footerLeftParts.join(" • ");
  
  return `
<article class="post-card" data-index="${index}" data-post-id="${postId}">
      <div class="post-card-header">
        <div class="post-card-actions">
          <button class="post-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-post-id="${postId}" onclick="event.stopPropagation()" title="${isBookmarked ? 'Remove bookmark' : 'Add bookmark'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          <button class="post-copy-link-btn" data-post-id="${postId}" onclick="event.stopPropagation()" title="Copy post link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
    </div>
        <h3 class="post-card-title">${escapeHtml(post.title || "Untitled")}</h3>
        ${metaHtml ? `<div class="post-card-meta">${metaHtml}</div>` : ''}
  </div>
      <div class="post-card-badges">
        <span class="badge badge-hw">${escapeHtml(hw)}</span>
        <span class="badge badge-model">${escapeHtml(model)}</span>
      </div>
      <p class="post-card-preview">${escapeHtml(preview)}${preview.length >= 150 ? "..." : ""}</p>
      <div class="post-card-footer">
        ${footerLeft ? `<span>${escapeHtml(footerLeft)}</span>` : "<span></span>"}
        ${post.ed_url ? `<a href="${escapeAttribute(post.ed_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View on Ed →</a>` : ""}
      </div>
    </article>
  `;
}

function formatCardDate(isoString) {
  if (!isoString || typeof isoString !== "string") return "";

  // Prefer the YYYY-MM-DD portion to avoid user-timezone shifting dates.
  const datePart = isoString.split("T")[0];
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;

  let dateObj = null;
  if (dateOnly) {
    dateObj = new Date(`${dateOnly}T00:00:00Z`);
  } else {
    dateObj = new Date(isoString);
  }

  if (isNaN(dateObj.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(dateObj);
}

// =========================================
// MODAL
// =========================================
function clearHomeworkPreview() {
  if (!els.homeworkPreviewContainer) return;
  state.pdfRenderToken += 1;
  els.homeworkPreviewContainer.hidden = true;
  els.homeworkPreviewContainer.innerHTML = "";
}

async function ensurePdfJsLoaded() {
  if (state.pdfLib) return state.pdfLib;
  if (state.pdfLibLoading) return state.pdfLibLoading;

  state.pdfLibLoading = (async () => {
    const existing = globalThis.pdfjsLib;
    if (existing?.getDocument) {
      existing.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      state.pdfLib = existing;
      return existing;
    }

    await new Promise((resolve, reject) => {
      const prior = document.querySelector(`script[data-pdfjs-src="${CSS.escape(PDFJS_CDN)}"]`);
      if (prior) {
        prior.addEventListener("load", () => resolve(), { once: true });
        prior.addEventListener("error", () => reject(new Error("Failed to load pdf.js script")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = PDFJS_CDN;
      script.async = true;
      script.defer = true;
      script.dataset.pdfjsSrc = PDFJS_CDN;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load pdf.js script"));
      document.head.appendChild(script);
    });

    const pdfjs = globalThis.pdfjsLib;
    if (!pdfjs?.getDocument) {
      throw new Error("Failed to load pdf.js (window.pdfjsLib missing)");
    }
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    state.pdfLib = pdfjs;
    return pdfjs;
  })();

  try {
    return await state.pdfLibLoading;
  } finally {
    state.pdfLibLoading = null;
  }
}

function renderPdfPreviewShell(hw, pdfUrl) {
  if (!els.homeworkPreviewContainer) return;
  els.homeworkPreviewContainer.hidden = false;
  els.homeworkPreviewContainer.innerHTML = `
    <div class="homework-preview-header">
      <span>Preview: ${escapeHtml(hw)}</span>
      <button type="button" class="homework-preview-close" aria-label="Close preview">×</button>
    </div>
    <div class="homework-preview-body">
      <div class="homework-preview-status" role="status" aria-live="polite">Loading PDF…</div>
      <div class="homework-preview-pages" data-pdf-url="${escapeAttribute(pdfUrl)}"></div>
    </div>
  `;

  const closeBtn = els.homeworkPreviewContainer.querySelector(".homework-preview-close");
  if (closeBtn) closeBtn.addEventListener("click", () => clearHomeworkPreview());
}

async function renderPdfIntoContainer(pdfUrl, renderToken) {
  if (!els.homeworkPreviewContainer) return;

  const statusEl = els.homeworkPreviewContainer.querySelector(".homework-preview-status");
  const pagesEl = els.homeworkPreviewContainer.querySelector(".homework-preview-pages");
  if (!pagesEl) return;

  // Safety checks for stale/closed renders
  const isStale = () => (
    renderToken !== state.pdfRenderToken ||
    els.homeworkPreviewContainer.hidden ||
    pagesEl.dataset.pdfUrl !== pdfUrl
  );

  try {
    const pdfjs = await ensurePdfJsLoaded();
    if (isStale()) return;

    const loadingTask = pdfjs.getDocument({ url: pdfUrl });
    const pdf = await loadingTask.promise;
    if (isStale()) return;

    // Clear any existing pages
    pagesEl.innerHTML = "";

    const containerWidth = Math.max(320, pagesEl.clientWidth || 800);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      if (isStale()) return;
      if (statusEl) statusEl.textContent = `Rendering page ${pageNum} / ${pdf.numPages}…`;

      const page = await pdf.getPage(pageNum);
      if (isStale()) return;

      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(2, (containerWidth - 24) / unscaled.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.className = "pdfjs-page";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      pagesEl.appendChild(canvas);
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    if (statusEl) statusEl.remove();
  } catch (err) {
    if (isStale()) return;
    const message = (err && typeof err.message === "string") ? err.message : String(err);
    if (statusEl) {
      statusEl.innerHTML = `
        <div>Could not embed this PDF in-page.</div>
        <div class="homework-preview-fallback">
          <a href="${escapeAttribute(pdfUrl)}" target="_blank" rel="noopener">Open PDF in a new tab →</a>
        </div>
        <div class="homework-preview-error">${escapeHtml(message)}</div>
      `;
    }
  }
}

function openPostModal(post) {
  if (!els.postModalBackdrop) return;

  lastFocusedElement = document.activeElement;
  state.currentModalPost = post;
  state.qaMessages = [];
  if (els.qaMessages) els.qaMessages.innerHTML = "";

  const m = post.metrics || {};
  const hw = m.homework_id || "Unknown";
  const model = m.model_name || "Unknown";
  const created = post.created_at ? new Date(post.created_at) : null;
  const createdStr = created && !isNaN(created.getTime()) 
    ? created.toLocaleString()
    : "";
  const author = post.user?.name || "Unknown";
  
  if (els.postModalTitle) els.postModalTitle.textContent = post.title || "Untitled";
  
  if (els.postModalMeta) {
    els.postModalMeta.innerHTML = `
      <span>${escapeHtml(createdStr)}</span>
      <span>•</span>
      <span>by ${escapeHtml(author)}</span>
      ${post.ed_url ? `<span>•</span><a href="${escapeAttribute(post.ed_url)}" target="_blank">View on Ed</a>` : ""}
    `;
  }

  if (els.postModalBadges) {
    els.postModalBadges.innerHTML = `
      <span class="badge badge-hw">${escapeHtml(hw)}</span>
      <span class="badge badge-model">${escapeHtml(model)}</span>
    `;
  }
  
  const files = getFilesForPost(post);
  if (els.postModalFiles && files && files.length > 0) {
    els.postModalFiles.innerHTML = files.map(f => 
      `<a href="${escapeAttribute(f.saved_as)}" target="_blank">📎 ${escapeHtml(f.original_filename)}</a>`
    ).join(" • ");
  }

  // Reset any previous PDF preview when opening a post
  clearHomeworkPreview();
  
  // Add homework link and preview
  renderHomeworkLink(post);
  
  // Add similar posts
  renderSimilarPosts(post);
  
  let bodyText = post.document || "(no body text available)";
  if (els.postModalBody) {
    els.postModalBody.innerHTML = formatBodyWithLinks(bodyText, files);
  }
  
  els.postModalBackdrop.hidden = false;
  els.postModalBackdrop.removeAttribute("hidden");
  document.body.classList.add("modal-open");
  if (els.postModalClose) els.postModalClose.focus();
}

function getHomeworkPDFUrl(homeworkId) {
  if (!homeworkId || homeworkId === "Unknown") return null;
  
  // Extract number from homework_id (e.g., "HW0", "hw0", "Homework 0" -> "0")
  const match = homeworkId.match(/\d+/);
  if (!match) return null;
  
  const hwNum = match[0];
  return `https://berkeley-cs182.github.io/fa25/assets/assignments/hw${hwNum}.pdf`;
}

function renderHomeworkLink(post) {
  if (!els.homeworkLinkContainer) return;

  // Ensure stale previews from previous posts are cleared
  clearHomeworkPreview();
  
  const hw = post.metrics?.homework_id || "Unknown";
  const pdfUrl = getHomeworkPDFUrl(hw);
  
  if (pdfUrl) {
    els.homeworkLinkContainer.innerHTML = `
      <div class="homework-link-item">
        <a href="${escapeAttribute(pdfUrl)}" target="_blank" class="homework-link">
          📄 ${escapeHtml(hw)} Assignment PDF
        </a>
        <button type="button" class="homework-preview-toggle" data-pdf-url="${escapeAttribute(pdfUrl)}">
          👁️ Preview PDF
        </button>
      </div>
    `;
    
    // Add preview toggle handler
    const toggleBtn = els.homeworkLinkContainer.querySelector(".homework-preview-toggle");
    if (toggleBtn && els.homeworkPreviewContainer) {
      toggleBtn.addEventListener("click", async () => {
        const isHidden = els.homeworkPreviewContainer.hidden;

        // If currently hidden, show + render. Otherwise hide + clear.
        if (isHidden) {
          // Render via pdf.js so Safari/blocked embeds don't download.
          const renderToken = state.pdfRenderToken + 1;
          state.pdfRenderToken = renderToken;
          renderPdfPreviewShell(hw, pdfUrl);
          await renderPdfIntoContainer(pdfUrl, renderToken);
        } else {
          clearHomeworkPreview();
        }
      });
    }
  } else {
    els.homeworkLinkContainer.innerHTML = `<p class="no-homework-link">No homework PDF available for ${escapeHtml(hw)}</p>`;
  }
}

function renderSimilarPosts(post) {
  if (!els.similarPostsContainer) return;
  
  const hw = post.metrics?.homework_id;
  const model = post.metrics?.model_name;
  const currentPostId = post.number;
  
  // Find similar posts (same homework or same model, excluding current post)
  const similar = state.allPosts
    .filter(p => {
      if (p.number === currentPostId) return false;
      const pHw = p.metrics?.homework_id;
      const pModel = p.metrics?.model_name;
      return (hw && pHw === hw) || (model && pModel === model);
    })
    .slice(0, 6); // Limit to 6 similar posts
  
  if (similar.length === 0) {
    els.similarPostsContainer.innerHTML = `<p class="no-similar-posts">No similar posts found</p>`;
    return;
  }
  
  els.similarPostsContainer.innerHTML = similar.map(p => {
    const pHw = p.metrics?.homework_id || "Unknown";
    const pModel = p.metrics?.model_name || "Unknown";
    const preview = (p.document || "").substring(0, 100).replace(/\n/g, " ");
    
    return `
      <div class="similar-post-card" data-post-index="${state.allPosts.indexOf(p)}">
        <div class="similar-post-header">
          <h5>${escapeHtml(p.title || "Untitled")}</h5>
          <div class="similar-post-badges">
            <span class="badge badge-hw">${escapeHtml(pHw)}</span>
            <span class="badge badge-model">${escapeHtml(pModel)}</span>
        </div>
        </div>
        <p class="similar-post-preview">${escapeHtml(preview)}${preview.length >= 100 ? "..." : ""}</p>
        <button class="similar-post-view-btn">View Post</button>
      </div>
    `;
  }).join("");
  
  // Add click handlers
  els.similarPostsContainer.querySelectorAll(".similar-post-card, .similar-post-view-btn").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = el.closest(".similar-post-card");
      if (card) {
        const index = parseInt(card.dataset.postIndex);
        if (!isNaN(index) && state.allPosts[index]) {
          openPostModal(state.allPosts[index]);
        }
      }
    });
  });
}

function closePostModal() {
  if (!els.postModalBackdrop) return;
  clearHomeworkPreview();
  els.postModalBackdrop.hidden = true;
  els.postModalBackdrop.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
  state.currentModalPost = null;
  state.qaMessages = [];
  if (els.qaMessages) els.qaMessages.innerHTML = "";
  if (els.qaStatus) els.qaStatus.textContent = "";

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    try { lastFocusedElement.focus(); } catch {}
  }
}

function getFilesForPost(post) {
  const threadNum = String(post.number);
  const entry = state.filesManifest[threadNum];
  if (!entry || !entry.files || !entry.files.length) return null;
  return entry.files;
}

function formatBodyWithLinks(bodyText, files) {
  let formatted = escapeHtml(bodyText);
  
  if (files && files.length > 0) {
    formatted = formatted.replace(/\[📎 ([^\]]+)\]/g, (match, filename) => {
      const file = files.find(f => f.original_filename === filename.trim());
      if (file) {
        return `<a href="${escapeAttribute(file.saved_as)}" target="_blank" rel="noopener">📎 ${escapeHtml(filename)}</a>`;
      }
      return match;
    });
  }
  
  formatted = formatted.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    return `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
  });
  
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

// =========================================
// ANALYTICS & VISUALIZATIONS
// =========================================
function setupAnalytics() {
  // Analytics will be rendered when data loads
}

function renderAnalytics() {
  if (state.allPosts.length === 0) return;
  
  renderHomeworkChart();
  renderModelChart();
  renderTimelineChart();
  renderContributors();
  renderKeywords();
}

function renderHomeworkChart() {
  if (!els.homeworkChart) return;
  
  const hwCounts = {};
  state.allPosts.forEach(post => {
    const hw = post.metrics?.homework_id || "Unknown";
    hwCounts[hw] = (hwCounts[hw] || 0) + 1;
  });
  
  const sorted = Object.entries(hwCounts).sort((a, b) => {
    const numA = parseInt(a[0].replace(/\D/g, '')) || 0;
    const numB = parseInt(b[0].replace(/\D/g, '')) || 0;
    return numA - numB;
  });
  
  const maxCount = Math.max(...sorted.map(([, count]) => count));
  
  els.homeworkChart.innerHTML = sorted.map(([hw, count]) => {
    const percentage = (count / maxCount) * 100;
    return `
      <div class="chart-bar-item" style="--percentage: ${percentage}%" data-hw="${escapeAttribute(hw)}" title="Click to filter by ${escapeHtml(hw)}">
        <div class="chart-bar-label">${escapeHtml(hw)}</div>
        <div class="chart-bar-wrapper">
          <div class="chart-bar" style="width: ${percentage}%">
            <span class="chart-bar-value">${count}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
  
  // Add click handlers for interactive filtering
  els.homeworkChart.querySelectorAll(".chart-bar-item").forEach(item => {
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      const hw = item.dataset.hw;
      state.activeFilters.homework = hw;
      applyFiltersAndRender();
      switchSection("browse");
      showToast(`Filtered by ${hw}`);
    });
  });
}

function renderModelChart() {
  if (!els.modelChart) return;
  
  const modelCounts = {};
  state.allPosts.forEach(post => {
    const model = post.metrics?.model_name || "Unknown";
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  });
  
  const sorted = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10
  
  const maxCount = Math.max(...sorted.map(([, count]) => count));
  
  els.modelChart.innerHTML = sorted.map(([model, count]) => {
    const percentage = (count / maxCount) * 100;
    return `
      <div class="chart-bar-item" style="--percentage: ${percentage}%" data-model="${escapeAttribute(model)}">
        <div class="chart-bar-label">${escapeHtml(model)}</div>
        <div class="chart-bar-wrapper">
          <div class="chart-bar chart-bar-model" style="width: ${percentage}%">
            <span class="chart-bar-value">${count}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
  
  // Add click handlers for interactive filtering
  els.modelChart.querySelectorAll(".chart-bar-item").forEach(item => {
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      const model = item.dataset.model;
      state.activeFilters.model = model;
      applyFiltersAndRender();
      switchSection("browse");
    });
  });
}

function renderTimelineChart() {
  if (!els.timelineChart) return;
  
  const dateCounts = {};
  state.allPosts.forEach(post => {
    if (!post.created_at) return;
    const date = new Date(post.created_at);
    if (isNaN(date.getTime())) return;
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
  });
  
  const sorted = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
  const maxCount = Math.max(...sorted.map(([, count]) => count));
  
  // Create a simple bar chart for timeline
  els.timelineChart.innerHTML = `
    <div class="timeline-chart">
      ${sorted.map(([date, count]) => {
        const percentage = (count / maxCount) * 100;
        const dateObj = new Date(date);
        const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
          <div class="timeline-bar" style="height: ${percentage}%" title="${label}: ${count} posts">
            <span class="timeline-value">${count}</span>
    </div>
        `;
      }).join("")}
  </div>
    <div class="timeline-labels">
      ${sorted.map(([date]) => {
        const dateObj = new Date(date);
        return `<span>${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;
      }).join("")}
    </div>
  `;
}

// Matrix removed - was not displaying properly

function renderContributors() {
  if (!els.contributorsList) return;
  
  const authorCounts = {};
  state.allPosts.forEach(post => {
    const author = post.user?.name || "Unknown";
    authorCounts[author] = (authorCounts[author] || 0) + 1;
  });
  
  const sorted = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  const maxCount = Math.max(...sorted.map(([, count]) => count));
  
  els.contributorsList.innerHTML = sorted.map(([author, count]) => {
    const percentage = (count / maxCount) * 100;
    return `
      <div class="contributor-item">
        <div class="contributor-name">${escapeHtml(author)}</div>
        <div class="contributor-bar-wrapper">
          <div class="contributor-bar" style="width: ${percentage}%"></div>
        </div>
        <div class="contributor-count">${count}</div>
      </div>
    `;
  }).join("");
}

function renderKeywords() {
  if (!els.keywordsCloud) return;
  
  // Extract keywords from titles and content
  const wordCounts = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'special', 'participation', 'hw', 'homework']);
  
  state.allPosts.forEach(post => {
    const text = `${post.title || ''} ${post.document || ''}`.toLowerCase();
    const words = text.match(/\b[a-z]{4,}\b/g) || [];
    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
  });
  
  const sorted = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  
  const maxCount = Math.max(...sorted.map(([, count]) => count));
  const minCount = Math.min(...sorted.map(([, count]) => count));
  
  els.keywordsCloud.innerHTML = sorted.map(([word, count]) => {
    const size = 0.75 + ((count - minCount) / (maxCount - minCount)) * 1.25;
    return `
      <span class="keyword-tag" style="font-size: ${size}rem; opacity: ${0.6 + (count / maxCount) * 0.4}">
        ${escapeHtml(word)} <small>(${count})</small>
      </span>
    `;
  }).join("");
}

// =========================================
// THEME
// =========================================
function setupTheme() {
  els.appearanceButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      applyTheme(mode);
    });
  });
  
  // Load saved theme
  const saved = localStorage.getItem(THEME_KEY) || "auto";
  applyTheme(saved);
}

function applyTheme(mode) {
  document.body.classList.remove("theme-light", "theme-dark");
  
  if (mode === "light") {
    document.body.classList.add("theme-light");
    localStorage.setItem(THEME_KEY, "light");
  } else if (mode === "dark") {
    document.body.classList.add("theme-dark");
    localStorage.setItem(THEME_KEY, "dark");
    } else {
    localStorage.removeItem(THEME_KEY);
  }
}

// =========================================
// QA FUNCTIONALITY (simplified - for modal)
// =========================================
function setupQA() {
  if (!els.qaForm) return;
  
  els.qaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = els.qaInput?.value.trim();
    if (!question || !state.currentModalPost) return;
    
    // Simple placeholder - full QA implementation would go here
    if (els.qaMessages) {
      const userMsg = document.createElement("div");
      userMsg.className = "qa-message qa-user";
      userMsg.innerHTML = `<p>${escapeHtml(question)}</p>`;
      els.qaMessages.appendChild(userMsg);
    }
    
    if (els.qaInput) els.qaInput.value = "";
  });
}

// =========================================
// AI ASSISTANT (New Section)
// =========================================
let assistantEngine = null;
let assistantWebllm = null;
let assistantMessages = [];
let assistantGenerating = false;

async function initAssistantEngine() {
  if (assistantEngine) return;
  
  if (!navigator.gpu) {
    if (els.assistantStatus) {
      els.assistantStatus.textContent = "WebGPU not supported";
    }
    return;
  }

  try {
    if (els.assistantStatus) {
      els.assistantStatus.textContent = "Loading model...";
    }
    if (els.assistantLoading) {
      els.assistantLoading.hidden = false;
    }
    
    if (!assistantWebllm) {
      if (els.assistantLoadingText) {
        els.assistantLoadingText.textContent = "Loading WebLLM library...";
      }
      assistantWebllm = await import("https://esm.run/@mlc-ai/web-llm");
    }
    
    const modelId = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    if (els.assistantLoadingText) {
      els.assistantLoadingText.textContent = "Loading Llama 3.2 1B...";
    }
    
    assistantEngine = await assistantWebllm.CreateMLCEngine(modelId, {
      initProgressCallback: (progress) => {
        if (els.assistantLoadingText) {
          els.assistantLoadingText.textContent = progress.text || "Loading...";
        }
        if (els.assistantProgressFill) {
          els.assistantProgressFill.style.width = `${Math.round(progress.progress * 100)}%`;
        }
      },
    });
    
    if (els.assistantLoading) {
      els.assistantLoading.hidden = true;
    }
    if (els.assistantStatus) {
      els.assistantStatus.textContent = "Ready";
    }
    if (els.assistantInput) {
      els.assistantInput.disabled = false;
    }
    if (els.assistantSend) {
      els.assistantSend.disabled = false;
    }
    
    assistantMessages = [{
      role: "system",
      content: "You are a helpful AI assistant for exploring EECS 182 special participation posts. Answer questions about the posts, models, and homeworks. Be concise and helpful."
    }];
  } catch (err) {
    console.error("Failed to init assistant:", err);
    if (els.assistantStatus) {
      els.assistantStatus.textContent = "Failed to load";
    }
    if (els.assistantLoading) {
      els.assistantLoading.hidden = true;
    }
  }
}

function addAssistantMessage(role, content, isStreaming = false) {
  if (!els.assistantMessages) return null;
  
  const div = document.createElement("div");
  div.className = `assistant-message ${role}${isStreaming ? " streaming" : ""}`;
  div.innerHTML = `<p>${escapeHtml(content)}</p>`;
  els.assistantMessages.appendChild(div);
  els.assistantMessages.scrollTop = els.assistantMessages.scrollHeight;
  return div;
}

function setupAssistant() {
  if (!els.assistantForm) return;
  
  els.assistantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = els.assistantInput?.value.trim();
    if (!question || assistantGenerating) return;
    
    if (!assistantEngine) {
      await initAssistantEngine();
      if (!assistantEngine) return;
    }
    
    addAssistantMessage("user", question);
    if (els.assistantInput) els.assistantInput.value = "";
    
    assistantGenerating = true;
    if (els.assistantInput) els.assistantInput.disabled = true;
    if (els.assistantSend) els.assistantSend.disabled = true;
    if (els.assistantStatus) els.assistantStatus.textContent = "Thinking...";
    
    const assistantEl = addAssistantMessage("assistant", "", true);
    
    try {
      assistantMessages.push({ role: "user", content: question });
      
      let fullResponse = "";
      const asyncGenerator = await assistantEngine.chat.completions.create({
        messages: assistantMessages,
        stream: true,
        max_tokens: 512,
        temperature: 0.7,
      });
      
      for await (const chunk of asyncGenerator) {
        const delta = chunk.choices[0]?.delta?.content || "";
        fullResponse += delta;
        if (assistantEl) {
          assistantEl.querySelector("p").textContent = fullResponse;
          if (els.assistantMessages) {
            els.assistantMessages.scrollTop = els.assistantMessages.scrollHeight;
          }
        }
      }
      
      assistantMessages.push({ role: "assistant", content: fullResponse });
      if (assistantEl) assistantEl.classList.remove("streaming");
    } catch (err) {
      console.error("Assistant error:", err);
      if (assistantEl) {
        assistantEl.querySelector("p").textContent = "Sorry, something went wrong.";
        assistantEl.classList.remove("streaming");
      }
    } finally {
      assistantGenerating = false;
      if (els.assistantInput) els.assistantInput.disabled = false;
      if (els.assistantSend) els.assistantSend.disabled = false;
      if (els.assistantStatus) els.assistantStatus.textContent = "Ready";
      if (els.assistantInput) els.assistantInput.focus();
    }
  });
  
  if (els.assistantClear) {
    els.assistantClear.addEventListener("click", () => {
      assistantMessages = [{
        role: "system",
        content: "You are a helpful AI assistant for exploring EECS 182 special participation posts. Answer questions about the posts, models, and homeworks. Be concise and helpful."
      }];
      if (els.assistantMessages) {
        els.assistantMessages.innerHTML = `
          <div class="assistant-message assistant">
            <p>Conversation cleared. How can I help you?</p>
          </div>
        `;
      }
    });
  }
}

// =========================================
// COMPARISON VIEW (Homework-First)
// =========================================

function setupComparison() {
  if (!els.compareHomework || !els.compareModelA || !els.compareModelB) return;
  
  // Populate homework dropdown when data loads
  if (state.allPosts.length > 0) {
    populateComparisonDropdowns();
  }
  
  els.compareHomework.addEventListener("change", () => updateComparisonInputs());
  els.compareModelA.addEventListener("change", () => updateComparisonView());
  els.compareModelB.addEventListener("change", () => updateComparisonView());
}

function populateComparisonDropdowns() {
  const homeworks = new Set();
  state.allPosts.forEach(post => {
    const hw = post.metrics?.homework_id;
    if (hw) homeworks.add(hw);
  });
  
  const sortedHomeworks = Array.from(homeworks).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });
  
  if (els.compareHomework) {
    els.compareHomework.innerHTML = '<option value="">Choose a homework...</option>' +
      sortedHomeworks.map(hw => `<option value="${escapeAttribute(hw)}">${escapeHtml(hw)}</option>`).join("");
  }

  // Model dropdowns depend on homework selection.
  if (els.compareModelA) {
    els.compareModelA.innerHTML = '<option value="">Choose a model...</option>';
    els.compareModelA.disabled = true;
  }
  if (els.compareModelB) {
    els.compareModelB.innerHTML = '<option value="">Choose a model...</option>';
    els.compareModelB.disabled = true;
  }
}

function updateComparisonInputs() {
  const selectedHomework = els.compareHomework?.value;

  if (!selectedHomework) {
    if (els.compareModelA) {
      els.compareModelA.innerHTML = '<option value="">Choose a model...</option>';
      els.compareModelA.disabled = true;
    }
    if (els.compareModelB) {
      els.compareModelB.innerHTML = '<option value="">Choose a model...</option>';
      els.compareModelB.disabled = true;
    }
    if (els.compareResults) els.compareResults.hidden = true;
    if (els.compareEmpty) els.compareEmpty.hidden = false;
    return;
  }

  // Populate model dropdowns based on homework selection
  const models = new Set();
  state.allPosts.forEach(post => {
    if (post.metrics?.homework_id !== selectedHomework) return;
    const model = post.metrics?.model_name;
    if (model) models.add(model);
  });

  const sortedModels = Array.from(models).sort((a, b) => a.localeCompare(b));
  const optionsHtml = '<option value="">Choose a model...</option>' +
    sortedModels.map(m => `<option value="${escapeAttribute(m)}">${escapeHtml(m)}</option>`).join("");

  const prevA = els.compareModelA?.value || "";
  const prevB = els.compareModelB?.value || "";

  if (els.compareModelA) {
    els.compareModelA.innerHTML = optionsHtml;
    els.compareModelA.disabled = false;
    if (prevA && models.has(prevA)) els.compareModelA.value = prevA;
  }

  if (els.compareModelB) {
    els.compareModelB.innerHTML = optionsHtml;
    els.compareModelB.disabled = false;
    if (prevB && models.has(prevB)) els.compareModelB.value = prevB;
  }

  updateComparisonView();
}

function updateComparisonView() {
  const selectedHomework = els.compareHomework?.value;
  const modelA = els.compareModelA?.value;
  const modelB = els.compareModelB?.value;

  if (!selectedHomework || !modelA || !modelB) {
    if (els.compareResults) els.compareResults.hidden = true;
    if (els.compareEmpty) els.compareEmpty.hidden = false;
    return;
  }

  if (els.compareHomeworkTitle) {
    els.compareHomeworkTitle.textContent = `${escapeHtml(selectedHomework)}: ${escapeHtml(modelA)} vs ${escapeHtml(modelB)}`;
  }

  renderComparison(selectedHomework, modelA, modelB);

  if (els.compareResults) els.compareResults.hidden = false;
  if (els.compareEmpty) els.compareEmpty.hidden = true;
}

function renderComparison(selectedHomework, modelA, modelB) {
  if (!els.comparePostsGrid || !selectedHomework || !modelA || !modelB) return;

  const postsA = state.allPosts
    .filter(p => p.metrics?.homework_id === selectedHomework && p.metrics?.model_name === modelA)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const postsB = state.allPosts
    .filter(p => p.metrics?.homework_id === selectedHomework && p.metrics?.model_name === modelB)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const renderPostCard = (post, labelModel) => {
    const m = post.metrics || {};
    const hw = m.homework_id || "Unknown";
    const created = post.created_at ? new Date(post.created_at) : null;
    const createdStr = created && !isNaN(created.getTime())
      ? created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "";
    const author = post.user?.name || "Unknown";
    const bodyText = post.document || "(no body text available)";
    const pdfUrl = getHomeworkPDFUrl(hw);

    return `
      <div class="compare-post-card">
        <div class="compare-post-header">
          <h3>${escapeHtml(labelModel)}</h3>
          <button class="compare-post-open-btn" data-post-index="${state.allPosts.indexOf(post)}">
            Open Full Post
          </button>
        </div>
        <div class="compare-post-title">
          <h4>${escapeHtml(post.title || "Untitled")}</h4>
        </div>
        <div class="compare-post-meta">
          <span>${escapeHtml(createdStr)}</span>
          <span>•</span>
          <span>${escapeHtml(author)}</span>
        </div>
        ${pdfUrl ? `
          <div class="compare-post-homework-link">
            <a href="${escapeAttribute(pdfUrl)}" target="_blank">📄 View ${escapeHtml(hw)} PDF</a>
          </div>
        ` : ""}
        <div class="compare-post-body">
          <p>${escapeHtml(bodyText.substring(0, 800))}${bodyText.length > 800 ? "..." : ""}</p>
        </div>
        ${post.ed_url ? `
          <div class="compare-post-footer">
            <a href="${escapeAttribute(post.ed_url)}" target="_blank">View on Ed →</a>
          </div>
        ` : ""}
      </div>
    `;
  };

  const renderColumn = (label, posts) => {
    if (posts.length === 0) {
      return `
        <div class="compare-column">
          <div class="compare-column-header">${escapeHtml(label)}</div>
          <div class="compare-column-empty">No posts found.</div>
        </div>
      `;
    }

    return `
      <div class="compare-column">
        <div class="compare-column-header">${escapeHtml(label)}</div>
        <div class="compare-column-cards">
          ${posts.map(p => renderPostCard(p, label)).join("")}
        </div>
      </div>
    `;
  };

  els.comparePostsGrid.innerHTML = renderColumn(modelA, postsA) + renderColumn(modelB, postsB);

  els.comparePostsGrid.querySelectorAll(".compare-post-open-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.postIndex);
      if (!isNaN(index) && state.allPosts[index]) {
        openPostModal(state.allPosts[index]);
      }
    });
  });
}

// =========================================
// BACK TO TOP
// =========================================
function setupBackToTop() {
  if (!els.backToTop) return;
  
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      els.backToTop.hidden = false;
    } else {
      els.backToTop.hidden = true;
    }
  });
  
  els.backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// =========================================
// KEYBOARD SHORTCUTS
// =========================================
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (els.heroSearchInput) {
        els.heroSearchInput.focus();
        switchSection("home");
      }
    }
    
    // Escape to close modals
    if (e.key === "Escape") {
      if (els.postModalBackdrop && !els.postModalBackdrop.hidden) {
        closePostModal();
      }
    }
    
    // Number keys for navigation
    if (e.key >= "1" && e.key <= "6" && !e.ctrlKey && !e.metaKey) {
      const sections = ["home", "browse", "analytics", "compare", "assistant", "help"];
      const index = parseInt(e.key) - 1;
      if (sections[index]) {
        switchSection(sections[index]);
      }
    }
  });
}

// =========================================
// UTILITIES
// =========================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

// =========================================
// EXPORT FUNCTIONALITY
// =========================================
function setupExport() {
  if (!els.exportBtn) return;
  
  els.exportBtn.addEventListener("click", () => {
    exportFilteredResults();
  });
}

function exportFilteredResults() {
  if (state.filtered.length === 0) {
    showToast("No posts to export. Apply filters to see results.");
    return;
  }
  
  const data = state.filtered.map(post => ({
    title: post.title || "Untitled",
    author: post.user?.name || "Unknown",
    homework: post.metrics?.homework_id || "Unknown",
    model: post.metrics?.model_name || "Unknown",
    created_at: post.created_at || "",
    view_count: post.view_count || 0,
    content_preview: (post.document || "").substring(0, 200),
    ed_url: post.ed_url || ""
  }));
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `llm-posts-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Show feedback
  const originalText = els.exportBtn.innerHTML;
  els.exportBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Exported!';
  setTimeout(() => {
    els.exportBtn.innerHTML = originalText;
  }, 2000);
}

// =========================================
// SHARE FUNCTIONALITY
// =========================================
function setupShare() {
  if (!els.shareBtn) return;
  
  els.shareBtn.addEventListener("click", async () => {
    await copyShareableLink();
  });
}

function updateShareableLink() {
  const params = new URLSearchParams();
  if (state.activeFilters.homework) params.set("hw", state.activeFilters.homework);
  if (state.activeFilters.model) params.set("model", state.activeFilters.model);
  if (state.activeFilters.search) params.set("search", state.activeFilters.search);
  if (state.currentView !== "grid") params.set("view", state.currentView);
  
  const url = `${window.location.origin}${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  state.shareUrl = url;
  return url;
}

async function copyShareableLink() {
  const url = updateShareableLink();
  
  try {
    await navigator.clipboard.writeText(url);
    const originalText = els.shareBtn.innerHTML;
    els.shareBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
    setTimeout(() => {
      els.shareBtn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showToast("Link copied to clipboard!");
  }
}

async function copyPostLink(post) {
  const postId = post.number || post.id;
  const url = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  
  try {
    await navigator.clipboard.writeText(url);
    showToast("Post link copied to clipboard!");
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showToast("Post link copied!");
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
}

// =========================================
// BOOKMARKS FUNCTIONALITY
// =========================================
function setupBookmarks() {
  if (!els.bookmarkToggle) return;
  
  const saved = localStorage.getItem("llm-explorer-bookmarks");
  if (saved) {
    try {
      state.bookmarks = new Set(JSON.parse(saved));
    } catch (e) {
      state.bookmarks = new Set();
    }
  }
  
  els.bookmarkToggle.addEventListener("click", () => {
    toggleBookmarkView();
  });
  
  updateBookmarkButton();
}

function toggleBookmark(postId) {
  if (!state.bookmarks) {
    state.bookmarks = new Set();
  }
  const id = String(postId);
  if (state.bookmarks.has(id)) {
    state.bookmarks.delete(id);
  } else {
    state.bookmarks.add(id);
  }
  
  localStorage.setItem("llm-explorer-bookmarks", JSON.stringify([...state.bookmarks]));
  updateBookmarkButton();
}

function updateBookmarkButton() {
  if (!els.bookmarkToggle) return;
  if (!state.bookmarks) {
    state.bookmarks = new Set();
  }
  const count = state.bookmarks.size;
  if (count > 0) {
    els.bookmarkToggle.setAttribute("data-count", count);
    els.bookmarkToggle.classList.add("has-bookmarks");
  } else {
    els.bookmarkToggle.removeAttribute("data-count");
    els.bookmarkToggle.classList.remove("has-bookmarks");
  }
}

function toggleBookmarkView() {
  if (state.bookmarks.size === 0) {
    showToast("No bookmarks yet. Click the bookmark icon on any post to save it!");
    return;
  }
  
  const bookmarkedPosts = state.allPosts.filter(post => {
    const postId = String(post.number || post.id);
    return state.bookmarks.has(postId);
  });
  
  state.filtered = bookmarkedPosts;
  renderPosts();
  updateResultsSummary();
  showToast(`Showing ${bookmarkedPosts.length} bookmarked post${bookmarkedPosts.length === 1 ? '' : 's'}`);
}

// =========================================
// URL PARAMETERS
// =========================================
function setupURLParams() {
  const params = new URLSearchParams(window.location.search);
  
  if (params.has("hw")) {
    state.activeFilters.homework = params.get("hw");
  }
  if (params.has("model")) {
    state.activeFilters.model = params.get("model");
  }
  if (params.has("search")) {
    state.activeFilters.search = params.get("search");
    if (els.heroSearchInput) {
      els.heroSearchInput.value = state.activeFilters.search;
    }
  }
  if (params.has("view")) {
    state.currentView = params.get("view");
  }
  
  if (params.toString()) {
    setTimeout(() => {
      applyFiltersAndRender();
      if (state.currentView !== "grid" && els.postsGrid) {
        els.postsGrid.setAttribute("data-view", state.currentView);
      }
    }, 100);
  }
}

// =========================================
// INITIALIZATION
// =========================================
async function init() {
  cacheElements();
  setupTheme();
  setupNavigation();
  setupSearch();
  setupViewModes();
  setupAnalytics();
  setupQA();
  setupAssistant();
  setupComparison();
  setupBackToTop();
  setupKeyboardShortcuts();
  setupExport();
  setupShare();
  setupBookmarks();
  setupURLParams();
  
  // Ensure modal starts hidden
  if (els.postModalBackdrop) {
    els.postModalBackdrop.hidden = true;
  }
  
  // Modal close handlers
  if (els.postModalClose) {
    els.postModalClose.addEventListener("click", closePostModal);
  }
  if (els.postModalBackdrop) {
    els.postModalBackdrop.addEventListener("click", (e) => {
      if (e.target === els.postModalBackdrop) closePostModal();
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.postModalBackdrop && !els.postModalBackdrop.hidden) {
      closePostModal();
    }
  });
  
  // Sort handler
  if (els.sortSelect) {
    els.sortSelect.addEventListener("change", () => {
      applyFiltersAndRender();
    });
  }

  try {
    const [posts, manifest, insights] = await Promise.all([
      loadData(),
      loadFilesManifest(),
      loadInsights(),
    ]);
    
    state.allPosts = posts;
    state.filesManifest = manifest;
    state.insights = insights;
    
    updateStatistics();
    setupFilterDropdowns();
    buildFilterTags();
    applyFiltersAndRender();
    renderAnalytics();
    populateComparisonDropdowns();
    
    // If on browse section, ensure it's rendered
    if (state.currentSection === "browse") {
    applyFiltersAndRender();
    }
    
    // If on analytics section, ensure it's rendered
    if (state.currentSection === "analytics") {
      renderAnalytics();
    }
  } catch (err) {
    console.error(err);
    alert(`Error loading data: ${err.message}`);
  }
}

window.addEventListener("DOMContentLoaded", init);
