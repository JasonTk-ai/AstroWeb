/* ==========================================================================
   Astro Fluid — fondo iridiscente + estrella de vidrio interactiva (WebGL)
   Sin dependencias. Uso:
     <canvas class="hero-fluid" id="heroFluid" aria-hidden="true"></canvas>
     <script src="astro-fluid.js"></script>
     <script>AstroFluid.init(document.getElementById('heroFluid'), { palette: 'aurora' });</script>
   ========================================================================== */
(function (global) {
  'use strict';

  const PALETTES = {
    // Paleta de marca Astro: negro -> teal profundo -> menta -> azul cielo -> lavanda
    aurora:   ['#030509', '#0b2730', '#2D7D8A', '#5FEAD4', '#B8C8F0'],
    // Más nocturna y fría: azul noche, azul glow, lavanda
    nocturno: ['#030409', '#141a2e', '#3a4f8f', '#A6DAFF', '#E8ECF4'],
    // Menta + un toque cálido (ámbar) para contraste tipo monopo
    eclipse:  ['#040506', '#0e2624', '#3d8a7a', '#d9a866', '#f1dcb4'],
  };

  const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;      // espacio uv con aspecto corregido
uniform vec2  uStar;       // centro de la estrella
uniform float uStarR;      // radio
uniform float uStarRot;    // rotación
uniform float uPulse;      // 0..1 al hacer click
uniform vec3  uC0, uC1, uC2, uC3, uC4;

// --- Simplex noise 2D (Ashima Arts, MIT) ---
vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.6;
  for (int i = 0; i < 3; i++){ v += a * snoise(p); p = p * 1.7 + 3.1; a *= 0.45; }
  return v;
}

// Paleta: valor 0..1 -> color, con zonas oscuras dominantes (look editorial)
vec3 palette(float x, float glow){
  vec3 c = mix(uC0, uC1, smoothstep(0.34, 0.56, x));
  c = mix(c, uC2, smoothstep(0.54, 0.72, x));
  c = mix(c, uC3, smoothstep(0.72, 0.9, x) * 0.85);
  c = mix(c, uC4, smoothstep(0.84, 1.0, x) * (0.35 + 0.4 * glow));
  return c;
}

// Campo de "luz líquida" (domain warping)
vec3 field(vec2 uv){
  float t = uTime * 0.035;
  vec2 p = uv * 0.62;

  // empuje suave alrededor del cursor
  vec2 dm = uv - uMouse;
  float md = exp(-dot(dm, dm) * 5.0);
  p += dm * md * 0.22;

  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.8));
  vec2 r = vec2(fbm(p + 0.9 * q + vec2(1.7, 9.2) + t * 0.6),
                fbm(p + 0.9 * q + vec2(8.3, 2.8) - t * 0.5));
  float f = fbm(p + 0.8 * r);
  float x = clamp(f * 0.75 + 0.48, 0.0, 1.0);
  return palette(x, clamp(length(r), 0.0, 1.0));
}

// Estrella de 4 puntas (forma astroide, como un destello)
float starShape(vec2 p){
  float c = cos(uStarRot), s = sin(uStarRot);
  p = mat2(c, -s, s, c) * p / uStarR;
  float n = 0.6;                               // <1 = puntas cóncavas
  vec2 a = sqrt(p * p + 0.0009);                // abs() suavizado: sin costuras
  return pow(pow(a.x, n) + pow(a.y, n), 1.0 / n); // 0 centro, 1 borde
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;        // aspecto corregido
  vec3 col = field(uv);

  // --- Estrella de vidrio ---
  vec2 sp = uv - uStar;
  float sd = starShape(sp);
  if (sd < 1.15){
    float e = 1.5 / uRes.y;
    vec2 grad = vec2(starShape(sp + vec2(e, 0.0)) - sd, starShape(sp + vec2(0.0, e)) - sd) / e;
    float inside = 1.0 - smoothstep(0.985, 1.0, sd);
    float h = sqrt(max(0.0, 1.0 - sd * sd));      // domo
    float edge = pow(1.0 - h, 2.2);
    vec2 n = normalize(grad + 1e-5) * edge;

    // refracción con dispersión cromática (iridiscencia)
    float k = uStarR * (0.16 + 0.12 * uPulse);
    vec3 refr;
    refr.r = field(uStar + sp * 0.78 - n * k * 1.00).r;
    refr.g = field(uStar + sp * 0.78 - n * k * 1.12).g;
    refr.b = field(uStar + sp * 0.78 - n * k * 1.26).b;
    refr = refr * 1.18 + 0.03;

    // borde brillante (fresnel) y destello
    float rim = smoothstep(0.80, 0.995, sd) * inside;
    vec3 rimCol = mix(uC3, uC4, 0.5 + 0.5 * sin(atan(sp.y, sp.x) * 2.0 + uTime * 0.4));
    float spec = pow(max(0.0, dot(normalize(vec2(-0.6, 0.8)), -normalize(grad + 1e-5))), 18.0) * edge;

    vec3 glass = refr + rimCol * rim * 0.45 + vec3(spec) * 0.55;
    glass += uC4 * 0.18 * exp(-sd * sd * 6.0);    // núcleo luminoso
    col = mix(col, glass, inside);

    // halo exterior suave
    col += uC3 * 0.10 * smoothstep(1.15, 1.0, sd) * (1.0 - inside);
  }

  // viñeta + grano
  float vig = smoothstep(1.25, 0.25, length(uv * vec2(0.8, 1.0)));
  col *= mix(0.55, 1.0, vig);
  float g = fract(sin(dot(frag + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * 0.035;

  gl_FragColor = vec4(col, 1.0);
}`;

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function init(canvas, opts) {
    opts = opts || {};
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) { canvas.classList.add('is-fallback'); return null; }

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ['uRes', 'uTime', 'uMouse', 'uStar', 'uStarR', 'uStarRot', 'uPulse', 'uC0', 'uC1', 'uC2', 'uC3', 'uC4']
      .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    function setPalette(name) {
      const pal = Array.isArray(name) ? name : (PALETTES[name] || PALETTES.aurora);
      pal.forEach((hex, i) => gl.uniform3fv(U['uC' + i], hexToRgb(hex)));
    }
    setPalette(opts.palette || 'aurora');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const maxDpr = opts.maxDpr || 1.5;
    let W = 1, H = 1, aspect = 1;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H; aspect = W / H;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uRes, W, H);
    }
    resize();
    window.addEventListener('resize', resize);

    // Estado de interacción (con inercia)
    const isMobile = () => aspect < 0.9;
    const anchor = () => isMobile() ? [0.1, -0.34] : [aspect * 0.5 * 0.56, 0.0];
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const star = { x: anchor()[0], y: anchor()[1], vx: 0, vy: 0, rot: 0.2, pulse: 0 };

    function toUv(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const x = (clientX - r.left) / r.height - 0.5 * (r.width / r.height);
      const y = 0.5 - (clientY - r.top) / r.height;
      return [x, y];
    }
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e;
      const [x, y] = toUv(p.clientX, p.clientY);
      mouse.tx = x; mouse.ty = y;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    canvas.parentElement.addEventListener('pointerdown', () => { star.pulse = 1; });

    let visible = true, running = true, last = performance.now(), time = opts.startTime || 8;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((ent) => { visible = ent[0].isIntersecting; if (visible) loop(); })
        .observe(canvas);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); loop(); } });

    let raf = 0;
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      time += dt;

      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;

      // La estrella se inclina hacia el cursor con resorte suave
      const [ax, ay] = anchor();
      const follow = opts.follow != null ? opts.follow : 0.32;
      const gx = ax + (mouse.x - ax) * follow, gy = ay + (mouse.y - ay) * follow;
      star.vx += (gx - star.x) * 0.018; star.vy += (gy - star.y) * 0.018;
      star.vx *= 0.88; star.vy *= 0.88;
      star.x += star.vx; star.y += star.vy;
      star.rot += dt * 0.08 + star.vx * 0.9;
      star.pulse *= 0.94;

      const baseR = isMobile() ? 0.27 : 0.46;
      const R = baseR * (1 + 0.025 * Math.sin(time * 0.8) + 0.08 * star.pulse);

      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform2f(U.uStar, star.x, star.y);
      gl.uniform1f(U.uStarR, R);
      gl.uniform1f(U.uStarRot, star.rot);
      gl.uniform1f(U.uPulse, star.pulse);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reduce) loop();
    }
    function loop() {
      if (!raf && running && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    loop();
    if (reduce) requestAnimationFrame(frame); // un cuadro estático

    return {
      setPalette,
      destroy() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); },
    };
  }

  global.AstroFluid = { init, PALETTES };
})(window);
