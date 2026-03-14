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

function buildPageHref(pageName, designation, source = "") {
  const params = new URLSearchParams({ designation: designation || "3I" });
  const normalizedSource = normalizeRequestedSource(source);
  if (normalizedSource) params.set("source", normalizedSource);
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
  if (!project.localMeta || !project.localMeta.totalPoints) return "Local draft available";
  return `${project.localMeta.annotatedPoints} of ${project.localMeta.totalPoints} annotated locally`;
}

function createAvailabilityBadges(project) {
  const badges = [];

  if (project.hasLocal && project.hasWeb) {
    badges.push('<span class="index-badge mixed">Local + Web</span>');
  } else if (project.hasLocal) {
    badges.push('<span class="index-badge local">Local</span>');
  } else if (project.hasWeb) {
    badges.push('<span class="index-badge web">Web</span>');
  }

  if (project.localMeta?.updatedAt) {
    badges.push('<span class="index-badge local">Draft saved</span>');
  }

  return badges.join("");
}

function renderProjectRow(project) {
  const row = document.createElement("tr");
  const hasPresentation = hasPresentationForProject(project);
  const sourceOptions = project.hasLocal && project.hasWeb
    ? `
      <option value="">Choose source</option>
      <option value="local">From local</option>
      <option value="web">From web</option>
    `
    : "";

  row.innerHTML = `
    <td>
      <div class="index-object-name">${project.designation}</div>
      <div class="index-object-detail">${project.hasLocal ? formatProjectSummary(project) : "Bundled trajectory available"}</div>
    </td>
    <td><div class="index-badges">${createAvailabilityBadges(project)}</div></td>
    <td>
      <div class="index-source-block">
        ${project.hasLocal && project.hasWeb
          ? `<select class="index-source-select" aria-label="Choose source for ${project.designation}">${sourceOptions}</select>`
          : `<div class="index-source-static">${project.hasLocal ? "From local" : "From web"}</div>`
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
          ${hasPresentation ? `<a class="index-action-link" data-role="presentation" href="${buildPageHref("presentation", project.designation)}">Presentation</a>` : ""}
        </div>
        <div class="index-helper">${project.hasLocal && project.hasWeb ? "Choose a source to continue." : ""}</div>
        <div class="index-warning">this will overwrite the local version.</div>
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
        ? "Choose a source for Play/Edit, or open the presentation."
        : "Choose a source to continue.";
      return;
    }

    helper.textContent = state.source === "local"
      ? "Using the local draft."
      : "Using the bundled web version.";

    playLink.href = buildPageHref("trajectory_player", project.designation, state.source);
    editLink.href = buildPageHref("object_motion", project.designation, state.source);
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
    summary.textContent = "0 projects";
    return;
  }

  empty.style.display = "none";
  for (const project of projects) tbody.appendChild(renderProjectRow(project));

  const webCount = projects.filter(project => project.hasWeb).length;
  const localCount = projects.filter(project => project.hasLocal).length;
  summary.textContent = `${projects.length} projects · ${webCount} from web · ${localCount} with local drafts`;
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
      error.textContent = "Enter an object designation before continuing.";
      error.classList.add("visible");
      input.focus();
      return;
    }

    window.location.href = buildPageHref("object_motion", designation);
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

async function bootstrapIndexPage() {
  const bundledObjects = await loadBundledObjects();
  const localProjects = APP_CONFIG.useLocalStorage ? readLocalObjects() : [];
  const projects = mergeProjectSources(bundledObjects, localProjects, APP_CONFIG.useLocalStorage);
  const subtitle = document.getElementById("index-subtitle");
  if (subtitle && !APP_CONFIG.useLocalStorage) {
    subtitle.textContent = "Choose a bundled object";
  }
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
