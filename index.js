import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyADVt7WfOu_Tr7_c3dZOIM_6wH4DHMs1OQ",
  authDomain: "astro-489617.firebaseapp.com",
  projectId: "astro-489617",
  storageBucket: "astro-489617.firebasestorage.app",
  messagingSenderId: "296424230553",
  appId: "1:296424230553:web:b083fb23f52daa7470f208",
  measurementId: "G-SYL972S006"
};

const app = initializeApp(firebaseConfig);
let analytics = null;

try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("[index] Firebase analytics unavailable:", error);
}

void analytics;

const OBJECT_MANIFEST_PATH = "data/objects.json";
const DEFAULT_WEB_OBJECTS = Object.freeze(["3I"]);
const LOCAL_DRAFT_PREFIX = "objectMotion:";
const PRESENTATION_OBJECTS = Object.freeze(["3I"]);
const APP_CONFIG = globalThis.AppConfigShared?.readAppConfig?.(globalThis.AppConfig) || { useLocalStorage: false };
const AppTranslations = globalThis.AppTranslations || {};

let activeLocale = AppTranslations.getLocaleFromSearch?.(window.location.search) || "en";
AppTranslations.setDocumentLocale?.(activeLocale);

function t(name, fallback = "", params = null) {
  const sourceText = fallback || (typeof name === "string" ? name : "");
  return AppTranslations.translate?.(sourceText, { locale: activeLocale, params, fallback: sourceText }) || sourceText;
}

function sanitizeDesignation(name) {
  return String(name || "").trim().replace(/[\s/]/g, "_");
}

function normalizeRequestedSource(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "local" || normalized === "web" ? normalized : "";
}

function normalizeManifestObjects(payload, fallbackObjects = DEFAULT_WEB_OBJECTS) {
  const rawObjects = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.objects)
      ? payload.objects
      : null;

  if (!rawObjects) return [...fallbackObjects];

  const seen = new Set();
  const normalized = [];

  for (const entry of rawObjects) {
    const designation = typeof entry === "string"
      ? entry.trim()
      : typeof entry?.designation === "string"
        ? entry.designation.trim()
        : "";

    const sanitizedName = sanitizeDesignation(designation);
    if (!designation || !sanitizedName || seen.has(sanitizedName)) continue;
    seen.add(sanitizedName);
    normalized.push(designation);
  }

  return normalized.length ? normalized : [...fallbackObjects];
}

function buildPageHref(pageName, designation, source = "", locale = activeLocale) {
  const params = new URLSearchParams({ designation: designation || "3I" });
  const normalizedSource = normalizeRequestedSource(source);
  if (normalizedSource) params.set("source", normalizedSource);
  params.set("lang", locale || activeLocale || "en");
  return `${pageName}?${params.toString()}`;
}

function readLocalObjects(storage = window.localStorage) {
  const results = [];
  const seen = new Set();

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(LOCAL_DRAFT_PREFIX)) continue;

    const fallbackDesignation = key.slice(LOCAL_DRAFT_PREFIX.length);
    let designation = fallbackDesignation;
    let updatedAt = "";
    let totalPoints = 0;
    let annotatedPoints = 0;

    try {
      const parsed = JSON.parse(storage.getItem(key) || "{}");
      designation = String(parsed.designation || parsed.object || fallbackDesignation).trim() || fallbackDesignation;
      updatedAt = String(parsed.updatedAt || parsed.createdAt || "").trim();
      if (Array.isArray(parsed.points)) {
        totalPoints = parsed.points.length;
        annotatedPoints = parsed.points.filter(point => point && point.camera !== null).length;
      }
    } catch (_) {
      designation = fallbackDesignation;
    }

    const sanitizedName = sanitizeDesignation(designation);
    if (!sanitizedName || seen.has(sanitizedName)) continue;

    seen.add(sanitizedName);
    results.push({
      designation,
      sanitizedName,
      updatedAt,
      totalPoints,
      annotatedPoints,
    });
  }

  results.sort((a, b) => a.designation.localeCompare(b.designation, undefined, { sensitivity: "base" }));
  return results;
}

function mergeProjectSources(webDesignations = DEFAULT_WEB_OBJECTS, localProjects = [], useLocalStorage = true) {
  const projectMap = new Map();

  for (const designation of webDesignations) {
    const sanitizedName = sanitizeDesignation(designation);
    projectMap.set(sanitizedName, {
      designation,
      sanitizedName,
      hasWeb: true,
      hasLocal: false,
      localMeta: null,
    });
  }

  if (useLocalStorage) {
    for (const localProject of localProjects) {
      const sanitizedName = sanitizeDesignation(localProject.designation);
      const existing = projectMap.get(sanitizedName);

      if (existing) {
        existing.hasLocal = true;
        existing.localMeta = localProject;
        existing.designation = localProject.designation || existing.designation;
        continue;
      }

      projectMap.set(sanitizedName, {
        designation: localProject.designation,
        sanitizedName,
        hasWeb: false,
        hasLocal: true,
        localMeta: localProject,
      });
    }
  }

  return Array.from(projectMap.values())
    .sort((a, b) => a.designation.localeCompare(b.designation, undefined, { sensitivity: "base" }));
}

async function loadBundledObjects(fetchImpl = window.fetch) {
  try {
    const response = await fetchImpl(OBJECT_MANIFEST_PATH, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`[index] Could not load ${OBJECT_MANIFEST_PATH}; using fallback list.`);
      return [...DEFAULT_WEB_OBJECTS];
    }

    const manifest = await response.json();
    return normalizeManifestObjects(manifest, DEFAULT_WEB_OBJECTS);
  } catch (error) {
    console.warn(`[index] Could not read ${OBJECT_MANIFEST_PATH}; using fallback list.`, error);
    return [...DEFAULT_WEB_OBJECTS];
  }
}

function getProjectSelectionState(project, selectedSource = "") {
  const normalized = normalizeRequestedSource(selectedSource);
  const resolvedSource = normalized || (project.hasLocal && !project.hasWeb ? "local" : (project.hasWeb && !project.hasLocal ? "web" : ""));

  return {
    source: resolvedSource,
    showActions: Boolean(resolvedSource),
    highlightLocal: resolvedSource === "local",
    showWebWarning: project.hasLocal && project.hasWeb && resolvedSource === "web",
  };
}

function hasPresentationForProject(project, supportedObjects = PRESENTATION_OBJECTS) {
  if (!project?.hasWeb) return false;
  return supportedObjects.includes(String(project.designation || "").trim());
}

function formatProjectSummary(project) {
  if (!project.localMeta || !project.localMeta.totalPoints) {
    return t("ui.index.localDraftAvailable", "Local draft available");
  }
  return t("ui.index.annotatedProgress", `${project.localMeta.annotatedPoints} of ${project.localMeta.totalPoints} annotated locally`, {
    annotated: project.localMeta.annotatedPoints,
    total: project.localMeta.totalPoints,
  });
}

function createAvailabilityBadges(project) {
  const badges = [];

  if (project.hasLocal && project.hasWeb) {
    badges.push(`<span class="index-badge mixed">${t("ui.index.availabilityLocalWeb", "Local + Web")}</span>`);
  } else if (project.hasLocal) {
    badges.push(`<span class="index-badge local">${t("ui.index.availabilityLocal", "Local")}</span>`);
  } else if (project.hasWeb) {
    badges.push(`<span class="index-badge web">${t("ui.index.availabilityWeb", "Web")}</span>`);
  }

  if (project.localMeta?.updatedAt) {
    badges.push(`<span class="index-badge local">${t("ui.index.availabilityDraftSaved", "Draft saved")}</span>`);
  }

  return badges.join("");
}

function renderProjectRow(project) {
  const row = document.createElement("tr");
  const hasPresentation = hasPresentationForProject(project);
  const sourceOptions = project.hasLocal && project.hasWeb
    ? `
      <option value="">${t("ui.index.sourceChoose", "Choose source")}</option>
      <option value="local">${t("ui.index.sourceFromLocal", "From local")}</option>
      <option value="web">${t("ui.index.sourceFromWeb", "From web")}</option>
    `
    : "";

  row.innerHTML = `
    <td>
      <div class="index-object-name">${project.designation}</div>
      <div class="index-object-detail">${project.hasLocal ? formatProjectSummary(project) : t("ui.index.bundledTrajectoryAvailable", "Bundled trajectory available")}</div>
    </td>
    <td><div class="index-badges">${createAvailabilityBadges(project)}</div></td>
    <td>
      <div class="index-source-block">
        ${project.hasLocal && project.hasWeb
          ? `<select class="index-source-select" aria-label="Choose source for ${project.designation}">${sourceOptions}</select>`
          : `<div class="index-source-static">${project.hasLocal ? t("ui.index.sourceFromLocal", "From local") : t("ui.index.sourceFromWeb", "From web")}</div>`
        }
      </div>
    </td>
    <td>
      <div class="index-action-block">
        <div class="index-actions">
          <div class="index-primary-actions">
            <a class="index-action-link" data-role="play" href="#">Play</a>
            <a class="index-action-link" data-role="edit" href="#">Edit</a>
          </div>
          ${hasPresentation ? `<a class="index-action-link" data-role="presentation" href="${buildPageHref("presentation", project.designation, "", activeLocale)}">Presentation</a>` : ""}
        </div>
        <div class="index-helper">${project.hasLocal && project.hasWeb ? t("ui.index.helperChooseSource", "Choose a source to continue.") : ""}</div>
        <div class="index-warning">${t("ui.index.warningOverwriteLocal", "this will overwrite the local version.")}</div>
      </div>
    </td>
  `;

  const select = row.querySelector(".index-source-select");
  const primaryActions = row.querySelector(".index-primary-actions");
  const helper = row.querySelector(".index-helper");
  const warning = row.querySelector(".index-warning");
  const playLink = row.querySelector('[data-role="play"]');
  const editLink = row.querySelector('[data-role="edit"]');

  function applySelection(selectedSource) {
    const state = getProjectSelectionState(project, selectedSource);
    primaryActions.classList.toggle("hidden", !state.showActions);
    primaryActions.classList.toggle("local", state.highlightLocal);
    warning.classList.toggle("visible", state.showWebWarning);

    if (!state.showActions) {
      helper.textContent = hasPresentation
        ? t("ui.index.helperChooseSourceOrPresentation", "Choose a source for Play/Edit, or open the presentation.")
        : t("ui.index.helperChooseSource", "Choose a source to continue.");
      return;
    }

    helper.textContent = state.source === "local"
      ? t("ui.index.helperUsingLocal", "Using the local draft.")
      : t("ui.index.helperUsingWeb", "Using the bundled web version.");

    playLink.href = buildPageHref("trajectory_player", project.designation, state.source, activeLocale);
    editLink.href = buildPageHref("object_motion", project.designation, state.source, activeLocale);
  }

  if (select) {
    primaryActions.classList.add("hidden");
    select.addEventListener("change", event => applySelection(event.target.value));
    applySelection("");
  } else {
    applySelection(project.hasLocal ? "local" : "web");
  }

  return row;
}

function renderProjectTable(projects) {
  const tbody = document.getElementById("index-table-body");
  const empty = document.getElementById("index-empty");
  const summary = document.getElementById("index-summary");

  tbody.innerHTML = "";

  if (!projects.length) {
    empty.style.display = "block";
    summary.textContent = t("ui.index.summary", "0 projects", {
      count: 0,
      webCount: 0,
      localCount: 0,
    });
    return;
  }

  empty.style.display = "none";
  for (const project of projects) tbody.appendChild(renderProjectRow(project));

  const webCount = projects.filter(project => project.hasWeb).length;
  const localCount = projects.filter(project => project.hasLocal).length;
  summary.textContent = t("ui.index.summary", `${projects.length} projects · ${webCount} from web · ${localCount} with local drafts`, {
    count: projects.length,
    webCount,
    localCount,
  });
}

function applyStaticIndexText() {
  document.title = t("ui.index.title", "3i-web Projects");
  const title = document.getElementById("index-title");
  const subtitle = document.getElementById("index-subtitle");
  const empty = document.getElementById("index-empty");
  const createBtn = document.getElementById("index-create-btn");
  const projectTable = document.getElementById("index-project-table");
  const languageLabel = document.getElementById("index-language-label");
  const objectCol = document.getElementById("index-col-object");
  const availabilityCol = document.getElementById("index-col-availability");
  const sourceCol = document.getElementById("index-col-source");
  const actionsCol = document.getElementById("index-col-actions");
  const modalTitle = document.getElementById("index-modal-title");
  const modalCopy = document.getElementById("index-modal-copy");
  const modalInput = document.getElementById("index-modal-input");

  if (title) title.textContent = t("ui.index.title", "3i-web Projects");
  if (subtitle) {
    subtitle.textContent = APP_CONFIG.useLocalStorage
      ? t("ui.index.subtitle", "Choose a bundled object or resume a local draft")
      : t("ui.index.subtitleWebOnly", "Choose a bundled object");
  }
  if (empty) empty.textContent = t("ui.index.empty", "No projects found yet. Create a new object to begin.");
  if (createBtn) createBtn.setAttribute("aria-label", t("ui.index.createAriaLabel", "Create new object"));
  if (projectTable) projectTable.setAttribute("aria-label", t("ui.index.projectListAriaLabel", "Project list"));
  if (languageLabel) languageLabel.textContent = t("ui.index.languageLabel", "Language");
  if (objectCol) objectCol.textContent = t("ui.index.table.object", "Object");
  if (availabilityCol) availabilityCol.textContent = t("ui.index.table.availability", "Availability");
  if (sourceCol) sourceCol.textContent = t("ui.index.table.source", "Source");
  if (actionsCol) actionsCol.textContent = t("ui.index.table.actions", "Actions");
  if (modalTitle) modalTitle.textContent = t("ui.index.createModalTitle", "Create New Object");
  if (modalCopy) modalCopy.textContent = t("ui.index.createModalCopy", "Enter the object designation. The Object Motion Tracker will open and let you fetch or annotate its trajectory.");
  if (modalInput) modalInput.placeholder = t("ui.index.createModalPlaceholder", "Examples: 3I or C/2025 N1");
}

function setupCreateObjectModal() {
  const openBtn = document.getElementById("index-create-btn");
  const modal = document.getElementById("index-modal");
  const input = document.getElementById("index-modal-input");
  const error = document.getElementById("index-modal-error");
  const cancelBtn = document.getElementById("index-modal-cancel");
  const submitBtn = document.getElementById("index-modal-submit");

  function closeModal() {
    modal.classList.remove("visible");
    modal.setAttribute("aria-hidden", "true");
    input.value = "";
    error.textContent = "";
    error.classList.remove("visible");
  }

  function openModal() {
    modal.classList.add("visible");
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => input.focus());
  }

  function submit() {
    const designation = String(input.value || "").trim();
    if (!designation) {
      error.textContent = t("ui.index.validationEnterDesignation", "Enter an object designation before continuing.");
      error.classList.add("visible");
      input.focus();
      return;
    }

    window.location.href = buildPageHref("object_motion", designation, "", activeLocale);
  }

  openBtn.addEventListener("click", openModal);
  cancelBtn.addEventListener("click", closeModal);
  submitBtn.addEventListener("click", submit);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") submit();
    if (event.key === "Escape") closeModal();
  });
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("visible")) closeModal();
  });
}

function setupLanguageSelector() {
  const select = document.getElementById("index-language-select");
  if (!select) return;
  select.value = activeLocale;
  select.addEventListener("change", event => {
    const nextLocale = AppTranslations.normalizeLocale?.(event.target.value) || "en";
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    window.location.href = `${url.pathname.replace(/^\/+/, "")}${url.search}${url.hash}`;
  });
}

async function bootstrapIndexPage() {
  await AppTranslations.loadTranslations?.();
  activeLocale = AppTranslations.getLocaleFromSearch?.(window.location.search) || activeLocale;
  AppTranslations.setDocumentLocale?.(activeLocale);
  applyStaticIndexText();
  setupLanguageSelector();

  const bundledObjects = await loadBundledObjects();
  const localProjects = APP_CONFIG.useLocalStorage ? readLocalObjects() : [];
  const projects = mergeProjectSources(bundledObjects, localProjects, APP_CONFIG.useLocalStorage);
  renderProjectTable(projects);
  setupCreateObjectModal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bootstrapIndexPage();
  }, { once: true });
} else {
  bootstrapIndexPage();
}
