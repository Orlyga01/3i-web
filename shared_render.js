// ═══════════════════════════════════════════════════════════════
// SHARED RENDERING LIBRARY
// Common rendering helpers shared across the interactive viewer pages
// ═══════════════════════════════════════════════════════════════

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const AppTranslations = window.AppTranslations || {};
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// ── UTILS ─────────────────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const eio = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function lighten(h, a) {
  let r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + a)},${Math.min(255, g + a)},${Math.min(255, b + a)})`;
}
function darken(h, a) {
  let r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return `rgb(${Math.max(0, r - a)},${Math.max(0, g - a)},${Math.max(0, b - a)})`;
}

// ── 3D CAMERA (true orbiting) ──────────────────────────────────
let aEl = 90, aAz = 0, aDist = 1200, aTx = 0, aTy = 0, aTz = 0;

function buildCamera(el, az, dist, tx, ty, tz) {
  const elR = el * Math.PI / 180;
  const camX = tx + dist * Math.cos(elR) * Math.sin(az);
  const camY = ty + dist * Math.cos(elR) * (-Math.cos(az));
  const camZ = tz + dist * Math.sin(elR);
  const fx = tx - camX, fy = ty - camY, fz = tz - camZ;
  const fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const Fx = fx / fl, Fy = fy / fl, Fz = fz / fl;
  let ux = 0, uy = 0, uz = 1;
  if (Math.abs(el) > 88) { ux = Math.sin(az); uy = -Math.cos(az); uz = 0; }
  const Rx = Fy * uz - Fz * uy, Ry = Fz * ux - Fx * uz, Rz = Fx * uy - Fy * ux;
  const Rl = Math.sqrt(Rx * Rx + Ry * Ry + Rz * Rz) || 1;
  const rx = Rx / Rl, ry = Ry / Rl, rz = Rz / Rl;
  const Ux = ry * Fz - rz * Fy, Uy = rz * Fx - rx * Fz, Uz = rx * Fy - ry * Fx;
  return { camX, camY, camZ, Fx, Fy, Fz, rx, ry, rz, Ux, Uy, Uz };
}

const FOV = 560;
let CAM = buildCamera(90, 0, 1200, 0, 0, 0);

function project3(wx, wy, wz) {
  const { camX, camY, camZ, Fx, Fy, Fz, rx, ry, rz, Ux, Uy, Uz } = CAM;
  const dx = wx - camX, dy = wy - camY, dz = wz - camZ;
  const cx2 = dx * rx + dy * ry + dz * rz;
  const cy2 = dx * Ux + dy * Uy + dz * Uz;
  const cz2 = dx * Fx + dy * Fy + dz * Fz;
  const z = Math.max(cz2, 10);
  return { sx: canvas.width / 2 + cx2 * FOV / z, sy: canvas.height / 2 - cy2 * FOV / z, depth: cz2 };
}
function getScale(depth) { return FOV / Math.max(depth, 10); }

// ── STARS ─────────────────────────────────────────────────────
const stars = Array.from({ length: 900 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.4 + .2,
  b: Math.random() * .55 + .3
}));

function drawStars() {
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210,225,255,${s.b * .6})`;
    ctx.fill();
  }
}

// ── PLANETS ───────────────────────────────────────────────────
// Orbit radii at real scale: 1 AU = 175 px.
// Uranus kept at compressed value (background only).
const planets = [
  { name: 'Mercury', color: '#c0b0a0', r: 5,  orbit:   68, speed: .047, angle: .5 },  // 0.387 AU
  { name: 'Venus',   color: '#e8c87a', r: 8,  orbit:  127, speed: .035, angle: 1.2, texture: 'assets/venus.webp' },  // 0.723 AU
  { name: 'Earth',   color: '#4488cc', r: 9,  orbit:  175, speed: .029, angle: 2.1, texture: 'assets/earth.png' },  // 1.000 AU
  { name: 'Mars',    color: '#dd5533', r: 7,  orbit:  267, speed: .024, angle: 3.4, texture: 'assets/mars.png' },   // 1.524 AU
  { name: 'Jupiter', color: '#c8a060', r: 44, orbit:  910, speed: .013, angle: .8,  texture: 'assets/jupiter.gif' }, // 5.203 AU
  { name: 'Saturn',  color: '#d4b870', r: 18, orbit: 1669, speed: .009, angle: 4.2, ring: true, texture: 'assets/saturn.webp' }, // 9.537 AU
  { name: 'Uranus',  color: '#88ddee', r: 13, orbit:  608, speed: .006, angle: 1.9, texture: 'assets/uranus.png' }, // compressed (background)
];
const N_PLANETS = planets.length;

function getLocalizedPlanetName(name) {
  return AppTranslations.getPlanetName?.(
    name,
    AppTranslations.getLocaleFromSearch?.(window.location.search) || 'en'
  ) || name;
}

// Load planet textures
const planetTextures = {};
function loadPlanetTexture(planet) {
  if (planet.texture && !planetTextures[planet.name]) {
    const img = new Image();
    img.src = planet.texture;
    planetTextures[planet.name] = img;
  }
}
planets.forEach(loadPlanetTexture);

// Load comet texture
const sharedSpriteImageCache = new Map();

function getSharedSpriteImage(src) {
  const normalizedSrc = String(src || '').trim();
  if (!normalizedSrc) return null;

  const cached = sharedSpriteImageCache.get(normalizedSrc);
  if (cached) return cached;

  const image = new Image();
  image.src = normalizedSrc;
  sharedSpriteImageCache.set(normalizedSrc, image);
  return image;
}

const cometImage = getSharedSpriteImage('assets/comet.png');

function parseCometTint(col) {
  if (Array.isArray(col) && col.length >= 3) {
    return {
      r: clamp(Math.round(Number(col[0]) || 0), 0, 255),
      g: clamp(Math.round(Number(col[1]) || 0), 0, 255),
      b: clamp(Math.round(Number(col[2]) || 0), 0, 255),
    };
  }
  if (col && typeof col === 'object') {
    return {
      r: clamp(Math.round(Number(col.r) || 0), 0, 255),
      g: clamp(Math.round(Number(col.g) || 0), 0, 255),
      b: clamp(Math.round(Number(col.b) || 0), 0, 255),
    };
  }
  const raw = String(col || '180,220,255').split(',').map(v => Number(v.trim()));
  return {
    r: clamp(Math.round(raw[0] || 180), 0, 255),
    g: clamp(Math.round(raw[1] || 220), 0, 255),
    b: clamp(Math.round(raw[2] || 255), 0, 255),
  };
}

const cometVariantCache = new Map();

function createScratchCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  return el;
}

function getCometVariantCacheKey(image, tint) {
  return [
    image?.src || 'default',
    tint.r,
    tint.g,
    tint.b,
  ].join('|');
}

function getRecoloredCometImage(image, tint) {
  if (!image?.complete || !(image.naturalWidth > 0)) return image;

  const cacheKey = getCometVariantCacheKey(image, tint);
  const cached = cometVariantCache.get(cacheKey);
  if (cached) return cached;

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scratch = createScratchCanvas(width, height);
  const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  if (!scratchCtx) return image;

  scratchCtx.clearRect(0, 0, width, height);
  scratchCtx.drawImage(image, 0, 0, width, height);

  const imageData = scratchCtx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (!alpha) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Preserve the source sprite's luminance and brightest highlights so the
    // recolored image keeps its edges and inner detail instead of going flat.
    const sourceLuma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const sourcePeak = Math.max(r, g, b) / 255;
    const alphaFactor = alpha / 255;
    const shade = 0.12 + sourceLuma * 0.72 + sourcePeak * 0.34;
    const highlight = Math.pow(sourcePeak, 1.35) * 34 * alphaFactor;

    data[i] = clamp(Math.round(tint.r * shade + highlight), 0, 255);
    data[i + 1] = clamp(Math.round(tint.g * shade + highlight), 0, 255);
    data[i + 2] = clamp(Math.round(tint.b * shade + highlight), 0, 255);
  }

  scratchCtx.putImageData(imageData, 0, 0);
  cometVariantCache.set(cacheKey, scratch);
  return scratch;
}

function drawSpriteImage(targetCtx, drawable, x, y, width, height, alpha, sourceRect) {
  targetCtx.save();
  targetCtx.globalAlpha = alpha;
  if (sourceRect) {
    targetCtx.drawImage(
      drawable,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      x,
      y,
      width,
      height,
    );
  } else {
    targetCtx.drawImage(drawable, x, y, width, height);
  }
  targetCtx.restore();
}

function drawTintedSprite(targetCtx, image, x, y, width, height, alpha, tint, sourceRect) {
  const variant = getRecoloredCometImage(image, tint);
  drawSpriteImage(targetCtx, variant, x, y, width, height, alpha, sourceRect);
}

function drawCometBillboard(targetCtx, options = {}) {
  const {
    x = 0,
    y = 0,
    size = 80,
    rotationAngle = 0,
    alpha = 1,
    tint = parseCometTint(),
    image = cometImage,
    tailReveal = 1,
    tailRevealMode = 'default',
    tailRevealAngle = null,
    anchorX = 0.5,
    anchorY = 0.9,
    preserveSpriteColor = false,
    showCoreGlow = true,
    showNucleusGlow = true,
  } = options;

  if (image?.complete && image.naturalWidth > 0) {
    const reveal = eio(clamp(tailReveal, 0, 1));
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    const drawH = size;
    const drawW = drawH * (imgW / Math.max(imgH, 1));
    const anchorXpx = drawW * anchorX;
    const anchorYpx = drawH * anchorY;
    let srcY;
    let srcH;
    let destY;
    let destH;
    let clipRect = null;
    let clipPolygon = null;

    if (tailRevealMode === 'tail-start') {
      srcY = 0;
      srcH = imgH;
      destY = -anchorYpx;
      destH = drawH;
      const axisAngle = Number.isFinite(tailRevealAngle) ? tailRevealAngle : 0;
      const axisX = Math.cos(axisAngle);
      const axisY = Math.sin(axisAngle);
      const normalX = -axisY;
      const normalY = axisX;
      const diagonal = Math.hypot(drawW, drawH);
      const revealLength = Math.max(0, diagonal * reveal);
      const headPadding = Math.max(drawW, drawH) * 0.18;
      // Keep the reveal band wider than the rotated sprite bounds so the far
      // end of the tail is not cropped while the visible length grows.
      const halfWidth = diagonal;
      const startX = -axisX * headPadding;
      const startY = -axisY * headPadding;
      const endX = axisX * revealLength;
      const endY = axisY * revealLength;
      clipPolygon = [
        { x: startX + normalX * halfWidth, y: startY + normalY * halfWidth },
        { x: startX - normalX * halfWidth, y: startY - normalY * halfWidth },
        { x: endX - normalX * halfWidth, y: endY - normalY * halfWidth },
        { x: endX + normalX * halfWidth, y: endY + normalY * halfWidth },
      ];
    } else {
      const visibleFrac = lerp(0.2, 1, reveal);
      srcY = imgH * (1 - visibleFrac);
      srcH = imgH - srcY;
      destY = -anchorYpx + (srcY / imgH) * drawH;
      destH = drawH * visibleFrac;
    }

    const destX = -anchorXpx;

    if (preserveSpriteColor) {
      targetCtx.save();
      targetCtx.translate(x, y);
      targetCtx.rotate(rotationAngle);
      if (clipPolygon) {
        targetCtx.beginPath();
        targetCtx.moveTo(clipPolygon[0].x, clipPolygon[0].y);
        for (let i = 1; i < clipPolygon.length; i += 1) {
          targetCtx.lineTo(clipPolygon[i].x, clipPolygon[i].y);
        }
        targetCtx.closePath();
        targetCtx.clip();
      }
      if (clipRect) {
        targetCtx.beginPath();
        targetCtx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
        targetCtx.clip();
      }
      drawSpriteImage(
        targetCtx,
        image,
        destX,
        destY,
        drawW,
        destH,
        alpha,
        { x: 0, y: srcY, width: imgW, height: srcH }
      );
      targetCtx.restore();
      return;
    }

    targetCtx.save();
    targetCtx.translate(x, y);
    targetCtx.rotate(rotationAngle);
    if (clipPolygon) {
      targetCtx.beginPath();
      targetCtx.moveTo(clipPolygon[0].x, clipPolygon[0].y);
      for (let i = 1; i < clipPolygon.length; i += 1) {
        targetCtx.lineTo(clipPolygon[i].x, clipPolygon[i].y);
      }
      targetCtx.closePath();
      targetCtx.clip();
    }
    if (clipRect) {
      targetCtx.beginPath();
      targetCtx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
      targetCtx.clip();
    }
    if (showCoreGlow) {
      const coreGlowRadius = Math.max(size * (0.16 + reveal * 0.06), 10);
      const coreGlow = targetCtx.createRadialGradient(0, 0, 0, 0, 0, coreGlowRadius);
      coreGlow.addColorStop(0, `rgba(${tint.r},${tint.g},${tint.b},${0.32 * alpha})`);
      coreGlow.addColorStop(0.65, `rgba(${tint.r},${tint.g},${tint.b},${0.14 * alpha})`);
      coreGlow.addColorStop(1, `rgba(${tint.r},${tint.g},${tint.b},0)`);
      targetCtx.beginPath();
      targetCtx.arc(0, 0, coreGlowRadius, 0, Math.PI * 2);
      targetCtx.fillStyle = coreGlow;
      targetCtx.fill();
    }
    drawTintedSprite(
      targetCtx,
      image,
      destX,
      destY,
      drawW,
      destH,
      alpha,
      tint,
      { x: 0, y: srcY, width: imgW, height: srcH },
    );
    if (showNucleusGlow) {
      const nucleusRadius = Math.max(size * 0.06, 3.5);
      const nucleus = targetCtx.createRadialGradient(0, 0, 0, 0, 0, nucleusRadius);
      nucleus.addColorStop(0, `rgba(255,255,255,${Math.min(1, alpha)})`);
      nucleus.addColorStop(0.45, `rgba(${tint.r},${tint.g},${tint.b},${0.92 * alpha})`);
      nucleus.addColorStop(1, `rgba(${tint.r},${tint.g},${tint.b},0)`);
      targetCtx.beginPath();
      targetCtx.arc(0, 0, nucleusRadius, 0, Math.PI * 2);
      targetCtx.fillStyle = nucleus;
      targetCtx.fill();
    }
    targetCtx.restore();
    return;
  }

  if (showCoreGlow) {
    const glowSize = Math.max(size * 0.44, 12);
    const outerGlow = targetCtx.createRadialGradient(x, y, 0, x, y, glowSize);
    outerGlow.addColorStop(0, `rgba(${tint.r},${tint.g},${tint.b},${0.5 * alpha})`);
    outerGlow.addColorStop(0.3, `rgba(${tint.r},${tint.g},${tint.b},${0.3 * alpha})`);
    outerGlow.addColorStop(0.6, `rgba(${tint.r},${tint.g},${tint.b},${0.15 * alpha})`);
    outerGlow.addColorStop(1, `rgba(${tint.r},${tint.g},${tint.b},0)`);
    targetCtx.beginPath();
    targetCtx.arc(x, y, glowSize, 0, Math.PI * 2);
    targetCtx.fillStyle = outerGlow;
    targetCtx.fill();
  }

  if (showNucleusGlow) {
    const nucleusRadius = Math.max(size * 0.11, 3);
    const nucleus = targetCtx.createRadialGradient(x, y, 0, x, y, nucleusRadius);
    nucleus.addColorStop(0, `rgba(255,255,255,${alpha})`);
    nucleus.addColorStop(0.4, `rgba(${tint.r},${tint.g},${tint.b},${0.85 * alpha})`);
    nucleus.addColorStop(1, `rgba(${tint.r},${tint.g},${tint.b},0)`);
    targetCtx.beginPath();
    targetCtx.arc(x, y, nucleusRadius, 0, Math.PI * 2);
    targetCtx.fillStyle = nucleus;
    targetCtx.fill();
  }
}

function drawOrbit(p, alpha) {
  const N = 120;
  ctx.beginPath();
  let first = true;
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2;
    const { sx, sy } = project3(Math.cos(a) * p.orbit, Math.sin(a) * p.orbit, 0);
    first ? (ctx.moveTo(sx, sy), first = false) : ctx.lineTo(sx, sy);
  }
  ctx.strokeStyle = `rgba(180,210,255,${alpha})`;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

function drawPlanet(p, showLabel) {
  const wx = Math.cos(p.angle) * p.orbit, wy = Math.sin(p.angle) * p.orbit;
  const { sx, sy, depth } = project3(wx, wy, 0);
  if (depth < 5) return;
  const sc = getScale(depth), pr = Math.max(p.r * sc, 2);
  
  // If planet has a texture, render it
  if (p.texture && planetTextures[p.name] && planetTextures[p.name].complete) {
    const img = planetTextures[p.name];
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const squareSize = Math.min(imgW, imgH);
    const cropX = (imgW - squareSize) / 2;
    const cropY = (imgH - squareSize) / 2;

    if (p.ring) {
      // Ringed planet (Saturn): texture is landscape — rings extend left/right.
      // Draw at full aspect ratio using planet diameter as height,
      // so planet body stays at original size and rings show in full width.
      const drawH = pr * 2;
      const drawW = drawH * (imgW / imgH); // preserves aspect ratio
      ctx.save();
      ctx.drawImage(img, 0, 0, imgW, imgH,
                    sx - drawW / 2, sy - drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      // Spherical planet: subtle glow + circular clip to hide texture edges.
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 2.5);
      g.addColorStop(0, p.color + '44');
      g.addColorStop(1, p.color + '00');
      ctx.beginPath();
      ctx.arc(sx, sy, pr * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, pr * 0.95, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cropX, cropY, squareSize, squareSize,
                    sx - pr, sy - pr, pr * 2, pr * 2);
      ctx.restore();
    }
  } else {
    // Procedural rendering for planets without textures
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 3);
    g.addColorStop(0, p.color + '88');
    g.addColorStop(1, p.color + '00');
    ctx.beginPath();
    ctx.arc(sx, sy, pr * 3, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    const bg = ctx.createRadialGradient(sx - pr * .3, sy - pr * .3, pr * .05, sx, sy, pr);
    bg.addColorStop(0, lighten(p.color, 70));
    bg.addColorStop(1, darken(p.color, 50));
    ctx.beginPath();
    ctx.arc(sx, sy, pr, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  }
  
  if (p.ring && pr > 3 && !p.texture) {
    const N2 = 80, rIn = pr * 1.4, rOut = pr * 2.2;
    for (let ri = 0; ri < 2; ri++) {
      const rr = ri ? rOut : rIn;
      ctx.beginPath();
      let fst = true;
      for (let i = 0; i <= N2; i++) {
        const a = i / N2 * Math.PI * 2;
        const { sx: rx2, sy: ry2 } = project3(wx + Math.cos(a) * rr, wy + Math.sin(a) * rr, 0);
        fst ? (ctx.moveTo(rx2, ry2), fst = false) : ctx.lineTo(rx2, ry2);
      }
      ctx.strokeStyle = 'rgba(210,185,130,0.5)';
      ctx.lineWidth = ri ? pr * .4 : pr * .2;
      ctx.stroke();
    }
  }
  if (showLabel && sc > 0.3) {
    ctx.fillStyle = 'rgba(215,230,255,.9)';
    ctx.font = Math.max(9, 10 * sc) + 'px Georgia';
    ctx.textAlign = 'center';
    // Ringed textured planets: label clears the planet body (rings extend sideways)
    const labelOffset = pr + 5;
    ctx.fillText(getLocalizedPlanetName(p.name), sx, sy - labelOffset);
  }
}

function drawSun() {
  const { sx, sy, depth } = project3(0, 0, 0);
  if (depth < 5) return;
  const sc = getScale(depth), sr = 30 * sc;
  for (let i = 3; i > 0; i--) {
    const g = ctx.createRadialGradient(sx, sy, sr * .3, sx, sy, sr * (1 + i));
    g.addColorStop(0, `rgba(255,210,60,${.1 / i})`);
    g.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.beginPath();
    ctx.arc(sx, sy, sr * (1 + i), 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  const sg = ctx.createRadialGradient(sx - sr * .2, sy - sr * .2, sr * .05, sx, sy, sr);
  sg.addColorStop(0, '#fffef8');
  sg.addColorStop(.3, '#ffe855');
  sg.addColorStop(1, '#ff7200');
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fillStyle = sg;
  ctx.fill();
}

// ── ECLIPTIC PLANE ────────────────────────────────────────────
let planeFlash = { x: 0, y: 0, strength: 0 };

function drawEclipticPlane() {
  const elAbs = Math.abs(aEl);
  const showFactor = clamp((90 - elAbs) / 75, 0, 1);
  if (showFactor < 0.01) return;
  const outerR = Math.max(...planets.map(p => p.orbit)) * 1.15;
  const N = 200;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    pts.push(project3(Math.cos(a) * outerR, Math.sin(a) * outerR, 0));
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < N; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  const sf = showFactor;
  ctx.fillStyle = `rgba(155,205,255,${sf * 0.30})`;
  ctx.fill();
  const { sx: cx, sy: cy } = project3(0, 0, 0);
  const diskR = Math.hypot(pts[0].sx - cx, pts[0].sy - cy);
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < N; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  ctx.clip();
  const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, diskR);
  inner.addColorStop(0, `rgba(210,230,255,${sf * 0.20})`);
  inner.addColorStop(0.5, `rgba(180,215,255,${sf * 0.08})`);
  inner.addColorStop(1, `rgba(150,200,255,0)`);
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < N; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  ctx.strokeStyle = `rgba(180,220,255,${sf * 0.70})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPlaneFlash() {
  if (planeFlash.strength < 0.02) return;
  const { sx: px, sy: py, depth } = project3(planeFlash.x, planeFlash.y, 0);
  const sc = getScale(depth), fs = planeFlash.strength;
  const fr = clamp(110 * sc, 25, 220);
  const fg = ctx.createRadialGradient(px, py, 0, px, py, fr);
  fg.addColorStop(0, `rgba(255,255,180,${fs})`);
  fg.addColorStop(.12, `rgba(255,230,80,${fs * .92})`);
  fg.addColorStop(.3, `rgba(255,140,40,${fs * .7})`);
  fg.addColorStop(.55, `rgba(180,80,255,${fs * .4})`);
  fg.addColorStop(1, `rgba(80,60,255,0)`);
  ctx.beginPath();
  ctx.arc(px, py, fr, 0, Math.PI * 2);
  ctx.fillStyle = fg;
  ctx.fill();
  for (let r = 1; r <= 5; r++) {
    ctx.beginPath();
    ctx.arc(px, py, r * fr * .25, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,230,100,${fs * Math.max(0, 1 - r * .18)})`;
    ctx.lineWidth = 3 - r * .4;
    ctx.stroke();
  }
}

// ── COMET DRAW ────────────────────────────────────────────────
function drawComet(wx, wy, wz, alpha, col, options = {}) {
  const tint = parseCometTint(col);
  const {
    sizeMultiplier = 1,
    tailReveal = 1,
    tailRevealMode = 'default',
    tailRevealAngle,
    image = cometImage,
    anchorX,
    anchorY,
    imageBaseTailAngle = -Math.PI / 2,
    alignToSun = true,
    tailDirectionSign = 1,
    rotationOffset = 0,
    preserveSpriteColor = false,
    showCoreGlow = true,
    showNucleusGlow = true,
  } = options;
  const { sx, sy, depth } = project3(wx, wy, wz);
  if (depth < 5) return;
  const sc = getScale(depth);
  
  // If comet image is loaded, use it
  if (image.complete && image.naturalWidth > 0) {
    let rotationAngle = rotationOffset;
    if (alignToSun) {
      // Rotate the sprite so its built-in tail direction lines up with the
      // requested Sun-relative direction for this object.
      const d3 = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
      const directionSign = Number(tailDirectionSign) < 0 ? -1 : 1;
      const tailDirX = (wx / d3) * directionSign;
      const tailDirY = (wy / d3) * directionSign;
      const tailDirZ = (wz / d3) * directionSign;
      
      // Project that target tail direction into screen space to rotate the sprite.
      const pointLen = 100;
      const { sx: tailSx, sy: tailSy } = project3(
        wx + tailDirX * pointLen,
        wy + tailDirY * pointLen,
        wz + tailDirZ * pointLen,
      );
      const screenAngle = Math.atan2(tailSy - sy, tailSx - sx);
      rotationAngle += screenAngle - imageBaseTailAngle;
    }
    
    // The sprite is tall, so treat `size` as the on-screen height.
    const cometSize = 125 * sc * sizeMultiplier;
    
    drawCometBillboard(ctx, {
      x: sx,
      y: sy,
      size: cometSize,
      rotationAngle,
      alpha,
      tint,
      image,
      tailReveal,
      tailRevealMode,
      tailRevealAngle,
      preserveSpriteColor,
      showCoreGlow,
      showNucleusGlow,
      ...(anchorX !== undefined && { anchorX }),
      ...(anchorY !== undefined && { anchorY }),
    });
  } else {
    drawCometBillboard(ctx, {
      x: sx,
      y: sy,
      size: 125 * sc * sizeMultiplier,
      rotationAngle: rotationOffset,
      alpha,
      tint,
      image,
      tailReveal,
      tailRevealMode,
      tailRevealAngle,
      preserveSpriteColor,
      showCoreGlow,
      showNucleusGlow,
      ...(anchorX !== undefined && { anchorX }),
      ...(anchorY !== undefined && { anchorY }),
    });
  }
}

window.drawCometBillboard = drawCometBillboard;
window.parseCometTint = parseCometTint;
window.getSharedSpriteImage = getSharedSpriteImage;