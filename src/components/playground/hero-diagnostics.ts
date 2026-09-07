type Mode = "active" | "idle";
type RenderInfo = { calls: number; triangles: number };

/** Opt-in local QA data; no DOM updates or sample storage for ordinary visits. */
export function createHeroDiagnostics(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
  const samples: Record<Mode, { cpu: number[]; interval: number[]; gpu: number[] }> = {
    active: { cpu: [], interval: [], gpu: [] },
    idle: { cpu: [], interval: [], gpu: [] },
  };
  const extension: unknown = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const timer = extension && typeof extension === "object"
    && "TIME_ELAPSED_EXT" in extension && typeof extension.TIME_ELAPSED_EXT === "number"
    && "GPU_DISJOINT_EXT" in extension && typeof extension.GPU_DISJOINT_EXT === "number"
    ? { elapsed: extension.TIME_ELAPSED_EXT, disjoint: extension.GPU_DISJOINT_EXT }
    : undefined;
  let pending: { query: WebGLQuery; mode: Mode } | undefined;
  let querying = false;
  let renders = 0;
  let previous = 0;
  let previousMode: Mode | undefined;
  let lastPublish = 0;
  let lastInfo: RenderInfo = { calls: 0, triangles: 0 };
  let pixelRatio = 1;
  const add = (values: number[], value: number) => {
    values.push(value);
    if (values.length > 180) values.shift();
  };
  const percentile = (values: number[], fraction: number) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(2));
  };
  const publish = (state: string) => {
    canvas.dataset.heroDiagnostics = JSON.stringify({
      state,
      renders,
      width: canvas.width,
      height: canvas.height,
      pixelRatio,
      ...lastInfo,
      active: {
        samples: samples.active.cpu.length,
        cpuP95: percentile(samples.active.cpu, 0.95),
        gpuSamples: samples.active.gpu.length,
        gpuP95: percentile(samples.active.gpu, 0.95),
        intervalMedian: percentile(samples.active.interval, 0.5),
        intervalP95: percentile(samples.active.interval, 0.95),
      },
      idle: {
        samples: samples.idle.cpu.length,
        cpuP95: percentile(samples.idle.cpu, 0.95),
        gpuSamples: samples.idle.gpu.length,
        gpuP95: percentile(samples.idle.gpu, 0.95),
        intervalMedian: percentile(samples.idle.interval, 0.5),
        intervalP95: percentile(samples.idle.interval, 0.95),
      },
    });
  };
  return {
    resetSamples() {
      for (const mode of ['active','idle'] as const) {
        samples[mode].cpu.length = samples[mode].interval.length = samples[mode].gpu.length = 0;
      }
      if (pending) gl.deleteQuery(pending.query);
      pending = undefined; previous = 0; previousMode = undefined;
    },
    beginGpu(mode: Mode) {
      if (!timer) return;
      if (pending && gl.getQueryParameter(pending.query, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(timer.disjoint)) {
          add(samples[pending.mode].gpu, gl.getQueryParameter(pending.query, gl.QUERY_RESULT) / 1e6);
        }
        gl.deleteQuery(pending.query);
        pending = undefined;
      }
      if (!pending) {
        const query = gl.createQuery();
        if (query) {
          gl.beginQuery(timer.elapsed, query);
          pending = { query, mode };
          querying = true;
        }
      }
    },
    endGpu() {
      if (querying && timer) gl.endQuery(timer.elapsed);
      querying = false;
    },
    dispose() {
      if (pending) gl.deleteQuery(pending.query);
      pending = undefined;
    },
    rendered(info: RenderInfo, ratio: number) {
      renders++;
      lastInfo = { calls: info.calls, triangles: info.triangles };
      pixelRatio = ratio;
    },
    frame(mode: Mode, now: number, cpuMs: number) {
      add(samples[mode].cpu, cpuMs);
      if (previous && mode === previousMode) add(samples[mode].interval, now - previous);
      previous = now;
      previousMode = mode;
      if (now - lastPublish > 500) {
        publish(mode);
        lastPublish = now;
      }
    },
    stopped(state: string) {
      previous = 0;
      previousMode = undefined;
      publish(state);
    },
  };
}
