// C/2025 N1 (ATLAS) - Real JPL Horizons Trajectory Data
// Source: JPL Horizons System (2026-Mar-06)
// Orbital elements: e=6.14, q=1.356 AU, i=175.1° (retrograde)
// Perihelion: 2025-Oct-29

// Heliocentric ecliptic coordinates converted from JPL data
// km → AU (÷149597870.7) → animation pixels (×175)
// Scale: 1 AU ≈ 175 px
const ATLAS_PATH = [
  // frac   wx    wy    wz   — heliocentric ecliptic coordinates (px)
  [0.00,   48, -787,  51],  // Jul 01, 2025: Discovery, 4.5 AU
  [0.06,   12, -701,  47],  // Jul 16
  [0.12,  -25, -615,  43],  // Jul 31
  [0.18,  -61, -527,  39],  // Aug 15
  [0.24,  -97, -439,  35],  // Aug 30
  [0.29, -133, -348,  30],  // Sep 14
  [0.35, -168, -256,  26],  // Sep 29
  [0.39, -201, -160,  21],  // Oct 14
  [0.42, -229,  -61,  16],  // Oct 29: PERIHELION 1.356 AU
  [0.46, -252,   40,  10],  // Nov 13
  [0.51, -269,  140,   5],  // Nov 28
  [0.55, -283,  238,  -1],  // Dec 13
  [0.60, -294,  334,  -7],  // Dec 28: Earth closest ~1.8 AU
  [0.65, -305,  429, -13],  // Jan 12, 2026
  [0.70, -315,  524, -19],  // Jan 27
  [0.76, -324,  617, -25],  // Feb 11
  [0.82, -333,  710, -30],  // Feb 26
  [0.88, -342,  802, -36],  // Mar 13
  [1.00, -360,  920, -45],  // Mar 16: Jupiter flyby (extrapolated)
];

// Key event fractions based on real JPL data
const AT_ENTRY = 0.00;        // Jul 1, 2025 - Discovery
const AT_MARS = 0.37;          // Oct 3, 2025 - Mars close approach (0.194 AU)
const AT_PERIHELION = 0.42;    // Oct 29, 2025 - Perihelion (1.356 AU)
const AT_EARTH = 0.60;         // Dec 19, 2025 - Earth closest (1.8 AU)
const AT_JUPITER = 0.95;       // Mar 16, 2026 - Jupiter flyby (0.36 AU)

// Per-scene frac ranges for animation
const SC_FRAC = [
  [0.00, 0.00],  // Scene 0: ecliptic plane view (no 3I yet)
  [0.00, 0.00],  // Scene 1: zoom to plane edge (no 3I yet)
  [0.00, 0.35],  // Scene 2: spot 3I/ATLAS (Jul 1 - Sep 30)
  [0.35, 0.41],  // Scene 3: entering system POV (Oct 1 - Oct 28)
  [0.37, 0.52],  // Scene 4: Mars flyby + Perihelion (Oct 3 - Nov 30)
  [0.52, 0.70],  // Scene 5: outbound, Earth alignment (Dec 1 - Jan 31)
  [0.70, 1.00],  // Scene 6: Jupiter flyby, exit (Feb 1 - Mar 16)
];

// Convert atlasFrac to actual calendar date
// Jul 1, 2025 (frac=0.00) to Mar 16, 2026 (frac=1.00) = 258 days
function fracToDate(frac) {
  const startDate = new Date(2025, 6, 1); // July 1, 2025 (month is 0-indexed)
  const days = frac * 258; // 258 days total
  const date = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}
