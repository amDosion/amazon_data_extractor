"use strict";

const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const puppeteer = require("puppeteer");

const SELLER_ORDERS_URL = "https://sellercentral.amazon.com/order-reports-and-feeds/reports/allOrders#";
const ORDERS_PAGE_PATH = "/order-reports-and-feeds/reports/allOrders";

const CONFIG = {
  port: clampNumber(process.env.PORT, 1, 65535, 8787),
  browserMode: normalizeBrowserMode(process.env.BROWSER_MODE || "launch"),
  headless: String(process.env.HEADLESS || "true").toLowerCase() !== "false",
  profileDir: process.env.PROFILE_DIR || path.resolve(__dirname, ".chrome-profile"),
  chromeDebugUrl: process.env.CHROME_DEBUG_URL || "http://127.0.0.1:9222",
  chromeWsEndpoint: process.env.CHROME_WS_ENDPOINT || "",
  outputRoot: process.env.OUTPUT_ROOT || path.resolve(__dirname, "downloads"),
  maxTimeoutMs: clampNumber(process.env.MAX_TIMEOUT_MS, 30000, 600000, 300000)
};

let browser = null;
let browserManagedByService = false;
let queue = Promise.resolve();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "amazon-order-report-service",
        browserMode: CONFIG.browserMode,
        headless: CONFIG.headless,
        profileDir: CONFIG.profileDir,
        chromeDebugUrl: CONFIG.chromeDebugUrl,
        chromeWsEndpoint: CONFIG.chromeWsEndpoint || undefined,
        outputRoot: CONFIG.outputRoot
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/orders/report") {
      const body = await readJsonBody(req);
      const result = await enqueue(() => runOrderReport(body || {}));
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    sendJson(res, 404, {
      ok: false,
      error: "Not Found"
    });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
});

server.listen(CONFIG.port, () => {
  console.log(`[order-service] listening on http://127.0.0.1:${CONFIG.port}`);
});

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});

async function runOrderReport(payload) {
  const startedAt = Date.now();
  const options = normalizeOptions(payload.options || {});
  const outputDir = sanitizeRelativePath(payload.output?.downloadDir || "amazon");

  const page = await createPage(options.pageTimeoutMs);
  const logs = [];

  try {
    logs.push(`Open page: ${SELLER_ORDERS_URL}`);
    await page.goto(SELLER_ORDERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: options.pageTimeoutMs
    });

    const currentUrl = page.url();
    if (!currentUrl.includes(ORDERS_PAGE_PATH) || isLoginUrl(currentUrl)) {
      const tip =
        CONFIG.browserMode === "connect"
          ? "Connected Chrome session is not logged in to Seller Central."
          : "Start with HEADLESS=false and complete login once in service profile.";
      throw new Error(
        `Seller Central session invalid in order service. ${tip}`
      );
    }

    const workflow = await page.evaluate(runOrderWorkflowInPage, {
      reportNamePrefix: options.reportNamePrefix,
      pageTimeoutMs: options.pageTimeoutMs
    });
    logs.push(...(workflow.logs || []));

    if (!workflow.downloadUrl) {
      return {
        mode: workflow.pageTriggeredDownload ? "in-page-click" : "no-download-url",
        savedPath: "",
        logs,
        durationMs: Date.now() - startedAt
      };
    }

    const saveResult = await downloadWithCookies({
      page,
      downloadUrl: workflow.downloadUrl,
      reportNamePrefix: options.reportNamePrefix,
      preferredFilename: workflow.downloadFilename || "",
      outputDir
    });

    return {
      mode: "saved-file",
      savedPath: saveResult.savedPath,
      downloadFilename: saveResult.downloadFilename,
      logs,
      durationMs: Date.now() - startedAt
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function createPage(timeoutMs) {
  const b = await ensureBrowser();
  const page = await b.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
  return page;
}

async function ensureBrowser() {
  if (browser) {
    return browser;
  }

  if (CONFIG.browserMode === "connect") {
    const wsEndpoint = await resolveChromeWsEndpoint();
    browserManagedByService = false;
    browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: null
    });
  } else {
    await fs.mkdir(CONFIG.profileDir, { recursive: true });
    browserManagedByService = true;
    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      userDataDir: CONFIG.profileDir,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
  }

  browser.on("disconnected", () => {
    browser = null;
    browserManagedByService = false;
  });
  return browser;
}

async function closeBrowser() {
  if (!browser) {
    return;
  }
  try {
    if (browserManagedByService) {
      await browser.close();
    } else {
      await browser.disconnect();
    }
  } catch (_error) {
    // Ignore close errors.
  } finally {
    browser = null;
    browserManagedByService = false;
  }
}

async function resolveChromeWsEndpoint() {
  const staticEndpoint = String(CONFIG.chromeWsEndpoint || "").trim();
  if (staticEndpoint) {
    return staticEndpoint;
  }

  const base = String(CONFIG.chromeDebugUrl || "").trim().replace(/\/+$/, "");
  if (!base) {
    throw new Error("CHROME_DEBUG_URL is required when BROWSER_MODE=connect.");
  }

  let version;
  try {
    const response = await fetch(`${base}/json/version`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    version = await response.json();
  } catch (error) {
    throw new Error(
      `Unable to access Chrome remote debugging endpoint: ${base}/json/version (${error.message}). ` +
      "Start Chrome with --remote-debugging-port=9222."
    );
  }

  const ws = String(version?.webSocketDebuggerUrl || "").trim();
  if (!ws) {
    throw new Error(`webSocketDebuggerUrl missing at ${base}/json/version.`);
  }
  return ws;
}

async function downloadWithCookies(input) {
  const { page, downloadUrl, preferredFilename, reportNamePrefix, outputDir } = input;

  const url = String(downloadUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Invalid download URL returned by page workflow.");
  }

  const cookies = await page.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const userAgent = await page.evaluate(() => navigator.userAgent);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Download request failed: HTTP ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const rootDir = path.resolve(CONFIG.outputRoot);
  const targetDir = path.resolve(rootDir, outputDir);
  if (!targetDir.toLowerCase().startsWith(rootDir.toLowerCase())) {
    throw new Error("Invalid output directory.");
  }
  await fs.mkdir(targetDir, { recursive: true });

  const ext = inferExtension(url, response.headers.get("content-type"));
  const fileName = sanitizeFileName(preferredFilename) || buildFileName(reportNamePrefix, ext);
  const absPath = path.join(targetDir, fileName);
  await fs.writeFile(absPath, bytes);

  const relPath = normalizePath(path.relative(rootDir, absPath));
  return {
    savedPath: relPath,
    downloadFilename: relPath
  };
}

function normalizeOptions(raw) {
  const reportNamePrefix = sanitizePrefix(raw.reportNamePrefix) || "orders-report";
  const pageTimeoutMs = clampNumber(raw.pageTimeoutMs, 60000, CONFIG.maxTimeoutMs, 180000);
  return {
    reportNamePrefix,
    pageTimeoutMs
  };
}

function normalizeBrowserMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return mode === "connect" ? "connect" : "launch";
}

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(parsed);
      } catch (_error) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json)
  });
  res.end(json);
}

function sanitizePrefix(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);
}

function sanitizeFileName(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const name = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, "");
  return name.slice(0, 120);
}

function sanitizeRelativePath(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "amazon";
  }
  const normalized = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim().replace(/[^a-zA-Z0-9._-]/g, ""))
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
  return normalized || "amazon";
}

function buildFileName(prefix, ext) {
  const safePrefix = sanitizePrefix(prefix) || "orders-report";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  return `${safePrefix}_${stamp}${ext || ".csv"}`;
}

function inferExtension(url, contentType) {
  const fromUrl = (() => {
    try {
      const u = new URL(url);
      const match = u.pathname.match(/\.[a-zA-Z0-9]+$/);
      return match ? match[0].toLowerCase() : "";
    } catch (_error) {
      return "";
    }
  })();
  if (fromUrl) {
    return fromUrl;
  }

  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("csv")) {
    return ".csv";
  }
  if (ct.includes("json")) {
    return ".json";
  }
  if (ct.includes("excel") || ct.includes("spreadsheetml")) {
    return ".xlsx";
  }
  if (ct.includes("tab-separated")) {
    return ".tsv";
  }
  return ".csv";
}

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/");
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, num));
}

function isLoginUrl(url) {
  const text = String(url || "").toLowerCase();
  return text.includes("signin") || text.includes("/ap/");
}

function runOrderWorkflowInPage(payload) {
  const ORDERS_PAGE_PATH_LOCAL = "/order-reports-and-feeds/reports/allOrders";
  const REQUEST_BUTTON_TEXTS = [
    "create report",
    "request report",
    "generate report",
    "run report",
    "创建报告",
    "请求报告",
    "生成报告"
  ];
  const DOWNLOAD_TEXTS = ["download", "下载"];
  const READY_TEXTS = ["ready", "completed", "done", "available", "已完成", "完成", "就绪"];

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeText(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function containsAny(text, patterns) {
    return patterns.some((item) => text.includes(item));
  }

  function isElementVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return element.getClientRects().length > 0;
  }

  function getRawHref(element) {
    return String(element.getAttribute("href") || "").trim();
  }

  function isJavascriptHref(href) {
    return href.toLowerCase().startsWith("javascript:");
  }

  function normalizeUrl(href) {
    return new URL(href, window.location.origin).toString();
  }

  function scoreDownloadUrl(url) {
    const value = String(url).toLowerCase();
    let score = 0;
    if (value.includes("download")) {
      score += 5;
    }
    if (value.includes("report")) {
      score += 2;
    }
    if (/\.(csv|txt|tsv|xlsx)(\?|$)/.test(value)) {
      score += 3;
    }
    return score;
  }

  function findDownloadTarget(scope) {
    const links = Array.from(scope.querySelectorAll("a[href]")).filter((link) => isElementVisible(link));
    const candidates = [];

    for (const link of links) {
      const text = normalizeText(link.innerText || link.textContent || "");
      if (!containsAny(text, DOWNLOAD_TEXTS)) {
        continue;
      }
      const rawHref = getRawHref(link);
      if (isJavascriptHref(rawHref)) {
        continue;
      }
      const resolvedUrl = link.href ? normalizeUrl(link.href) : "";
      if (/^https?:\/\//i.test(resolvedUrl)) {
        candidates.push({
          element: link,
          href: resolvedUrl,
          score: scoreDownloadUrl(resolvedUrl)
        });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return { element: candidates[0].element, href: candidates[0].href };
    }

    const buttons = Array.from(scope.querySelectorAll("button, [role='button']")).filter((btn) => isElementVisible(btn));
    for (const button of buttons) {
      const text = normalizeText(button.innerText || button.textContent || "");
      if (containsAny(text, DOWNLOAD_TEXTS)) {
        return { element: button, href: "" };
      }
    }

    return null;
  }

  function findButtonByText(texts) {
    const controls = Array.from(document.querySelectorAll("button, [role='button'], a"));
    for (const control of controls) {
      if (!isElementVisible(control)) {
        continue;
      }
      const text = normalizeText(control.innerText || control.textContent || "");
      if (!containsAny(text, texts)) {
        continue;
      }
      if (control instanceof HTMLAnchorElement) {
        const rawHref = getRawHref(control);
        if (isJavascriptHref(rawHref)) {
          continue;
        }
      }
      return control;
    }
    return null;
  }

  function getReportRows() {
    const selectors = ["table tbody tr", "[role='rowgroup'] [role='row']", "[data-testid*='row']"];
    for (const selector of selectors) {
      const rows = Array.from(document.querySelectorAll(selector)).filter((row) => isElementVisible(row));
      if (rows.length > 0) {
        return rows;
      }
    }
    return [];
  }

  function isReadyText(text) {
    return containsAny(text, READY_TEXTS);
  }

  function buildRowSignature(row) {
    return normalizeText((row.innerText || "").slice(0, 240));
  }

  function collectReadyRowSignatures() {
    const set = new Set();
    for (const row of getReportRows()) {
      const text = normalizeText(row.innerText || "");
      if (isReadyText(text) && findDownloadTarget(row)) {
        set.add(buildRowSignature(row));
      }
    }
    return set;
  }

  function findReadyRowCandidate(baselineReady, requireNew) {
    const rows = getReportRows();
    for (const row of rows) {
      const text = normalizeText(row.innerText || "");
      if (!isReadyText(text)) {
        continue;
      }
      const signature = buildRowSignature(row);
      if (requireNew && baselineReady.has(signature)) {
        continue;
      }
      if (!findDownloadTarget(row)) {
        continue;
      }
      return { row, signature };
    }
    return null;
  }

  function safeClick(element) {
    if (!element) {
      return false;
    }
    if (element instanceof HTMLAnchorElement) {
      const rawHref = getRawHref(element);
      if (isJavascriptHref(rawHref)) {
        return false;
      }
    }
    element.click();
    return true;
  }

  async function waitForReadyDownload(timeoutMs, baselineReady, requestClicked, logs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const candidate = findReadyRowCandidate(baselineReady, requestClicked);
      if (candidate) {
        return candidate;
      }
      await wait(2000);
    }
    logs.push("Timed out waiting for a ready row.");
    return findReadyRowCandidate(new Set(), false);
  }

  async function run() {
    const logs = [];
    if (!window.location.pathname.includes(ORDERS_PAGE_PATH_LOCAL)) {
      throw new Error("Current page is not the allOrders report page.");
    }

    await wait(500);
    const baselineReady = collectReadyRowSignatures();
    logs.push(`Existing ready rows: ${baselineReady.size}`);

    let requestClicked = false;
    const requestButton = findButtonByText(REQUEST_BUTTON_TEXTS);
    if (requestButton && safeClick(requestButton)) {
      requestClicked = true;
      logs.push("Triggered report request button.");
      await wait(1200);
    }

    const timeoutMs = clampNumber(payload?.pageTimeoutMs, 60000, 600000, 180000);
    const readyCandidate = await waitForReadyDownload(timeoutMs, baselineReady, requestClicked, logs);
    if (!readyCandidate) {
      throw new Error("No ready report row with download action was found.");
    }

    const target = findDownloadTarget(readyCandidate.row) || findDownloadTarget(document);
    if (!target) {
      throw new Error("Ready report found but download control is missing.");
    }

    if (target.href) {
      logs.push("Resolved download URL.");
      return {
        logs,
        downloadUrl: target.href,
        downloadFilename: "",
        requestClicked
      };
    }

    safeClick(target.element);
    logs.push("Triggered in-page download click.");
    return {
      logs,
      pageTriggeredDownload: true,
      requestClicked
    };
  }

  return run();
}
