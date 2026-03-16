const DEFAULT_DESIGNATION = "3I";
const DEFAULT_TITLE = "3I Atlas Presentation";
const AppTranslations = window.AppTranslations || {};
const presentationLocale = AppTranslations.getLocaleFromSearch?.(window.location.search) || "en";

AppTranslations.setDocumentLocale?.(presentationLocale);

function pt(name, fallback = "", params = null) {
  const sourceText = fallback || (typeof name === "string" ? name : "");
  return AppTranslations.translate?.(sourceText, { locale: presentationLocale, params, fallback: sourceText }) || sourceText;
}

function getDesignationFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const designation = String(params.get("designation") || "").trim();
  return designation || DEFAULT_DESIGNATION;
}

function buildPresentationManifestPath(designation) {
  const normalized = String(designation || "").trim() || DEFAULT_DESIGNATION;
  return `data/${normalized}/presentation.json`;
}

function buildPresentationMainHref(designation, explicitHref = "", locale = presentationLocale) {
  const trimmedExplicitHref = String(explicitHref || "").trim();
  if (trimmedExplicitHref) {
    return AppTranslations.withLangParam?.(trimmedExplicitHref, locale) || trimmedExplicitHref;
  }

  const normalized = String(designation || "").trim() || DEFAULT_DESIGNATION;
  const params = new URLSearchParams({
    designation: normalized,
    source: "web",
    lang: locale || presentationLocale || "en",
  });
  return `trajectory_player?${params.toString()}`;
}

function normalizeSlideHref(src) {
  const value = String(src || "").trim();
  if (!value) return value;
  return value.replace(/\.html(?=([?#]|$))/i, "");
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
        src: AppTranslations.withLangParam?.(normalizeSlideHref(src), presentationLocale) || normalizeSlideHref(src),
      };
    })
    .filter(Boolean);

  const normalizedDesignation = String(payload?.designation || designation || DEFAULT_DESIGNATION).trim() || DEFAULT_DESIGNATION;
  const baseTitle = String(payload?.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE;
  const baseSubtitle = String(payload?.subtitle || "").trim();

  return {
    designation: normalizedDesignation,
    title: pt(baseTitle, baseTitle),
    subtitle: pt(baseSubtitle, baseSubtitle),
    mainHref: buildPresentationMainHref(normalizedDesignation, payload?.mainHref, presentationLocale),
    slides: slides.map(slide => ({
      ...slide,
      title: pt(slide.title, slide.title),
    })),
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
  await AppTranslations.loadTranslations?.(fetchImpl);
  const response = await fetchImpl(buildPresentationManifestPath(designation), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load presentation manifest for ${designation}.`);
  }

  const payload = await response.json();
  return normalizePresentationManifest(payload, designation);
}

function bootstrapPresentationPage() {
  AppTranslations.loadTranslations?.().catch(() => {});
  const stageEl = document.getElementById("presentation-stage");
  const frameEl = document.getElementById("presentation-frame");
  const playFlyoverEl = document.getElementById("presentation-play-flyover");
  const messageEl = document.getElementById("presentation-message");
  const messageTitleEl = document.getElementById("presentation-message-title");
  const messageCopyEl = document.getElementById("presentation-message-copy");
  const backBtn = document.getElementById("presentation-back-btn");
  const nextBtn = document.getElementById("presentation-next-btn");
  const pauseBtn = document.getElementById("presentation-pause-btn");
  const skipLink = document.getElementById("presentation-skip-link");
  const homeLink = document.getElementById("presentation-home-link");

  const state = {
    manifest: null,
    started: false,
    currentIndex: -1,
    cometTailPaused: false,
    introFlyoverPrimed: false,
  };

  const playFlyover = {
    resetTimer: 0,
    play() {
      if (!playFlyoverEl) return;
      if (this.resetTimer) window.clearTimeout(this.resetTimer);
      playFlyoverEl.classList.remove("is-active");
      void playFlyoverEl.offsetWidth;
      playFlyoverEl.classList.add("is-active");
      this.resetTimer = window.setTimeout(() => {
        playFlyoverEl.classList.remove("is-active");
        this.resetTimer = 0;
      }, 115250);
    },
    stop() {
      if (!playFlyoverEl) return;
      if (this.resetTimer) {
        window.clearTimeout(this.resetTimer);
        this.resetTimer = 0;
      }
      playFlyoverEl.classList.remove("is-active");
    },
  };

  function handlePresentationKeydown(event) {
    if (
      event.code === "Digit1" ||
      event.code === "Numpad1" ||
      event.key === "1"
    ) {
      event.preventDefault();
      moveBy(1);
      return;
    }

    if (event.key === "ArrowRight") moveBy(1);
    if (event.key === "ArrowLeft") moveBy(-1);
    if (event.key === "Escape") window.location.href = skipLink.href;
  }

  function attachFrameKeyHandler() {
    try {
      const frameDocument = frameEl.contentDocument;
      if (!frameDocument) return;
      frameDocument.addEventListener("keydown", handlePresentationKeydown);
    } catch (error) {
      console.warn("[presentation] Could not attach iframe keyboard handler.", error);
    }
  }

  function isCometTailSlide(slide) {
    return /slides\/3I\/comet_tail(?:\.html)?(?:[?#]|$)/.test(String(slide?.src || ""));
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
    nextBtn.disabled = !state.started;
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
    frameEl.title = slide.title || "Presentation slide";
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

    if (delta < 0) {
      state.introFlyoverPrimed = false;
    }

    if (delta > 0 && state.currentIndex === 0 && !state.introFlyoverPrimed) {
      state.introFlyoverPrimed = true;
      playFlyover.play();
      updateControls();
      return;
    }

    const nextIndex = state.currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= state.manifest.slides.length) return;

    state.currentIndex = nextIndex;
    state.introFlyoverPrimed = false;
    playFlyover.stop();
    updateStage();
  }

  backBtn.addEventListener("click", () => moveBy(-1));
  nextBtn.addEventListener("click", () => moveBy(1));
  pauseBtn.addEventListener("click", toggleCometTailPause);
  frameEl.addEventListener("load", attachFrameKeyHandler);
  window.addEventListener("message", event => {
    if (event.source !== frameEl.contentWindow) return;
    if (event.data?.type !== "comet-tail-pause-state") return;
    state.cometTailPaused = Boolean(event.data.paused);
    updatePauseButton();
  });
  document.addEventListener("keydown", handlePresentationKeydown);

  const designation = getDesignationFromUrl();
  loadPresentationManifest(window.fetch, designation)
    .then(manifest => {
      state.manifest = manifest;
      state.started = manifest.slides.length > 0;
      state.currentIndex = state.started ? 0 : -1;
      document.title = `${manifest.title} · ${pt("ui.presentation.pageTitleSuffix", "3i-web")}`;
      skipLink.href = manifest.mainHref;
      if (homeLink) homeLink.href = AppTranslations.withLangParam?.("index.html", presentationLocale) || "index.html";
      hideError();
      updateStage();
    })
    .catch(error => {
      console.warn("[presentation] Failed to load presentation manifest.", error);
      showError(
        pt("ui.presentation.unavailableTitle", "Presentation unavailable"),
        pt("ui.presentation.unavailableCopy", "The JSON manifest could not be loaded for this object yet.")
      );
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapPresentationPage, { once: true });
} else {
  bootstrapPresentationPage();
}
