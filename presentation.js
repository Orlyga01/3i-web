const DEFAULT_DESIGNATION = "3I";
const DEFAULT_TITLE = "3I Atlas Presentation";

function getDesignationFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const designation = String(params.get("designation") || "").trim();
  return designation || DEFAULT_DESIGNATION;
}

function buildPresentationManifestPath(designation) {
  const normalized = String(designation || "").trim() || DEFAULT_DESIGNATION;
  return `data/${normalized}/presentation.json`;
}

function buildPresentationMainHref(designation, explicitHref = "") {
  const trimmedExplicitHref = String(explicitHref || "").trim();
  if (trimmedExplicitHref) return trimmedExplicitHref;

  const normalized = String(designation || "").trim() || DEFAULT_DESIGNATION;
  const params = new URLSearchParams({
    designation: normalized,
    source: "web",
  });
  return `trajectory_player?${params.toString()}`;
}

function normalizePresentationManifest(payload, designation = DEFAULT_DESIGNATION) {
  const rawSlides = Array.isArray(payload?.slides) ? payload.slides : [];
  const slides = rawSlides
    .map((slide, index) => {
      const title = String(slide?.title || "").trim();
      const src = String(slide?.src || "").trim();
      if (!title || !src) return null;

      return {
        id: String(slide?.id || `slide-${index + 1}`).trim(),
        title,
        src,
      };
    })
    .filter(Boolean);

  return {
    designation: String(payload?.designation || designation || DEFAULT_DESIGNATION).trim() || DEFAULT_DESIGNATION,
    title: String(payload?.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE,
    subtitle: String(payload?.subtitle || "").trim(),
    mainHref: buildPresentationMainHref(designation, payload?.mainHref),
    slides,
  };
}

function getPresentationControls(state) {
  const slideCount = Number.isFinite(state?.slideCount) ? state.slideCount : 0;
  const currentIndex = Number.isFinite(state?.currentIndex) ? state.currentIndex : -1;
  const started = Boolean(state?.started) && slideCount > 0 && currentIndex >= 0;

  return {
    canStart: slideCount > 0 && !started,
    canBack: started && currentIndex > 0,
    canNext: started && currentIndex < slideCount - 1,
  };
}

async function loadPresentationManifest(fetchImpl = window.fetch, designation = getDesignationFromUrl()) {
  const response = await fetchImpl(buildPresentationManifestPath(designation), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load presentation manifest for ${designation}.`);
  }

  const payload = await response.json();
  return normalizePresentationManifest(payload, designation);
}

function bootstrapPresentationPage() {
  const titleEl = document.getElementById("presentation-title");
  const subtitleEl = document.getElementById("presentation-subtitle");
  const slideNameEl = document.getElementById("presentation-slide-name");
  const stageEl = document.getElementById("presentation-stage");
  const frameEl = document.getElementById("presentation-frame");
  const messageEl = document.getElementById("presentation-message");
  const messageTitleEl = document.getElementById("presentation-message-title");
  const messageCopyEl = document.getElementById("presentation-message-copy");
  const startBtn = document.getElementById("presentation-start-btn");
  const backBtn = document.getElementById("presentation-back-btn");
  const nextBtn = document.getElementById("presentation-next-btn");
  const skipLink = document.getElementById("presentation-skip-link");

  const state = {
    manifest: null,
    started: false,
    currentIndex: -1,
  };

  function updateControls() {
    const controls = getPresentationControls({
      started: state.started,
      currentIndex: state.currentIndex,
      slideCount: state.manifest?.slides?.length || 0,
    });

    startBtn.disabled = !controls.canStart;
    backBtn.disabled = !controls.canBack;
    nextBtn.disabled = !controls.canNext;
  }

  function updateStage() {
    if (!state.manifest || !state.started || state.currentIndex < 0) {
      stageEl.classList.remove("started");
      slideNameEl.textContent = "Ready to start";
      updateControls();
      return;
    }

    const slide = state.manifest.slides[state.currentIndex];
    if (!slide) {
      stageEl.classList.remove("started");
      slideNameEl.textContent = "Ready to start";
      updateControls();
      return;
    }

    stageEl.classList.add("started");
    slideNameEl.textContent = slide.title;
    if (frameEl.getAttribute("src") !== slide.src) {
      frameEl.setAttribute("src", slide.src);
    }
    updateControls();
  }

  function showError(title, message) {
    messageTitleEl.textContent = title;
    messageCopyEl.textContent = message;
    messageEl.classList.add("visible");
    messageEl.setAttribute("aria-hidden", "false");
    stageEl.classList.remove("started");
    startBtn.disabled = true;
    backBtn.disabled = true;
    nextBtn.disabled = true;
  }

  function hideError() {
    messageEl.classList.remove("visible");
    messageEl.setAttribute("aria-hidden", "true");
  }

  function startPresentation() {
    if (!state.manifest?.slides?.length) return;
    state.started = true;
    state.currentIndex = 0;
    hideError();
    updateStage();
  }

  function moveBy(delta) {
    if (!state.started || !state.manifest?.slides?.length) return;

    const nextIndex = state.currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= state.manifest.slides.length) return;

    state.currentIndex = nextIndex;
    updateStage();
  }

  startBtn.addEventListener("click", startPresentation);
  backBtn.addEventListener("click", () => moveBy(-1));
  nextBtn.addEventListener("click", () => moveBy(1));

  document.addEventListener("keydown", event => {
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      if (!state.started) {
        startPresentation();
      } else {
        moveBy(1);
      }
      return;
    }

    if (event.key === "ArrowRight") moveBy(1);
    if (event.key === "ArrowLeft") moveBy(-1);
    if (event.key === "Escape") window.location.href = skipLink.href;
  });

  const designation = getDesignationFromUrl();
  loadPresentationManifest(window.fetch, designation)
    .then(manifest => {
      state.manifest = manifest;
      document.title = `${manifest.title} · 3i-web`;
      titleEl.textContent = manifest.title;
      subtitleEl.textContent = manifest.subtitle || "JSON-driven slideshow shell with iframe-based slides";
      skipLink.href = manifest.mainHref;
      updateStage();
    })
    .catch(error => {
      console.warn("[presentation] Failed to load presentation manifest.", error);
      showError(
        "Presentation unavailable",
        "The JSON manifest could not be loaded for this object yet."
      );
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapPresentationPage, { once: true });
} else {
  bootstrapPresentationPage();
}
