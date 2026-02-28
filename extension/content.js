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

  if (request?.action === "ads.fetchReport") {
    fetchAdsReportData(request.payload || {})
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request?.action === "inventory.fetch") {
    fetchInventoryBundle(request.payload || {})
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request?.action === "reviews.scrape") {
    scrapeReviewsFromPage()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
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

// =====================================================
// ===== 广告报告数据提取 =====
// =====================================================
async function fetchAdsReportData(payload) {
  const reportType = String(payload.reportType || "sp").toLowerCase();
  const dateRange = String(payload.dateRange || "LAST_30_DAYS");
  const asinFilter = String(payload.asinFilter || "").trim();

  // Seller Central 广告 API 端点
  const endpoints = {
    // 广告活动概览
    campaigns: "https://sellercentral.amazon.com/api/advertising/campaigns",
    // 广告组数据
    adGroups: "https://sellercentral.amazon.com/api/advertising/ad-groups",
    // 广告性能摘要
    performance: "https://sellercentral.amazon.com/api/advertising/performance/summary"
  };

  // 尝试从页面 DOM 提取广告数据（适用于已在广告页面的情况）
  const domData = extractAdsDataFromDom();

  // 尝试 API 调用
  let apiData = null;
  try {
    const performanceUrl = `${endpoints.performance}?dateRange=${encodeURIComponent(dateRange)}&reportType=${encodeURIComponent(reportType)}`;
    apiData = await fetchJsonEndpoint(performanceUrl);
  } catch (_error) {
    // API 可能不可用，回退到 DOM 提取
  }

  // 合并数据源
  const result = {
    reportType,
    dateRange,
    source: apiData ? "api" : domData ? "dom" : "unavailable",
    campaigns: [],
    summary: {
      totalSpend: 0,
      totalSales: 0,
      totalImpressions: 0,
      totalClicks: 0,
      acos: 0,
      roas: 0,
      ctr: 0,
      cpc: 0
    }
  };

  if (apiData) {
    result.summary = extractAdsSummaryFromApi(apiData);
    result.campaigns = extractCampaignsFromApi(apiData);
  } else if (domData) {
    result.summary = domData.summary;
    result.campaigns = domData.campaigns;
  }

  // ASIN 过滤
  if (asinFilter && result.campaigns.length > 0) {
    const filterAsins = new Set(asinFilter.split(/[\s,]+/).map((a) => a.trim().toUpperCase()).filter(Boolean));
    if (filterAsins.size > 0) {
      result.campaigns = result.campaigns.filter((c) =>
        !c.asin || filterAsins.has(c.asin.toUpperCase())
      );
    }
  }

  return result;
}

function extractAdsDataFromDom() {
  // 尝试从广告管理页面的表格中提取数据
  const tables = document.querySelectorAll("table, [role='grid']");
  if (tables.length === 0) return null;

  const campaigns = [];
  let totalSpend = 0, totalSales = 0, totalImpressions = 0, totalClicks = 0;

  for (const table of tables) {
    const rows = table.querySelectorAll("tbody tr, [role='row']");
    for (const row of rows) {
      const cells = row.querySelectorAll("td, [role='gridcell']");
      if (cells.length < 3) continue;

      const texts = Array.from(cells).map((c) => c.textContent?.trim() || "");
      const campaign = {
        name: texts[0] || "",
        status: "",
        spend: 0,
        sales: 0,
        impressions: 0,
        clicks: 0,
        acos: 0
      };

      // 尝试解析数值（支持 $1,234.56 格式）
      for (const text of texts) {
        const numMatch = text.replace(/[$,¥€£]/g, "").match(/[\d.]+/);
        if (!numMatch) continue;
        const num = parseFloat(numMatch[0]);
        if (isNaN(num)) continue;

        const lower = text.toLowerCase();
        if (lower.includes("spend") || lower.includes("花费") || (text.startsWith("$") && campaign.spend === 0)) {
          campaign.spend = num;
          totalSpend += num;
        } else if (lower.includes("sales") || lower.includes("销售") || (text.startsWith("$") && campaign.sales === 0)) {
          campaign.sales = num;
          totalSales += num;
        } else if (lower.includes("%") && campaign.acos === 0) {
          campaign.acos = num;
        }
      }

      if (campaign.name) campaigns.push(campaign);
    }
  }

  // 也尝试从页面摘要区域提取
  const summarySelectors = [
    "[data-testid*='spend']", "[data-testid*='sales']", "[data-testid*='acos']",
    ".metric-value", ".kpi-value", "[class*='spend']", "[class*='sales']"
  ];

  for (const sel of summarySelectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent?.trim() || "";
      const numMatch = text.replace(/[$,¥€£]/g, "").match(/[\d.]+/);
      if (!numMatch) continue;
      const num = parseFloat(numMatch[0]);
      if (isNaN(num)) continue;

      const context = (el.closest("[class]")?.className || "").toLowerCase() + " " + (el.getAttribute("data-testid") || "").toLowerCase();
      if (context.includes("spend") && totalSpend === 0) totalSpend = num;
      if (context.includes("sales") && totalSales === 0) totalSales = num;
    }
  }

  const acos = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
  const roas = totalSpend > 0 ? totalSales / totalSpend : 0;

  return {
    summary: {
      totalSpend,
      totalSales,
      totalImpressions,
      totalClicks,
      acos: parseFloat(acos.toFixed(1)),
      roas: parseFloat(roas.toFixed(2)),
      ctr: 0,
      cpc: 0
    },
    campaigns
  };
}

function extractAdsSummaryFromApi(data) {
  if (!data || typeof data !== "object") return { totalSpend: 0, totalSales: 0, totalImpressions: 0, totalClicks: 0, acos: 0, roas: 0, ctr: 0, cpc: 0 };

  const spend = parseFloat(data.totalSpend || data.spend || data.cost || 0);
  const sales = parseFloat(data.totalSales || data.sales || data.attributedSales || 0);
  const impressions = parseInt(data.totalImpressions || data.impressions || 0, 10);
  const clicks = parseInt(data.totalClicks || data.clicks || 0, 10);
  const acos = sales > 0 ? (spend / sales) * 100 : 0;
  const roas = spend > 0 ? sales / spend : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;

  return {
    totalSpend: spend,
    totalSales: sales,
    totalImpressions: impressions,
    totalClicks: clicks,
    acos: parseFloat(acos.toFixed(1)),
    roas: parseFloat(roas.toFixed(2)),
    ctr: parseFloat(ctr.toFixed(2)),
    cpc: parseFloat(cpc.toFixed(2))
  };
}

function extractCampaignsFromApi(data) {
  const list = data?.campaigns || data?.results || data?.items || [];
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    name: item.name || item.campaignName || "",
    status: item.status || item.state || "",
    asin: item.asin || "",
    spend: parseFloat(item.spend || item.cost || 0),
    sales: parseFloat(item.sales || item.attributedSales || 0),
    impressions: parseInt(item.impressions || 0, 10),
    clicks: parseInt(item.clicks || 0, 10),
    acos: parseFloat(item.acos || 0)
  }));
}

// =====================================================
// ===== 库存数据提取 =====
// =====================================================
async function fetchInventoryBundle(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];

  // Seller Central 库存 API 端点
  const endpoints = {
    inventory: "https://sellercentral.amazon.com/restockInventory/api/inventory",
    fbaInventory: "https://sellercentral.amazon.com/api/fba-inventory",
    inventoryHealth: "https://sellercentral.amazon.com/inventoryplanning/api/inventory-health"
  };

  let inventoryData = null;
  const errors = [];

  // 尝试多个 API 端点
  for (const [name, url] of Object.entries(endpoints)) {
    try {
      inventoryData = await fetchJsonEndpoint(url);
      if (inventoryData) break;
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  // 回退到 DOM 提取
  const domData = extractInventoryFromDom();

  const result = {
    source: inventoryData ? "api" : domData ? "dom" : "unavailable",
    items: [],
    summary: {
      totalAvailable: 0,
      totalInbound: 0,
      totalReserved: 0,
      totalUnfulfillable: 0,
      avgDaysOfSupply: 0,
      lowStockCount: 0
    },
    errors
  };

  if (inventoryData) {
    result.items = extractInventoryItemsFromApi(inventoryData, items);
  } else if (domData) {
    result.items = domData.items;
  }

  // 计算汇总
  for (const item of result.items) {
    result.summary.totalAvailable += item.available || 0;
    result.summary.totalInbound += item.inbound || 0;
    result.summary.totalReserved += item.reserved || 0;
    result.summary.totalUnfulfillable += item.unfulfillable || 0;
    if (item.daysOfSupply > 0) {
      result.summary.avgDaysOfSupply += item.daysOfSupply;
    }
    if (item.daysOfSupply > 0 && item.daysOfSupply < 14) {
      result.summary.lowStockCount++;
    }
  }

  if (result.items.length > 0) {
    result.summary.avgDaysOfSupply = Math.round(result.summary.avgDaysOfSupply / result.items.length);
  }

  return result;
}

function extractInventoryFromDom() {
  const tables = document.querySelectorAll("table, [role='grid']");
  if (tables.length === 0) return null;

  const items = [];
  for (const table of tables) {
    const rows = table.querySelectorAll("tbody tr, [role='row']");
    for (const row of rows) {
      const cells = row.querySelectorAll("td, [role='gridcell']");
      if (cells.length < 2) continue;

      const texts = Array.from(cells).map((c) => c.textContent?.trim() || "");
      const asinMatch = texts.join(" ").match(/[A-Z0-9]{10}/i);

      items.push({
        asin: asinMatch ? asinMatch[0].toUpperCase() : "",
        sku: texts[0] || "",
        available: parseInt(texts.find((t) => /^\d+$/.test(t)) || "0", 10),
        inbound: 0,
        reserved: 0,
        unfulfillable: 0,
        daysOfSupply: 0
      });
    }
  }

  return items.length > 0 ? { items } : null;
}

function extractInventoryItemsFromApi(data, filterItems) {
  const list = data?.inventoryItems || data?.items || data?.results || [];
  if (!Array.isArray(list)) return [];

  const filterSet = filterItems.length > 0
    ? new Set(filterItems.map((i) => i.toUpperCase()))
    : null;

  return list
    .map((item) => ({
      asin: item.asin || "",
      sku: item.sku || item.sellerSku || "",
      title: item.productName || item.title || "",
      available: parseInt(item.availableQuantity || item.fulfillableQuantity || item.available || 0, 10),
      inbound: parseInt(item.inboundQuantity || item.inbound || 0, 10),
      reserved: parseInt(item.reservedQuantity || item.reserved || 0, 10),
      unfulfillable: parseInt(item.unfulfillableQuantity || item.unfulfillable || 0, 10),
      daysOfSupply: parseInt(item.daysOfSupply || item.estimatedDaysOfSupply || 0, 10)
    }))
    .filter((item) => {
      if (!filterSet) return true;
      return filterSet.has(item.asin.toUpperCase()) || filterSet.has(item.sku.toUpperCase());
    });
}

// =====================================================
// ===== 评论抓取 =====
// =====================================================
async function scrapeReviewsFromPage() {
  const reviews = [];

  // 尝试从当前页面抓取评论
  const reviewSelectors = [
    "[data-hook='review']",
    ".review",
    "[class*='review-card']",
    "[data-testid*='review']",
    ".a-section.review"
  ];

  for (const selector of reviewSelectors) {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length === 0) continue;

    for (const node of nodes) {
      const titleEl = node.querySelector("[data-hook='review-title'], .review-title, [class*='review-title']");
      const bodyEl = node.querySelector("[data-hook='review-body'], .review-text, [class*='review-body']");
      const ratingEl = node.querySelector("[data-hook='review-star-rating'], .review-rating, [class*='star-rating']");
      const dateEl = node.querySelector("[data-hook='review-date'], .review-date, [class*='review-date']");

      const title = titleEl?.textContent?.trim() || "";
      const body = bodyEl?.textContent?.trim() || "";
      const ratingText = ratingEl?.textContent?.trim() || ratingEl?.getAttribute("class") || "";
      const ratingMatch = ratingText.match(/(\d(?:\.\d)?)/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
      const date = dateEl?.textContent?.trim() || "";

      if (body || title) {
        reviews.push({ title, body, rating, date });
      }
    }

    if (reviews.length > 0) break;
  }

  // 检测 ASIN
  const asin = detectAsinFromPage();

  return {
    asin,
    reviewCount: reviews.length,
    reviews,
    source: reviews.length > 0 ? "dom" : "unavailable"
  };
}
