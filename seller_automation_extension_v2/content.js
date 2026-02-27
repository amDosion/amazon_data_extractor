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

  sendResponse({ ok: false, error: `Unknown action: ${request?.action}` });
  return false;
});

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
    safeClick(requestButton);
    requestClicked = true;
    logs.push("Triggered report request button.");
    await wait(1200);
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
  const links = Array.from(scope.querySelectorAll("a[href]"));
  for (const link of links) {
    const text = normalizeText(link.innerText || link.textContent || "");
    if (containsAny(text, DOWNLOAD_TEXTS)) {
      return { element: link, href: link.href };
    }
  }

  const buttons = Array.from(scope.querySelectorAll("button, [role='button']"));
  for (const button of buttons) {
    const text = normalizeText(button.innerText || button.textContent || "");
    if (containsAny(text, DOWNLOAD_TEXTS)) {
      return { element: button, href: null };
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
    if (containsAny(text, texts)) {
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
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
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