/* A deterministic, dependency-free WebGL particle sculpture. */
const TAU = Math.PI * 2;
const LOOP_SECONDS = 11;
const MOTION_SPEED = .8;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (a, b, value) => { const n = clamp((value - a) / (b - a), 0, 1); return n * n * (3 - 2 * n); };

const vertexSource = `
precision highp float;
attribute vec3 aPosition;
attribute vec4 aData;
uniform vec2 uResolution;
uniform float uTime, uScale, uPixelRatio, uStorm, uCenter;
uniform mediump float uGlow;
varying mediump vec3 vColor;
varying mediump float vAlpha;
void main() {
  float seed = aData.x;
  float kind = aData.w;
  vec3 p = aPosition;
  float alpha = aData.z;
  float size = aData.y;
  vec3 color = vec3(1.0, .19, .30);
  if (kind < .5) {
    float pulse = 1.0 + .013 * sin(uTime * 2.0);
    p *= pulse;
    float right = smoothstep(-.6, .85, p.x);
    float waist = 1.0 - smoothstep(.35, 1.0, abs(p.y));
    float curl = uStorm * right;
    p.x += curl * (.15 * sin(p.y * 5.2 + uTime * 1.6) + .10 * sin(seed * 39.0 + uTime));
    p.y -= curl * (.14 + .14 * sin(p.x * 4.0 + uTime * 1.8));
    p.z += curl * .13 * sin(p.y * 5.0 + uTime * 1.9);
    p.x += .010 * sin(uTime * (1.2 + seed) + seed * 81.0);
    p.y += .009 * cos(uTime * 1.1 + seed * 133.0);
    float yaw = -.15 + .055 * sin(uTime * .65);
    p.xz = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw)) * p.xz;
    alpha *= 1.0 - uStorm * right * waist * .59;
    alpha *= .63 + .37 * pow(.5 + .5 * sin(uTime * (2.0 + seed * 2.0) + seed * 101.0), 2.0);
    color = mix(vec3(1.0, .045, .14), vec3(1.0, .19, .24), smoothstep(-.9, .95, aPosition.x));
    alpha *= mix(.72, 1.45, (1.0 - smoothstep(-.8, .65, aPosition.x)));
  } else if (kind < 1.5) {
    float angle = aPosition.x + uTime * (1.15 + seed * .6);
    float r = aPosition.z;
    p = vec3(cos(angle) * r, -1.35 + aPosition.y + .012 * sin(angle * 4.0 + uTime * 3.0), sin(angle) * r);
    alpha *= .7 + .3 * sin(seed * 167.0 + uTime * 4.0);
    color = vec3(1.0, .30, .34);
    alpha *= 1.05 + uStorm * .45;
    size *= 1.25;
  } else if (kind < 2.5) {
    float progress = fract(seed * 17.131 + uTime * (.20 + aPosition.z * .06));
    float height = (2.30 + aPosition.y * .4) * uStorm;
    float radius = (.56 * (1.0 - progress) + .19 * sin(progress * 3.14159)) * (.78 + aPosition.z * .28);
    float angle = seed * 71.0 + uTime * 2.0 + progress * (8.0 + aPosition.z * 3.0);
    p = vec3(cos(angle) * radius, -1.34 + progress * height, sin(angle) * radius);
    p.x += .045 * sin(progress * 24.0 + seed * 27.0);
    p.y += .04 * sin(progress * 21.0 + seed * 12.0);
    alpha *= uStorm * sin(progress * 3.14159);
    size *= 1.1;
    color = vec3(1.0, .48, .43);
  } else if (kind < 3.5) {
    p.y += .025 * sin(uTime * .6 + seed * 28.0);
    p.x += .016 * cos(uTime * .35 + seed * 18.0);
    alpha *= .4 + .6 * pow(.5 + .5 * sin(uTime * .9 + seed * 41.0), 3.0);
    color = vec3(1.0, .35, .42);
  } else {
    color = vec3(1.0, .55, .58);
  }
  // A gently elevated camera exposes the horizontal energy rings.
  float cameraPitch = .045;
  p.yz = mat2(cos(cameraPitch), -sin(cameraPitch), sin(cameraPitch), cos(cameraPitch)) * p.yz;
  float perspective = 4.6 / (4.6 - p.z);
  vec2 screen = vec2(p.x, p.y) * perspective * uScale;
  gl_Position = vec4(screen.x / (uResolution.x * .5), (screen.y + uCenter) / (uResolution.y * .5), 0., 1.);
  gl_PointSize = max(1.0, size * uPixelRatio * perspective * mix(1.0, 5.5, uGlow));
  vColor = color;
  vAlpha = alpha * mix(1.60, .16, uGlow);
}
`;
const fragmentSource = `
precision mediump float;
varying mediump vec3 vColor;
varying mediump float vAlpha;
uniform mediump float uGlow;
void main() {
  float r = length(gl_PointCoord - .5) * 2.0;
  if (r > 1.0) discard;
  float halo = exp(-4.0 * r * r) * (1.0 - smoothstep(.65, 1.0, r));
  float core = exp(-2.0 * r * r) * (1.0 - smoothstep(.74, 1.0, r));
  vec3 color = mix(vColor, vec3(1.0, .86, .80), .72 * (1.0 - uGlow));
  float alpha = mix(core, halo, uGlow) * vAlpha;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;
const lineVertexSource = `
precision highp float;
attribute vec3 aPosition;
attribute float aAlpha;
uniform vec2 uResolution;
uniform float uScale, uCenter;
uniform vec2 uOffset;
varying mediump float vAlpha;
void main() {
 vec3 p = aPosition;
 float tilt = .045;
 p.yz = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p.yz;
 float perspective = 4.6 / (4.6 - p.z);
 vec2 q = vec2(p.x, p.y) * perspective * uScale;
 gl_Position = vec4(q.x / (uResolution.x * .5), (q.y + uCenter) / (uResolution.y * .5), 0., 1.);
 gl_Position.xy += uOffset / uResolution * 2.0;
 vAlpha = aAlpha;
}
`;
const lineFragmentSource = `
precision mediump float;
varying mediump float vAlpha;
uniform mediump float uLineGlow;
void main() { float a = vAlpha * mix(1.35, .19, uLineGlow); gl_FragColor = vec4(mix(vec3(1.0, .73, .68), vec3(1.0, .035, .12), uLineGlow) * a, a); }
`;

function seededRandom(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function compileProgram(gl, vs, fs) {
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; };
  const vertex = compile(gl.VERTEX_SHADER, vs), fragment = compile(gl.FRAGMENT_SHADER, fs);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}
function heartOutline(t) {
  const curves = [
    [[0, .77], [.25, 1.10], [.80, 1.13], [1.0, .66]],
    [[1.0, .66], [1.26, .07], [.62, -.40], [0, -.96]],
    [[0, -.96], [-.62, -.40], [-1.26, .07], [-1.0, .66]],
    [[-1.0, .66], [-.80, 1.13], [-.25, 1.10], [0, .77]]
  ];
  const unit = ((t / TAU) % 1 + 1) % 1 * 4;
  const part = Math.floor(unit), f = unit - part, q = 1 - f;
  const c = curves[part];
  return [0, 1].map(axis => q*q*q*c[0][axis] + 3*q*q*f*c[1][axis] + 3*q*f*f*c[2][axis] + f*f*f*c[3][axis]);
}
function sceneLayout(canvas, dpr) {
  const bounds = canvas.getBoundingClientRect();
  const dedication = document.querySelector('.dedication')?.getBoundingClientRect();
  const music = document.querySelector('.music')?.getBoundingClientRect();
  const top = dedication ? dedication.bottom - bounds.top + 18 : Math.min(90, bounds.height * .12);
  const bottom = music ? music.top - bounds.top - 22 : bounds.height - Math.min(120, bounds.height * .15);
  const available = Math.max(70, bottom - top);
  const scale = Math.min(bounds.width / 2.65, available / 2.85);
  const center = (top + bottom) / 2 - .17 * scale;
  return { scale: scale * dpr, center: (bounds.height / 2 - center) * dpr };
}
function makeHeart(random, count) {
  const contour = [], lengths = [0];
  for (let i = 0; i <= 1200; i++) {
    const point = heartOutline(i / 1200 * TAU);
    if (i) lengths.push(lengths[i - 1] + Math.hypot(point[0] - contour[i - 1][0], point[1] - contour[i - 1][1]));
    contour.push(point);
  }
  const data = [];
  for (let i = 0; i < count; i++) {
    const distance = random() * lengths[lengths.length - 1];
    let lo = 0, hi = lengths.length - 1;
    while (hi - lo > 1) { const mid = lo + hi >> 1; if (lengths[mid] < distance) lo = mid; else hi = mid; }
    const f = (distance - lengths[lo]) / (lengths[hi] - lengths[lo]);
    const edgeX = contour[lo][0] * (1 - f) + contour[hi][0] * f;
    const edgeY = contour[lo][1] * (1 - f) + contour[hi][1] * f;
    const latitude = random() * Math.PI;
    const radius = Math.pow(Math.sin(latitude), .32);
    const thickness = .47;
    const shellNoise = (random() - .5) * .029;
    const x = edgeX * (radius + shellNoise) * 1.035;
    const y = edgeY * (radius + shellNoise);
    const z = Math.cos(latitude) * thickness * (.87 + .13 * Math.abs(edgeX)) + (random() - .5) * .025;
    const seed = random();
    const bright = .40 + random() * .65 + (x < -.6 ? .26 : 0);
    const size = 1.00 + Math.pow(random(), 2) * 1.80;
    data.push(x, y, z, seed, size, bright, 0);
  }
  return data;
}

export function startHeart(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return startCanvasFallback(canvas);
  const pointProgram = compileProgram(gl, vertexSource, fragmentSource);
  const lineProgram = compileProgram(gl, lineVertexSource, lineFragmentSource);
  const random = seededRandom(20260903);
  const mobile = matchMedia('(max-width: 700px)').matches;
  const particles = makeHeart(random, mobile ? 9300 : 14000);
  for (let i = 0; i < (mobile ? 1450 : 2200); i++) {
    const angle = random() * TAU;
    const r = .68 * Math.sqrt(random());
    particles.push(angle, (random() - .5) * .052, r, random(), .8 + random() * 1.55, .5 + random() * .65, 1);
  }
  for (let i = 0; i < (mobile ? 750 : 1300); i++) particles.push(random(), random(), random(), random(), .75 + random() * 1.8, .55 + random() * .7, 2);
  for (let i = 0; i < 220; i++) {
    const t = random() * TAU, r = .95 + random() * .20;
    particles.push(Math.pow(Math.sin(t), 3) * r, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2.5) / 14.5 * r, (random() - .5) * .6, random(), .6 + random() * 1.2, .17 + random() * .27, 3);
  }
  const particleBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particles), gl.STATIC_DRAW);
  const pointCount = particles.length / 7;
  const pointAttrs = { position: gl.getAttribLocation(pointProgram, 'aPosition'), data: gl.getAttribLocation(pointProgram, 'aData') };
  const uniform = (program, names) => Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
  const pointUniforms = uniform(pointProgram, ['uResolution', 'uTime', 'uScale', 'uPixelRatio', 'uStorm', 'uGlow', 'uCenter']);
  const lineUniforms = uniform(lineProgram, ['uResolution', 'uScale', 'uOffset', 'uLineGlow', 'uCenter']);
  const lineAttrs = { position: gl.getAttribLocation(lineProgram, 'aPosition'), alpha: gl.getAttribLocation(lineProgram, 'aAlpha') };
  const lineBuffer = gl.createBuffer();
  const headBuffer = gl.createBuffer();
  const headData = new Float32Array(512 * 7);
  let headOffset = 0;
  const lineData = new Float32Array(65536);
  const filaments = Array.from({ length: mobile ? 76 : 108 }, () => ({ phase: random(), angle: random() * TAU, speed: .15 + random() * .1, radius: .78 + random() * .32, length: .06 + random() * .13, wobble: random() * 12 }));
  const tassels = Array.from({ length: mobile ? 40 : 56 }, (_, index) => ({
    phase: random(), speed: .075 + random() * .035,
    side: (index + Math.floor(index / 4)) % 2 ? 1 : -1, spread: random(), centered: index % 4 === 0,
    length: .14 + random() * .12, seed: random() * TAU,
    depth: index % 6 === 0 && index % 4 !== 0 ? .18 : -.38 - random() * .45,
    foreground: index % 6 === 0 && index % 4 !== 0
  }));
  let width = 0, height = 0, scale = 0, center = 0, pixelRatio = 1, animationFrame = 0, destroyed = false;
  let running = true, elapsed = 0, previous = performance.now(), lineOffset = 0;
  gl.clearColor(.004, .002, .005, 1); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  function resize() {
    const rect = canvas.getBoundingClientRect();
    pixelRatio = Math.min(Math.max(devicePixelRatio || 1, 2), 3);
    width = Math.max(1, Math.round(rect.width * pixelRatio)); height = Math.max(1, Math.round(rect.height * pixelRatio));
    canvas.width = width; canvas.height = height;
    // At every aspect ratio the full heart and energy platform stay in frame.
    ({ scale, center } = sceneLayout(canvas, pixelRatio));
    gl.viewport(0, 0, width, height);
    render(elapsed);
  }
  function segment(a, b, opacityA, opacityB) {
    if (lineOffset + 8 > lineData.length) return;
    lineData[lineOffset++] = a[0]; lineData[lineOffset++] = a[1]; lineData[lineOffset++] = a[2]; lineData[lineOffset++] = opacityA;
    lineData[lineOffset++] = b[0]; lineData[lineOffset++] = b[1]; lineData[lineOffset++] = b[2]; lineData[lineOffset++] = opacityB;
  }
  function buildLines(t, storm) {
    lineOffset = 0; headOffset = 0;
    for (let ring = 0; ring < 11; ring++) {
      const radius = .55 + ring * .013;
      const start = t * (.9 + ring * .027) + ring * 1.51;
      const length = TAU * (.30 + .23 * Math.sin(ring * 1.7) ** 2);
      let previousPoint;
      for (let j = 0; j <= 60; j++) {
        const progress = j / 60;
        const angle = start + length * progress;
        const ripple = .012 * Math.sin(angle * 5 + t * 2 + ring);
        const point = [Math.cos(angle) * (radius + ripple), -1.35 + (ring - 5) * .008 + .008 * Math.sin(angle * 3 + t), Math.sin(angle) * (radius + ripple)];
        const opacity = Math.sin(Math.PI * progress) * (.32 + (ring % 3) * .14) * (1 + storm * .15);
        if (previousPoint) segment(previousPoint.point, point, previousPoint.opacity, opacity);
        previousPoint = { point, opacity };
      }
    }
    if (storm > .003) for (const filament of filaments) {
      const head = (filament.phase + t * filament.speed) % 1;
      let previousPoint;
      for (let j = 0; j <= 19; j++) {
        const progress = head - filament.length * (1 - j / 19);
        if (progress < 0) { previousPoint = null; continue; }
        const angle = filament.angle + t * 1.65 + progress * (7 + filament.wobble * .18) + .22 * Math.sin(progress * 12 + filament.wobble);
        const radius = (.56 * (1 - progress) + .19 * Math.sin(progress * Math.PI)) * filament.radius;
        const point = [Math.cos(angle) * radius + .075 * Math.sin(progress * 18 + filament.wobble), -1.34 + progress * (2.25 + .21 * Math.sin(filament.wobble)) * storm + .04 * Math.sin(progress * 21 + filament.wobble), Math.sin(angle) * radius + .04 * Math.cos(progress * 17 + filament.wobble)];
        const life = Math.sin(Math.PI * head);
        const opacity = Math.pow(j / 19, 2.5) * Math.sin(Math.PI * progress) * storm * .9 * life;
        if (j === 19) { headData.set([...point, 0, 2.4 + filament.radius, storm * life * .95, 4], headOffset); headOffset += 7; }
        if (previousPoint) segment(previousPoint.point, point, previousPoint.opacity, opacity);
        previousPoint = { point, opacity };
      }
    }
    // Falling tassels follow the continuous clock independently of the rising wave.
    // Both ends of every lifecycle become fully transparent before its position wraps.
    const edge = Math.min(1.60, width / (2 * scale) - .10);
    for (const tassel of tassels) {
      const head = (tassel.phase + t * tassel.speed) % 1;
      const life = ease(0, .15, head) * (1 - ease(.77, 1, head));
      const xBase = tassel.centered ? (tassel.spread * 2 - 1) * .85 : tassel.side * (.92 + Math.max(.08, edge - .92) * tassel.spread);
      const brightness = tassel.centered ? .42 : (tassel.foreground ? .78 : .64);
      for (let strand = 0; strand < 2; strand++) {
        let previousPoint;
        for (let j = 0; j <= 25; j++) {
          const along = j / 25;
          const progress = head - tassel.length * (1 - along);
          if (progress < 0) { previousPoint = null; continue; }
          const x = xBase + .05 * Math.sin(t * .53 + tassel.seed + progress * 7)
            + .023 * Math.sin(progress * 18 + tassel.seed) + (strand - .5) * .013;
          const y = 1.10 - 2.43 * Math.pow(progress, 1.1);
          const z = tassel.depth + .035 * Math.sin(progress * 9 + tassel.seed);
          const point = [x, y, z];
          const opacity = Math.pow(along, 2.0) * life * brightness * (strand ? .53 : 1);
          if (previousPoint) segment(previousPoint.point, point, previousPoint.opacity, opacity);
          previousPoint = { point, opacity };
          if (j === 25 && strand === 0) {
            headData.set([x, y, z, 0, 3.2, life * brightness * 1.4, 4], headOffset); headOffset += 7;
            // Two small companions make each falling head feel particulate.
            for (let spark = 0; spark < 2; spark++) {
              const drift = .035 + spark * .033;
              const flicker = .55 + .45 * Math.sin(t * 2 + tassel.seed + spark);
              headData.set([x + drift * Math.sin(t + tassel.seed + spark * 3), y + drift * 1.5, z - .03, 0, 1.0 + spark * .2, life * brightness * flicker * .6, 4], headOffset);
              headOffset += 7;
            }
          }
        }
      }
    }
    // Quiet expanding ripples add motion under the sculpture between the waves.
    for (let ripple = 0; ripple < 2; ripple++) {
      const progress = (t * .13 + ripple * .5) % 1;
      const radius = .57 + progress * .40;
      const life = Math.sin(Math.PI * progress) ** 2;
      let previousPoint;
      for (let j = 0; j <= 80; j++) {
        const angle = j / 80 * TAU;
        const point = [Math.cos(angle) * radius, -1.355, Math.sin(angle) * radius];
        if (previousPoint) segment(previousPoint, point, life * .15, life * .15);
        previousPoint = point;
      }
    }
    // A few subtle crossed glints on the bright left rim.
    for (let i = 0; i < 9; i++) {
      const flash = Math.pow(Math.max(0, Math.sin(t * (1.3 + i * .05) + i * 7.27)), 18);
      if (flash < .01) continue;
      const angle = Math.PI + .38 + i / 9 * 2.23;
      const contourPoint = heartOutline(angle);
      const x = contourPoint[0] * .96, y = contourPoint[1] * .98;
      const arm = (.018 + .008 * Math.sin(i * 3)) * flash;
      segment([x - arm, y - arm, .17], [x + arm, y + arm, .17], flash * .62, flash * .62);
      segment([x - arm, y + arm, .17], [x + arm, y - arm, .17], flash * .62, flash * .62);
    }
  }
  function render(seconds) {
    if (destroyed || gl.isContextLost()) return;
    // Only the invisible-at-boundaries energy envelope repeats. The sculpture never resets.
    const t = seconds * MOTION_SPEED;
    const phase = ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
    const storm = ease(1.4, 3.3, phase) * (1 - ease(5.1, 7.1, phase));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pointProgram); gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.enableVertexAttribArray(pointAttrs.position); gl.vertexAttribPointer(pointAttrs.position, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(pointAttrs.data); gl.vertexAttribPointer(pointAttrs.data, 4, gl.FLOAT, false, 28, 12);
    gl.uniform2f(pointUniforms.uResolution, width, height); gl.uniform1f(pointUniforms.uTime, t); gl.uniform1f(pointUniforms.uScale, scale); gl.uniform1f(pointUniforms.uCenter, center); gl.uniform1f(pointUniforms.uPixelRatio, pixelRatio * Math.min(1.2, scale / pixelRatio / 185)); gl.uniform1f(pointUniforms.uStorm, storm);
    gl.uniform1f(pointUniforms.uGlow, 1); gl.drawArrays(gl.POINTS, 0, pointCount);
    gl.uniform1f(pointUniforms.uGlow, 0); gl.drawArrays(gl.POINTS, 0, pointCount);
    gl.disableVertexAttribArray(pointAttrs.position); gl.disableVertexAttribArray(pointAttrs.data);
    buildLines(t, storm);
    gl.useProgram(lineProgram); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer); gl.bufferData(gl.ARRAY_BUFFER, lineData.subarray(0, lineOffset), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(lineAttrs.position); gl.vertexAttribPointer(lineAttrs.position, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(lineAttrs.alpha); gl.vertexAttribPointer(lineAttrs.alpha, 1, gl.FLOAT, false, 16, 12);
    gl.uniform2f(lineUniforms.uResolution, width, height); gl.uniform1f(lineUniforms.uScale, scale); gl.uniform1f(lineUniforms.uCenter, center);
    gl.uniform1f(lineUniforms.uLineGlow, 1);
    for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { gl.uniform2f(lineUniforms.uOffset, offset[0] * pixelRatio, offset[1] * pixelRatio); gl.drawArrays(gl.LINES, 0, lineOffset / 4); }
    gl.uniform1f(lineUniforms.uLineGlow, 0); gl.uniform2f(lineUniforms.uOffset, 0, 0); gl.drawArrays(gl.LINES, 0, lineOffset / 4);
    gl.disableVertexAttribArray(lineAttrs.position); gl.disableVertexAttribArray(lineAttrs.alpha);
    if (headOffset) {
      gl.useProgram(pointProgram); gl.bindBuffer(gl.ARRAY_BUFFER, headBuffer); gl.bufferData(gl.ARRAY_BUFFER, headData.subarray(0, headOffset), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pointAttrs.position); gl.vertexAttribPointer(pointAttrs.position, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(pointAttrs.data); gl.vertexAttribPointer(pointAttrs.data, 4, gl.FLOAT, false, 28, 12);
      gl.uniform1f(pointUniforms.uGlow, 1); gl.drawArrays(gl.POINTS, 0, headOffset / 7);
      gl.uniform1f(pointUniforms.uGlow, 0); gl.drawArrays(gl.POINTS, 0, headOffset / 7);
      gl.disableVertexAttribArray(pointAttrs.position); gl.disableVertexAttribArray(pointAttrs.data);
    }
  }
  function tick(now) {
    if (!running || destroyed) return;
    elapsed += Math.min(.1, (now - previous) / 1000); previous = now;
    render(elapsed); animationFrame = requestAnimationFrame(tick);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  resize(); animationFrame = requestAnimationFrame(tick);
  const api = {
    pause() { running = false; cancelAnimationFrame(animationFrame); },
    resume() { if (!running && !destroyed) { running = true; previous = performance.now(); animationFrame = requestAnimationFrame(tick); } },
    reset() { elapsed = 0; previous = performance.now(); render(elapsed); },
    setTime(seconds) { api.pause(); elapsed = Number(seconds) || 0; render(elapsed); },
    get time() { return elapsed; },
    get duration() { return LOOP_SECONDS / MOTION_SPEED; },
    get renderer() { return 'webgl'; },
    destroy() { api.pause(); destroyed = true; observer.disconnect(); gl.deleteBuffer(particleBuffer); gl.deleteBuffer(lineBuffer); gl.deleteBuffer(headBuffer); gl.deleteProgram(pointProgram); gl.deleteProgram(lineProgram); }
  };
  window.heartScene = api;
  return api;
}

// Devices without WebGL retain a lightweight animated version of the sculpture.
function startCanvasFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is not available.');
  const r = seededRandom(20260903), data = makeHeart(r, 2600);
  let frame = 0, running = true, elapsed = 0, last = performance.now();
  function render() {
    const bounds = canvas.getBoundingClientRect(), dpr = Math.min(Math.max(devicePixelRatio || 1, 2), 3);
    if (canvas.width !== Math.round(bounds.width * dpr) || canvas.height !== Math.round(bounds.height * dpr)) { canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr); }
    const w = canvas.width, h = canvas.height;
    const { scale, center } = sceneLayout(canvas, dpr);
    const origin = h / 2 - center;
    const t = elapsed * MOTION_SPEED;
    ctx.fillStyle = '#010001'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < data.length; i += 7) {
      const x = data[i], y = data[i + 1], z = data[i + 2], seed = data[i + 3];
      const alpha = (.3 + .45 * (Math.sin(t * 2 + seed * 70) + 1) / 2) * data[i + 5];
      ctx.fillStyle = `rgba(255,100,115,${alpha})`;
      ctx.fillRect(w / 2 + (x + .012 * Math.sin(t + seed * 19)) * scale, origin - (y * .999 - z * .045) * scale, data[i + 4] * dpr, data[i + 4] * dpr);
    }
    ctx.strokeStyle = '#ff929d'; ctx.lineWidth = .8 * dpr;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(w / 2, origin + scale * (1.30 + i * .008), scale * (.53 + i * .012), scale * (.12 + i * .002), 0, elapsed + i, elapsed + i + 4); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  function tick(now) { if (!running) return; elapsed += Math.min(.1, (now - last) / 1000); last = now; render(); frame = requestAnimationFrame(tick); }
  const api = { pause() { running = false; cancelAnimationFrame(frame); }, resume() { if (!running) { running = true; last = performance.now(); frame = requestAnimationFrame(tick); } }, reset() { elapsed = 0; render(); }, setTime(seconds) { api.pause(); elapsed = Number(seconds) || 0; render(); }, get time() { return elapsed; }, get duration() { return LOOP_SECONDS / MOTION_SPEED; }, get renderer() { return 'canvas2d'; }, destroy() { api.pause(); } };
  window.heartScene = api; frame = requestAnimationFrame(tick); return api;
}
