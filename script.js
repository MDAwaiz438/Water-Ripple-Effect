import * as THREE from "https://esm.sh/three@0.175.0";

class Fish {
  constructor(el, config) {
    this.el = el;
    this.speed = config.speed;
    this.phase = config.phase;
    this.baseY = config.baseY;       // vh
    this.amplitude = config.amplitude; // vh
    this.freq = config.freq;
    this.dir = config.dir;           // 1 = left->right, -1 = right->left
    this.colorOffset = config.colorOffset; // hue shift from theme, degrees
    this.el.style.width = `${config.size}px`;
  }

  update(time, themeHsl) {
    const cycle = (time * this.speed + this.phase) % 1;
    const xPercent = this.dir === 1 ? cycle * 120 - 10 : 110 - cycle * 120;
    const yPercent = this.baseY + Math.sin(time * this.freq + this.phase * 10) * this.amplitude;
    const flip = this.dir === 1 ? 1 : -1;

    this.el.style.transform = `translate(${xPercent}vw, ${yPercent}vh) scaleX(${flip})`;

    const hue = (themeHsl.h + this.colorOffset + 360) % 360;
    const sat = Math.min(100, themeHsl.s + 30);
    const light = Math.min(80, Math.max(55, themeHsl.l + 25));
    this.el.style.color = `hsl(${hue}, ${sat}%, ${light}%)`;
  }
}

class App {
  constructor() {
    this.settings = {
      damping: 0.98,
      tension: 0.02,
      resolution: 512,
      rippleStrength: 1.0,
      mouseIntensity: 0.3,
      clickIntensity: 2.0,
      rippleRadius: 20,
      autoDrops: true,
      autoDropInterval: 3000,
      autoDropIntensity: 1.0,
      performanceMode: true
    };

    this.gradientColors = {
      colorA1: [0.6, 0.1, 0.8],
      colorA2: [0.3, 0.0, 0.5],
      colorB1: [0.8, 0.2, 0.9],
      colorB2: [0.4, 0.1, 0.7]
    };

    this.lastMousePosition = { x: 0, y: 0 };
    this.mouseThrottleTime = 0;
    this.loadingProgress = 0;
    this.isLoaded = false;

    this.startLoading();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -window.innerWidth / 2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      -window.innerHeight / 2,
      0.1,
      1000
    );
    this.camera.position.z = 10;

    this.clock = new THREE.Clock();

    this.initWaterRipple();
    this.createBackground();
    this.createFish();
    this.bindEvents();
    this.setupAutoDrops();
    this.tick();
  }

  createFish() {
    const container = document.getElementById("fishContainer");
    const template = document.getElementById("fish-template");

    const configs = [
      { speed: 0.03,  phase: 0.0, baseY: 45, amplitude: 8,  freq: 0.6, dir: 1,  size: 50, colorOffset: 150 },
      { speed: 0.025, phase: 0.3, baseY: 60, amplitude: 6,  freq: 0.7, dir: -1, size: 40, colorOffset: -150 },
      { speed: 0.04,  phase: 0.6, baseY: 35, amplitude: 10, freq: 0.9, dir: 1,  size: 35, colorOffset: 180 },
      { speed: 0.035, phase: 0.8, baseY: 70, amplitude: 7,  freq: 0.5, dir: -1, size: 45, colorOffset: 90 },
    ];

    this.fishes = configs.map((cfg) => {
      const node = template.content.firstElementChild.cloneNode(true);
      container.appendChild(node);
      return new Fish(node, cfg);
    });
  }

  rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  getThemeHsl() {
    const c = this.gradientColors;
    const avg = [0, 1, 2].map(
      (i) => (c.colorA1[i] + c.colorA2[i] + c.colorB1[i] + c.colorB2[i]) / 4
    );
    return this.rgbToHsl(avg[0], avg[1], avg[2]);
  }

  updateFish(time) {
    if (!this.fishes || !this.fishes.length) return;
    const themeHsl = this.getThemeHsl();
    this.fishes.forEach((fish) => fish.update(time, themeHsl));
  }

  startLoading() {
    const blobLoader = document.querySelector(".blob-loader");
    const progressPercentage = document.getElementById("progress-percentage");
    const loader = document.getElementById("loader");

    const loadingInterval = setInterval(() => {
      this.loadingProgress += Math.random() * 3 + 1;

      if (this.loadingProgress >= 100) {
        this.loadingProgress = 100;
        clearInterval(loadingInterval);

        if (blobLoader) blobLoader.style.transform = `scale(1.1)`;
        progressPercentage.textContent = "100%";

        setTimeout(() => {
          this.init();

          setTimeout(() => {
            loader.classList.add("hidden");
            this.isLoaded = true;

            setTimeout(() => {
              const centerX = window.innerWidth / 2;
              const centerY = window.innerHeight / 2;
              this.addRipple(centerX, centerY, 1.5);
            }, 300);
          }, 500);
        }, 300);
      } else {
        if (blobLoader) {
          const scale = 0.8 + (this.loadingProgress / 100) * 0.2;
          blobLoader.style.transform = `scale(${scale})`;
        }
        progressPercentage.textContent = Math.floor(this.loadingProgress) + "%";
      }
    }, 50);
  }

  initWaterRipple() {
    const resolution = this.settings.resolution;

    this.waterBuffers = {
      current: new Float32Array(resolution * resolution),
      previous: new Float32Array(resolution * resolution)
    };

    this.waterTexture = new THREE.DataTexture(
      this.waterBuffers.current,
      resolution,
      resolution,
      THREE.RedFormat,
      THREE.FloatType
    );
    this.waterTexture.minFilter = THREE.LinearFilter;
    this.waterTexture.magFilter = THREE.LinearFilter;
    this.waterTexture.needsUpdate = true;
  }

  createBackground() {
    const backgroundShader = {
      uniforms: {
        waterTexture: { value: this.waterTexture },
        rippleStrength: { value: this.settings.rippleStrength },
        resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight)
        },
        time: { value: 0 },
        colorA1: {
          value: new THREE.Vector3(
            this.gradientColors.colorA1[0],
            this.gradientColors.colorA1[1],
            this.gradientColors.colorA1[2]
          )
        },
        colorA2: {
          value: new THREE.Vector3(
            this.gradientColors.colorA2[0],
            this.gradientColors.colorA2[1],
            this.gradientColors.colorA2[2]
          )
        },
        colorB1: {
          value: new THREE.Vector3(
            this.gradientColors.colorB1[0],
            this.gradientColors.colorB1[1],
            this.gradientColors.colorB1[2]
          )
        },
        colorB2: {
          value: new THREE.Vector3(
            this.gradientColors.colorB2[0],
            this.gradientColors.colorB2[1],
            this.gradientColors.colorB2[2]
          )
        }
      },
      vertexShader: `
                        varying vec2 vUv;

                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
      fragmentShader: `
                        uniform sampler2D waterTexture;
                        uniform float rippleStrength;
                        uniform vec2 resolution;
                        uniform float time;
                        uniform vec3 colorA1;
                        uniform vec3 colorA2;
                        uniform vec3 colorB1;
                        uniform vec3 colorB2;
                        varying vec2 vUv;

                        float S(float a, float b, float t) {
                            return smoothstep(a, b, t);
                        }

                        mat2 Rot(float a) {
                            float s = sin(a);
                            float c = cos(a);
                            return mat2(c, -s, s, c);
                        }

                        float noise(vec2 p) {
                            vec2 ip = floor(p);
                            vec2 fp = fract(p);
                            float a = fract(sin(dot(ip, vec2(12.9898, 78.233))) * 43758.5453);
                            float b = fract(sin(dot(ip + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
                            float c = fract(sin(dot(ip + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
                            float d = fract(sin(dot(ip + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);

                            fp = fp * fp * (3.0 - 2.0 * fp);

                            return mix(mix(a, b, fp.x), mix(c, d, fp.x), fp.y);
                        }

                        void main() {
                            float waterHeight = texture2D(waterTexture, vUv).r;

                            float step = 1.0 / resolution.x;
                            vec2 distortion = vec2(
                                texture2D(waterTexture, vec2(vUv.x + step, vUv.y)).r - texture2D(waterTexture, vec2(vUv.x - step, vUv.y)).r,
                                texture2D(waterTexture, vec2(vUv.x, vUv.y + step)).r - texture2D(waterTexture, vec2(vUv.x, vUv.y - step)).r
                            ) * rippleStrength * 5.0;

                            vec2 tuv = vUv + distortion;
                            tuv -= 0.5;

                            float ratio = resolution.x / resolution.y;
                            tuv.y *= 1.0/ratio;

                            vec3 layer1 = mix(colorA1, colorA2, S(-0.3, 0.2, (tuv*Rot(radians(-5.0))).x));
                            vec3 layer2 = mix(colorB1, colorB2, S(-0.3, 0.2, (tuv*Rot(radians(-5.0))).x));
                            vec3 finalComp = mix(layer1, layer2, S(0.5, -0.3, tuv.y));

                            float noiseValue = noise(tuv * 20.0 + time * 0.1) * 0.03;
                            finalComp += vec3(noiseValue);

                            float vignette = 1.0 - smoothstep(0.5, 1.5, length(tuv * 1.5));
                            finalComp *= mix(0.95, 1.0, vignette);

                            gl_FragColor = vec4(finalComp, 1.0);
                        }
                    `
    };

    const geometry = new THREE.PlaneGeometry(
      window.innerWidth,
      window.innerHeight
    );
    this.backgroundMaterial = new THREE.ShaderMaterial({
      uniforms: backgroundShader.uniforms,
      vertexShader: backgroundShader.vertexShader,
      fragmentShader: backgroundShader.fragmentShader
    });

    const mesh = new THREE.Mesh(geometry, this.backgroundMaterial);
    this.scene.add(mesh);
  }

  updateWaterSimulation() {
    const { current, previous } = this.waterBuffers;
    const { damping, tension, resolution } = this.settings;

    const safeTension = Math.min(tension, 0.05);

    for (let i = 1; i < resolution - 1; i++) {
      for (let j = 1; j < resolution - 1; j++) {
        const index = i * resolution + j;

        const top = previous[index - resolution];
        const bottom = previous[index + resolution];
        const left = previous[index - 1];
        const right = previous[index + 1];

        current[index] = (top + bottom + left + right) / 2 - current[index];
        current[index] =
          current[index] * damping + previous[index] * (1 - damping);
        current[index] += (0 - previous[index]) * safeTension;
        current[index] = Math.max(-1.0, Math.min(1.0, current[index]));
      }
    }

    [this.waterBuffers.current, this.waterBuffers.previous] = [
      this.waterBuffers.previous,
      this.waterBuffers.current
    ];

    this.waterTexture.image.data = this.waterBuffers.current;
    this.waterTexture.needsUpdate = true;
  }

  addRipple(x, y, strength = 1.0) {
    const { resolution, rippleRadius } = this.settings;

    const normalizedX = x / window.innerWidth;
    const normalizedY = 1.0 - y / window.innerHeight;

    const texX = Math.floor(normalizedX * resolution);
    const texY = Math.floor(normalizedY * resolution);

    const radius = rippleRadius;
    const rippleStrength = strength;
    const radiusSquared = radius * radius;

    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const distanceSquared = i * i + j * j;

        if (distanceSquared <= radiusSquared) {
          const posX = texX + i;
          const posY = texY + j;

          if (
            posX >= 0 &&
            posX < resolution &&
            posY >= 0 &&
            posY < resolution
          ) {
            const index = posY * resolution + posX;
            const distance = Math.sqrt(distanceSquared);
            const rippleValue =
              Math.cos(((distance / radius) * Math.PI) / 2) * rippleStrength;
            this.waterBuffers.previous[index] += rippleValue;
          }
        }
      }
    }
  }

  bindEvents() {
    window.addEventListener("mousemove", (ev) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      const now = performance.now();
      if (now - this.mouseThrottleTime < 16) return;
      this.mouseThrottleTime = now;

      const dx = x - this.lastMousePosition.x;
      const dy = y - this.lastMousePosition.y;
      const distSquared = dx * dx + dy * dy;

      if (distSquared > 5) {
        this.addRipple(x, y, this.settings.mouseIntensity);
        this.lastMousePosition.x = x;
        this.lastMousePosition.y = y;
      }
    });

    window.addEventListener("click", (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.addRipple(x, y, this.settings.clickIntensity);
    });

    window.addEventListener("resize", () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.left = -width / 2;
      this.camera.right = width / 2;
      this.camera.top = height / 2;
      this.camera.bottom = -height / 2;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);

      if (this.backgroundMaterial) {
        this.backgroundMaterial.uniforms.resolution.value.set(width, height);
      }

      if (this.scene.children[0] && this.scene.children[0].geometry) {
        this.scene.children[0].geometry.dispose();
        this.scene.children[0].geometry = new THREE.PlaneGeometry(
          width,
          height
        );
      }
    });
  }

  setupAutoDrops() {
    if (this.autoDropsInterval) {
      clearInterval(this.autoDropsInterval);
    }

    if (this.settings.autoDrops) {
      this.autoDropsInterval = setInterval(() => {
        if (!this.settings.autoDrops) return;

        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        this.addRipple(x, y, this.settings.autoDropIntensity);
      }, this.settings.autoDropInterval);
    }
  }

  updateTextDistortion() {
    const turbulence = document.getElementById("turbulence");
    if (turbulence) {
      const time = this.clock.getElapsedTime();
      const frequency1 = 0.015 + Math.sin(time * 0.5) * 0.005;
      const frequency2 = 0.01 + Math.cos(time * 0.3) * 0.003;
      turbulence.setAttribute("baseFrequency", `${frequency1} ${frequency2}`);
    }
  }

  tick() {
    this.updateWaterSimulation();
    this.updateTextDistortion();
    this.updateFish(this.clock.getElapsedTime());

    if (this.backgroundMaterial) {
      this.backgroundMaterial.uniforms.rippleStrength.value = this.settings.rippleStrength;
      this.backgroundMaterial.uniforms.time.value += this.clock.getDelta();
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.tick());
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new App();
});
