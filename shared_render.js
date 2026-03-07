// ═══════════════════════════════════════════════════════════════
// SHARED RENDERING LIBRARY
// Common functions used by both solar_comet and atlas_journey
// ═══════════════════════════════════════════════════════════════

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
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
const planets = [
  { name: 'Mercury', color: '#c0b0a0', r: 5, orbit: 72, speed: .047, angle: .5 },
  { name: 'Venus', color: '#e8c87a', r: 8, orbit: 118, speed: .035, angle: 1.2 },
  { name: 'Earth', color: '#4488cc', r: 9, orbit: 170, speed: .029, angle: 2.1, texture: 'assets/earth.png' },
  { name: 'Mars', color: '#dd5533', r: 7, orbit: 235, speed: .024, angle: 3.4 },
  { name: 'Jupiter', color: '#c8a060', r: 44, orbit: 365, speed: .013, angle: .8, texture: 'assets/jupiter.gif' },
  { name: 'Saturn', color: '#d4b870', r: 18, orbit: 488, speed: .009, angle: 4.2, ring: true },
  { name: 'Uranus', color: '#88ddee', r: 13, orbit: 608, speed: .006, angle: 1.9 },
];
const N_PLANETS = planets.length;

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
const cometImage = new Image();
cometImage.src = 'assets/green_aura_transparent.png';

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
    
    // Draw glow
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 2.5);
    g.addColorStop(0, p.color + '44');
    g.addColorStop(1, p.color + '00');
    ctx.beginPath();
    ctx.arc(sx, sy, pr * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    
    // Draw planet with texture - use a smaller clip circle to avoid black edges
    const clipRadius = pr * 0.95; // Clip slightly smaller
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, clipRadius, 0, Math.PI * 2);
    ctx.clip();
    
    // Calculate how much to crop from left and right to make it square
    const squareSize = Math.min(imgW, imgH);
    const cropX = (imgW - squareSize) / 2;
    const cropY = (imgH - squareSize) / 2;
    
    // Draw texture at full size
    ctx.drawImage(
      img,
      cropX, cropY, squareSize, squareSize,  // source: center square crop
      sx - pr, sy - pr, pr * 2, pr * 2       // destination: fit to planet
    );
    
    ctx.restore();
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
  
  if (p.ring && pr > 3) {
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
    ctx.fillText(p.name, sx, sy - pr - 5);
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
  const outerR = planets[N_PLANETS - 1].orbit;
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
function drawComet(wx, wy, wz, alpha, col) {
  col = col || '180,220,255';
  const { sx, sy, depth } = project3(wx, wy, wz);
  if (depth < 5) return;
  const sc = getScale(depth);
  
  // If comet image is loaded, use it
  if (cometImage.complete && cometImage.naturalWidth > 0) {
    // Calculate direction TOWARD Sun (at origin 0,0,0)
    const d3 = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
    const sunDirX = -wx / d3;  // normalized direction toward sun
    const sunDirY = -wy / d3;
    
    // Project sun direction to screen space to get rotation angle
    const pointLen = 100;
    const { sx: sunSx, sy: sunSy } = project3(wx + sunDirX * pointLen, wy + sunDirY * pointLen, wz);
    const screenAngle = Math.atan2(sunSy - sy, sunSx - sx);
    
    // The image has tail at right-bottom corner (315 degrees or -45 degrees)
    // Adding 90 degrees correction based on user feedback
    const imageBaseTailAngle = (-45 + 90) * Math.PI / 180;
    const rotationAngle = screenAngle - imageBaseTailAngle;
    
    // Size of the comet image on screen
    const cometSize = 80 * sc;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy);
    ctx.rotate(rotationAngle);
    ctx.drawImage(cometImage, -cometSize/2, -cometSize/2, cometSize, cometSize);
    ctx.restore();
  } else {
    // Fallback: Draw procedural comet if image not loaded
    const glowSize = 35 * sc;
    const outerGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowSize);
    outerGlow.addColorStop(0, `rgba(${col},${.5 * alpha})`);
    outerGlow.addColorStop(0.3, `rgba(${col},${.3 * alpha})`);
    outerGlow.addColorStop(0.6, `rgba(${col},${.15 * alpha})`);
    outerGlow.addColorStop(1, `rgba(${col},0)`);
    ctx.beginPath();
    ctx.arc(sx, sy, glowSize, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();
    
    const ng = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9 * sc);
    ng.addColorStop(0, `rgba(255,255,255,${alpha})`);
    ng.addColorStop(.4, `rgba(${col},${.85 * alpha})`);
    ng.addColorStop(1, `rgba(${col},0)`);
    ctx.beginPath();
    ctx.arc(sx, sy, 9 * sc, 0, Math.PI * 2);
    ctx.fillStyle = ng;
    ctx.fill();
  }
}
