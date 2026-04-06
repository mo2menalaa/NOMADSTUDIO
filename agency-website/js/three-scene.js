/**
 * three-scene.js — NOMAD STUDIO
 *
 * Two separate Three.js scenes:
 *
 * 1. HERO — Particle logo
 *    • Loads logo.jpeg, samples dark pixels → point cloud
 *    • Cursor proximity scatters particles; spring back to rest
 *
 * 2. WORKS — Fullscreen image planes
 *    • Loads works images without crossOrigin (file:// compatible)
 *    • Noise-wipe dissolve transition between images on scroll
 */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') return;

  /* ════════════════════════════════════════════════
     SHARED: image loader that works on file:// URLs
  ════════════════════════════════════════════════ */
  function loadTex(src) {
    const tex = new THREE.Texture();
    tex.minFilter     = THREE.LinearFilter;
    tex.magFilter     = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const img = new window.Image();
    img.onload = () => { tex.image = img; tex.needsUpdate = true; };
    img.src = src; // no crossOrigin → works on file://
    return tex;
  }

  /* ════════════════════════════════════════════════
     SCENE 1 — HERO PARTICLE LOGO
  ════════════════════════════════════════════════ */
  /* True on phones/tablets — disables mouse repulsion for static particles */
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  (function initHero() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;

    /* Fix canvas dimensions before Three.js touches it */
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    /*
     * Pixel-space ortho camera: (0,0) = top-left, (W,H) = bottom-right
     * OrthographicCamera(left, right, top, bottom, near, far)
     * top=H, bottom=0  →  y=0 maps to top of screen, y=H to bottom
     */
    /* top=0 / bottom=H → y=0 at screen top, y=H at bottom (matches pixel coords) */
    const camera = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);

    /* ── Mouse in canvas pixel space ───────────── */
    const mouse  = { x: W / 2, y: H / 2 };
    window.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });

    /* ── Particle buffers (filled after logo loads) */
    let geo, points;
    let restX = [], restY = [];
    let curX  = [], curY  = [];
    const REPEL_R = Math.min(W, H) * 0.12;   /* repulsion radius in px */
    const REPEL_STRENGTH = 0.45;
    const SPRING = 0.06;

    /* ── Sample logo pixels ─────────────────────── */
    const logoImg = new window.Image();
    logoImg.onload = () => {
      /* Draw to an offscreen canvas — scale logo to ~70% of viewport width */
      const off   = document.createElement('canvas');
      const SCALE = 0.88;
      const lW    = Math.floor(W * SCALE);
      const lH    = Math.floor(lW * (logoImg.naturalHeight / logoImg.naturalWidth));
      off.width   = lW;
      off.height  = lH;
      const ctx = off.getContext('2d');
      ctx.drawImage(logoImg, 0, 0, lW, lH);

      const data   = ctx.getImageData(0, 0, lW, lH).data;
      const STEP   = 3;          /* sample every N pixels */
      const THRESH = 160;        /* brightness threshold — darker = logo */

      /* Offset so logo is centered in viewport */
      const offX = (W - lW) / 2;
      const offY = (H - lH) / 2;

      for (let py = 0; py < lH; py += STEP) {
        for (let px = 0; px < lW; px += STEP) {
          const i  = (py * lW + px) * 4;
          const br = (data[i] + data[i+1] + data[i+2]) / 3;
          if (br < THRESH) {
            const wx = offX + px;       /* canvas pixel x */
            const wy = offY + py;       /* canvas pixel y (top=0 in our ortho cam) */
            restX.push(wx);
            restY.push(wy);
            curX.push(isTouchDevice ? wx : wx + (Math.random() - .5) * 4);
            curY.push(isTouchDevice ? wy : wy + (Math.random() - .5) * 4);
          }
        }
      }

      const N   = restX.length;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);

      /* Assign colours: most sand, ~8% terra */
      const SAND  = [0.953, 0.937, 0.914]; // #F3EFE8
      const TERRA = [0.761, 0.302, 0.173]; // #C24D2C

      for (let i = 0; i < N; i++) {
        pos[i*3]   = curX[i];
        pos[i*3+1] = curY[i];
        pos[i*3+2] = 0;
        const c = Math.random() < 0.08 ? TERRA : SAND;
        col[i*3]   = c[0];
        col[i*3+1] = c[1];
        col[i*3+2] = c[2];
      }

      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

      const mat = new THREE.PointsMaterial({
        size:         window.devicePixelRatio > 1 ? 1.6 : 2.0,
        vertexColors: true,
        transparent:  true,
        opacity:      0.92,
        sizeAttenuation: false,
      });

      points = new THREE.Points(geo, mat);
      scene.add(points);
    };
    logoImg.src = 'assets/logo.jpeg';

    /* ── Resize ─────────────────────────────────── */
    window.addEventListener('resize', () => {
      const nW = window.innerWidth, nH = window.innerHeight;
      canvas.width  = nW;
      canvas.height = nH;
      renderer.setSize(nW, nH, false);
      camera.right  = nW;
      camera.bottom = nH;  /* bottom=nH keeps y=0 at screen top */
      camera.updateProjectionMatrix();
    });

    /* ── Render loop ────────────────────────────── */
    (function tick() {
      requestAnimationFrame(tick);

      if (geo && points && !isTouchDevice) {
        const posArr = geo.attributes.position.array;
        const N = restX.length;

        for (let i = 0; i < N; i++) {
          const rx = restX[i], ry = restY[i];
          let   cx = curX[i],  cy = curY[i];

          /* Mouse repulsion */
          const dx   = cx - mouse.x;
          const dy   = cy - mouse.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 0.0001;
          if (dist < REPEL_R) {
            const force = ((REPEL_R - dist) / REPEL_R) * REPEL_STRENGTH;
            cx += (dx / dist) * force * REPEL_R * 0.12;
            cy += (dy / dist) * force * REPEL_R * 0.12;
          }

          /* Spring back to rest */
          cx += (rx - cx) * SPRING;
          cy += (ry - cy) * SPRING;

          curX[i] = cx; curY[i] = cy;
          posArr[i*3]   = cx;
          posArr[i*3+1] = cy;
        }
        geo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    })();
  })();

  /* ════════════════════════════════════════════════
     SCENE 2 — WORKS IMAGE PLANES
  ════════════════════════════════════════════════ */
  (function initWorks() {
    const canvas = document.getElementById('worksCanvas');
    if (!canvas) return;

    /* Works data — edit these to match your real projects */
    window.WORKS = [
      { title: 'Triple Screen',   client: 'Internal',   type: 'AI Photo Shoot',     date: '2025', src: 'assets/works/triple-screen.png' },
      { title: 'The Figure',      client: 'Campaign',   type: 'Campaign Visual',    date: '2025', src: 'assets/works/the-figure.jpg'    },
      { title: 'Red Silhouette',  client: 'Brand',      type: 'Brand Campaign',     date: '2025', src: 'assets/works/red-silhouette.png' },
      { title: 'Grain Study',     client: 'Studio',     type: 'Creative Direction', date: '2024', src: 'assets/works/grain-study.png'   },
      { title: 'Urban Scatter',   client: 'Art Space',  type: 'Art Direction',      date: '2024', src: 'assets/works/urban-scatter.png' },
      { title: 'Particle Series', client: 'Exhibition', type: 'Art Direction',      date: '2024', src: 'assets/works/particle-series.png'},
    ];
    const WORKS = window.WORKS;
    const N     = WORKS.length;

    /* ── Fix canvas size before Three.js ─────────── */
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x0a0907, 1);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* ── Load all image textures (no crossOrigin) ── */
    const aspects = new Array(N).fill(1.0); // natural w/h ratio per work
    const textures = WORKS.map((w, idx) => {
      const tex = new THREE.Texture();
      tex.minFilter     = THREE.LinearFilter;
      tex.magFilter     = THREE.LinearFilter;
      tex.generateMipmaps = false;
      const img = new window.Image();
      img.onload = () => {
        tex.image = img;
        tex.needsUpdate = true;
        aspects[idx] = img.naturalWidth / img.naturalHeight;
      };
      img.src = w.src;
      return tex;
    });

    /* ── Vertex shader ──────────────────────────── */
    const vert = /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `;

    /* ── Fragment shader ────────────────────────── */
    const frag = /* glsl */`
      precision mediump float;

      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float uBlend;
      uniform float uTime;
      uniform float uAspectA;
      uniform float uAspectB;
      uniform float uScreenAspect;

      varying vec2 vUv;

      /* Cover-fit UV: ia=image aspect, sa=screen aspect */
      vec2 coverUV(vec2 uv, float ia, float sa) {
        if (sa > ia) {
          uv.y = (uv.y - 0.5) * (ia / sa) + 0.5;
        } else {
          uv.x = (uv.x - 0.5) * (sa / ia) + 0.5;
        }
        return uv;
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float sa = uScreenAspect;
        vec4 a = texture2D(texA, coverUV(vUv, uAspectA, sa));
        vec4 b = texture2D(texB, coverUV(vUv, uAspectB, sa));

        /* ── Censorship / decipher block transition ── */
        const float GRID = 72.0;
        vec2  cellId   = floor(vec2(vUv.x * GRID, vUv.y * GRID / uScreenAspect));
        float rnd      = hash(cellId);
        float t        = clamp((uBlend - rnd * 0.55) / 0.45, 0.0, 1.0);
        float censored = smoothstep(0.0, 0.38, t) * (1.0 - smoothstep(0.62, 1.0, t));
        vec4  blk      = vec4(0.04, 0.03, 0.02, 1.0);
        vec4  col      = mix(a, b, smoothstep(0.42, 0.58, t));
        col = mix(col, blk, censored * 0.88);

        /* Film grain */
        float gr = hash(vUv + fract(uTime*.017)) - .5;
        col.rgb += gr * .032;

        /* Terra shadow tint in darks */
        float luma = dot(col.rgb, vec3(.299,.587,.114));
        col.rgb = mix(col.rgb, col.rgb*vec3(.76,.30,.17)*1.3, (1.-luma)*.07);

        gl_FragColor = vec4(col.rgb, 1.);
      }
    `;

    const uniforms = {
      texA:         { value: textures[0] },
      texB:         { value: textures[1] },
      uBlend:       { value: 0.0 },
      uTime:        { value: 0.0 },
      uAspectA:     { value: 1.0 },
      uAspectB:     { value: 1.0 },
      uScreenAspect:{ value: W / H },
    };

    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthWrite: false })
    ));

    /* ── Public API used by main.js ─────────────── */
    window.__works3 = {
      set(idxA, idxB, blend) {
        const a = Math.max(0, Math.min(N-1, idxA));
        const b = Math.max(0, Math.min(N-1, idxB));
        uniforms.texA.value   = textures[a];
        uniforms.texB.value   = textures[b];
        uniforms.uBlend.value = blend;
        uniforms.uAspectA.value = aspects[a];
        uniforms.uAspectB.value = aspects[b];
      },
    };

    /* ── Resize ─────────────────────────────────── */
    window.addEventListener('resize', () => {
      const nW = window.innerWidth, nH = window.innerHeight;
      canvas.width  = nW;
      canvas.height = nH;
      renderer.setSize(nW, nH, false);
      uniforms.uScreenAspect.value = nW / nH;
    });

    /* ── Render loop ────────────────────────────── */
    const clock = new THREE.Clock();
    (function tick() {
      requestAnimationFrame(tick);
      uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    })();
  })();

  /* ════════════════════════════════════════════════
     SCENE 3 — FOOTER PARTICLE LOGO
  ════════════════════════════════════════════════ */
  (function initFooter() {
    const canvas = document.getElementById('footerCanvas');
    if (!canvas) return;

    const footerEl = document.querySelector('.footer');
    const W = footerEl ? footerEl.offsetWidth  : window.innerWidth;
    const H = footerEl ? footerEl.offsetHeight : 480;
    if (!W || !H) return;

    canvas.width  = W;
    canvas.height = H;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, W, 0, H, -1, 1);

    const mouse = { x: W / 2, y: H / 2 };
    window.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });

    let geo, points;
    let restX = [], restY = [];
    let curX  = [], curY  = [];
    const REPEL_R = Math.min(W, H) * 0.14;
    const REPEL_STRENGTH = 0.45;
    const SPRING = 0.06;

    const logoImg = new window.Image();
    logoImg.onload = () => {
      const off   = document.createElement('canvas');
      const SCALE = 0.60;
      const lW    = Math.floor(W * SCALE);
      const lH    = Math.floor(lW * (logoImg.naturalHeight / logoImg.naturalWidth));
      off.width   = lW;
      off.height  = lH;
      const ctx = off.getContext('2d');
      ctx.drawImage(logoImg, 0, 0, lW, lH);

      const data   = ctx.getImageData(0, 0, lW, lH).data;
      const STEP   = 3;
      const THRESH = 160;
      const offX   = (W - lW) / 2;
      const offY   = (H - lH) / 2;

      for (let py = 0; py < lH; py += STEP) {
        for (let px = 0; px < lW; px += STEP) {
          const i  = (py * lW + px) * 4;
          const br = (data[i] + data[i+1] + data[i+2]) / 3;
          if (br < THRESH) {
            restX.push(offX + px); restY.push(offY + py);
            curX.push(isTouchDevice ? offX + px : offX + px + (Math.random()-.5)*4);
            curY.push(isTouchDevice ? offY + py : offY + py + (Math.random()-.5)*4);
          }
        }
      }

      const N   = restX.length;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const SAND  = [0.953, 0.937, 0.914];
      const TERRA = [0.761, 0.302, 0.173];

      for (let i = 0; i < N; i++) {
        pos[i*3]   = curX[i]; pos[i*3+1] = curY[i]; pos[i*3+2] = 0;
        const c = Math.random() < 0.08 ? TERRA : SAND;
        col[i*3] = c[0]; col[i*3+1] = c[1]; col[i*3+2] = c[2];
      }

      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

      points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: window.devicePixelRatio > 1 ? 1.6 : 2.0,
        vertexColors: true, transparent: true, opacity: 0.20, sizeAttenuation: false,
      }));
      scene.add(points);
    };
    logoImg.src = 'assets/logo.jpeg';

    (function tick() {
      requestAnimationFrame(tick);
      if (geo && points && !isTouchDevice) {
        const posArr = geo.attributes.position.array;
        const N = restX.length;
        for (let i = 0; i < N; i++) {
          const rx = restX[i], ry = restY[i];
          let   cx = curX[i],  cy = curY[i];
          const dx = cx - mouse.x, dy = cy - mouse.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 0.0001;
          if (dist < REPEL_R) {
            const force = ((REPEL_R - dist) / REPEL_R) * REPEL_STRENGTH;
            cx += (dx / dist) * force * REPEL_R * 0.12;
            cy += (dy / dist) * force * REPEL_R * 0.12;
          }
          cx += (rx - cx) * SPRING; cy += (ry - cy) * SPRING;
          curX[i] = cx; curY[i] = cy;
          posArr[i*3] = cx; posArr[i*3+1] = cy;
        }
        geo.attributes.position.needsUpdate = true;
      }
      renderer.render(scene, camera);
    })();
  })();

})();
