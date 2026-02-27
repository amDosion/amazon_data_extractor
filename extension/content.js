const ORDERS_PAGE_PATH = "/order-reports-and-feeds/reports/allOrders";

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
const ASIN_REGEX = /^[A-Z0-9]{10}$/i;

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action === "health.ping") {
    sendResponse({ ok: true, href: window.location.href });
    return false;
  }

  if (request?.action === "orders.execute") {
    executeOrderReportWorkflow(request.payload || {})
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request?.action === "product.fetchApis") {
    fetchProductApiBundle(request.payload || {})
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request?.action === "product.detectAsin") {
    sendResponse({ ok: true, asin: detectAsinFromPage() });
    return false;
  }

  sendResponse({ ok: false, error: `Unknown action: ${request?.action}` });
  return false;
});

async function fetchProductApiBundle(payload) {
  const asin = String(payload.asin || "").trim().toUpperCase();
  if (!ASIN_REGEX.test(asin)) {
    throw new Error("Invalid ASIN format.");
  }

  const endpoints = {
    targets: `https://sellercentral.amazon.com/api/experiments/v2/targets?experimentType=TITLE&targetType=ASIN&searchTerms=${encodeURIComponent(
      asin
    )}`,
    v3: `https://sellercentral.amazon.com/abis/ajax/reconciledDetailsV3?asin=${encodeURIComponent(asin)}`,
    v2: `https://sellercentral.amazon.com/abis/ajax/reconciledDetailsV2?asin=${encodeURIComponent(asin)}`
  };

  const [targets, v3, v2] = await Promise.all([
    fetchJsonEndpoint(endpoints.targets),
    fetchJsonEndpoint(endpoints.v3),
    fetchJsonEndpoint(endpoints.v2)
  ]);

  return {
    asin,
    targets,
    v3,
    v2
  };
}

function detectAsinFromPage() {
  const urlCandidates = [
    window.location.href.match(/[?&]asin=([A-Z0-9]{10})/i),
    window.location.pathname.match(/\/([A-Z0-9]{10})(?:[/?#]|$)/i)
  ];

  for (const match of urlCandidates) {
    if (match?.[1] && ASIN_REGEX.test(match[1])) {
      return match[1].toUpperCase();
    }
  }

  const selectors = [
    "[data-asin]",
    "#asin",
    ".asin",
    "[data-testid*='asin']",
    "[id*='asin']"
  ];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    for (const node of nodes) {
      const raw = node.getAttribute("data-asin") || node.textContent || "";
      const found = raw.match(/[A-Z0-9]{10}/i);
      if (found?.[0] && ASIN_REGEX.test(found[0])) {
        return found[0].toUpperCase();
      }
    }
  }

  return null;
}

async function fetchJsonEndpoint(url) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include"
  });

  const responseUrl = response.url || url;
  const maybeLogin = /signin|ap\/|login/i.test(responseUrl);
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  if (maybeLogin) {
    throw new Error("Seller Central session invalid. Please log in again.");
  }

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    const htmlLike = rawText.trim().startsWith("<");
    if (htmlLike) {
      throw new Error("Response is not JSON. Check Seller Central login/session.");
    }
    throw new Error("Invalid JSON response from Seller Central API.");
  }
}

async function executeOrderReportWorkflow(payload) {
  const logs = [];

  if (!window.location.pathname.includes(ORDERS_PAGE_PATH)) {
    throw new Error("Current page is not the allOrders report page.");
  }

  logs.push(`Page detected: ${window.location.pathname}`);

  await waitForDomStable();

  const baselineReady = collectReadyRowSignatures();
  logs.push(`Existing ready rows: ${baselineReady.size}`);

  const requestButton = findButtonByText(REQUEST_BUTTON_TEXTS);
  let requestClicked = false;

  if (requestButton) {
    if (safeClick(requestButton)) {
      requestClicked = true;
      logs.push("Triggered report request button.");
      await wait(1200);
    } else {
      logs.push("Skipped javascript: request control to avoid CSP.");
    }
  } else {
    logs.push("Request button not found. Will try latest ready report.");
  }

  const timeoutMs = clampNumber(payload.pageTimeoutMs, 60000, 600000, 180000);
  const readyCandidate = await waitForReadyDownload({
    timeoutMs,
    baselineReady,
    requestClicked,
    logs
  });

  if (!readyCandidate) {
    throw new Error("No ready report row with download action was found.");
  }

  const { row, signature } = readyCandidate;
  logs.push(`Ready row selected: ${signature.slice(0, 80)}`);

  const downloadTarget = findDownloadTarget(row) || findDownloadTarget(document);
  if (!downloadTarget) {
    throw new Error("Ready report found but download control is missing.");
  }

  if (downloadTarget.href) {
    const url = normalizeUrl(downloadTarget.href);
    const filename = buildFilename(payload.reportNamePrefix, url);
    logs.push(`Download URL resolved: ${trimForLog(url)}`);

    return {
      logs,
      downloadUrl: url,
      downloadFilename: filename,
      requestClicked
    };
  }

  if (downloadTarget.javascriptHref) {
    throw new Error("Download control resolved to javascript: URL, blocked by page CSP. Please try again after report list refresh.");
  }

  safeClick(downloadTarget.element);
  logs.push("Triggered in-page download click.");

  return {
    logs,
    pageTriggeredDownload: true,
    requestClicked
  };
}

async function waitForReadyDownload(options) {
  const start = Date.now();
  const timeoutMs = options.timeoutMs;

  while (Date.now() - start < timeoutMs) {
    const candidate = findReadyRowCandidate(options.baselineReady, options.requestClicked);
    if (candidate) {
      return candidate;
    }

    await wait(2000);
  }

  options.logs.push("Timed out waiting for a ready row.");

  return findReadyRowCandidate(new Set(), false);
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

    const hasDownload = Boolean(findDownloadTarget(row));
    if (!hasDownload) {
      continue;
    }

    return { row, signature };
  }

  return null;
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

function findDownloadTarget(scope) {
  const links = Array.from(scope.querySelectorAll("a[href]")).filter((link) => isElementVisible(link));
  const candidates = [];
  let javascriptFallback = null;

  for (const link of links) {
    const text = normalizeText(link.innerText || link.textContent || "");
    if (!containsAny(text, DOWNLOAD_TEXTS)) {
      continue;
    }

    const rawHref = getRawHref(link);
    if (isJavascriptHref(rawHref)) {
      if (!javascriptFallback) {
        javascriptFallback = { element: link, href: null, javascriptHref: rawHref };
      }
      continue;
    }

    const extractedUrl = extractDownloadUrlFromAttributes(link);
    const resolvedUrl = extractedUrl || link.href;
    if (isHttpDownloadUrl(resolvedUrl)) {
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
      return { element: button, href: null };
    }
  }

  return javascriptFallback;
}

function findButtonByText(texts) {
  const controls = Array.from(document.querySelectorAll("button, [role='button'], a"));

  for (const control of controls) {
    if (!isElementVisible(control)) {
      continue;
    }

    const text = normalizeText(control.innerText || control.textContent || "");
    if (containsAny(text, texts)) {
      if (control instanceof HTMLAnchorElement) {
        const rawHref = getRawHref(control);
        if (isJavascriptHref(rawHref)) {
          continue;
        }
      }
      return control;
    }
  }

  return null;
}

function isReadyText(text) {
  return containsAny(text, READY_TEXTS);
}

function containsAny(text, patterns) {
  return patterns.some((item) => text.includes(item));
}

function normalizeText(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, " ");
}

function buildRowSignature(row) {
  return normalizeText((row.innerText || "").slice(0, 240));
}

function normalizeUrl(href) {
  return new URL(href, window.location.origin).toString();
}

function getRawHref(element) {
  return String(element.getAttribute("href") || "").trim();
}

function isJavascriptHref(href) {
  return href.toLowerCase().startsWith("javascript:");
}

function extractDownloadUrlFromAttributes(element) {
  const attrNames = [
    "data-url",
    "data-href",
    "data-download-url",
    "data-download",
    "download-url",
    "href"
  ];

  for (const name of attrNames) {
    const value = String(element.getAttribute(name) || "").trim();
    if (!value || isJavascriptHref(value)) {
      continue;
    }

    try {
      const normalized = normalizeUrl(value);
      if (isHttpDownloadUrl(normalized)) {
        return normalized;
      }
    } catch (_error) {
      // Ignore malformed URL.
    }
  }

  return null;
}

function isHttpDownloadUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
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

function buildFilename(prefix, url) {
  const safePrefix = sanitizePrefix(prefix) || "orders-report";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  const ext = guessExtension(url);
  return `amazon/${safePrefix}_${stamp}${ext}`;
}

function sanitizePrefix(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

function guessExtension(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\.[a-zA-Z0-9]+$/);
    if (match) {
      return match[0];
    }
  } catch (_error) {
    // Ignore.
  }

  return ".csv";
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

  if (typeof element.click === "function") {
    element.click();
    return true;
  }

  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
  return true;
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

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, num));
}

function trimForLog(text) {
  if (text.length <= 140) {
    return text;
  }

  return `${text.slice(0, 140)}...`;
}

async function waitForDomStable() {
  if (document.readyState === "complete") {
    await wait(250);
    return;
  }

  await new Promise((resolve) => {
    const listener = () => {
      if (document.readyState === "complete") {
        document.removeEventListener("readystatechange", listener);
        resolve();
      }
    };

    document.addEventListener("readystatechange", listener);
    setTimeout(resolve, 4000);
  });

  await wait(250);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
