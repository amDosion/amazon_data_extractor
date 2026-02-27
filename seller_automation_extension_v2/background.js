const ORDERS_PAGE_URL = "https://sellercentral.amazon.com/order-reports-and-feeds/reports/allOrders#";
const ORDERS_PAGE_PATH = "/order-reports-and-feeds/reports/allOrders";
const ORDERS_TAB_QUERY = "https://sellercentral.amazon.com/order-reports-and-feeds/reports/allOrders*";

const STORAGE_KEYS = {
  config: "sellerAutomationConfigV2",
  logs: "sellerAutomationLogsV2"
};

const ALARM_NAME = "orders-report-schedule-v2";
const MAX_LOG_ITEMS = 300;

const DEFAULT_CONFIG = {
  modules: {
    orders: {
      enabled: true,
      defaults: {
        datePreset: "LAST_7_DAYS",
        reportNamePrefix: "orders-report",
        pageTimeoutMs: 180000
      }
    },
    ads: {
      enabled: false,
      planned: true
    },
    payments: {
      enabled: false,
      planned: true
    }
  },
  scheduler: {
    enabled: false,
    everyHours: 12
  },
  behavior: {
    closeAutomationTabAfterRun: true,
    keepRunsSilent: true
  }
};

let activeRunPromise = null;

chrome.runtime.onInstalled.addListener(async () => {
  await ensureConfig();
  await syncAlarmWithConfig();
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    await appendLog({
      level: "warning",
      scope: "system",
      trigger: "system",
      message: "Side panel behavior setup failed",
      details: { error: error.message }
    });
  }

  await appendLog({
    level: "info",
    scope: "system",
    trigger: "system",
    message: "V2 extension initialized"
  });
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureConfig();
  await syncAlarmWithConfig();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  try {
    await runOrderReportTask({}, { trigger: "alarm" });
  } catch (error) {
    await appendLog({
      level: "error",
      scope: "orders",
      trigger: "alarm",
      message: "Scheduled run failed",
      details: { error: error.message }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch(async (error) => {
      await appendLog({
        level: "error",
        scope: "system",
        trigger: "manual",
        message: "Message handling error",
        details: {
          action: request?.action,
          error: error.message
        }
      });
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleMessage(request, sender) {
  switch (request?.action) {
    case "ui.getBootstrap": {
      const [config, logs] = await Promise.all([getConfig(), getLogs()]);
      return {
        config,
        logs,
        busy: Boolean(activeRunPromise),
        modules: {
          orders: "active",
          ads: "planned",
          payments: "planned"
        }
      };
    }

    case "orders.runNow": {
      if (activeRunPromise) {
        throw new Error("Another run is already in progress.");
      }

      return await runOrderReportTask(request.payload ?? {}, {
        trigger: "manual",
        senderTabId: sender?.tab?.id ?? null
      });
    }

    case "settings.updateOrders": {
      const config = await getConfig();
      const payload = request.payload ?? {};

      config.modules.orders.defaults.datePreset = normalizeDatePreset(payload.datePreset);
      config.modules.orders.defaults.reportNamePrefix =
        sanitizePrefix(payload.reportNamePrefix) || DEFAULT_CONFIG.modules.orders.defaults.reportNamePrefix;
      config.modules.orders.defaults.pageTimeoutMs = clampNumber(payload.pageTimeoutMs, 60000, 600000, 180000);
      config.behavior.closeAutomationTabAfterRun = Boolean(payload.closeAutomationTabAfterRun);

      await setConfig(config);
      await appendLog({
        level: "info",
        scope: "system",
        trigger: "manual",
        message: "Order settings updated",
        details: {
          datePreset: config.modules.orders.defaults.datePreset,
          reportNamePrefix: config.modules.orders.defaults.reportNamePrefix,
          pageTimeoutMs: config.modules.orders.defaults.pageTimeoutMs,
          closeAutomationTabAfterRun: config.behavior.closeAutomationTabAfterRun
        }
      });

      return { config };
    }

    case "schedule.update": {
      const config = await getConfig();
      const payload = request.payload ?? {};

      config.scheduler.enabled = Boolean(payload.enabled);
      config.scheduler.everyHours = clampNumber(payload.everyHours, 1, 24, 12);

      await setConfig(config);
      await syncAlarmWithConfig(config);

      await appendLog({
        level: "info",
        scope: "scheduler",
        trigger: "manual",
        message: config.scheduler.enabled ? "Scheduler enabled" : "Scheduler disabled",
        details: {
          everyHours: config.scheduler.everyHours
        }
      });

      return { scheduler: config.scheduler };
    }

    case "logs.clear": {
      await chrome.storage.local.set({ [STORAGE_KEYS.logs]: [] });
      return { cleared: true };
    }

    case "logs.list": {
      return { logs: await getLogs() };
    }

    default:
      throw new Error(`Unknown action: ${request?.action}`);
  }
}

async function runOrderReportTask(inputOptions, context) {
  const config = await getConfig();
  const options = {
    datePreset: normalizeDatePreset(inputOptions.datePreset || config.modules.orders.defaults.datePreset),
    reportNamePrefix: sanitizePrefix(inputOptions.reportNamePrefix || config.modules.orders.defaults.reportNamePrefix),
    pageTimeoutMs: clampNumber(
      inputOptions.pageTimeoutMs || config.modules.orders.defaults.pageTimeoutMs,
      60000,
      600000,
      180000
    )
  };

  const runId = crypto.randomUUID();
  const trigger = context.trigger || "manual";
  const startedAt = new Date().toISOString();

  await appendLog({
    level: "info",
    scope: "orders",
    trigger,
    message: "Order report run started",
    details: {
      runId,
      options
    }
  });

  const runTask = executeOrderRun(runId, options, config, context, trigger, startedAt);
  activeRunPromise = runTask;

  try {
    return await runTask;
  } finally {
    activeRunPromise = null;
  }
}

async function executeOrderRun(runId, options, config, context, trigger, startedAt) {
  let createdTabId = null;

  try {
    const target = await acquireOrdersTab(context);
    createdTabId = target.createdTabId;

    await ensureTabReady(target.tab.id, ORDERS_PAGE_PATH, options.pageTimeoutMs);
    await ensureContentScriptReady(target.tab.id, options.pageTimeoutMs);

    const contentResult = await chrome.tabs.sendMessage(target.tab.id, {
      action: "orders.execute",
      payload: {
        datePreset: options.datePreset,
        reportNamePrefix: options.reportNamePrefix,
        pageTimeoutMs: options.pageTimeoutMs
      }
    });

    if (!contentResult?.ok) {
      throw new Error(contentResult?.error || "Content workflow failed.");
    }

    const finalResult = {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      trigger,
      pageLogs: contentResult.logs ?? []
    };

    if (contentResult.downloadUrl) {
      const filename = contentResult.downloadFilename || buildDownloadFilename(options.reportNamePrefix, contentResult.downloadUrl);
      const downloadId = await chrome.downloads.download({
        url: contentResult.downloadUrl,
        filename,
        saveAs: false,
        conflictAction: "uniquify"
      });

      finalResult.download = {
        mode: "downloads-api",
        downloadId,
        filename
      };
    } else if (contentResult.pageTriggeredDownload) {
      finalResult.download = {
        mode: "in-page-click"
      };
    } else {
      finalResult.download = {
        mode: "none"
      };
    }

    await appendLog({
      level: "success",
      scope: "orders",
      trigger,
      message: "Order report run completed",
      details: finalResult
    });

    return finalResult;
  } catch (error) {
    const failed = {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      trigger,
      error: error.message
    };

    await appendLog({
      level: "error",
      scope: "orders",
      trigger,
      message: "Order report run failed",
      details: failed
    });

    throw error;
  } finally {
    if (createdTabId && config.behavior.closeAutomationTabAfterRun) {
      try {
        await chrome.tabs.remove(createdTabId);
      } catch (error) {
        await appendLog({
          level: "warning",
          scope: "system",
          trigger,
          message: "Failed to close automation tab",
          details: {
            tabId: createdTabId,
            error: error.message
          }
        });
      }
    }
  }
}

async function acquireOrdersTab(context) {
  const senderTabId = context?.senderTabId;

  if (senderTabId) {
    const senderTab = await safeGetTab(senderTabId);
    if (senderTab && senderTab.url?.includes(ORDERS_PAGE_PATH)) {
      return { tab: senderTab, createdTabId: null };
    }
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.url?.includes(ORDERS_PAGE_PATH)) {
    return { tab: activeTab, createdTabId: null };
  }

  const existing = await chrome.tabs.query({ url: ORDERS_TAB_QUERY });
  if (existing.length > 0) {
    return { tab: existing[0], createdTabId: null };
  }

  const tab = await chrome.tabs.create({
    url: ORDERS_PAGE_URL,
    active: false
  });

  return { tab, createdTabId: tab.id };
}

async function ensureTabReady(tabId, expectedPath, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const tab = await safeGetTab(tabId);
    if (!tab) {
      throw new Error("Target tab no longer exists.");
    }

    if (tab.status === "complete" && tab.url?.includes(expectedPath)) {
      return;
    }

    await wait(500);
  }

  throw new Error("Timed out waiting for Seller Central page load.");
}

async function ensureContentScriptReady(tabId, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { action: "health.ping" });
      if (pong?.ok) {
        return;
      }
    } catch (_error) {
      // Ignore and retry while content script gets attached.
    }

    await wait(350);
  }

  throw new Error("Timed out waiting for content script readiness.");
}

async function safeGetTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch (_error) {
    return null;
  }
}

function normalizeDatePreset(value) {
  const allowed = new Set(["LAST_1_DAY", "LAST_7_DAYS", "LAST_30_DAYS"]);
  if (allowed.has(value)) {
    return value;
  }

  return DEFAULT_CONFIG.modules.orders.defaults.datePreset;
}

function sanitizePrefix(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, num));
}

function buildDownloadFilename(prefix, url) {
  const safePrefix = sanitizePrefix(prefix) || "orders-report";
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  const extension = inferExtension(url);
  return `amazon/${safePrefix}_${timestamp}${extension}`;
}

function inferExtension(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\.[a-zA-Z0-9]+$/);
    if (match) {
      return match[0];
    }
  } catch (_error) {
    // Ignore URL parse error.
  }

  return ".csv";
}

async function ensureConfig() {
  const existing = await chrome.storage.local.get(STORAGE_KEYS.config);
  if (!existing[STORAGE_KEYS.config]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.config]: structuredClone(DEFAULT_CONFIG) });
    return structuredClone(DEFAULT_CONFIG);
  }

  const merged = mergeConfig(existing[STORAGE_KEYS.config]);
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: merged });
  return merged;
}

async function getConfig() {
  const current = await chrome.storage.local.get(STORAGE_KEYS.config);
  return mergeConfig(current[STORAGE_KEYS.config]);
}

async function setConfig(config) {
  const merged = mergeConfig(config);
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: merged });
}

function mergeConfig(raw) {
  const cfg = raw || {};
  return {
    modules: {
      orders: {
        enabled: cfg.modules?.orders?.enabled ?? DEFAULT_CONFIG.modules.orders.enabled,
        defaults: {
          datePreset: normalizeDatePreset(cfg.modules?.orders?.defaults?.datePreset),
          reportNamePrefix:
            sanitizePrefix(cfg.modules?.orders?.defaults?.reportNamePrefix) ||
            DEFAULT_CONFIG.modules.orders.defaults.reportNamePrefix,
          pageTimeoutMs: clampNumber(
            cfg.modules?.orders?.defaults?.pageTimeoutMs,
            60000,
            600000,
            DEFAULT_CONFIG.modules.orders.defaults.pageTimeoutMs
          )
        }
      },
      ads: {
        enabled: cfg.modules?.ads?.enabled ?? DEFAULT_CONFIG.modules.ads.enabled,
        planned: true
      },
      payments: {
        enabled: cfg.modules?.payments?.enabled ?? DEFAULT_CONFIG.modules.payments.enabled,
        planned: true
      }
    },
    scheduler: {
      enabled: cfg.scheduler?.enabled ?? DEFAULT_CONFIG.scheduler.enabled,
      everyHours: clampNumber(cfg.scheduler?.everyHours, 1, 24, DEFAULT_CONFIG.scheduler.everyHours)
    },
    behavior: {
      closeAutomationTabAfterRun:
        cfg.behavior?.closeAutomationTabAfterRun ?? DEFAULT_CONFIG.behavior.closeAutomationTabAfterRun,
      keepRunsSilent: true
    }
  };
}

async function syncAlarmWithConfig(providedConfig) {
  const config = providedConfig || (await getConfig());

  await chrome.alarms.clear(ALARM_NAME);

  if (!config.scheduler.enabled) {
    return;
  }

  const periodInMinutes = clampNumber(config.scheduler.everyHours * 60, 60, 1440, 720);
  const when = Date.now() + 10000;

  await chrome.alarms.create(ALARM_NAME, {
    when,
    periodInMinutes
  });
}

async function getLogs() {
  const storage = await chrome.storage.local.get(STORAGE_KEYS.logs);
  return storage[STORAGE_KEYS.logs] || [];
}

async function appendLog(entry) {
  const existing = await getLogs();
  const prepared = {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    level: entry.level || "info",
    scope: entry.scope || "system",
    trigger: entry.trigger || "system",
    message: entry.message || "",
    details: entry.details || null
  };

  const next = [prepared, ...existing].slice(0, MAX_LOG_ITEMS);
  await chrome.storage.local.set({ [STORAGE_KEYS.logs]: next });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

