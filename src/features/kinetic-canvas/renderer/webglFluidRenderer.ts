"use client";

import type { LiquidPhysics } from "../input/liquidInput";
import { createHeroTextCanvas } from "../materials/heroTextMask";
import { FLUID_TEXTURE_SRC, RIPPLE_COUNT, TARGET_FPS, TEXT_MAX_DIM, resolveKineticQuality } from "./quality";
import { FRAGMENT_SOURCE, VERTEX_SOURCE } from "../shaders/liquidComposite";

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create WebGL shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create WebGL program");
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "unknown program error";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

export function startFluidRenderer(
  canvas: HTMLCanvasElement,
  getPhysics: () => LiquidPhysics,
  reducedMotionRef: { current: boolean },
  staticModeRef: { current: boolean },
  heroNameRef: { current: boolean },
): () => void {
  const glContext = canvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!glContext) throw new Error("WebGL2 unavailable");
  const gl: WebGL2RenderingContext = glContext;

  const program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);
  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const energyLocation = gl.getUniformLocation(program, "u_energy");
  const pointerLocation = gl.getUniformLocation(program, "u_pointer");
  const nameOpacityLocation = gl.getUniformLocation(program, "u_nameOpacity");
  const rippleLocations = Array.from({ length: RIPPLE_COUNT }, (_, i) =>
    gl.getUniformLocation(program, `u_ripples[${i}]`),
  );
  const textureLocation = gl.getUniformLocation(program, "u_texture");
  const textLocation = gl.getUniformLocation(program, "u_text");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // pearl background texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([248, 251, 255, 255]));
  const image = new Image();
  image.decoding = "async";
  image.src = FLUID_TEXTURE_SRC;
  image.addEventListener("load", () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  });

  // hero-name coverage texture
  const textTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let running = true;
  let lastRenderTime = 0;
  let textTextureVisible = false;
  const startedAt = performance.now();

  function regenerateText() {
    if (!heroNameRef.current) return;
    const texW = Math.min(canvas.width, TEXT_MAX_DIM);
    const texH = Math.max(1, Math.round(texW * (height / Math.max(width, 1))));
    const textCanvas = createHeroTextCanvas(texW, texH);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    textTextureVisible = true;
  }

  function clearTextTexture() {
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    textTextureVisible = false;
  }

  function configure() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = resolveKineticQuality().dpr;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    regenerateText();
  }

  function paint(t: number) {
    const physics = getPhysics();
    const pointer = physics.pointer;
    const scrollY = heroNameRef.current ? window.scrollY : 9999;
    const fadeStart = height * 0.14;
    const fadeEnd = height * 0.56;
    const fadeProgress = Math.min(1, Math.max(0, (scrollY - fadeStart) / Math.max(1, fadeEnd - fadeStart)));
    const nameOpacity = heroNameRef.current ? 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress) : 0;
    if (nameOpacity <= 0.01 && textTextureVisible) {
      clearTextTexture();
    } else if (nameOpacity > 0.01 && !textTextureVisible) {
      regenerateText();
    }

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureLocation, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.uniform1i(textLocation, 1);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t);
    gl.uniform1f(energyLocation, pointer.energy);
    gl.uniform1f(nameOpacityLocation, nameOpacity);
    gl.uniform2f(pointerLocation, pointer.x * dpr, pointer.y * dpr);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ripple = physics.ripples[i];
      if (ripple) {
        gl.uniform4f(rippleLocations[i], ripple.x * dpr, ripple.y * dpr, t - ripple.age, ripple.intensity);
      } else {
        gl.uniform4f(rippleLocations[i], -9999, -9999, -9999, 0);
      }
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function render(now = performance.now()) {
    if (!running) return;
    const frozen = reducedMotionRef.current || staticModeRef.current;
    if (frozen) {
      paint(0);
      frame = 0;
      return; // single static frame; the name still renders
    }
    const interval = 1000 / TARGET_FPS;
    if (now - lastRenderTime < interval) {
      frame = requestAnimationFrame(render);
      return;
    }
    lastRenderTime = now;
    paint((now - startedAt) / 1000);
    frame = requestAnimationFrame(render);
  }

  function onVisibility() {
    running = !document.hidden;
    if (running) frame = requestAnimationFrame(render);
    else cancelAnimationFrame(frame);
  }

  function onScroll() {
    if (reducedMotionRef.current || staticModeRef.current) {
      paint(0);
    }
  }

  configure();
  window.addEventListener("resize", configure);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  frame = requestAnimationFrame(render);

  // Re-rasterize once the hero font has loaded; repaint a static frame in
  // frozen mode so the real glyphs appear.
  if (typeof document !== "undefined" && document.fonts) {
    document.fonts.ready
      .then(() => {
        regenerateText();
        if (reducedMotionRef.current || staticModeRef.current) paint(0);
      })
      .catch(() => {});
  }

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", configure);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    gl.deleteTexture(texture);
    gl.deleteTexture(textTexture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };
}

