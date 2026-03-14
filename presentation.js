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
  const stageEl = document.getElementById("presentation-stage");
  const frameEl = document.getElementById("presentation-frame");
  const messageEl = document.getElementById("presentation-message");
  const messageTitleEl = document.getElementById("presentation-message-title");
  const messageCopyEl = document.getElementById("presentation-message-copy");
  const backBtn = document.getElementById("presentation-back-btn");
  const nextBtn = document.getElementById("presentation-next-btn");
  const pauseBtn = document.getElementById("presentation-pause-btn");
  const skipLink = document.getElementById("presentation-skip-link");

  const state = {
    manifest: null,
    started: false,
    currentIndex: -1,
    cometTailPaused: false,
  };

  function isCometTailSlide(slide) {
    return String(slide?.src || "").includes("slides/3I/comet_tail.html");
  }

  function updatePauseButton() {
    const slide = state.manifest?.slides?.[state.currentIndex];
    const enabled = state.started && isCometTailSlide(slide);
    pauseBtn.disabled = !enabled;
    pauseBtn.textContent = state.cometTailPaused ? "Play" : "Pause";
  }

  function updateControls() {
    const controls = getPresentationControls({
      started: state.started,
      currentIndex: state.currentIndex,
      slideCount: state.manifest?.slides?.length || 0,
    });

    backBtn.disabled = !controls.canBack;
    nextBtn.disabled = !controls.canNext;
    updatePauseButton();
  }

  function updateStage() {
    if (!state.manifest || !state.started || state.currentIndex < 0) {
      stageEl.classList.remove("started");
      updateControls();
      return;
    }

    const slide = state.manifest.slides[state.currentIndex];
    if (!slide) {
      stageEl.classList.remove("started");
      updateControls();
      return;
    }

    stageEl.classList.add("started");
    state.cometTailPaused = false;
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
    state.cometTailPaused = false;
    backBtn.disabled = true;
    nextBtn.disabled = true;
    pauseBtn.disabled = true;
    pauseBtn.textContent = "Pause";
  }

  function hideError() {
    messageEl.classList.remove("visible");
    messageEl.setAttribute("aria-hidden", "true");
  }

  function toggleCometTailPause() {
    const slide = state.manifest?.slides?.[state.currentIndex];
    if (!isCometTailSlide(slide) || !frameEl.contentWindow) return;
    state.cometTailPaused = !state.cometTailPaused;
    frameEl.contentWindow.postMessage(
      { type: "comet-tail-toggle-pause" },
      "*"
    );
    updatePauseButton();
  }

  function moveBy(delta) {
    if (!state.started || !state.manifest?.slides?.length) return;

    const nextIndex = state.currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= state.manifest.slides.length) return;

    state.currentIndex = nextIndex;
    updateStage();
  }

  backBtn.addEventListener("click", () => moveBy(-1));
  nextBtn.addEventListener("click", () => moveBy(1));
  pauseBtn.addEventListener("click", toggleCometTailPause);
  window.addEventListener("message", event => {
    if (event.source !== frameEl.contentWindow) return;
    if (event.data?.type !== "comet-tail-pause-state") return;
    state.cometTailPaused = Boolean(event.data.paused);
    updatePauseButton();
  });

  document.addEventListener("keydown", event => {
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      moveBy(1);
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
      state.started = manifest.slides.length > 0;
      state.currentIndex = state.started ? 0 : -1;
      document.title = `${manifest.title} · 3i-web`;
      skipLink.href = manifest.mainHref;
      hideError();
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
