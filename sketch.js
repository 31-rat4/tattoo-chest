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

let THEME = { bg: 0, fg: 255 };
let INVERT_BODIES = false;
let HIDE_SUN_STROKE = false;

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
  }

  draw() {
    push();
    fill(INVERT_BODIES ? THEME.bg : THEME.fg);
    noStroke();
    circle(this.x, this.y, this.diameter);
    pop();
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
    const dashLength = dotSize * 20;
    const strokeW = max(0.5, dotSize);
    const symbolGap = dotSize * 0.8;

    let angle = -HALF_PI;
    for (const letter of this.letters) {
      this.#drawRay(letter, angle, innerRadius, dotSize, dashLength, strokeW, symbolGap);
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

  #drawRay(letterMorse, angle, innerRadius, dotSize, dashLength, strokeW, symbolGap) {
    push();
    translate(this.x, this.y);
    rotate(angle);

    let offset = 0;
    for (const symbol of letterMorse) {
      if (symbol === ".") {
        fill(THEME.fg);
        noStroke();
        circle(innerRadius + offset + dotSize / 2, 0, dotSize);
        offset += dotSize + symbolGap;
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
    this.size = size;
    this.boundaryRadius = boundaryRadius;

    const h = size * Math.sqrt(3) / 2;
    this.top = { x, y: y - h * 2 / 3 };
    this.bottomLeft = { x: x - size / 2, y: y + h / 3 };
    this.bottomRight = { x: x + size / 2, y: y + h / 3 };

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
    fill(THEME.bg);
    stroke(THEME.fg);
    strokeWeight(2);
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
    stroke(THEME.fg);
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
    this.moon.draw();
    this.prism.draw();
  }
}

let tattoo;
let controlPanel;
let darkCheckbox, invertBodiesCheckbox, hideSunStrokeCheckbox;
let tiltSlider, aimSlider, baseNSlider, spreadSlider, moonScaleSlider, moonAngleSlider, moonOffsetSlider;
let tiltValue, aimValue, baseNValue, spreadValue, moonScaleValue, moonAngleValue, moonOffsetValue;

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
  darkCheckbox = createCheckbox(" Dark mode", true).parent(toggleRow);
  darkCheckbox.changed(applyTheme);
  invertBodiesCheckbox = createCheckbox(" Invert sun/moon", false).parent(toggleRow);
  invertBodiesCheckbox.changed(() => { INVERT_BODIES = invertBodiesCheckbox.checked(); });
  hideSunStrokeCheckbox = createCheckbox(" Hide sun outline", false).parent(toggleRow);
  hideSunStrokeCheckbox.changed(() => { HIDE_SUN_STROKE = hideSunStrokeCheckbox.checked(); });

  ({ slider: tiltSlider,      valueLabel: tiltValue }      = makeSlider(controlPanel, "Tilt (deg)",         -45,  45,   23,   1));
  ({ slider: aimSlider,       valueLabel: aimValue }       = makeSlider(controlPanel, "Aim fraction",       0.05, 0.95, 0.5,  0.01));
  ({ slider: baseNSlider,     valueLabel: baseNValue }     = makeSlider(controlPanel, "Base n",             1.30, 1.80, 1.500, 0.001));
  ({ slider: spreadSlider,    valueLabel: spreadValue }    = makeSlider(controlPanel, "Dispersion spread",  0,    0.15, 0.150, 0.001));
  ({ slider: moonScaleSlider, valueLabel: moonScaleValue } = makeSlider(controlPanel, "Moon scale",         0.1,  1.0,  0.8,  0.01));
  ({ slider: moonAngleSlider, valueLabel: moonAngleValue } = makeSlider(controlPanel, "Moon angle (deg)",   0,    360,  180,  1));
  ({ slider: moonOffsetSlider,valueLabel: moonOffsetValue }= makeSlider(controlPanel, "Moon offset",        -300, 300,  0,    1));

  applyTheme();
}

function applyTheme() {
  const dark = darkCheckbox.checked();
  THEME = dark ? { bg: 0, fg: 255 } : { bg: 255, fg: 0 };
  controlPanel.style("background", dark ? "#111" : "#eee");
  controlPanel.style("color", dark ? "#fff" : "#000");
}

function makeSlider(parent, label, mn, mx, val, step) {
  const row = createDiv()
    .parent(parent)
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "12px")
    .style("margin-bottom", "6px");
  createSpan(label).parent(row).style("min-width", "160px");
  const slider = createSlider(mn, mx, val, step).parent(row).style("flex", "1");
  const valueLabel = createSpan(val.toString()).parent(row).style("min-width", "60px").style("text-align", "right");
  return { slider, valueLabel };
}

function draw() {
  background(THEME.bg);
  tattoo.prism.update({
    tiltDeg:      tiltSlider.value(),
    aimFraction:  aimSlider.value(),
    baseN:        baseNSlider.value(),
    spread:       spreadSlider.value()
  });
  tattoo.setMoon(moonScaleSlider.value(), moonAngleSlider.value(), moonOffsetSlider.value());
  tiltValue.html(nf(tiltSlider.value(), 0, 0));
  aimValue.html(nf(aimSlider.value(), 0, 2));
  baseNValue.html(nf(baseNSlider.value(), 0, 3));
  spreadValue.html(nf(spreadSlider.value(), 0, 3));
  moonScaleValue.html(nf(moonScaleSlider.value(), 0, 2));
  moonAngleValue.html(nf(moonAngleSlider.value(), 0, 0));
  moonOffsetValue.html(nf(moonOffsetSlider.value(), 0, 0));
  tattoo.draw();
}
