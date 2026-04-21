const MORSE = {
  A: ".-",    B: "-...",  C: "-.-.",  D: "-..",   E: ".",
  F: "..-.",  G: "--.",   H: "....",  I: "..",    J: ".---",
  K: "-.-",   L: ".-..",  M: "--",    N: "-.",    O: "---",
  P: ".--.",  Q: "--.-",  R: ".-.",   S: "...",   T: "-",
  U: "..-",   V: "...-",  W: ".--",   X: "-..-",  Y: "-.--",
  Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----."
};

let THEME = { bg: 255, fg: 0 };
let INVERT_BODIES = true;
let HIDE_SUN_STROKE = true;
let SHOW_FRACTAL = false;
let SHOW_EYE = true;

class MorseEncoder {
  static encode(text) {
    return text
      .toUpperCase()
      .split(" ")
      .map(word =>
        word
          .split("")
          .map(ch => MORSE[ch] || "")
          .filter(code => code.length > 0)
          .join(" ")
      )
      .filter(word => word.length > 0)
      .join(" / ");
  }
}

class Moon {
  constructor(x, y, diameter) {
    this.x = x;
    this.y = y;
    this.diameter = diameter;
    this.fractalBuffer = null;
    this.bufferKey = null;
    this.fractalZoom = 1.0;
  }

  setFractalZoom(zoom) {
    this.fractalZoom = zoom;
  }

  drawFill() {
    const moonFill = INVERT_BODIES ? THEME.bg : THEME.fg;
    push();
    fill(moonFill);
    noStroke();
    circle(this.x, this.y, this.diameter);
    pop();
  }

  drawFractal() {
    if (!SHOW_FRACTAL) return;
    const contrast = INVERT_BODIES ? THEME.fg : THEME.bg;
    this.#ensureBuffer(contrast);
    push();
    imageMode(CORNER);
    const r = this.diameter / 2;
    image(this.fractalBuffer, this.x - r, this.y - r, this.diameter, this.diameter);
    pop();
  }

  draw() {
    this.drawFill();
    this.drawFractal();
  }

  #ensureBuffer(contrast) {
    const key = `${contrast}|${this.fractalZoom}`;
    if (this.bufferKey === key && this.fractalBuffer) return;
    this.bufferKey = key;

    const SIZE = 256;
    const MAX_ITER = 100;
    const halfWidth = 1.5 / this.fractalZoom;
    const buf = createGraphics(SIZE, SIZE);
    buf.pixelDensity(1);
    buf.loadPixels();

    const half = SIZE / 2;
    for (let j = 0; j < SIZE; j++) {
      for (let i = 0; i < SIZE; i++) {
        const idx = 4 * (j * SIZE + i);
        const dx = (i - half + 0.5) / half;
        const dy = (j - half + 0.5) / half;

        if (dx * dx + dy * dy > 1) {
          buf.pixels[idx + 3] = 0;
          continue;
        }

        // Center the set's visual midpoint (-0.5, 0) on the moon's center.
        const cx = -0.5 + halfWidth * dx;
        const cy = halfWidth * dy;

        let zx = 0, zy = 0, iter = 0;
        while (zx * zx + zy * zy < 4 && iter < MAX_ITER) {
          const tmp = zx * zx - zy * zy + cx;
          zy = 2 * zx * zy + cy;
          zx = tmp;
          iter++;
        }

        if (iter === MAX_ITER) {
          buf.pixels[idx]     = contrast;
          buf.pixels[idx + 1] = contrast;
          buf.pixels[idx + 2] = contrast;
          buf.pixels[idx + 3] = 255;
        } else {
          buf.pixels[idx + 3] = 0;
        }
      }
    }
    buf.updatePixels();
    this.fractalBuffer = buf;
  }
}

class Sun {
  constructor(x, y, diameter, message) {
    this.x = x;
    this.y = y;
    this.diameter = diameter;
    this.message = message;
    this.letters = this.#encodeLetters(message);
    this.rayGap = 10;
    this.packingFactor = 0.55;

    // Morse ray styling — all multipliers relative to the auto-sized dotSize.
    this.dashLengthMul = 20;   // dash length = dotSize * dashLengthMul
    this.strokeWMul    = 1.0;  // stroke weight = dotSize * strokeWMul
    this.symbolGapMul  = 0.8;  // gap between symbols = dotSize * symbolGapMul
    this.dotAsLine     = false;
    this.dotLineLenMul = 0.5;  // when dotAsLine, dot becomes a line of length dotSize * this
  }

  draw() {
    this.drawBody();
    this.drawRays();
  }

  drawBody() {
    push();
    if (INVERT_BODIES) {
      fill(THEME.fg);
      noStroke();
      circle(this.x, this.y, this.diameter);
    } else if (!HIDE_SUN_STROKE) {
      noFill();
      stroke(THEME.fg);
      strokeWeight(2);
      circle(this.x, this.y, this.diameter);
    }
    pop();
  }

  drawRays() {
    if (this.letters.length === 0) return;

    const anglePerRay = TWO_PI / this.letters.length;
    const innerRadius = this.diameter / 2 + this.rayGap;

    const arcPerRay = anglePerRay * innerRadius;
    const dotSize = arcPerRay * this.packingFactor;
    const dashLength = dotSize * this.dashLengthMul;
    const strokeW = max(0.5, dotSize * this.strokeWMul);
    const symbolGap = dotSize * this.symbolGapMul;
    const dotLineLen = dotSize * this.dotLineLenMul;

    let angle = -HALF_PI;
    for (const letter of this.letters) {
      this.#drawRay(letter, angle, innerRadius, dotSize, dashLength, strokeW, symbolGap, dotLineLen);
      angle += anglePerRay;
    }
  }

  #encodeLetters(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .split("")
      .map(ch => MORSE[ch])
      .filter(code => code !== undefined);
  }

  #drawRay(letterMorse, angle, innerRadius, dotSize, dashLength, strokeW, symbolGap, dotLineLen) {
    push();
    translate(this.x, this.y);
    rotate(angle);

    let offset = 0;
    for (const symbol of letterMorse) {
      if (symbol === ".") {
        if (this.dotAsLine) {
          stroke(THEME.fg);
          strokeWeight(strokeW);
          noFill();
          line(innerRadius + offset, 0, innerRadius + offset + dotLineLen, 0);
          offset += dotLineLen + symbolGap;
        } else {
          fill(THEME.fg);
          noStroke();
          circle(innerRadius + offset + dotSize / 2, 0, dotSize);
          offset += dotSize + symbolGap;
        }
      } else if (symbol === "-") {
        stroke(THEME.fg);
        strokeWeight(strokeW);
        noFill();
        line(innerRadius + offset, 0, innerRadius + offset + dashLength, 0);
        offset += dashLength + symbolGap;
      }
    }
    pop();
  }
}

class Prism {
  constructor(x, y, size, boundaryRadius) {
    this.x = x;
    this.y = y;
    this.boundaryRadius = boundaryRadius;
    this.#recomputeGeometry(size);

    // Tilt of the incoming ray, in degrees. The "incoming angle" points from the
    // entry point BACK toward the source; travel direction is the opposite.
    this.tiltDeg = 23;
    this.aimFraction = 0.5; // where on the left face the laser hits (0 = top, 1 = bottomLeft)

    this.baseN = 1.500;
    this.spread = 0.150;  // dispersion: n(violet) − n(red)

    this.spectrumColors = [
      [255, 0, 0],
      [255, 127, 0],
      [255, 255, 0],
      [0, 255, 0],
      [0, 127, 255],
      [75, 0, 180],
      [148, 0, 211]
    ];

    this.#recomputeSpectrum();
  }

  get incomingAngle() {
    return PI - radians(this.tiltDeg);
  }

  setSize(size) {
    if (size === this.size) return;
    this.#recomputeGeometry(size);
  }

  #recomputeGeometry(size) {
    this.size = size;
    const h = size * Math.sqrt(3) / 2;
    this.top = { x: this.x, y: this.y - h * 2 / 3 };
    this.bottomLeft = { x: this.x - size / 2, y: this.y + h / 3 };
    this.bottomRight = { x: this.x + size / 2, y: this.y + h / 3 };
  }

  update({ tiltDeg, aimFraction, baseN, spread }) {
    if (tiltDeg !== undefined) this.tiltDeg = tiltDeg;
    if (aimFraction !== undefined) this.aimFraction = aimFraction;
    const nChanged = (baseN !== undefined && baseN !== this.baseN) ||
                     (spread !== undefined && spread !== this.spread);
    if (baseN !== undefined) this.baseN = baseN;
    if (spread !== undefined) this.spread = spread;
    if (nChanged) this.#recomputeSpectrum();
  }

  #recomputeSpectrum() {
    // Upsample the anchor palette so the rainbow fan reads as a smooth gradient.
    const samples = 40;
    const anchors = this.spectrumColors;
    const lastAnchor = anchors.length - 1;
    this.spectrum = [];
    for (let i = 0; i < samples; i++) {
      const t = samples === 1 ? 0 : i / (samples - 1);
      const pos = t * lastAnchor;
      const idx = Math.min(Math.floor(pos), lastAnchor - 1);
      const frac = pos - idx;
      const a = anchors[idx], b = anchors[idx + 1];
      const color = [
        a[0] + (b[0] - a[0]) * frac,
        a[1] + (b[1] - a[1]) * frac,
        a[2] + (b[2] - a[2]) * frac
      ];
      const n = this.baseN - this.spread / 2 + t * this.spread;
      this.spectrum.push({ color, n });
    }
  }

  draw() {
    this.#drawIncomingLight();
    this.#drawBody();
    this.#drawDispersion();
  }

  #drawBody() {
    push();
    fill(INVERT_BODIES ? THEME.fg : THEME.bg);
    noStroke();
    triangle(
      this.top.x, this.top.y,
      this.bottomLeft.x, this.bottomLeft.y,
      this.bottomRight.x, this.bottomRight.y
    );
    pop();
  }

  #aimPoint() {
    return {
      x: lerp(this.top.x, this.bottomLeft.x, this.aimFraction),
      y: lerp(this.top.y, this.bottomLeft.y, this.aimFraction)
    };
  }

  #laserDir() {
    // Travel direction = opposite of incomingAngle (which points backward to source).
    return { x: -cos(this.incomingAngle), y: -sin(this.incomingAngle) };
  }

  #drawIncomingLight() {
    const aim = this.#aimPoint();
    const backDir = { x: cos(this.incomingAngle), y: sin(this.incomingAngle) };
    const origin = this.#rayToBoundary(aim, backDir);
    push();
    stroke(INVERT_BODIES ? THEME.fg : THEME.bg);
    strokeWeight(2);
    line(origin.x, origin.y, aim.x, aim.y);
    pop();
  }

  #drawDispersion() {
    const entry = this.#aimPoint();
    const laserDir = this.#laserDir();
    const N_left = this.#outwardNormal(this.top, this.bottomLeft);
    const N_right = this.#outwardNormal(this.top, this.bottomRight);
    const N_bottom = this.#outwardNormal(this.bottomLeft, this.bottomRight);

    const traces = this.spectrum.map(({ color, n }) => ({
      color,
      trace: this.#traceColor(entry, laserDir, n, N_left, N_right, N_bottom)
    }));

    push();

    // Pass 1: internal segments in the foreground color (dispersion is tiny
    // inside glass — the colors nearly overlap, reading as a single refraction wedge).
    stroke(INVERT_BODIES ? THEME.bg : THEME.fg);
    strokeWeight(2);
    noFill();
    for (const { trace } of traces) {
      if (!trace) continue;
      line(entry.x, entry.y, trace.exit.x, trace.exit.y);
    }

    // Pass 2: external fan as filled quads between consecutive samples —
    // gives a continuous gradient with no black gaps between colors.
    noStroke();
    for (let i = 0; i < traces.length - 1; i++) {
      const a = traces[i], b = traces[i + 1];
      if (!a.trace || !a.trace.externalEnd) continue;
      if (!b.trace || !b.trace.externalEnd) continue;
      fill(
        (a.color[0] + b.color[0]) / 2,
        (a.color[1] + b.color[1]) / 2,
        (a.color[2] + b.color[2]) / 2
      );
      quad(
        a.trace.exit.x, a.trace.exit.y,
        b.trace.exit.x, b.trace.exit.y,
        b.trace.externalEnd.x, b.trace.externalEnd.y,
        a.trace.externalEnd.x, a.trace.externalEnd.y
      );
    }
    pop();
  }

  // Traces a single wavelength through the prism using Snell's law.
  // Returns { entry, exit, externalEnd } or null if the ray misses or TIRs.
  #traceColor(entry, laserDir, n, N_left, N_right, N_bottom) {
    // --- Entry refraction: air → glass at left face ---
    // N must point against the incident ray. N_left is outward (into air).
    const internalDir = this.#refract(laserDir, N_left, 1 / n);
    if (!internalDir) return null;

    // --- Travel through glass: find which face the ray hits first ---
    const hitRight = this.#segmentIntersect(entry, internalDir, this.top, this.bottomRight);
    const hitBottom = this.#segmentIntersect(entry, internalDir, this.bottomLeft, this.bottomRight);

    let exit, N_exit_out;
    if (hitRight && (!hitBottom || hitRight.t < hitBottom.t)) {
      exit = hitRight.point;
      N_exit_out = N_right;
    } else if (hitBottom) {
      exit = hitBottom.point;
      N_exit_out = N_bottom;
    } else {
      return null;
    }

    // --- Exit refraction: glass → air ---
    // Inside the glass, N must point into glass (inward = opposite of outward).
    const N_exit_in = { x: -N_exit_out.x, y: -N_exit_out.y };
    const externalDir = this.#refract(internalDir, N_exit_in, n);
    if (!externalDir) return { entry, exit, externalEnd: null }; // total internal reflection

    const externalEnd = this.#rayToBoundary(exit, externalDir);
    return { entry, exit, externalEnd };
  }

  // 2D Snell's law. `I` is the incident unit direction, `N` is the unit normal
  // pointing INTO the medium the ray is currently in (so I·N < 0). `eta` = n1/n2.
  // Returns the refracted unit direction, or null on total internal reflection.
  #refract(I, N, eta) {
    const cosI = -(I.x * N.x + I.y * N.y);
    const sinT2 = eta * eta * (1 - cosI * cosI);
    if (sinT2 > 1) return null;
    const cosT = Math.sqrt(1 - sinT2);
    const k = eta * cosI - cosT;
    return { x: eta * I.x + k * N.x, y: eta * I.y + k * N.y };
  }

  // Ray/segment intersection. Returns { point, t, s } where t is the distance
  // along the ray and s ∈ [0,1] is the position along the segment. null if miss.
  #segmentIntersect(origin, dir, a, b) {
    const dx1 = dir.x, dy1 = dir.y;
    const dx2 = b.x - a.x, dy2 = b.y - a.y;
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 1e-9) return null;
    const ox = a.x - origin.x, oy = a.y - origin.y;
    const t = (ox * dy2 - oy * dx2) / det;
    const s = (ox * dy1 - oy * dx1) / det;
    if (t <= 1e-6 || s < 0 || s > 1) return null;
    return { point: { x: origin.x + dx1 * t, y: origin.y + dy1 * t }, t, s };
  }

  // Outward unit normal of the face (a → b), pointing away from the prism centroid.
  #outwardNormal(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    let nrm = { x: dy / len, y: -dx / len };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const toCenter = { x: this.x - mid.x, y: this.y - mid.y };
    if (nrm.x * toCenter.x + nrm.y * toCenter.y > 0) {
      nrm = { x: -nrm.x, y: -nrm.y };
    }
    return nrm;
  }

  // Ray-circle intersection: from `origin` in direction `dir`, returns the point
  // where the ray hits the sun boundary circle.
  #rayToBoundary(origin, dir) {
    const ox = origin.x - this.x;
    const oy = origin.y - this.y;
    const b = 2 * (dir.x * ox + dir.y * oy);
    const c = ox * ox + oy * oy - this.boundaryRadius * this.boundaryRadius;
    const disc = b * b - 4 * c;
    if (disc < 0) return { x: origin.x, y: origin.y };
    const t = (-b + Math.sqrt(disc)) / 2;
    return { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
  }
}

// SVG path data from Wikimedia Commons' Eye of Horus (wedjat, left eye).
// viewBox 187×140; coordinates are in SVG space.
// Each subpath: start [x, y], then an array of cubic bezier control-point
// triplets [cp1x, cp1y, cp2x, cp2y, endX, endY].
// https://commons.wikimedia.org/wiki/File:Eye_of_Horus.svg
const EYE_OF_HORUS_SVG = {
  width: 187,
  height: 140,
  subpaths: [
    // Main figure: almond outline + tail + cheek curl
    {
      start: [127.26613, 136.21927],
      beziers: [
        [124.97297, 127.94136, 119.75427, 119.85215, 122.40056, 110.75228],
        [124.88439, 101.95864, 126.86488, 92.998797, 131.00515, 84.767464],
        [133.12454, 78.735762, 137.10291, 72.3992, 139.03438, 67.113077],
        [141.28689, 64.089153, 140.7503, 62.213386, 138.49372, 62.749089],
        [135.64951, 66.029929, 127.07839, 71.567078, 121.85098, 75.583414],
        [113.94393, 81.20854, 107.08337, 88.165032, 99.599458, 94.241496],
        [95.200294, 98.450588, 89.39493, 101.36234, 84.275988, 104.86309],
        [72.684043, 112.59908, 59.795201, 119.15258, 45.705092, 120.35077],
        [37.368307, 122.30886, 27.876615, 120.6206, 20.320609, 116.62717],
        [10.837767, 111.66197, 5.7096554, 100.42701, 5.6144329, 90.053499],
        [6.3119461, 82.975759, 13.042575, 77.8754, 19.27215, 75.54405],
        [26.399931, 74.271276, 35.836228, 74.576379, 39.65404, 81.87592],
        [44.705034, 87.033303, 42.185261, 97.398645, 34.547005, 98.126196],
        [25.800969, 100.89185, 24.834709, 88.908247, 23.200196, 84.549029],
        [15.929521, 86.039935, 12.153054, 99.206424, 17.40463, 103.61004],
        [25.658454, 112.8362, 39.211904, 111.65079, 50.181063, 109.40689],
        [59.716359, 106.81456, 69.380626, 103.51384, 77.599461, 97.960516],
        [87.814533, 90.143316, 99.078904, 83.668088, 108.47392, 74.810814],
        [111.63978, 72.33639, 121.05801, 68.528116, 111.5303, 68.436852],
        [103.95304, 68.896513, 96.448059, 71.178264, 88.877754, 69.556831],
        [80.46938, 69.394801, 72.400056, 67.253382, 64.288999, 65.387412],
        [53.488146, 61.592775, 42.811559, 57.407924, 31.579246, 55.006132],
        [24.480858, 52.356327, 16.454573, 52.846157, 9.5311269, 50.672017],
        [7.3066441, 46.476532, 4.2812394, 36.33164, 13.013821, 39.004774],
        [22.758974, 40.55662, 31.739091, 35.556285, 41.166967, 34.192393],
        [55.186547, 30.483206, 69.039994, 25.725865, 83.634461, 24.821469],
        [93.450666, 23.677707, 103.30454, 25.515122, 113.09707, 26.254629],
        [128.68867, 29.281258, 143.4852, 35.347272, 158.64041, 39.996956],
        [163.25729, 41.978583, 168.3661, 40.210857, 173.22268, 40.3656],
        [175.64312, 40.841572, 179.6413, 38.656107, 180.84683, 41.181469],
        [183.49568, 45.219378, 185.31244, 51.843876, 177.99949, 49.877999],
        [168.05599, 50.525988, 157.27634, 53.100457, 150.07097, 60.380133],
        [145.74486, 65.463324, 146.84442, 74.986546, 146.82446, 79.433706],
        [151.83352, 83.888033, 158.3444, 84.948494, 164.15111, 87.606287],
        [161.11529, 92.57722, 153.45783, 95.519579, 149.77631, 101.05378],
        [142.28854, 110.07433, 130.77761, 117.4817, 129.18786, 129.96657],
        [128.70247, 131.1818, 129.775, 137.43711, 127.26613, 136.21927]
      ]
    },
    // Iris lens (inner eye band)
    {
      start: [107.09946, 60.468544],
      beziers: [
        [119.74905, 58.243447, 132.61984, 55.887148, 144.36557, 50.595372],
        [148.1459, 50.511716, 156.57777, 46.677676, 148.1919, 46.018132],
        [137.00778, 43.733812, 126.86026, 38.15044, 115.69087, 35.726755],
        [107.60263, 32.079384, 111.20064, 46.109582, 104.01782, 48.100352],
        [96.116633, 53.324709, 83.771196, 47.803683, 83.676385, 37.965503],
        [84.240949, 34.068567, 79.979349, 36.38685, 77.701591, 36.150307],
        [65.897482, 37.787609, 54.627772, 41.978846, 43.01743, 44.592432],
        [41.251259, 45.557945, 33.02216, 46.026942, 38.524996, 47.622282],
        [45.933222, 51.137148, 53.460754, 54.632814, 61.423146, 56.361783],
        [74.330438, 60.490735, 88.029099, 59.698419, 101.29584, 61.474297],
        [103.25581, 61.296278, 105.15154, 60.732925, 107.09946, 60.468544]
      ]
    },
    // Eyebrow
    {
      start: [10.592381, 31.377407],
      beziers: [
        [7.7816619, 24.648203, 10.858085, 14.200774, 19.943797, 17.505408],
        [27.501836, 19.342405, 34.079844, 15.015062, 41.509097, 14.894692],
        [49.884979, 12.190503, 58.377445, 9.1329834, 67.291801, 7.8196492],
        [74.759558, 5.8567934, 83.223253, 5.9561385, 89.849458, 4.3439022],
        [99.909624, 5.9156764, 110.35952, 4.7238551, 120.23904, 7.3105083],
        [126.34003, 8.4066921, 132.00261, 10.613634, 138.39907, 12.469884],
        [144.6358, 14.966754, 151.27783, 16.634649, 157.75332, 18.453131],
        [165.22435, 21.667934, 173.33902, 19.729578, 180.94658, 18.717995],
        [189.54565, 22.612541, 182.81334, 32.246544, 175.33475, 31.614487],
        [165.25189, 32.303269, 155.41447, 28.675179, 145.74672, 26.229128],
        [137.09134, 23.209856, 128.56282, 19.665081, 119.33696, 18.758069],
        [106.23027, 15.955514, 92.611643, 14.459921, 79.388372, 17.390954],
        [64.039368, 18.751208, 49.630129, 24.500527, 35.475054, 30.18651],
        [27.493491, 31.917031, 18.370344, 34.039397, 10.592381, 31.377407]
      ]
    }
  ]
};

class EyeOfHorus {
  constructor(cx, cy, size) {
    this.cx = cx;
    this.cy = cy;
    this.size = size;
  }

  setPosition(cx, cy) {
    this.cx = cx;
    this.cy = cy;
  }

  setSize(size) {
    this.size = size;
  }

  // Draws the wedjat (left Eye of Horus) from its SVG path, centered at (cx, cy).
  // The three subpaths — outline+tail+cheek, iris lens, eyebrow — are rendered as
  // filled shapes. When inverted, colors flip to stay readable against the prism.
  draw() {
    if (!SHOW_EYE) return;
    const color = INVERT_BODIES ? THEME.bg : THEME.fg;
    const svg = EYE_OF_HORUS_SVG;
    const s = this.size / svg.width;

    push();
    translate(this.cx, this.cy);
    scale(s);
    translate(-svg.width / 2, -svg.height / 2);

    fill(color);
    noStroke();

    const [main, iris, brow] = svg.subpaths;

    // Main figure with iris lens as an inner contour (cutout). The contour must
    // wind opposite to the outer path; the SVG's subpath 2 is already reversed.
    beginShape();
    vertex(main.start[0], main.start[1]);
    for (const b of main.beziers) {
      bezierVertex(b[0], b[1], b[2], b[3], b[4], b[5]);
    }
    beginContour();
    vertex(iris.start[0], iris.start[1]);
    for (const b of iris.beziers) {
      bezierVertex(b[0], b[1], b[2], b[3], b[4], b[5]);
    }
    endContour();
    endShape(CLOSE);

    // Eyebrow as a separate filled shape above the eye.
    beginShape();
    vertex(brow.start[0], brow.start[1]);
    for (const b of brow.beziers) {
      bezierVertex(b[0], b[1], b[2], b[3], b[4], b[5]);
    }
    endShape(CLOSE);

    pop();
  }
}

class CelestialTattoo {
  constructor(cx, cy, size, message) {
    this.cx = cx;
    this.cy = cy;
    this.sunDiameter = size;
    const initialMoonScale = 0.8;
    const moonDiameter = size * initialMoonScale;
    const moonOffset = (size - moonDiameter) / 2;
    const prismSize = moonDiameter * 0.5;

    this.sun = new Sun(cx, cy, size, message);
    this.moon = new Moon(cx - moonOffset, cy, moonDiameter);
    this.prism = new Prism(cx, cy, prismSize, size / 2);
    this.eye = new EyeOfHorus(cx, cy, prismSize * 0.4);
  }

  setPrismSize(fraction) {
    const size = this.sunDiameter * fraction;
    this.prism.setSize(size);
    this.eye.setSize(size * 0.4);
  }

  setMoon(scale, angleDeg, offset) {
    const moonDiameter = this.sunDiameter * scale;
    const tangentOffset = (this.sunDiameter - moonDiameter) / 2;
    const radius = tangentOffset + offset;
    const a = radians(angleDeg);
    this.moon.x = this.cx + radius * Math.cos(a);
    this.moon.y = this.cy + radius * Math.sin(a);
    this.moon.diameter = moonDiameter;
  }

  draw() {
    this.sun.draw();
    this.moon.drawFill();
    this.moon.drawFractal();
    this.prism.draw();
    this.eye.draw();
  }
}

let tattoo;
let controlPanel;
let darkCheckbox, invertBodiesCheckbox, hideSunStrokeCheckbox, fractalCheckbox, eyeCheckbox;
let tiltSlider, aimSlider, baseNSlider, spreadSlider, prismSizeSlider, moonScaleSlider, moonAngleSlider, moonOffsetSlider, fractalZoomSlider;
let tiltValue, aimValue, baseNValue, spreadValue, prismSizeValue, moonScaleValue, moonAngleValue, moonOffsetValue, fractalZoomValue;
let dashLengthSlider, strokeWSlider, symbolGapSlider, dotLineLenSlider;
let dashLengthValue, strokeWValue, symbolGapValue, dotLineLenValue;
let dotAsLineCheckbox;

const PRAYER = `Senhor, fazei-me instrumento de vossa paz
Onde houver ódio, que eu leve o amor
Onde houver ofensa, que eu leve o perdão
Onde houver discórdia, que eu leve união
Onde houver dúvida, que eu leve a fé

Onde houver erro, que eu leve a verdade
Onde houver desespero, que eu leve a esperança
Onde houver tristeza, que eu leve alegria
Onde houver trevas, que eu leve a luz

Ó mestre, fazei que eu procure mais consolar que ser consolado
Compreender que ser compreendido
Amar que ser amado
Pois é dando que se recebe
É perdoando que se é perdoado
E é morrendo que se vive
Para a vida eterna`;

function setup() {
  createCanvas(600, 600);
  const size = min(width, height) * 0.6;
  tattoo = new CelestialTattoo(width / 2, height / 2, size, PRAYER);
  createControls();
}

function createControls() {
  controlPanel = createDiv()
    .style("padding", "12px")
    .style("font-family", "monospace")
    .style("width", "600px")
    .style("box-sizing", "border-box");

  const toggleRow = createDiv()
    .parent(controlPanel)
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "18px")
    .style("flex-wrap", "wrap")
    .style("margin-bottom", "10px");
  darkCheckbox = createCheckbox(" Dark mode", false).parent(toggleRow);
  darkCheckbox.changed(applyTheme);
  invertBodiesCheckbox = createCheckbox(" Invert sun/moon", true).parent(toggleRow);
  invertBodiesCheckbox.changed(() => { INVERT_BODIES = invertBodiesCheckbox.checked(); });
  hideSunStrokeCheckbox = createCheckbox(" Hide sun outline", true).parent(toggleRow);
  hideSunStrokeCheckbox.changed(() => { HIDE_SUN_STROKE = hideSunStrokeCheckbox.checked(); });
  fractalCheckbox = createCheckbox(" Fractal", false).parent(toggleRow);
  fractalCheckbox.changed(() => { SHOW_FRACTAL = fractalCheckbox.checked(); });
  eyeCheckbox = createCheckbox(" Eye of Horus", true).parent(toggleRow);
  eyeCheckbox.changed(() => { SHOW_EYE = eyeCheckbox.checked(); });

  makeSection(controlPanel, "Prism");
  ({ slider: tiltSlider,       input: tiltValue }       = makeControl(controlPanel, "Tilt (deg)",         -45,  45,   23,    1));
  ({ slider: aimSlider,        input: aimValue }        = makeControl(controlPanel, "Aim fraction",       0.05, 0.95, 0.5,   0.01));
  ({ slider: baseNSlider,      input: baseNValue }      = makeControl(controlPanel, "Base n",             1.30, 1.80, 1.500, 0.001));
  ({ slider: spreadSlider,     input: spreadValue }     = makeControl(controlPanel, "Dispersion spread",  0,    0.15, 0.150, 0.001));
  ({ slider: prismSizeSlider,  input: prismSizeValue }  = makeControl(controlPanel, "Size",               0.05, 0.8,  0.4,   0.01));

  makeSection(controlPanel, "Moon");
  ({ slider: moonScaleSlider,  input: moonScaleValue }  = makeControl(controlPanel, "Scale",              0.1,  1.0,  0.8,   0.01));
  ({ slider: moonAngleSlider,  input: moonAngleValue }  = makeControl(controlPanel, "Angle (deg)",        0,    360,  270,   1));
  ({ slider: moonOffsetSlider, input: moonOffsetValue } = makeControl(controlPanel, "Offset",             -300, 300,  9,     1));

  makeSection(controlPanel, "Fractal");
  ({ slider: fractalZoomSlider, input: fractalZoomValue } = makeControl(controlPanel, "Zoom",             0.3,  4.0,  1.0,   0.01));

  makeSection(controlPanel, "Morse Ray");
  const morseCheckRow = createDiv().parent(controlPanel).style("margin-bottom", "8px");
  dotAsLineCheckbox = createCheckbox(" Dot as line", false).parent(morseCheckRow);
  dotAsLineCheckbox.changed(() => { tattoo.sun.dotAsLine = dotAsLineCheckbox.checked(); });
  ({ slider: dashLengthSlider, input: dashLengthValue } = makeControl(controlPanel, "Dash length",          1,   40,  20,   0.1));
  ({ slider: strokeWSlider,    input: strokeWValue }    = makeControl(controlPanel, "Stroke weight",        0.1, 3,   1.0,  0.05));
  ({ slider: symbolGapSlider,  input: symbolGapValue }  = makeControl(controlPanel, "Symbol gap",           0,   10,  0.8,  0.05));
  ({ slider: dotLineLenSlider, input: dotLineLenValue } = makeControl(controlPanel, "Dot length (as line)", 0.1, 10,  0.5,  0.05));

  applyTheme();
}

function applyTheme() {
  const dark = darkCheckbox.checked();
  THEME = dark ? { bg: 0, fg: 255 } : { bg: 255, fg: 0 };
  controlPanel.style("background", dark ? "#111" : "#eee");
  controlPanel.style("color", dark ? "#fff" : "#000");
}

function makeSection(parent, label) {
  createDiv(label)
    .parent(parent)
    .style("font-weight", "bold")
    .style("margin-top", "14px")
    .style("margin-bottom", "6px")
    .style("opacity", "0.6")
    .style("font-size", "11px")
    .style("text-transform", "uppercase")
    .style("letter-spacing", "1.5px");
}

function makeControl(parent, label, mn, mx, val, step) {
  const row = createDiv()
    .parent(parent)
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "12px")
    .style("margin-bottom", "6px");
  createSpan(label).parent(row).style("min-width", "160px");
  const slider = createSlider(mn, mx, val, step).parent(row).style("flex", "1");
  const input = createInput(val.toString())
    .parent(row)
    .attribute("type", "number")
    .attribute("min", mn)
    .attribute("max", mx)
    .attribute("step", step)
    .style("width", "70px")
    .style("text-align", "right")
    .style("background", "transparent")
    .style("color", "inherit")
    .style("border", "1px solid currentColor")
    .style("border-radius", "3px")
    .style("font-family", "monospace")
    .style("padding", "2px 6px");

  slider.input(() => { input.value(slider.value()); });
  input.input(() => {
    const v = parseFloat(input.value());
    if (!isNaN(v)) slider.value(v);
  });
  return { slider, input };
}

function draw() {
  background(THEME.bg);
  tattoo.prism.update({
    tiltDeg:      tiltSlider.value(),
    aimFraction:  aimSlider.value(),
    baseN:        baseNSlider.value(),
    spread:       spreadSlider.value()
  });
  tattoo.setPrismSize(prismSizeSlider.value());
  tattoo.setMoon(moonScaleSlider.value(), moonAngleSlider.value(), moonOffsetSlider.value());
  tattoo.moon.setFractalZoom(fractalZoomSlider.value());
  tattoo.sun.dashLengthMul = dashLengthSlider.value();
  tattoo.sun.strokeWMul    = strokeWSlider.value();
  tattoo.sun.symbolGapMul  = symbolGapSlider.value();
  tattoo.sun.dotLineLenMul = dotLineLenSlider.value();
  tattoo.draw();
}

function keyPressed() {
  if (key === "s" || key === "S") saveCanvas("tattoo", "png");
}
