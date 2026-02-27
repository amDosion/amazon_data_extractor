const state = {
  config: null,
  logs: [],
  busy: false
};

const els = {
  runState: document.getElementById("runState"),
  statusText: document.getElementById("statusText"),
  datePreset: document.getElementById("datePreset"),
  reportNamePrefix: document.getElementById("reportNamePrefix"),
  closeTabAfterRun: document.getElementById("closeTabAfterRun"),
  runNow: document.getElementById("runNow"),
  saveOrdersSettings: document.getElementById("saveOrdersSettings"),
  schedulerEnabled: document.getElementById("schedulerEnabled"),
  everyHours: document.getElementById("everyHours"),
  saveSchedule: document.getElementById("saveSchedule"),
  refreshLogs: document.getElementById("refreshLogs"),
  clearLogs: document.getElementById("clearLogs"),
  logsList: document.getElementById("logsList")
};

init().catch((error) => {
  setStatus(`初始化失败: ${error.message}`);
});

async function init() {
  bindEvents();
  await refreshBootstrap();
}

function bindEvents() {
  els.runNow.addEventListener("click", runNow);
  els.saveOrdersSettings.addEventListener("click", saveOrderSettings);
  els.saveSchedule.addEventListener("click", saveSchedule);
  els.refreshLogs.addEventListener("click", refreshLogs);
  els.clearLogs.addEventListener("click", clearLogs);
}

async function refreshBootstrap() {
  const response = await callBackground("ui.getBootstrap");
  state.config = response.config;
  state.logs = response.logs;
  state.busy = Boolean(response.busy);

  fillFormByConfig();
  renderLogs();
  renderBusyState();
  setStatus("准备就绪");
}

function fillFormByConfig() {
  if (!state.config) {
    return;
  }

  const orderDefaults = state.config.modules.orders.defaults;
  els.datePreset.value = orderDefaults.datePreset;
  els.reportNamePrefix.value = orderDefaults.reportNamePrefix;
  els.closeTabAfterRun.checked = Boolean(state.config.behavior.closeAutomationTabAfterRun);
  els.schedulerEnabled.checked = Boolean(state.config.scheduler.enabled);
  els.everyHours.value = String(state.config.scheduler.everyHours);
}

async function runNow() {
  setBusy(true);
  setStatus("正在执行订单报告下载...");

  try {
    const payload = {
      datePreset: els.datePreset.value,
      reportNamePrefix: sanitizePrefix(els.reportNamePrefix.value),
      pageTimeoutMs: state.config?.modules?.orders?.defaults?.pageTimeoutMs || 180000
    };

    const result = await callBackground("orders.runNow", payload);

    const mode = result.download?.mode || "none";
    const modeText =
      mode === "downloads-api"
        ? `已下载: ${result.download.filename}`
        : mode === "in-page-click"
          ? "页面内已触发下载"
          : "未检测到下载动作";

    setStatus(`执行完成 (${modeText})`);
  } catch (error) {
    setStatus(`执行失败: ${error.message}`);
  } finally {
    setBusy(false);
    await refreshLogs();
  }
}

async function saveOrderSettings() {
  try {
    const payload = {
      datePreset: els.datePreset.value,
      reportNamePrefix: sanitizePrefix(els.reportNamePrefix.value),
      closeAutomationTabAfterRun: els.closeTabAfterRun.checked,
      pageTimeoutMs: state.config?.modules?.orders?.defaults?.pageTimeoutMs || 180000
    };

    const result = await callBackground("settings.updateOrders", payload);
    state.config = result.config;
    fillFormByConfig();
    setStatus("订单设置已保存");
    await refreshLogs();
  } catch (error) {
    setStatus(`保存失败: ${error.message}`);
  }
}

async function saveSchedule() {
  try {
    const payload = {
      enabled: els.schedulerEnabled.checked,
      everyHours: Number(els.everyHours.value)
    };

    const result = await callBackground("schedule.update", payload);
    state.config.scheduler = result.scheduler;
    fillFormByConfig();
    setStatus(`定时任务已更新: ${result.scheduler.enabled ? "开启" : "关闭"}`);
    await refreshLogs();
  } catch (error) {
    setStatus(`定时任务保存失败: ${error.message}`);
  }
}

async function refreshLogs() {
  const result = await callBackground("logs.list");
  state.logs = result.logs;
  renderLogs();
}

async function clearLogs() {
  await callBackground("logs.clear");
  state.logs = [];
  renderLogs();
  setStatus("日志已清空");
}

function renderBusyState() {
  els.runState.textContent = state.busy ? "Running" : "Idle";
  els.runState.classList.toggle("running", state.busy);
  els.runState.classList.toggle("idle", !state.busy);

  const disabled = state.busy;
  els.runNow.disabled = disabled;
  els.saveOrdersSettings.disabled = disabled;
  els.saveSchedule.disabled = disabled;
}

function setBusy(next) {
  state.busy = Boolean(next);
  renderBusyState();
}

function renderLogs() {
  els.logsList.innerHTML = "";

  if (!state.logs || state.logs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "log-item info";
    empty.innerHTML = '<div class="log-msg">暂无日志</div>';
    els.logsList.appendChild(empty);
    return;
  }

  for (const item of state.logs.slice(0, 80)) {
    const node = document.createElement("article");
    node.className = `log-item ${item.level || "info"}`;

    const meta = document.createElement("div");
    meta.className = "log-meta";
    const localTime = new Date(item.time).toLocaleString();
    meta.textContent = `${localTime} | ${item.scope} | ${item.trigger}`;

    const msg = document.createElement("div");
    msg.className = "log-msg";
    msg.textContent = item.message || "(no message)";

    node.appendChild(meta);
    node.appendChild(msg);
    els.logsList.appendChild(node);
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

async function callBackground(action, payload = {}) {
  const response = await chrome.runtime.sendMessage({ action, payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Unknown background error");
  }

  return response.data;
}

function sanitizePrefix(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);
}