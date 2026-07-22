#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const [url, output, widthText = "1672", heightText = "941", waitText = "6500", scenario = "rest"] = process.argv.slice(2);
if (!url || !output) {
  throw new Error("usage: capture-underwater.mjs <url> <output.png> [width] [height] [wait-ms]");
}

const width = Number(widthText);
const height = Number(heightText);
const waitMs = Number(waitText);
const targets = await fetch("http://127.0.0.1:9223/json/list").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("no Chrome page target on port 9223");

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const diagnostics = [];
let nextId = 1;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const callback = pending.get(message.id);
    if (!callback) return;
    pending.delete(message.id);
    if (message.error) callback.reject(new Error(message.error.message));
    else callback.resolve(message.result);
    return;
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    diagnostics.push(message.params.entry.text);
  }
  if (message.method === "Runtime.exceptionThrown") {
    diagnostics.push(message.params.exceptionDetails.text);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await Promise.all([
  send("Page.enable"),
  send("Network.enable"),
  send("Runtime.enable"),
  send("Log.enable"),
]);
await send("Network.clearBrowserCache");
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width < 700,
});
await send("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, 1000));
await send("Runtime.evaluate", {
  expression: `(() => {
    const target = location.hash && document.querySelector(location.hash);
    document.documentElement.style.scrollBehavior = 'auto';
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY);
  })()`,
});
await new Promise((resolve) => setTimeout(resolve, Math.max(0, waitMs - 450)));
if (scenario !== "rest") {
  await send("Runtime.evaluate", {
    expression: scenario === "wake"
      ? `window.__underwaterDebug?.wake([${width * 0.18}, ${height * 0.44}], [${width * 0.72}, ${height * 0.38}], 210)`
      : `window.__underwaterDebug?.press([${width * 0.53}, ${height * 0.43}], [0.25, -1])`,
  });
}
await new Promise((resolve) => setTimeout(resolve, 450));
const state = await send("Runtime.evaluate", {
  expression: `(() => {
    const container = document.querySelector('.fluid-canvas');
    const canvas = container?.querySelector('canvas');
    return {
      fluid: container?.dataset.fluid,
      rendererError: container?.dataset.rendererError,
      canvas: canvas ? { ...canvas.dataset } : null,
      section: document.documentElement.dataset.waterSection,
      scroll: {
        y: window.scrollY,
        max: document.documentElement.scrollHeight - window.innerHeight,
        targetTop: location.hash ? document.querySelector(location.hash)?.getBoundingClientRect().top : null,
      },
      contact: ['#contact', '.contact-section__inner', '.contact-basin', '.contact-footer']
        .map((selector) => {
          const node = document.querySelector(selector);
          const rect = node?.getBoundingClientRect();
          return rect ? { selector, top: rect.top, height: rect.height } : null;
        }),
    };
  })()`,
  returnByValue: true,
});
const capture = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
  fromSurface: true,
});
await writeFile(output, Buffer.from(capture.data, "base64"));
socket.close();

process.stdout.write(`${JSON.stringify({ state: state.result.value, diagnostics }, null, 2)}\n`);
