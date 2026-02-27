const SELLER_HOST = "sellercentral.amazon.com";
const ASIN_REGEX = /^[A-Z0-9]{10}$/i;
const MAX_ATTACHMENT_COUNT = 5;
const AI_ROLE_ID_REGEX = /^[a-z0-9_-]{2,40}$/;
const AMAZON_OPERATOR_CORE_PROMPT = [
  "你是一名资深亚马逊运营总监与增长策略顾问，必须输出完整、可执行、可复盘的分析。",
  "原则：禁止片面结论；禁止只看单一指标；所有建议必须兼顾增长、利润、库存、现金流与合规风险。",
  "强制分析流程：",
  "1) 数据完整性核查：时间范围、样本量、缺失字段、异常点、置信度。",
  "2) 全链路诊断：流量（自然+广告）-> 点击 -> 转化 -> 复购/留评 -> 利润。",
  "3) Listing 维度：标题、五点、描述、A+、图片叙事、关键词覆盖、差异化卖点、类目相关性。",
  "4) 广告维度：SP/SB/SD 结构、关键词层级、搜索词挖掘、否定策略、出价与分时预算、Placement、ACOS/TACOS。",
  "5) 商业维度：售价策略、折扣策略、费用结构（FBA/Referral/Storage/退货）、毛利与净利、Break-even。",
  "6) 运营维度：库存健康（可售天数/补货节奏/断货风险）、客服质量、差评风险、账户健康与政策合规。",
  "7) 根因拆解：区分症状与根因，明确影响路径，并尽量量化影响区间。",
  "8) 行动方案：按 P0(1-3天)/P1(1-2周)/P2(1-2月) 分级，给出执行步骤、负责人、预期 KPI 提升、风险与回滚条件。",
  "9) 实验设计：假设、变量、样本、观察窗口、成功阈值、止损阈值、复盘口径。",
  "输出格式必须包含：执行摘要 -> 诊断表 -> 根因 -> 分级行动计划 -> 风险与监控 -> 需要补充的数据。",
  "若数据不足，必须明确写出假设与缺失字段清单，再给临时方案与最终方案。"
].join("\\n");
const AI_BUILTIN_ROLES = [
  {
    id: "general",
    name: "通用",
    prompt:
      `${AMAZON_OPERATOR_CORE_PROMPT}\n\nRole focus:\n` +
      "全能运营模式：在广告、Listing、运营、库存、利润、合规、客服之间做统一决策。每次必须给出全局诊断和跨模块联动方案，不能只做局部优化。"
  },
  {
    id: "operationsConsultant",
    name: "运营策略顾问",
    prompt:
      `${AMAZON_OPERATOR_CORE_PROMPT}\n\nRole focus:\n` +
      "重点输出运营节奏与执行治理：周/月度 KPI 看板、SOP 设计、跨岗位协同、项目优先级、里程碑与复盘机制；强调可落地执行路径。"
  },
  {
    id: "listingOptimizer",
    name: "Listing优化师",
    prompt:
      `${AMAZON_OPERATOR_CORE_PROMPT}\n\nRole focus:\n` +
      "重点输出 Listing 增长：标题结构、关键词意图覆盖、五点卖点排序、描述/A+叙事、主图与辅图信息架构、转化障碍与替代文案方案。"
  },
  {
    id: "adsSpecialist",
    name: "广告投放专家",
    prompt:
      `${AMAZON_OPERATOR_CORE_PROMPT}\n\nRole focus:\n` +
      "重点输出广告增长与控本：SP/SB/SD 分层架构、词包分层、搜索词挖掘、否词规则、出价与 Placement 策略、预算节奏、ACOS/TACOS 与利润协同优化。"
  },
  {
    id: "fbaProfitAnalyst",
    name: "FBA利润分析师",
    prompt:
      `${AMAZON_OPERATOR_CORE_PROMPT}\n\nRole focus:\n` +
      "重点输出利润与现金流：单件经济模型、COGS、FBA/佣金/仓储/退货成本、促销折扣影响、盈亏平衡点、补货与资金占用风险。"
  },
  {
    id: "complianceAdvisor",
    name: "合规风控顾问",
    prompt:
      `${AMAZON_OPERATOR_CORE_PROMPT}\n\nRole focus:\n` +
      "重点输出合规风险控制：政策红线识别、账户健康指标、潜在违规触发点、低风险沟通措辞、整改优先级和申诉准备清单。"
  },
  {
    id: "customerServiceCoach",
    name: "客服沟通教练",
    prompt:
      `${AMAZON_OPERATOR_CORE_PROMPT}\n\nRole focus:\n` +
      "重点输出客服与口碑：售前问答、售后场景脚本、差评与退款处理、升级路径、满意度提升、Review 风险控制与政策安全表达。"
  }
];
const LEGACY_BUILTIN_ROLE_PROMPTS = Object.freeze({
  general:
    "You are an all-round Amazon seller copilot. Provide practical, concise, and action-oriented answers across listing, ads, operations, compliance, and customer service.",
  operationsConsultant:
    "You are an Amazon seller operations consultant. Focus on actionable SOPs, weekly execution, and KPI impact.",
  listingOptimizer:
    "You are an Amazon Listing Optimization specialist. Focus on title, bullets, description, A+ structure, and conversion lift.",
  adsSpecialist:
    "You are an Amazon PPC specialist. Focus on campaign structure, bidding logic, search terms, ACOS/TACOS, and budget allocation.",
  fbaProfitAnalyst:
    "You are an Amazon FBA profit analyst. Focus on fees, storage, return rate impact, margin, break-even, and cashflow risk.",
  complianceAdvisor:
    "You are an Amazon policy and compliance advisor. Focus on policy-safe language, account health, and risk mitigation.",
  customerServiceCoach:
    "You are an Amazon customer service coach. Draft concise, empathetic, policy-safe responses and escalation paths."
});

const DEFAULT_SYSTEM_SETTINGS = {
  ai: {
    defaultProvider: "deepseek",
    defaultRole: "general",
    showReasoning: true,
    temperature: 0.3,
    maxHistory: 12,
    models: {
      deepseek: "deepseek-chat",
      gemini: "gemini-2.5-flash",
      qwen: "qwen-plus"
    },
    keys: {
      deepseek: "",
      gemini: "",
      qwen: ""
    },
    roles: AI_BUILTIN_ROLES,
    systemPrompt: "You are an assistant for Amazon seller operations. Keep answers practical, concise, and action-oriented."
  },
  ordersService: {
    mode: "extension",
    endpoint: "http://127.0.0.1:8787",
    apiKey: "",
    timeoutMs: 180000,
    downloadDir: "amazon"
  }
};

const state = {
  config: null,
  systemSettings: structuredClone(DEFAULT_SYSTEM_SETTINGS),
  logs: [],
  busy: false,
  activeView: "orders",
  aiBusy: false,
  aiMessages: [],
  aiDraftAttachments: [],
  aiStreamPort: null,
  aiActiveRequestId: "",
  roleEditorId: ""
};

const els = {
  runState: document.getElementById("runState"),
  statusText: document.getElementById("statusText"),
  menuBtns: document.querySelectorAll(".menu-btn"),
  views: document.querySelectorAll(".view"),
  datePreset: document.getElementById("datePreset"),
  reportNamePrefix: document.getElementById("reportNamePrefix"),
  closeTabAfterRun: document.getElementById("closeTabAfterRun"),
  runNow: document.getElementById("runNow"),
  saveOrdersSettings: document.getElementById("saveOrdersSettings"),
  schedulerEnabled: document.getElementById("schedulerEnabled"),
  everyHours: document.getElementById("everyHours"),
  saveSchedule: document.getElementById("saveSchedule"),
  asinInput: document.getElementById("asinInput"),
  detectAsinBtn: document.getElementById("detectAsinBtn"),
  extractProductsBtn: document.getElementById("extractProductsBtn"),
  fieldPreset: document.getElementById("fieldPreset"),
  requestIntervalSec: document.getElementById("requestIntervalSec"),
  aiProviderSelect: document.getElementById("aiProviderSelect"),
  aiModelInput: document.getElementById("aiModelInput"),
  aiRoleSelect: document.getElementById("aiRoleSelect"),
  aiShowReasoning: document.getElementById("aiShowReasoning"),
  aiMessages: document.getElementById("aiMessages"),
  aiInput: document.getElementById("aiInput"),
  aiFileInput: document.getElementById("aiFileInput"),
  aiAttachmentList: document.getElementById("aiAttachmentList"),
  aiAttachBtn: document.getElementById("aiAttachBtn"),
  aiSendBtn: document.getElementById("aiSendBtn"),
  aiClearBtn: document.getElementById("aiClearBtn"),
  settingsOrdersMode: document.getElementById("settingsOrdersMode"),
  settingsServiceEndpoint: document.getElementById("settingsServiceEndpoint"),
  settingsServiceApiKey: document.getElementById("settingsServiceApiKey"),
  settingsServiceTimeoutMs: document.getElementById("settingsServiceTimeoutMs"),
  settingsServiceDownloadDir: document.getElementById("settingsServiceDownloadDir"),
  settingsTestServiceBtn: document.getElementById("settingsTestServiceBtn"),
  settingsServiceStatus: document.getElementById("settingsServiceStatus"),
  settingsDefaultProvider: document.getElementById("settingsDefaultProvider"),
  settingsTemperature: document.getElementById("settingsTemperature"),
  settingsMaxHistory: document.getElementById("settingsMaxHistory"),
  settingsModelDeepseek: document.getElementById("settingsModelDeepseek"),
  settingsModelGemini: document.getElementById("settingsModelGemini"),
  settingsModelQwen: document.getElementById("settingsModelQwen"),
  settingsKeyDeepseek: document.getElementById("settingsKeyDeepseek"),
  settingsKeyGemini: document.getElementById("settingsKeyGemini"),
  settingsKeyQwen: document.getElementById("settingsKeyQwen"),
  settingsSaveBtn: document.getElementById("settingsSaveBtn"),
  rolesList: document.getElementById("rolesList"),
  rolesAddBtn: document.getElementById("rolesAddBtn"),
  rolesDefaultRoleSelect: document.getElementById("rolesDefaultRoleSelect"),
  roleEditorForm: document.getElementById("roleEditorForm"),
  roleEditorOriginalId: document.getElementById("roleEditorOriginalId"),
  roleEditorId: document.getElementById("roleEditorId"),
  roleEditorName: document.getElementById("roleEditorName"),
  roleEditorPrompt: document.getElementById("roleEditorPrompt"),
  rolesSaveBtn: document.getElementById("rolesSaveBtn"),
  rolesDeleteBtn: document.getElementById("rolesDeleteBtn"),
  rolesCancelBtn: document.getElementById("rolesCancelBtn"),
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
  for (const btn of els.menuBtns) {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  }

  els.runNow.addEventListener("click", runNow);
  els.saveOrdersSettings.addEventListener("click", saveOrderSettings);
  els.saveSchedule.addEventListener("click", saveSchedule);
  els.detectAsinBtn.addEventListener("click", detectAsinFromActiveTab);
  els.extractProductsBtn.addEventListener("click", extractProducts);
  els.aiProviderSelect.addEventListener("change", syncAiModelWithProvider);
  els.aiSendBtn.addEventListener("click", sendAiMessage);
  els.aiClearBtn.addEventListener("click", clearAiMessages);
  els.aiAttachBtn.addEventListener("click", () => {
    if (!els.aiFileInput || state.aiBusy) {
      return;
    }
    els.aiFileInput.click();
  });
  els.aiFileInput.addEventListener("change", handleAiFileSelection);
  els.aiAttachmentList.addEventListener("click", handleAiAttachmentRemove);
  els.aiInput.addEventListener("keydown", (event) => {
    if (event.isComposing) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      sendAiMessage();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendAiMessage();
    }
  });
  els.settingsTestServiceBtn.addEventListener("click", testOrdersServiceConnection);
  els.settingsSaveBtn.addEventListener("click", saveSystemSettings);
  els.rolesAddBtn?.addEventListener("click", startCreateRole);
  els.roleEditorForm?.addEventListener("submit", saveRoleEditor);
  els.rolesDeleteBtn?.addEventListener("click", deleteCurrentRole);
  els.rolesCancelBtn?.addEventListener("click", resetRoleEditor);
  els.rolesDefaultRoleSelect?.addEventListener("change", saveDefaultRoleFromRolesView);
  els.rolesList?.addEventListener("click", handleRolesListClick);
  els.refreshLogs.addEventListener("click", refreshLogs);
  els.clearLogs.addEventListener("click", clearLogs);
  window.addEventListener("beforeunload", disconnectAiStreamPort);
}

function switchView(view) {
  state.activeView = view;

  for (const btn of els.menuBtns) {
    btn.classList.toggle("active", btn.dataset.view === view);
  }

  for (const section of els.views) {
    section.classList.toggle("active", section.id === `view-${view}`);
  }
}

async function refreshBootstrap() {
  const response = await callBackground("ui.getBootstrap");
  state.config = response.config;
  state.systemSettings = mergeSystemSettings(response.systemSettings);
  state.logs = response.logs;
  state.busy = Boolean(response.busy);

  fillFormByConfig();
  fillSystemSettingsForms();
  renderAiMessages();
  renderAiDraftAttachments();
  renderLogs();
  renderBusyState();
  switchView(state.activeView);
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

function fillSystemSettingsForms() {
  const settings = state.systemSettings || structuredClone(DEFAULT_SYSTEM_SETTINGS);
  const ai = settings.ai;
  const roles = normalizeAiRoles(ai.roles);
  const defaultRole = sanitizeAiRole(ai.defaultRole, roles);
  const ordersService = settings.ordersService || DEFAULT_SYSTEM_SETTINGS.ordersService;

  if (els.settingsOrdersMode) {
    els.settingsOrdersMode.value = ordersService.mode;
  }
  if (els.settingsServiceEndpoint) {
    els.settingsServiceEndpoint.value = ordersService.endpoint;
  }
  if (els.settingsServiceApiKey) {
    els.settingsServiceApiKey.value = ordersService.apiKey || "";
  }
  if (els.settingsServiceTimeoutMs) {
    els.settingsServiceTimeoutMs.value = String(ordersService.timeoutMs);
  }
  if (els.settingsServiceDownloadDir) {
    els.settingsServiceDownloadDir.value = ordersService.downloadDir || "amazon";
  }
  setServiceStatus(
    ordersService.mode === "headless-service"
      ? "当前为无头服务模式，建议先点“测试服务连接”。"
      : "当前为浏览器内自动化模式。",
    "info"
  );

  if (els.settingsDefaultProvider) {
    els.settingsDefaultProvider.value = ai.defaultProvider;
  }
  if (els.settingsTemperature) {
    els.settingsTemperature.value = String(ai.temperature);
  }
  if (els.settingsMaxHistory) {
    els.settingsMaxHistory.value = String(ai.maxHistory);
  }
  if (els.settingsModelDeepseek) {
    els.settingsModelDeepseek.value = ai.models.deepseek || "";
  }
  if (els.settingsModelGemini) {
    els.settingsModelGemini.value = ai.models.gemini || "";
  }
  if (els.settingsModelQwen) {
    els.settingsModelQwen.value = ai.models.qwen || "";
  }
  if (els.settingsKeyDeepseek) {
    els.settingsKeyDeepseek.value = ai.keys.deepseek || "";
  }
  if (els.settingsKeyGemini) {
    els.settingsKeyGemini.value = ai.keys.gemini || "";
  }
  if (els.settingsKeyQwen) {
    els.settingsKeyQwen.value = ai.keys.qwen || "";
  }

  if (els.aiProviderSelect) {
    els.aiProviderSelect.value = ai.defaultProvider;
  }
  if (els.aiShowReasoning) {
    els.aiShowReasoning.checked = sanitizeBoolean(ai.showReasoning, DEFAULT_SYSTEM_SETTINGS.ai.showReasoning);
  }
  const currentAiRole = sanitizeAiRole(els.aiRoleSelect?.value || defaultRole, roles);
  populateRoleSelect(els.aiRoleSelect, roles);
  if (els.aiRoleSelect) {
    els.aiRoleSelect.value = currentAiRole;
  }
  populateRoleSelect(els.rolesDefaultRoleSelect, roles);
  if (els.rolesDefaultRoleSelect) {
    els.rolesDefaultRoleSelect.value = defaultRole;
  }

  renderRolesList(roles, state.roleEditorId || defaultRole);
  if (state.roleEditorId) {
    populateRoleEditor(state.roleEditorId, roles);
  } else {
    resetRoleEditor();
  }

  syncAiModelWithProvider();
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
    const modeTextMap = {
      "downloads-api": `已下载: ${result.download?.filename || ""}`,
      "in-page-click": "页面内已触发下载",
      "service-download-url": `服务模式已下载: ${result.download?.filename || ""}`,
      "service-saved-file": `服务已保存文件: ${result.download?.savedPath || ""}`,
      "service-response": `服务响应: ${result.download?.message || ""}`
    };
    const modeText = modeTextMap[mode] || "未检测到下载动作";

    setStatus(`订单任务完成 (${modeText})`);
  } catch (error) {
    setStatus(`订单任务失败: ${error.message}`);
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

async function saveSystemSettings() {
  if (els.settingsSaveBtn.disabled) {
    return;
  }

  els.settingsSaveBtn.disabled = true;
  try {
    const payload = buildSystemSettingsPayload();
    const result = await callBackground("settings.save", payload);
    state.systemSettings = mergeSystemSettings(result.systemSettings);
    fillSystemSettingsForms();
    setServiceStatus("配置已保存", "ok");
    setStatus("系统设置已保存");
    await refreshLogs();
  } catch (error) {
    setServiceStatus(`保存失败: ${error.message}`, "error");
    setStatus(`系统设置保存失败: ${error.message}`);
  } finally {
    els.settingsSaveBtn.disabled = false;
  }
}

async function testOrdersServiceConnection() {
  if (!els.settingsTestServiceBtn || els.settingsTestServiceBtn.disabled) {
    return;
  }

  const payload = buildSystemSettingsPayload();
  els.settingsTestServiceBtn.disabled = true;
  setServiceStatus("正在测试服务连通性...", "info");

  try {
    const result = await callBackground("orders.servicePing", {
      ordersService: payload.ordersService
    });
    setServiceStatus(`服务可用 (${result.status})`, "ok");
    setStatus(`无头服务连通成功: ${result.endpoint}`);
  } catch (error) {
    setServiceStatus(`连接失败: ${error.message}`, "error");
    setStatus(`无头服务不可用: ${error.message}`);
  } finally {
    els.settingsTestServiceBtn.disabled = false;
  }
}

function buildSystemSettingsPayload() {
  const defaults = state.systemSettings?.ai || DEFAULT_SYSTEM_SETTINGS.ai;
  const serviceDefaults = state.systemSettings?.ordersService || DEFAULT_SYSTEM_SETTINGS.ordersService;
  const roles = normalizeAiRoles(defaults.roles);
  const defaultRole = sanitizeAiRole(defaults.defaultRole, roles);
  const defaultProvider = sanitizeProvider(
    els.settingsDefaultProvider?.value || defaults.defaultProvider || DEFAULT_SYSTEM_SETTINGS.ai.defaultProvider
  );

  const payload = {
    ai: {
      defaultProvider,
      defaultRole,
      showReasoning: sanitizeBoolean(els.aiShowReasoning?.checked, defaults.showReasoning ?? true),
      temperature: clampNumberInRange(
        els.settingsTemperature?.value,
        0,
        2,
        defaults.temperature ?? DEFAULT_SYSTEM_SETTINGS.ai.temperature
      ),
      maxHistory: Math.round(
        clampNumberInRange(
          els.settingsMaxHistory?.value,
          2,
          40,
          defaults.maxHistory ?? DEFAULT_SYSTEM_SETTINGS.ai.maxHistory
        )
      ),
      models: {
        deepseek: sanitizeModel(els.settingsModelDeepseek?.value, defaults.models?.deepseek),
        gemini: sanitizeModel(els.settingsModelGemini?.value, defaults.models?.gemini),
        qwen: sanitizeModel(els.settingsModelQwen?.value, defaults.models?.qwen)
      },
      keys: {
        deepseek: sanitizeApiKey(els.settingsKeyDeepseek?.value),
        gemini: sanitizeApiKey(els.settingsKeyGemini?.value),
        qwen: sanitizeApiKey(els.settingsKeyQwen?.value)
      },
      roles,
      systemPrompt: sanitizeSystemPrompt(defaults.systemPrompt, DEFAULT_SYSTEM_SETTINGS.ai.systemPrompt)
    },
    ordersService: {
      mode: sanitizeOrdersServiceMode(els.settingsOrdersMode?.value || serviceDefaults.mode),
      endpoint: sanitizeServiceEndpoint(els.settingsServiceEndpoint?.value || serviceDefaults.endpoint),
      apiKey: sanitizeApiKey(els.settingsServiceApiKey?.value || serviceDefaults.apiKey),
      timeoutMs: Math.round(
        clampNumberInRange(
          els.settingsServiceTimeoutMs?.value,
          30000,
          600000,
          serviceDefaults.timeoutMs ?? DEFAULT_SYSTEM_SETTINGS.ordersService.timeoutMs
        )
      ),
      downloadDir: sanitizeDownloadDir(els.settingsServiceDownloadDir?.value || serviceDefaults.downloadDir)
    }
  };

  return payload;
}

function getCurrentAiRoles() {
  return normalizeAiRoles(state.systemSettings?.ai?.roles);
}

function populateRoleSelect(selectEl, roles) {
  if (!selectEl) {
    return;
  }
  const list = normalizeAiRoles(roles);
  const current = sanitizeAiRole(selectEl.value, list);
  selectEl.innerHTML = "";
  for (const role of list) {
    const option = document.createElement("option");
    option.value = role.id;
    option.textContent = role.name;
    selectEl.appendChild(option);
  }
  selectEl.value = current;
}

function renderRolesList(roles, activeRoleId) {
  if (!els.rolesList) {
    return;
  }

  const list = normalizeAiRoles(roles);
  const active = sanitizeAiRole(activeRoleId, list);
  els.rolesList.innerHTML = "";

  for (const role of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `role-item${role.id === active ? " active" : ""}`;
    btn.setAttribute("data-role-id", role.id);

    const title = document.createElement("span");
    title.className = "role-item-title";
    title.textContent = role.name;
    btn.appendChild(title);

    const sub = document.createElement("span");
    sub.className = "role-item-sub";
    sub.textContent = role.id === "general" ? "general · 全能模式" : role.id;
    btn.appendChild(sub);

    els.rolesList.appendChild(btn);
  }
}

function applyRoleToEditor(role, roles) {
  if (!role) {
    return;
  }
  state.roleEditorId = role.id;

  if (els.roleEditorOriginalId) {
    els.roleEditorOriginalId.value = role.id;
  }
  if (els.roleEditorId) {
    els.roleEditorId.value = role.id;
    els.roleEditorId.disabled = role.id === "general";
  }
  if (els.roleEditorName) {
    els.roleEditorName.value = role.name;
  }
  if (els.roleEditorPrompt) {
    els.roleEditorPrompt.value = role.prompt || "";
  }
  if (els.rolesDeleteBtn) {
    els.rolesDeleteBtn.disabled = role.id === "general";
  }

  renderRolesList(roles, role.id);
}

function populateRoleEditor(roleId, roles) {
  const list = normalizeAiRoles(roles);
  const id = sanitizeAiRole(roleId, list);
  const role = list.find((item) => item.id === id) || list[0];
  applyRoleToEditor(role, list);
}

function resetRoleEditor() {
  const roles = getCurrentAiRoles();
  const defaultRole = sanitizeAiRole(state.systemSettings?.ai?.defaultRole, roles);
  populateRoleEditor(defaultRole, roles);
}

function startCreateRole() {
  const roles = getCurrentAiRoles();
  const id = buildNextRoleId("customRole", roles);
  state.roleEditorId = "";

  if (els.roleEditorOriginalId) {
    els.roleEditorOriginalId.value = "";
  }
  if (els.roleEditorId) {
    els.roleEditorId.value = id;
    els.roleEditorId.disabled = false;
  }
  if (els.roleEditorName) {
    els.roleEditorName.value = "";
  }
  if (els.roleEditorPrompt) {
    els.roleEditorPrompt.value = "";
  }
  if (els.rolesDeleteBtn) {
    els.rolesDeleteBtn.disabled = true;
  }
  renderRolesList(roles, "");
  els.roleEditorName?.focus();
}

function handleRolesListClick(event) {
  const target = event.target?.closest?.("[data-role-id]");
  if (!target) {
    return;
  }
  const roleId = target.getAttribute("data-role-id");
  if (!roleId) {
    return;
  }
  populateRoleEditor(roleId, getCurrentAiRoles());
}

async function saveRoleEditor(event) {
  event.preventDefault();
  const roles = getCurrentAiRoles();
  const originalId = sanitizeRoleId(els.roleEditorOriginalId?.value);
  const nextId = originalId === "general" ? "general" : sanitizeRoleId(els.roleEditorId?.value);
  const nextName = sanitizeRoleName(els.roleEditorName?.value, nextId);
  const nextPrompt = sanitizeRolePrompt(els.roleEditorPrompt?.value);

  if (!nextId) {
    setStatus("角色 ID 仅支持 2-40 位字母/数字/-/_");
    return;
  }
  if (!nextPrompt) {
    setStatus("角色提示词不能为空");
    return;
  }

  const duplicate = roles.some((item) => item.id === nextId && item.id !== originalId);
  if (duplicate) {
    setStatus("角色 ID 已存在，请更换");
    return;
  }

  const nextRoles = roles.map((item) => ({ ...item }));
  const index = originalId ? nextRoles.findIndex((item) => item.id === originalId) : -1;
  const roleData = {
    id: nextId,
    name: nextName,
    prompt: nextPrompt
  };

  if (index >= 0) {
    nextRoles[index] = roleData;
  } else {
    nextRoles.push(roleData);
  }

  let nextDefaultRole = sanitizeAiRole(state.systemSettings?.ai?.defaultRole, roles);
  if (originalId && nextDefaultRole === originalId) {
    nextDefaultRole = nextId;
  }
  nextDefaultRole = sanitizeAiRole(nextDefaultRole, nextRoles);

  try {
    state.roleEditorId = nextId;
    await saveRolesToSettings(nextRoles, nextDefaultRole);
    setStatus(`角色已保存: ${nextName}`);
  } catch (error) {
    setStatus(`角色保存失败: ${error.message}`);
  }
}

async function deleteCurrentRole() {
  const roles = getCurrentAiRoles();
  const currentId = sanitizeRoleId(els.roleEditorOriginalId?.value || state.roleEditorId);
  if (!currentId) {
    setStatus("请先选择要删除的角色");
    return;
  }
  if (currentId === "general") {
    setStatus("“通用”是全能基础角色，不能删除");
    return;
  }

  const nextRoles = roles.filter((item) => item.id !== currentId);
  let nextDefaultRole = sanitizeAiRole(state.systemSettings?.ai?.defaultRole, roles);
  if (nextDefaultRole === currentId) {
    nextDefaultRole = sanitizeAiRole("general", nextRoles);
  }

  try {
    state.roleEditorId = nextDefaultRole;
    await saveRolesToSettings(nextRoles, nextDefaultRole);
    setStatus(`角色已删除: ${currentId}`);
  } catch (error) {
    setStatus(`角色删除失败: ${error.message}`);
  }
}

async function saveDefaultRoleFromRolesView() {
  const roles = getCurrentAiRoles();
  const nextDefaultRole = sanitizeAiRole(els.rolesDefaultRoleSelect?.value, roles);
  try {
    state.roleEditorId = nextDefaultRole;
    await saveRolesToSettings(roles, nextDefaultRole);
    setStatus(`默认角色已更新: ${nextDefaultRole}`);
  } catch (error) {
    setStatus(`默认角色更新失败: ${error.message}`);
  }
}

async function saveRolesToSettings(roles, defaultRole) {
  const normalizedRoles = normalizeAiRoles(roles);
  const normalizedDefaultRole = sanitizeAiRole(defaultRole, normalizedRoles);

  const result = await callBackground("settings.save", {
    ai: {
      roles: normalizedRoles,
      defaultRole: normalizedDefaultRole
    }
  });
  state.systemSettings = mergeSystemSettings(result.systemSettings);
  fillSystemSettingsForms();
  await refreshLogs();
}

function buildNextRoleId(base, roles) {
  const list = normalizeAiRoles(roles);
  const candidateBase = sanitizeRoleId(base) || "role";
  if (!list.some((item) => item.id === candidateBase)) {
    return candidateBase;
  }

  for (let i = 2; i <= 9999; i += 1) {
    const next = `${candidateBase}-${i}`;
    if (!list.some((item) => item.id === next)) {
      return next;
    }
  }
  return `${candidateBase}-${Date.now().toString(36).slice(-4)}`;
}

function syncAiModelWithProvider() {
  const provider = sanitizeProvider(
    els.aiProviderSelect?.value || state.systemSettings?.ai?.defaultProvider || DEFAULT_SYSTEM_SETTINGS.ai.defaultProvider
  );
  const models = state.systemSettings?.ai?.models || DEFAULT_SYSTEM_SETTINGS.ai.models;
  if (els.aiProviderSelect) {
    els.aiProviderSelect.value = provider;
  }
  if (els.aiModelInput) {
    els.aiModelInput.value = models[provider] || "";
  }
}

async function handleAiFileSelection(event) {
  const files = Array.from(event.target?.files || []);
  if (files.length === 0) {
    return;
  }

  try {
    const availableCount = Math.max(0, MAX_ATTACHMENT_COUNT - state.aiDraftAttachments.length);
    const selected = files.slice(0, availableCount);

    if (selected.length < files.length) {
      setStatus(`最多支持 ${MAX_ATTACHMENT_COUNT} 个附件`);
    }

    for (const file of selected) {
      const attachment = await readAttachmentFile(file);
      if (!attachment) {
        continue;
      }

      state.aiDraftAttachments.push(attachment);
    }
  } catch (error) {
    setStatus(`附件读取失败: ${error.message}`);
  } finally {
    if (els.aiFileInput) {
      els.aiFileInput.value = "";
    }
    renderAiDraftAttachments();
  }
}

function handleAiAttachmentRemove(event) {
  const btn = event.target?.closest?.("[data-attachment-remove]");
  if (!btn) {
    return;
  }
  const id = btn.getAttribute("data-attachment-remove");
  if (!id) {
    return;
  }

  state.aiDraftAttachments = state.aiDraftAttachments.filter((item) => item.id !== id);
  renderAiDraftAttachments();
}

async function readAttachmentFile(file) {
  const id = crypto.randomUUID();
  const name = String(file.name || "attachment");
  const mimeType = String(file.type || guessMimeTypeByName(name) || "application/octet-stream");
  const size = Number(file.size || 0);

  if (isTextLikeFile(mimeType, name)) {
    const rawText = await file.text();
    const text = String(rawText || "");
    return {
      id,
      name,
      mimeType,
      size,
      kind: "text",
      text
    };
  }

  if (mimeType.startsWith("image/")) {
    const buffer = await file.arrayBuffer();
    return {
      id,
      name,
      mimeType,
      size,
      kind: "image",
      dataBase64: arrayBufferToBase64(buffer)
    };
  }

  const buffer = await file.arrayBuffer();
  return {
    id,
    name,
    mimeType,
    size,
    kind: "binary",
    dataBase64: arrayBufferToBase64(buffer)
  };
}

function renderAiDraftAttachments() {
  if (!els.aiAttachmentList) {
    return;
  }

  els.aiAttachmentList.innerHTML = "";
  if (!state.aiDraftAttachments || state.aiDraftAttachments.length === 0) {
    return;
  }

  for (const item of state.aiDraftAttachments) {
    const node = document.createElement("div");
    node.className = "ai-attachment-item";

    const name = document.createElement("span");
    name.className = "ai-attachment-name";
    name.textContent = `${item.name} (${formatBytes(item.size)})`;
    node.appendChild(name);

    const remove = document.createElement("button");
    remove.className = "ai-attachment-remove";
    remove.type = "button";
    remove.setAttribute("data-attachment-remove", item.id);
    remove.textContent = "×";
    node.appendChild(remove);

    els.aiAttachmentList.appendChild(node);
  }
}

function clearAiDraftAttachments() {
  state.aiDraftAttachments = [];
  if (els.aiFileInput) {
    els.aiFileInput.value = "";
  }
  renderAiDraftAttachments();
}

async function sendAiMessage() {
  if (state.aiBusy) {
    return;
  }

  const input = String(els.aiInput?.value || "").trim();
  const draftAttachments = state.aiDraftAttachments.slice();
  if (!input && draftAttachments.length === 0) {
    setStatus("请输入聊天内容或添加附件");
    return;
  }

  const aiSettings = state.systemSettings?.ai || DEFAULT_SYSTEM_SETTINGS.ai;
  const provider = sanitizeProvider(els.aiProviderSelect?.value || aiSettings.defaultProvider);
  const role = sanitizeAiRole(els.aiRoleSelect?.value || aiSettings.defaultRole, aiSettings.roles);
  const model = sanitizeModel(els.aiModelInput?.value, aiSettings.models[provider]);
  const showReasoning = sanitizeBoolean(els.aiShowReasoning?.checked, aiSettings.showReasoning ?? true);
  const temperature = clampNumberInRange(aiSettings.temperature, 0, 2, DEFAULT_SYSTEM_SETTINGS.ai.temperature);
  const maxHistory = Math.round(clampNumberInRange(aiSettings.maxHistory, 2, 40, DEFAULT_SYSTEM_SETTINGS.ai.maxHistory));
  const systemPrompt = sanitizeSystemPrompt(aiSettings.systemPrompt, DEFAULT_SYSTEM_SETTINGS.ai.systemPrompt);
  const attachmentsPayload = buildAttachmentPayload(draftAttachments);
  const userDisplayContent = buildUserDisplayContent(input, draftAttachments);
  if (state.systemSettings?.ai) {
    state.systemSettings.ai.showReasoning = showReasoning;
  }

  state.aiMessages.push({
    role: "user",
    content: userDisplayContent,
    attachments: draftAttachments.map((item) => ({
      name: item.name,
      size: item.size,
      mimeType: item.mimeType
    })),
    time: new Date().toISOString()
  });
  trimAiMessages(maxHistory);
  renderAiMessages();
  els.aiInput.value = "";
  clearAiDraftAttachments();

  setAiBusy(true);
  setStatus(`AI 流式请求中 (${provider}/${model}/${role})...`);

  const requestId = crypto.randomUUID();
  state.aiActiveRequestId = requestId;
  state.aiMessages.push({
    role: "assistant",
    content: "",
    reasoning: "",
    showReasoning,
    time: new Date().toISOString(),
    requestId,
    streaming: true
  });
  trimAiMessages(maxHistory);
  renderAiMessages();

  try {
    const port = ensureAiStreamPort();
    port.postMessage({
      action: "start",
      requestId,
      payload: {
        provider,
        role,
        model,
        temperature,
        maxHistory,
        showReasoning,
        systemPrompt,
        messages: buildAiPayloadMessages(maxHistory),
        attachments: attachmentsPayload
      }
    });
  } catch (error) {
    finalizeAiStreamError(requestId, error.message || "流式通道启动失败");
  }
}

function ensureAiStreamPort() {
  if (state.aiStreamPort) {
    return state.aiStreamPort;
  }

  const port = chrome.runtime.connect({ name: "ai-chat-stream" });
  port.onMessage.addListener(handleAiStreamEvent);
  port.onDisconnect.addListener(() => {
    if (state.aiBusy && state.aiActiveRequestId) {
      finalizeAiStreamError(state.aiActiveRequestId, "流式通道已断开");
    }
    state.aiStreamPort = null;
  });

  state.aiStreamPort = port;
  return port;
}

function disconnectAiStreamPort() {
  if (!state.aiStreamPort) {
    return;
  }
  try {
    state.aiStreamPort.disconnect();
  } catch (_error) {
    // Ignore disconnect errors.
  }
  state.aiStreamPort = null;
}

function handleAiStreamEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  const requestId = String(event.requestId || "");
  if (!requestId || requestId !== state.aiActiveRequestId) {
    return;
  }

  if (event.type === "started") {
    setStatus(`AI 已开始流式输出 (${event.provider || "unknown"}/${event.model || "unknown"}/${event.role || "unknown"})`);
    return;
  }

  if (event.type === "delta") {
    appendAiStreamDelta(requestId, String(event.delta || ""));
    return;
  }

  if (event.type === "reasoning_delta") {
    appendAiStreamReasoningDelta(requestId, String(event.delta || ""));
    return;
  }

  if (event.type === "done") {
    finalizeAiStreamDone(requestId, event);
    return;
  }

  if (event.type === "error") {
    finalizeAiStreamError(requestId, event.error || "流式请求失败");
    return;
  }

  if (event.type === "cancelled") {
    finalizeAiStreamError(requestId, "请求已取消");
  }
}

function appendAiStreamDelta(requestId, delta) {
  if (!delta) {
    return;
  }

  const idx = findAiMessageByRequestId(requestId);
  if (idx < 0) {
    return;
  }

  state.aiMessages[idx].content = `${state.aiMessages[idx].content || ""}${delta}`;
  renderAiMessages();
}

function appendAiStreamReasoningDelta(requestId, delta) {
  if (!delta) {
    return;
  }

  const idx = findAiMessageByRequestId(requestId);
  if (idx < 0) {
    return;
  }

  if (!state.aiMessages[idx].showReasoning) {
    return;
  }

  state.aiMessages[idx].reasoning = `${state.aiMessages[idx].reasoning || ""}${delta}`;
  renderAiMessages();
}

function finalizeAiStreamDone(requestId, result) {
  const idx = findAiMessageByRequestId(requestId);
  if (idx >= 0) {
    const fallback = String(result?.reply || "");
    const current = String(state.aiMessages[idx].content || "");
    if (state.aiMessages[idx].showReasoning) {
      const finalReasoning = String(result?.reasoning || "").trim();
      if (finalReasoning) {
        state.aiMessages[idx].reasoning = finalReasoning;
      }
    } else {
      state.aiMessages[idx].reasoning = "";
    }
    state.aiMessages[idx].content = current || fallback || "(empty)";
    state.aiMessages[idx].streaming = false;
    state.aiMessages[idx].time = new Date().toISOString();
  }

  trimAiMessages(state.systemSettings?.ai?.maxHistory || DEFAULT_SYSTEM_SETTINGS.ai.maxHistory);
  renderAiMessages();
  setStatus(`AI 回复完成 (${result?.provider || "unknown"}/${result?.model || "unknown"}/${result?.role || "unknown"})`);
  state.aiActiveRequestId = "";
  setAiBusy(false);
}

function finalizeAiStreamError(requestId, errorMessage) {
  const idx = findAiMessageByRequestId(requestId);
  if (idx >= 0) {
    const existing = String(state.aiMessages[idx].content || "").trim();
    const base = existing || "请求失败";
    state.aiMessages[idx].content = `${base}${existing ? "\n" : ": "}${errorMessage}`;
    state.aiMessages[idx].streaming = false;
    state.aiMessages[idx].error = true;
    state.aiMessages[idx].time = new Date().toISOString();
  } else {
    state.aiMessages.push({
      role: "assistant",
      content: `请求失败: ${errorMessage}`,
      time: new Date().toISOString(),
      error: true
    });
  }

  renderAiMessages();
  setStatus(`AI 对话失败: ${errorMessage}`);
  state.aiActiveRequestId = "";
  setAiBusy(false);
}

function findAiMessageByRequestId(requestId) {
  for (let i = state.aiMessages.length - 1; i >= 0; i -= 1) {
    if (state.aiMessages[i]?.requestId === requestId) {
      return i;
    }
  }
  return -1;
}

function clearAiMessages() {
  if (state.aiBusy) {
    return;
  }
  state.aiMessages = [];
  clearAiDraftAttachments();
  renderAiMessages();
  setStatus("AI 对话已清空");
}

function buildAiPayloadMessages(maxHistory) {
  const limit = Math.max(4, Number(maxHistory || DEFAULT_SYSTEM_SETTINGS.ai.maxHistory) * 2);
  return state.aiMessages
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .slice(-limit)
    .map((item) => ({
      role: item.role,
      content: String(item.content || "")
    }));
}

function trimAiMessages(maxHistory) {
  const limit = Math.max(4, Number(maxHistory || DEFAULT_SYSTEM_SETTINGS.ai.maxHistory) * 2);
  if (state.aiMessages.length > limit) {
    state.aiMessages = state.aiMessages.slice(-limit);
  }
}

function renderAiMessages() {
  if (!els.aiMessages) {
    return;
  }

  const container = els.aiMessages;
  container.innerHTML = "";

  if (!state.aiMessages || state.aiMessages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ai-empty";
    empty.textContent = "暂无对话，输入问题后点击发送。";
    container.appendChild(empty);
    return;
  }

  for (const item of state.aiMessages) {
    const node = document.createElement("article");
    const role = item.role === "user" ? "user" : "assistant";
    node.className = `ai-message ${role}${item.error ? " error" : ""}`;

    const meta = document.createElement("div");
    meta.className = "ai-message-meta";
    const timeText = item.time ? new Date(item.time).toLocaleTimeString() : "";
    meta.textContent = `${role === "user" ? "你" : "AI"}${timeText ? ` · ${timeText}` : ""}`;

    const content = document.createElement("div");
    content.className = "ai-message-content";
    const baseText =
      role === "assistant"
        ? buildAssistantMessageText(item)
        : String(item.content || "");
    content.textContent = item.streaming ? `${baseText}▍` : baseText;

    node.appendChild(meta);
    node.appendChild(content);
    container.appendChild(node);
  }

  container.scrollTop = container.scrollHeight;
}

function buildAssistantMessageText(item) {
  const answerText = String(item?.content || "").trim();
  const reasoningText = item?.showReasoning ? String(item?.reasoning || "").trim() : "";
  if (reasoningText && answerText) {
    return `【推理过程】\n${reasoningText}\n\n【最终答案】\n${answerText}`;
  }
  if (reasoningText) {
    return `【推理过程】\n${reasoningText}`;
  }
  return answerText;
}

function setAiBusy(next) {
  state.aiBusy = Boolean(next);
  if (els.aiSendBtn) {
    els.aiSendBtn.disabled = state.aiBusy;
  }
  if (els.aiClearBtn) {
    els.aiClearBtn.disabled = state.aiBusy;
  }
  if (els.aiInput) {
    els.aiInput.disabled = state.aiBusy;
  }
  if (els.aiAttachBtn) {
    els.aiAttachBtn.disabled = state.aiBusy;
  }
  if (els.aiFileInput) {
    els.aiFileInput.disabled = state.aiBusy;
  }
  if (els.aiProviderSelect) {
    els.aiProviderSelect.disabled = state.aiBusy;
  }
  if (els.aiModelInput) {
    els.aiModelInput.disabled = state.aiBusy;
  }
  if (els.aiRoleSelect) {
    els.aiRoleSelect.disabled = state.aiBusy;
  }
  if (els.aiShowReasoning) {
    els.aiShowReasoning.disabled = state.aiBusy;
  }
}

function mergeSystemSettings(raw) {
  const src = raw || {};
  const ai = src.ai || {};
  const ordersService = src.ordersService || {};
  const roles = normalizeAiRoles(ai.roles);
  const provider = sanitizeProvider(ai.defaultProvider);

  return {
    ai: {
      defaultProvider: provider,
      defaultRole: sanitizeAiRole(ai.defaultRole, roles),
      showReasoning: sanitizeBoolean(ai.showReasoning, DEFAULT_SYSTEM_SETTINGS.ai.showReasoning),
      temperature: clampNumberInRange(ai.temperature, 0, 2, DEFAULT_SYSTEM_SETTINGS.ai.temperature),
      maxHistory: Math.round(clampNumberInRange(ai.maxHistory, 2, 40, DEFAULT_SYSTEM_SETTINGS.ai.maxHistory)),
      models: {
        deepseek: sanitizeModel(ai.models?.deepseek, DEFAULT_SYSTEM_SETTINGS.ai.models.deepseek),
        gemini: sanitizeModel(ai.models?.gemini, DEFAULT_SYSTEM_SETTINGS.ai.models.gemini),
        qwen: sanitizeModel(ai.models?.qwen, DEFAULT_SYSTEM_SETTINGS.ai.models.qwen)
      },
      keys: {
        deepseek: sanitizeApiKey(ai.keys?.deepseek),
        gemini: sanitizeApiKey(ai.keys?.gemini),
        qwen: sanitizeApiKey(ai.keys?.qwen)
      },
      roles,
      systemPrompt: sanitizeSystemPrompt(ai.systemPrompt, DEFAULT_SYSTEM_SETTINGS.ai.systemPrompt)
    },
    ordersService: {
      mode: sanitizeOrdersServiceMode(ordersService.mode),
      endpoint: sanitizeServiceEndpoint(ordersService.endpoint),
      apiKey: sanitizeApiKey(ordersService.apiKey),
      timeoutMs: Math.round(
        clampNumberInRange(
          ordersService.timeoutMs,
          30000,
          600000,
          DEFAULT_SYSTEM_SETTINGS.ordersService.timeoutMs
        )
      ),
      downloadDir: sanitizeDownloadDir(ordersService.downloadDir)
    }
  };
}

function sanitizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (provider === "deepseek" || provider === "gemini" || provider === "qwen") {
    return provider;
  }
  return DEFAULT_SYSTEM_SETTINGS.ai.defaultProvider;
}

function sanitizeRoleId(value) {
  const roleId = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  if (!AI_ROLE_ID_REGEX.test(roleId)) {
    return "";
  }
  return roleId;
}

function sanitizeRoleName(value, fallback = "") {
  const raw = String(value || fallback || "").trim();
  const safe = raw || "未命名角色";
  return safe.slice(0, 40);
}

function sanitizeRolePrompt(value, fallback = "") {
  return String(value || fallback || "").trim().slice(0, 4000);
}

function normalizePromptFingerprint(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveRolePromptWithMigration(id, inputPrompt, builtinPrompt) {
  const normalizedBuiltin = sanitizeRolePrompt(builtinPrompt, "");
  const normalizedInput = sanitizeRolePrompt(inputPrompt, "");
  if (!normalizedBuiltin) {
    return normalizedInput;
  }
  if (!normalizedInput) {
    return normalizedBuiltin;
  }

  const legacyPrompt = LEGACY_BUILTIN_ROLE_PROMPTS[id];
  const inputFingerprint = normalizePromptFingerprint(normalizedInput);
  if (legacyPrompt && inputFingerprint === normalizePromptFingerprint(legacyPrompt)) {
    return normalizedBuiltin;
  }
  if (inputFingerprint === normalizePromptFingerprint(normalizedBuiltin)) {
    return normalizedBuiltin;
  }
  return normalizedInput;
}

function normalizeAiRoles(input) {
  const source = Array.isArray(input) && input.length > 0 ? input : AI_BUILTIN_ROLES;
  const list = [];
  const seen = new Set();

  for (const item of source) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const id = sanitizeRoleId(item.id);
    if (!id || seen.has(id)) {
      continue;
    }

    const builtin = AI_BUILTIN_ROLES.find((role) => role.id === id);
    list.push({
      id,
      name: sanitizeRoleName(item.name, builtin?.name || id),
      prompt: resolveRolePromptWithMigration(id, item.prompt, builtin?.prompt || "")
    });
    seen.add(id);
  }

  if (list.length === 0) {
    return AI_BUILTIN_ROLES.map((item) => ({ ...item }));
  }

  if (!seen.has("general")) {
    const generalRole = AI_BUILTIN_ROLES.find((item) => item.id === "general");
    if (generalRole) {
      list.unshift({ ...generalRole });
    }
  }

  return list;
}

function getDefaultAiRoleId(roles) {
  const list = Array.isArray(roles) ? roles : [];
  for (const item of list) {
    const id = sanitizeRoleId(item?.id);
    if (id === "general") {
      return id;
    }
  }

  for (const item of list) {
    const id = sanitizeRoleId(item?.id);
    if (id) {
      return id;
    }
  }

  return DEFAULT_SYSTEM_SETTINGS.ai.defaultRole;
}

function sanitizeAiRole(value, roles) {
  const roleId = sanitizeRoleId(value);
  const list = Array.isArray(roles) && roles.length > 0 ? roles : normalizeAiRoles(null);
  if (roleId && list.some((item) => sanitizeRoleId(item?.id) === roleId)) {
    return roleId;
  }
  return getDefaultAiRoleId(list);
}

function sanitizeModel(value, fallback) {
  const model = String(value || "").trim();
  return model ? model.slice(0, 80) : String(fallback || "").trim();
}

function sanitizeApiKey(value) {
  return String(value || "").trim();
}

function sanitizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === 0 || value === "0" || value === "false") {
    return false;
  }
  return Boolean(fallback);
}

function sanitizeOrdersServiceMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "extension" || mode === "headless-service") {
    return mode;
  }
  return DEFAULT_SYSTEM_SETTINGS.ordersService.mode;
}

function sanitizeServiceEndpoint(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return DEFAULT_SYSTEM_SETTINGS.ordersService.endpoint;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_SYSTEM_SETTINGS.ordersService.endpoint;
    }
    let path = parsed.pathname || "";
    if (path === "/") {
      path = "";
    } else {
      path = path.replace(/\/+$/, "");
    }
    return `${parsed.origin}${path}`;
  } catch (_error) {
    return DEFAULT_SYSTEM_SETTINGS.ordersService.endpoint;
  }
}

function sanitizeDownloadDir(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return DEFAULT_SYSTEM_SETTINGS.ordersService.downloadDir;
  }

  const normalized = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim().replace(/[^a-zA-Z0-9._-]/g, ""))
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

  return normalized || DEFAULT_SYSTEM_SETTINGS.ordersService.downloadDir;
}

function sanitizeSystemPrompt(value, fallback) {
  const prompt = String(value || fallback || DEFAULT_SYSTEM_SETTINGS.ai.systemPrompt).trim();
  return prompt.slice(0, 4000);
}

function setServiceStatus(text, type = "info") {
  if (!els.settingsServiceStatus) {
    return;
  }
  els.settingsServiceStatus.textContent = text;
  els.settingsServiceStatus.classList.remove("ok", "error");
  els.settingsServiceStatus.classList.add("settings-service-status");
  if (type === "ok") {
    els.settingsServiceStatus.classList.add("ok");
    return;
  }
  if (type === "error") {
    els.settingsServiceStatus.classList.add("error");
    return;
  }
}

function buildAttachmentPayload(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }

  return attachments.map((item) => {
    const base = {
      name: String(item.name || ""),
      mimeType: String(item.mimeType || "application/octet-stream"),
      size: Number(item.size || 0),
      kind: String(item.kind || "text")
    };

    if (base.kind === "text") {
      return {
        ...base,
        text: String(item.text || "")
      };
    }

    if (base.kind === "image") {
      return {
        ...base,
        dataBase64: String(item.dataBase64 || "")
      };
    }

    if (base.kind === "binary") {
      return {
        ...base,
        dataBase64: String(item.dataBase64 || "")
      };
    }

    return base;
  });
}

function buildUserDisplayContent(input, attachments) {
  const text = String(input || "").trim();
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return text;
  }

  const attachmentLines = attachments.map((item) => `- ${item.name} (${formatBytes(item.size)})`);
  const attachText = `已附加文件:\n${attachmentLines.join("\n")}`;
  if (!text) {
    return attachText;
  }
  return `${text}\n\n${attachText}`;
}

function guessMimeTypeByName(filename) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".txt")) {
    return "text/plain";
  }
  if (name.endsWith(".csv")) {
    return "text/csv";
  }
  if (name.endsWith(".md")) {
    return "text/markdown";
  }
  if (name.endsWith(".json")) {
    return "application/json";
  }
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    return "text/html";
  }
  if (name.endsWith(".xml")) {
    return "application/xml";
  }
  if (name.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (name.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (name.endsWith(".xls")) {
    return "application/vnd.ms-excel";
  }
  if (name.endsWith(".xlsm")) {
    return "application/vnd.ms-excel.sheet.macroenabled.12";
  }
  if (name.endsWith(".doc")) {
    return "application/msword";
  }
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".ppt")) {
    return "application/vnd.ms-powerpoint";
  }
  if (name.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (name.endsWith(".rtf")) {
    return "application/rtf";
  }
  if (name.endsWith(".zip")) {
    return "application/zip";
  }
  if (name.endsWith(".7z")) {
    return "application/x-7z-compressed";
  }
  if (name.endsWith(".rar")) {
    return "application/vnd.rar";
  }
  if (name.endsWith(".js")) {
    return "text/javascript";
  }
  if (name.endsWith(".ts")) {
    return "text/plain";
  }
  if (name.endsWith(".py")) {
    return "text/x-python";
  }
  if (name.endsWith(".java")) {
    return "text/x-java";
  }
  if (name.endsWith(".yml") || name.endsWith(".yaml")) {
    return "text/yaml";
  }
  if (name.endsWith(".png")) {
    return "image/png";
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (name.endsWith(".webp")) {
    return "image/webp";
  }
  if (name.endsWith(".gif")) {
    return "image/gif";
  }
  return "";
}

function isTextLikeFile(mimeType, filename) {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(filename || "").toLowerCase();

  if (isExcelLikeFile(mime, name)) {
    return false;
  }

  if (mime.startsWith("text/")) {
    return true;
  }
  if (mime.includes("json") || mime.includes("javascript")) {
    return true;
  }
  if (mime === "application/xml" || mime.endsWith("+xml")) {
    return true;
  }

  return (
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".md") ||
    name.endsWith(".json") ||
    name.endsWith(".xml") ||
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    name.endsWith(".js") ||
    name.endsWith(".ts") ||
    name.endsWith(".py") ||
    name.endsWith(".java") ||
    name.endsWith(".yaml") ||
    name.endsWith(".yml")
  );
}

function isExcelLikeFile(mimeType, filename) {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(filename || "").toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm") ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel.sheet.macroenabled.12"
  );
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) {
    return "0 B";
  }
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function clampNumberInRange(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, num));
}

async function detectAsinFromActiveTab() {
  try {
    const tab = await ensureSellerTabForProductFlow();
    const response = await sendToContent(tab.id, { action: "product.detectAsin" });
    const asin = response?.asin || "";

    if (!asin) {
      throw new Error("当前页面未识别到 ASIN。");
    }

    const current = els.asinInput.value.trim();
    const exists = current
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((item) => item.toUpperCase())
      .includes(asin.toUpperCase());

    if (!exists) {
      els.asinInput.value = current ? `${current}\n${asin}` : asin;
    }

    setStatus(`识别到 ASIN: ${asin}`);
    await appendRuntimeLog("success", "products", `Detected ASIN ${asin}`);
  } catch (error) {
    setStatus(`识别失败: ${error.message}`);
    await appendRuntimeLog("warning", "products", "Detect ASIN failed", { error: error.message });
  }
}

async function extractProducts() {
  const asins = parseAsinList(els.asinInput.value);
  if (asins.length === 0) {
    setStatus("请先输入至少一个有效 ASIN。");
    return;
  }

  const presetName = els.fieldPreset.value;
  const fieldDefs = getEnabledFieldDefinitions(presetName);
  if (fieldDefs.length === 0) {
    setStatus("字段配置为空，请检查 field_config.js。");
    return;
  }

  setBusy(true);
  setStatus(`开始提取 ${asins.length} 个 ASIN...`);
  await appendRuntimeLog("info", "products", "Product extraction started", {
    count: asins.length,
    presetName
  });

  try {
    const tab = await ensureSellerTabForProductFlow();
    const rows = [];
    const intervalMs = Math.max(500, Number(els.requestIntervalSec.value || 1) * 1000);

    for (let i = 0; i < asins.length; i += 1) {
      const asin = asins[i];
      setStatus(`提取中 ${i + 1}/${asins.length}: ${asin}`);

      try {
        const response = await sendToContent(tab.id, {
          action: "product.fetchApis",
          payload: { asin }
        });

        const row = buildProductRow(asin, response, fieldDefs);
        rows.push(row);
        await appendRuntimeLog("success", "products", `ASIN extracted: ${asin}`);
      } catch (error) {
        await appendRuntimeLog("error", "products", `ASIN extract failed: ${asin}`, { error: error.message });
      }

      if (i < asins.length - 1) {
        await wait(intervalMs);
      }
    }

    if (rows.length === 0) {
      throw new Error("没有成功提取的数据。");
    }

    const headers = buildCsvHeaders(fieldDefs);
    const csv = rowsToCsv(rows, headers);
    const filename = buildProductExportName();
    await downloadCsv(csv, filename);

    setStatus(`产品数据导出完成: ${filename}`);
    await appendRuntimeLog("success", "products", "Product extraction completed", {
      rows: rows.length,
      filename
    });
  } catch (error) {
    setStatus(`提取失败: ${error.message}`);
    await appendRuntimeLog("error", "products", "Product extraction failed", { error: error.message });
  } finally {
    setBusy(false);
    await refreshLogs();
  }
}

function parseAsinList(input) {
  return Array.from(
    new Set(
      String(input || "")
        .split(/[\n,;\s]+/)
        .map((item) => item.trim().toUpperCase())
        .filter((item) => ASIN_REGEX.test(item))
    )
  );
}

function getEnabledFieldDefinitions(presetName) {
  const fieldConfig = window.FIELD_CONFIG || {};
  const presetConfig = window.PRESET_CONFIGS || {};
  const preset = presetConfig[presetName] ?? presetConfig.standard ?? [];

  let allowedKeys = null;
  let includeDisabled = false;
  if (Array.isArray(preset)) {
    allowedKeys = new Set(preset);
  } else if (preset === "all" || preset?.fields === "all") {
    allowedKeys = null;
    includeDisabled = true;
  } else if (Array.isArray(preset?.fields)) {
    allowedKeys = new Set(preset.fields);
  }

  const defs = [];
  for (const category of Object.values(fieldConfig)) {
    if (!category || typeof category !== "object") {
      continue;
    }

    for (const [key, config] of Object.entries(category)) {
      if (!config || typeof config !== "object") {
        continue;
      }

      if (config.enabled === false && !includeDisabled) {
        continue;
      }

      if (allowedKeys && !allowedKeys.has(key)) {
        continue;
      }

      defs.push({
        key,
        label: config.label || key,
        source: config.source,
        path: config.path
      });
    }
  }

  defs.sort((a, b) => {
    if (a.label === "ASIN") {
      return -1;
    }
    if (b.label === "ASIN") {
      return 1;
    }
    return a.label.localeCompare(b.label, "zh-CN");
  });

  return defs;
}

function buildProductRow(asin, bundle, fieldDefs) {
  const row = { ASIN: asin };
  const targetScopedData = buildTargetScopedData(bundle.targets, asin);

  for (const def of fieldDefs) {
    const sourceData =
      def.source === "targets" ? targetScopedData
        : def.source === "v3" ? bundle.v3
          : def.source === "v2" ? bundle.v2
            : null;

    let value = extractFieldValue(sourceData, def.path);

    if (def.key === "productDescription" && isEmptyValue(value)) {
      value = extractFieldValue(bundle.v2, 'detailPageListingResponse["product_description#1.value"].value');
      if (isEmptyValue(value)) {
        const bullets = extractFieldValue(sourceData, "[0].targetInformation.bulletPoints");
        if (Array.isArray(bullets) && bullets.length > 0) {
          value = bullets.join(" | ");
        } else {
          value = extractFieldValue(bundle.v2, 'detailPageListingResponse["bullet_point#1.value"].value');
        }
      }
    }

    if (def.key === "childrenAsins" && isEmptyValue(value)) {
      value = extractFieldValue(sourceData, "[0].targetInformation.children");
    }

    if (def.key === "numberOfChildren" && isEmptyValue(value)) {
      value = extractFieldValue(sourceData, "[0].targetInformation.numberOfChildren");
    }

    row[def.label] = normalizeCellValue(value);
  }

  return row;
}

function buildTargetScopedData(targets, asin) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [];
  }

  const normalizedAsin = String(asin || "").trim().toUpperCase();
  const direct = targets.find((item) => {
    const t = item?.targetInformation?.target || item?.target;
    return String(t || "").toUpperCase() === normalizedAsin;
  });

  const parentByChild = targets.find((item) => {
    const children = item?.targetInformation?.children;
    return Array.isArray(children) && children.map((x) => String(x).toUpperCase()).includes(normalizedAsin);
  });

  if (direct) {
    const merged = cloneTargetItem(direct);
    const directParentAsin = direct?.targetInformation?.parent;
    const parentByParentAsin = directParentAsin
      ? targets.find((item) => {
          const t = item?.targetInformation?.target || item?.target;
          return String(t || "").toUpperCase() === String(directParentAsin).toUpperCase();
        })
      : null;

    const parentCandidate = parentByParentAsin || parentByChild || null;
    if (parentCandidate) {
      const currentChildren = merged?.targetInformation?.children;
      const currentChildrenCount = Array.isArray(currentChildren) ? currentChildren.length : 0;
      const currentNumberOfChildren = Number(merged?.targetInformation?.numberOfChildren || 0);

      if (currentChildrenCount === 0 || currentNumberOfChildren === 0) {
        merged.targetInformation.children = parentCandidate?.targetInformation?.children ?? currentChildren;
        merged.targetInformation.numberOfChildren =
          parentCandidate?.targetInformation?.numberOfChildren ?? merged?.targetInformation?.numberOfChildren;
      }
    }

    return [merged];
  }

  if (parentByChild) {
    return [cloneTargetItem(parentByChild)];
  }

  return [cloneTargetItem(targets[0])];
}

function cloneTargetItem(item) {
  return JSON.parse(JSON.stringify(item || {}));
}

function isEmptyValue(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function buildCsvHeaders(fieldDefs) {
  const labels = fieldDefs.map((def) => def.label).filter(Boolean);
  const unique = Array.from(new Set(["ASIN", ...labels]));
  return unique;
}

function rowsToCsv(rows, headers) {
  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    const line = headers.map((header) => csvEscape(row[header])).join(",");
    lines.push(line);
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

async function downloadCsv(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: `amazon/${filename}`,
      saveAs: false,
      conflictAction: "uniquify"
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function normalizeCellValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}

function extractFieldValue(data, path) {
  if (!data || !path) {
    return "";
  }

  const tokens = parsePathTokens(path);
  if (tokens.length === 0) {
    return "";
  }

  let current = data;
  for (const token of tokens) {
    if (current === undefined || current === null) {
      return "";
    }

    if (/^\d+$/.test(token)) {
      current = current[Number(token)];
    } else {
      current = current[token];
    }
  }

  return current ?? "";
}

function parsePathTokens(path) {
  const tokens = [];
  let current = "";

  for (let i = 0; i < path.length; i += 1) {
    const ch = path[i];

    if (ch === ".") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    if (ch === "[") {
      if (current) {
        tokens.push(current);
        current = "";
      }

      let bracket = "";
      let quote = null;
      i += 1;

      while (i < path.length) {
        const inner = path[i];

        if (quote) {
          if (inner === "\\") {
            const next = path[i + 1];
            if (next) {
              bracket += next;
              i += 2;
              continue;
            }
          }

          if (inner === quote) {
            quote = null;
            i += 1;
            continue;
          }

          bracket += inner;
          i += 1;
          continue;
        }

        if (inner === "'" || inner === "\"") {
          quote = inner;
          i += 1;
          continue;
        }

        if (inner === "]") {
          break;
        }

        bracket += inner;
        i += 1;
      }

      const token = bracket.trim();
      if (token) {
        tokens.push(token);
      }

      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function buildProductExportName() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  return `product_data_${stamp}.csv`;
}

async function ensureSellerTabForProductFlow() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id && active.url?.includes(SELLER_HOST)) {
    return active;
  }

  const inWindow = await chrome.tabs.query({ currentWindow: true, url: "https://sellercentral.amazon.com/*" });
  if (inWindow.length > 0) {
    return inWindow[0];
  }

  const anywhere = await chrome.tabs.query({ url: "https://sellercentral.amazon.com/*" });
  if (anywhere.length > 0) {
    return anywhere[0];
  }

  throw new Error("未找到 Seller Central 标签页，请先打开并登录 Seller Central。");
}

async function sendToContent(tabId, message) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    if (!response?.ok) {
      throw new Error(response?.error || "内容脚本返回错误");
    }
    return response;
  } catch (error) {
    if (String(error.message || "").includes("Receiving end does not exist")) {
      await injectContentScript(tabId);
      const retry = await chrome.tabs.sendMessage(tabId, message);
      if (!retry?.ok) {
        throw new Error(retry?.error || "内容脚本返回错误");
      }
      return retry;
    }
    throw error;
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (error) {
    throw new Error(`脚本注入失败，请刷新 Seller Central 页面后重试: ${error.message}`);
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
  els.detectAsinBtn.disabled = disabled;
  els.extractProductsBtn.disabled = disabled;
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
    empty.innerHTML = "<div class=\"log-msg\">暂无日志</div>";
    els.logsList.appendChild(empty);
    return;
  }

  for (const item of state.logs.slice(0, 100)) {
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

async function appendRuntimeLog(level, scope, message, details = null) {
  try {
    await callBackground("logs.append", {
      level,
      scope,
      trigger: "manual",
      message,
      details
    });
  } catch (_error) {
    // Ignore logging failures.
  }
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
