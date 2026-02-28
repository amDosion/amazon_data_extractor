const ORDERS_PAGE_URL = "https://sellercentral.amazon.com/order-reports-and-feeds/reports/allOrders#";
const ORDERS_PAGE_PATH = "/order-reports-and-feeds/reports/allOrders";
const ORDERS_TAB_QUERY = "https://sellercentral.amazon.com/order-reports-and-feeds/reports/allOrders*";

const STORAGE_KEYS = {
  config: "sellerAutomationConfigV2",
  logs: "sellerAutomationLogsV2",
  systemSettings: "sellerAutomationSystemSettingsV1"
};

const ALARM_NAME = "orders-report-schedule-v2";
const MAX_LOG_ITEMS = 300;
const AI_ROLE_ID_REGEX = /^[a-z0-9_-]{2,40}$/;
const AMAZON_OPERATOR_CORE_PROMPT = [
  "你是亚马逊运营AI助手，必须输出完整、可执行、可复盘的分析。",
  "方法约束：只在当前角色职责范围内分析，不跨角色扩写无关模块。",
  "1) 先做数据核查：时间范围、样本量、缺失项、异常点、置信度。",
  "2) 区分症状与根因，并尽量量化影响区间。",
  "3) 给出P0/P1/P2动作，写清目标、步骤、KPI、风险与回滚。",
  "4) 数据不足时先列假设与需补字段，不得直接下确定性结论。"
].join("\\n");
const MANDATORY_ANALYSIS_PROTOCOL = [
  "强制回复协议：",
  "每次回答至少包含：业务结论、关键诊断、根因拆解、P0/P1/P2行动、风险监控、需补充数据。",
  "每个行动项必须写明：目的、步骤、指标、预期收益、潜在副作用。",
  "如果输入数据有偏差或不足，必须先指出再分析，不能直接下结论。"
].join("\\n");

const AI_ROLE_PROMPT_GENERAL = [
  AMAZON_OPERATOR_CORE_PROMPT,
  "角色身份：亚马逊全局经营顾问（运营+广告+供应链+财务+合规+客服）。",
  "核心任务：做全局最优，不做局部最优；任何建议都要说明对 GMV、利润率、库存、风险的联动影响。",
  "必做分析：",
  "1) 经营体检矩阵：流量、点击率、转化率、客单、复购、TACOS、净利率、库存周转、账户健康。",
  "2) 父子体策略：识别流量内耗、主推款、利润款、引流款、清货款，给出变体分工。",
  "3) 增长杠杆排序：按影响度 x 落地难度 x 回报周期给出 Top 5。",
  "输出格式：",
  "A. 30天目标树（目标值+基线+差距）",
  "B. 跨团队执行表（运营/广告/设计/客服/供应链）",
  "C. 本周动作清单（按天安排+验收口径）",
  "D. 风险雷达（触发阈值+预案）"
].join("\\n");

const AI_ROLE_PROMPT_OPERATIONS = [
  AMAZON_OPERATOR_CORE_PROMPT,
  "角色身份：运营策略顾问，负责节奏、流程、协同与执行闭环。",
  "核心任务：把目标拆到人、拆到周、拆到动作，并建立复盘机制。",
  "必做分析：",
  "1) 目标拆解：月目标 -> 周目标 -> 日动作，定义负责人与截止时间。",
  "2) SOP审计：上新、素材迭代、价格调整、促销提报、库存补货、异常处理。",
  "3) 组织协同：RACI 责任矩阵、会议机制、升级路径、跨团队依赖。",
  "输出格式：",
  "A. 运营节奏图（周会/月会/复盘）",
  "B. SOP改造清单（现状-问题-新流程）",
  "C. 关键阻塞点与消除方案",
  "D. 执行追踪模板（进度/偏差/纠偏）"
].join("\\n");

const AI_ROLE_PROMPT_LISTING = [
  AMAZON_OPERATOR_CORE_PROMPT,
  "角色身份：Listing优化师，负责搜索匹配、信息表达和转化提升。",
  "核心任务：提升自然流量覆盖与详情页转化效率。",
  "必做分析：",
  "1) 关键词地图：核心词、属性词、场景词、竞品词，建立词-模块分配。",
  "2) 信息架构：标题、五点、描述、A+、主图/辅图是否一致传达核心卖点。",
  "3) 转化阻塞：信任缺口、对比劣势、证据不足、场景不清、价格心智不匹配。",
  "输出格式：",
  "A. 关键词覆盖差距表（缺词/弱词/冗余词）",
  "B. 标题方案3版（激进/平衡/保守）",
  "C. 五点与描述重写稿（含卖点优先级）",
  "D. 图片脚本与A+模块线框（逐屏目的）"
].join("\\n");

const AI_ROLE_PROMPT_ADS = [
  AMAZON_OPERATOR_CORE_PROMPT,
  "角色身份：广告投放专家，负责投放结构、竞价策略与预算效率。",
  "核心任务：在可控风险下提升有效流量和利润质量。",
  "必做分析：",
  "1) 账户架构：SP/SB/SD 的分层目标（拓量、控本、防守、拦截、再营销）。",
  "2) 词与ASIN策略：搜索词分桶、否词规则、匹配方式、竞品定向策略。",
  "3) 出价与预算：分时预算、placement 调整、预算上限和止损线。",
  "输出格式：",
  "A. 广告结构蓝图（保留/新建/合并/暂停）",
  "B. 关键词动作表（加词/提价/降价/否词）",
  "C. 预算分配表（日预算+时段系数）",
  "D. KPI看板（ACOS/TACOS/CVR/CPC/订单占比）"
].join("\\n");

const AI_ROLE_PROMPT_PROFIT = [
  AMAZON_OPERATOR_CORE_PROMPT,
  "角色身份：FBA利润分析师，负责单件模型、现金流与经营质量。",
  "核心任务：确保增长建立在可持续利润和可控库存上。",
  "必做分析：",
  "1) 单件利润拆解：售价、折扣、COGS、头程、FBA、佣金、仓储、退货、广告、售后。",
  "2) 情景分析：价格/转化/广告强度变化对净利率和现金流的影响。",
  "3) 库存与资金：周转天数、断货概率、滞销风险、补货节奏、资金占用。",
  "输出格式：",
  "A. 利润桥（Revenue -> Gross -> Net）",
  "B. 敏感性分析表（3档情景）",
  "C. 库存与现金流预警阈值",
  "D. 利润修复动作（定价/促销/物流/广告）"
].join("\\n");

const AI_ROLE_PROMPT_COMPLIANCE = [
  AMAZON_OPERATOR_CORE_PROMPT,
  "角色身份：合规风控顾问，负责政策安全与账户健康防线。",
  "核心任务：先防风险，再谈增长；所有建议必须政策安全可执行。",
  "必做分析：",
  "1) 风险识别：内容违规、侵权风险、资质缺失、评价风险、沟通风险。",
  "2) 严重度分级：高/中/低风险项及触发后果（下架、限制、申诉成本）。",
  "3) 整改路径：证据链、话术改写、内部流程修复、复发预防。",
  "输出格式：",
  "A. 风险清单（条款对应+触发概率+影响级别）",
  "B. 低风险替代表达库（可直接替换）",
  "C. POA 模板（根因/纠正/预防）",
  "D. 7天整改排期与验收标准"
].join("\\n");

const AI_ROLE_PROMPT_CS = [
  AMAZON_OPERATOR_CORE_PROMPT,
  "角色身份：客服沟通教练，负责客户体验、评价风险和售后效率。",
  "核心任务：提升满意度与一次解决率，同时压降退款和差评。",
  "必做分析：",
  "1) 场景分层：售前咨询、物流异常、质量问题、安装使用、退款退货、升级投诉。",
  "2) 话术质量：同理心、澄清问题、给方案、给时效、给闭环。",
  "3) VOC 回流：将客户问题沉淀到 Listing、产品、包装、说明书优化。",
  "输出格式：",
  "A. 场景话术库（首轮/二轮/升级）",
  "B. 升级判定树（何时补偿/退款/换货/升级）",
  "C. KPI改进计划（响应时效/一次解决率/退款率/差评率）",
  "D. VOC问题闭环表（问题-责任-改进-验证）"
].join("\\n");

const AI_BUILTIN_ROLES = [
  {
    id: "general",
    name: "通用",
    prompt: AI_ROLE_PROMPT_GENERAL
  },
  {
    id: "operationsconsultant",
    name: "运营策略顾问",
    prompt: AI_ROLE_PROMPT_OPERATIONS
  },
  {
    id: "listingoptimizer",
    name: "Listing优化师",
    prompt: AI_ROLE_PROMPT_LISTING
  },
  {
    id: "adsspecialist",
    name: "广告投放专家",
    prompt: AI_ROLE_PROMPT_ADS
  },
  {
    id: "fbaprofitanalyst",
    name: "FBA利润分析师",
    prompt: AI_ROLE_PROMPT_PROFIT
  },
  {
    id: "complianceadvisor",
    name: "合规风控顾问",
    prompt: AI_ROLE_PROMPT_COMPLIANCE
  },
  {
    id: "customerservicecoach",
    name: "客服沟通教练",
    prompt: AI_ROLE_PROMPT_CS
  }
];
const LEGACY_BUILTIN_ROLE_PROMPTS = Object.freeze({
  general: [
    "You are an all-round Amazon seller copilot. Provide practical, concise, and action-oriented answers across listing, ads, operations, compliance, and customer service.",
    "全能运营模式：在广告、Listing、运营、库存、利润、合规、客服之间做统一决策。每次必须给出全局诊断和跨模块联动方案，不能只做局部优化。"
  ],
  operationsconsultant: [
    "You are an Amazon seller operations consultant. Focus on actionable SOPs, weekly execution, and KPI impact.",
    "重点输出运营节奏与执行治理：周/月度 KPI 看板、SOP 设计、跨岗位协同、项目优先级、里程碑与复盘机制；强调可落地执行路径。"
  ],
  listingoptimizer: [
    "You are an Amazon Listing Optimization specialist. Focus on title, bullets, description, A+ structure, and conversion lift.",
    "重点输出 Listing 增长：标题结构、关键词意图覆盖、五点卖点排序、描述/A+叙事、主图与辅图信息架构、转化障碍与替代文案方案。"
  ],
  adsspecialist: [
    "You are an Amazon PPC specialist. Focus on campaign structure, bidding logic, search terms, ACOS/TACOS, and budget allocation.",
    "重点输出广告增长与控本：SP/SB/SD 分层架构、词包分层、搜索词挖掘、否词规则、出价与 Placement 策略、预算节奏、ACOS/TACOS 与利润协同优化。"
  ],
  fbaprofitanalyst: [
    "You are an Amazon FBA profit analyst. Focus on fees, storage, return rate impact, margin, break-even, and cashflow risk.",
    "重点输出利润与现金流：单件经济模型、COGS、FBA/佣金/仓储/退货成本、促销折扣影响、盈亏平衡点、补货与资金占用风险。"
  ],
  complianceadvisor: [
    "You are an Amazon policy and compliance advisor. Focus on policy-safe language, account health, and risk mitigation.",
    "重点输出合规风险控制：政策红线识别、账户健康指标、潜在违规触发点、低风险沟通措辞、整改优先级和申诉准备清单。"
  ],
  customerservicecoach: [
    "You are an Amazon customer service coach. Draft concise, empathetic, policy-safe responses and escalation paths.",
    "重点输出客服与口碑：售前问答、售后场景脚本、差评与退款处理、升级路径、满意度提升、Review 风险控制与政策安全表达。"
  ]
});

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
    systemPrompt:
      "You are an assistant for Amazon seller operations. Keep answers practical, concise, and action-oriented."
  },
  ordersService: {
    mode: "extension",
    endpoint: "http://127.0.0.1:8787",
    apiKey: "",
    timeoutMs: 180000,
    downloadDir: "amazon"
  }
};

let activeRunPromise = null;

chrome.runtime.onInstalled.addListener(async () => {
  await ensureConfig();
  await ensureSystemSettings();
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
  await ensureSystemSettings();
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

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ai-chat-stream") {
    return;
  }

  handleAiStreamPort(port);
});

async function handleMessage(request, sender) {
  switch (request?.action) {
    case "ui.getBootstrap": {
      const [config, logs, systemSettings] = await Promise.all([getConfig(), getLogs(), getSystemSettings()]);
      return {
        config,
        systemSettings,
        logs,
        busy: Boolean(activeRunPromise),
        modules: {
          orders: "active",
          productExtraction: "active",
          aiChat: "active",
          settings: "active",
          ads: "active",
          inventory: "active",
          profit: "active",
          keywords: "active",
          reviews: "active",
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

    case "logs.append": {
      const payload = request.payload ?? {};
      await appendLog({
        level: payload.level || "info",
        scope: payload.scope || "system",
        trigger: payload.trigger || "manual",
        message: payload.message || "",
        details: payload.details || null
      });
      return { appended: true };
    }

    case "settings.get": {
      return {
        systemSettings: await getSystemSettings()
      };
    }

    case "settings.save": {
      const payload = request.payload ?? {};
      const current = await getSystemSettings();
      const next = mergeSystemSettings({
        ...current,
        ai: {
          ...current.ai,
          ...payload.ai,
          models: {
            ...current.ai.models,
            ...(payload.ai?.models || {})
          },
          keys: {
            ...current.ai.keys,
            ...(payload.ai?.keys || {})
          }
        },
        ordersService: {
          ...current.ordersService,
          ...(payload.ordersService || {})
        }
      });

      await setSystemSettings(next);
      await appendLog({
        level: "info",
        scope: "settings",
        trigger: "manual",
        message: "System settings updated",
        details: {
          defaultProvider: next.ai.defaultProvider,
          defaultRole: next.ai.defaultRole,
          ordersMode: next.ordersService.mode
        }
      });

      return { systemSettings: next };
    }

    case "orders.servicePing": {
      const payload = request.payload ?? {};
      return await pingOrdersService(payload.ordersService || null);
    }

    case "ai.chat": {
      const payload = request.payload ?? {};
      const result = await processAiChat(payload);
      await appendLog({
        level: "info",
        scope: "ai",
        trigger: "manual",
        message: `AI chat response generated (${result.provider})`,
        details: {
          provider: result.provider,
          model: result.model,
          role: result.role
        }
      });
      return result;
    }

    case "ads.fetchReport": {
      const payload = request.payload ?? {};
      const tabId = payload.tabId;
      if (!tabId) throw new Error("No active Seller Central tab.");
      const response = await chrome.tabs.sendMessage(tabId, { action: "ads.fetchReport", payload });
      if (!response?.ok) throw new Error(response?.error || "Ads fetch failed");
      await appendLog({ level: "info", scope: "ads", trigger: "manual", message: "Ads report data fetched", details: { reportType: payload.reportType, source: response.source } });
      return response;
    }

    case "inventory.fetch": {
      const payload = request.payload ?? {};
      const tabId = payload.tabId;
      if (!tabId) throw new Error("No active Seller Central tab.");
      const response = await chrome.tabs.sendMessage(tabId, { action: "inventory.fetch", payload });
      if (!response?.ok) throw new Error(response?.error || "Inventory fetch failed");
      await appendLog({ level: "info", scope: "inventory", trigger: "manual", message: "Inventory data fetched", details: { source: response.source, itemCount: response.items?.length || 0 } });
      return response;
    }

    case "reviews.scrape": {
      const payload = request.payload ?? {};
      const tabId = payload.tabId;
      if (!tabId) throw new Error("No active tab.");
      const response = await chrome.tabs.sendMessage(tabId, { action: "reviews.scrape", payload });
      if (!response?.ok) throw new Error(response?.error || "Review scrape failed");
      await appendLog({ level: "info", scope: "reviews", trigger: "manual", message: `Reviews scraped: ${response.reviewCount || 0}`, details: { asin: response.asin, count: response.reviewCount } });
      return response;
    }

    default:
      throw new Error(`Unknown action: ${request?.action}`);
  }
}

async function runOrderReportTask(inputOptions, context) {
  const config = await getConfig();
  const systemSettings = await getSystemSettings();
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

  const runTask =
    systemSettings.ordersService.mode === "headless-service"
      ? executeOrderRunViaService(runId, options, systemSettings.ordersService, trigger, startedAt)
      : executeOrderRun(runId, options, config, context, trigger, startedAt);
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

async function executeOrderRunViaService(runId, options, serviceSettings, trigger, startedAt) {
  const endpoint = normalizeServiceEndpoint(serviceSettings.endpoint);
  const timeoutMs = clampNumber(
    serviceSettings.timeoutMs,
    30000,
    600000,
    DEFAULT_SYSTEM_SETTINGS.ordersService.timeoutMs
  );
  const downloadDir = sanitizeDownloadDir(serviceSettings.downloadDir);

  try {
    const requestUrl = `${endpoint}/api/orders/report`;
    const headers = {
      "Content-Type": "application/json"
    };
    if (serviceSettings.apiKey) {
      headers["X-API-Key"] = serviceSettings.apiKey;
    }

    const response = await fetchWithTimeout(
      requestUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          runId,
          trigger,
          source: "seller-automation-extension-v2",
          options,
          output: {
            downloadDir
          }
        })
      },
      timeoutMs
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Order service error ${response.status}: ${truncateText(text)}`);
    }

    const data = safeJsonParseLoose(text);
    const finalResult = {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      trigger,
      runner: "headless-service",
      service: {
        endpoint,
        timeoutMs,
        downloadDir
      }
    };

    if (data?.downloadUrl) {
      const filename =
        sanitizeDownloadFilename(data.downloadFilename) ||
        buildDownloadFilename(options.reportNamePrefix, data.downloadUrl, downloadDir);
      const downloadId = await chrome.downloads.download({
        url: String(data.downloadUrl),
        filename,
        saveAs: false,
        conflictAction: "uniquify"
      });

      finalResult.download = {
        mode: "service-download-url",
        downloadId,
        filename
      };
    } else if (data?.savedPath) {
      finalResult.download = {
        mode: "service-saved-file",
        savedPath: String(data.savedPath)
      };
    } else {
      finalResult.download = {
        mode: "service-response",
        message: typeof data?.message === "string" ? data.message : "Service accepted request."
      };
    }

    await appendLog({
      level: "success",
      scope: "orders",
      trigger,
      message: "Order report run completed (headless service)",
      details: finalResult
    });

    return finalResult;
  } catch (error) {
    await appendLog({
      level: "error",
      scope: "orders",
      trigger,
      message: "Order report run failed (headless service)",
      details: {
        runId,
        startedAt,
        finishedAt: new Date().toISOString(),
        trigger,
        endpoint,
        error: error.message
      }
    });
    throw error;
  }
}

async function pingOrdersService(overrideServiceSettings) {
  const current = await getSystemSettings();
  const merged = mergeSystemSettings({
    ...current,
    ordersService: {
      ...current.ordersService,
      ...(overrideServiceSettings || {})
    }
  });
  const service = merged.ordersService;
  const endpoint = normalizeServiceEndpoint(service.endpoint);
  const timeoutMs = clampNumber(
    service.timeoutMs,
    30000,
    600000,
    DEFAULT_SYSTEM_SETTINGS.ordersService.timeoutMs
  );

  const headers = {};
  if (service.apiKey) {
    headers["X-API-Key"] = service.apiKey;
  }

  const response = await fetchWithTimeout(
    `${endpoint}/health`,
    {
      method: "GET",
      headers
    },
    timeoutMs
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Service health error ${response.status}: ${truncateText(text)}`);
  }

  return {
    endpoint,
    status: response.status,
    ok: true,
    body: safeJsonParseLoose(text) || {}
  };
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
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

function buildDownloadFilename(prefix, url, downloadDir = "amazon") {
  const safePrefix = sanitizePrefix(prefix) || "orders-report";
  const safeDir = sanitizeDownloadDir(downloadDir);
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  const extension = inferExtension(url);
  return `${safeDir}/${safePrefix}_${timestamp}${extension}`;
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

function sanitizeDownloadFilename(filename) {
  const raw = String(filename || "").trim();
  if (!raw) {
    return "";
  }

  const normalized = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, ""))
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

  return normalized.slice(0, 180);
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

async function ensureSystemSettings() {
  const existing = await chrome.storage.local.get(STORAGE_KEYS.systemSettings);
  if (!existing[STORAGE_KEYS.systemSettings]) {
    const initial = structuredClone(DEFAULT_SYSTEM_SETTINGS);
    await chrome.storage.local.set({ [STORAGE_KEYS.systemSettings]: initial });
    return initial;
  }

  const merged = mergeSystemSettings(existing[STORAGE_KEYS.systemSettings]);
  await chrome.storage.local.set({ [STORAGE_KEYS.systemSettings]: merged });
  return merged;
}

async function getSystemSettings() {
  const current = await chrome.storage.local.get(STORAGE_KEYS.systemSettings);
  return mergeSystemSettings(current[STORAGE_KEYS.systemSettings]);
}

async function setSystemSettings(settings) {
  const merged = mergeSystemSettings(settings);
  await chrome.storage.local.set({ [STORAGE_KEYS.systemSettings]: merged });
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
      temperature: clampNumber(ai.temperature, 0, 2, DEFAULT_SYSTEM_SETTINGS.ai.temperature),
      maxHistory: clampNumber(ai.maxHistory, 2, 40, DEFAULT_SYSTEM_SETTINGS.ai.maxHistory),
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
      systemPrompt: sanitizeSystemPrompt(ai.systemPrompt)
    },
    ordersService: {
      mode: sanitizeOrdersServiceMode(ordersService.mode),
      endpoint: sanitizeServiceEndpoint(ordersService.endpoint),
      apiKey: sanitizeApiKey(ordersService.apiKey),
      timeoutMs: clampNumber(
        ordersService.timeoutMs,
        30000,
        600000,
        DEFAULT_SYSTEM_SETTINGS.ordersService.timeoutMs
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
  const raw = String(value || fallback || "").trim();
  return raw.slice(0, 4000);
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

  const legacyPromptSource = LEGACY_BUILTIN_ROLE_PROMPTS[id];
  const legacyPrompts = Array.isArray(legacyPromptSource)
    ? legacyPromptSource
    : legacyPromptSource
      ? [legacyPromptSource]
      : [];
  const inputFingerprint = normalizePromptFingerprint(normalizedInput);
  const isLegacyStructuredPrompt =
    inputFingerprint.includes("角色专属分析重点：") &&
    inputFingerprint.includes("输出规范（必须完整）：") &&
    inputFingerprint.includes("硬性约束：");
  if (isLegacyStructuredPrompt) {
    return normalizedBuiltin;
  }
  if (
    legacyPrompts.some((item) => {
      const legacyFingerprint = normalizePromptFingerprint(item);
      return (
        legacyFingerprint &&
        (inputFingerprint === legacyFingerprint || inputFingerprint.includes(legacyFingerprint))
      );
    })
  ) {
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

    const builtin = AI_BUILTIN_ROLES.find((role) => sanitizeRoleId(role.id) === id);
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

function getAiRolePrompt(role, roles) {
  const list = Array.isArray(roles) && roles.length > 0 ? roles : normalizeAiRoles(null);
  const roleId = sanitizeAiRole(role, list);
  const matched = list.find((item) => sanitizeRoleId(item?.id) === roleId);
  return String(matched?.prompt || "");
}

function composeRoleSystemPrompt(basePrompt, rolePrompt) {
  const roleText = String(rolePrompt || "").trim();
  const baseText = String(basePrompt || "").trim();
  const protocolText = String(MANDATORY_ANALYSIS_PROTOCOL || "").trim();

  const parts = [roleText, baseText, protocolText].filter(Boolean);
  return parts.join("\n\n");
}

function sanitizeModel(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }
  return raw.slice(0, 80);
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
  if (mode === "headless-service" || mode === "extension") {
    return mode;
  }
  return DEFAULT_SYSTEM_SETTINGS.ordersService.mode;
}

function sanitizeServiceEndpoint(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return DEFAULT_SYSTEM_SETTINGS.ordersService.endpoint;
  }
  return normalizeServiceEndpoint(raw);
}

function normalizeServiceEndpoint(value) {
  try {
    const parsed = new URL(String(value || "").trim());
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

function sanitizeSystemPrompt(value) {
  const prompt = String(value || DEFAULT_SYSTEM_SETTINGS.ai.systemPrompt);
  return prompt.trim().slice(0, 4000);
}

async function processAiChat(payload) {
  const settings = await getSystemSettings();
  const roles = normalizeAiRoles(settings.ai.roles);
  const provider = sanitizeProvider(payload.provider || settings.ai.defaultProvider);
  const role = sanitizeAiRole(payload.role || settings.ai.defaultRole, roles);
  const showReasoning = sanitizeBoolean(payload.showReasoning, settings.ai.showReasoning);
  const model = sanitizeModel(payload.model, settings.ai.models[provider]);
  const apiKey = sanitizeApiKey(payload.apiKey || settings.ai.keys[provider]);
  const temperature = clampNumber(payload.temperature, 0, 2, settings.ai.temperature);
  const maxHistory = clampNumber(payload.maxHistory, 2, 40, settings.ai.maxHistory);
  const baseSystemPrompt = sanitizeSystemPrompt(payload.systemPrompt || settings.ai.systemPrompt);
  const systemPrompt = composeRoleSystemPrompt(baseSystemPrompt, getAiRolePrompt(role, roles));
  const messages = normalizeChatMessages(payload.messages).slice(-maxHistory * 2);
  const attachments = normalizeChatAttachments(payload.attachments);

  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }
  if (messages.length === 0) {
    throw new Error("No chat messages to send.");
  }

  let result = { reply: "", reasoning: "" };
  if (provider === "deepseek") {
    result = await callDeepSeekChat({
      apiKey,
      model,
      messages: applyAttachmentsToTextMessages(messages, attachments),
      systemPrompt,
      temperature
    });
  } else if (provider === "gemini") {
    result = await callGeminiChat({ apiKey, model, messages, attachments, systemPrompt, temperature });
  } else if (provider === "qwen") {
    result = await callQwenChat({
      apiKey,
      model,
      messages: applyAttachmentsToTextMessages(messages, attachments),
      systemPrompt,
      temperature
    });
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return {
    provider,
    model,
    role,
    reasoning: showReasoning ? String(result.reasoning || "").trim() : "",
    reply: String(result.reply || "")
  };
}

function handleAiStreamPort(port) {
  let active = null;

  port.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.action === "cancel") {
      if (active?.requestId && message.requestId === active.requestId) {
        active.controller.abort();
      }
      return;
    }

    if (message.action !== "start") {
      return;
    }

    const requestId = String(message.requestId || crypto.randomUUID());
    if (active?.controller) {
      active.controller.abort();
    }

    const controller = new AbortController();
    active = { requestId, controller };

    processAiChatStream(message.payload ?? {}, {
      signal: controller.signal,
      onStarted: (meta) => {
        safePortPost(port, {
          type: "started",
          requestId,
          ...meta
        });
      },
      onDelta: (delta) => {
        safePortPost(port, {
          type: "delta",
          requestId,
          delta
        });
      },
      onReasoning: (delta) => {
        safePortPost(port, {
          type: "reasoning_delta",
          requestId,
          delta
        });
      }
    })
      .then(async (result) => {
        if (controller.signal.aborted) {
          safePortPost(port, {
            type: "cancelled",
            requestId
          });
          return;
        }

        safePortPost(port, {
          type: "done",
          requestId,
          ...result
        });

        await appendLog({
          level: "info",
          scope: "ai",
          trigger: "manual",
          message: `AI stream completed (${result.provider})`,
          details: {
            provider: result.provider,
            model: result.model,
            role: result.role
          }
        });
      })
      .catch(async (error) => {
        const cancelled = controller.signal.aborted;
        safePortPost(port, {
          type: cancelled ? "cancelled" : "error",
          requestId,
          error: cancelled ? "Request cancelled" : error.message
        });

        if (!cancelled) {
          await appendLog({
            level: "error",
            scope: "ai",
            trigger: "manual",
            message: "AI stream failed",
            details: {
              requestId,
              error: error.message
            }
          });
        }
      })
      .finally(() => {
        if (active?.requestId === requestId) {
          active = null;
        }
      });
  });

  port.onDisconnect.addListener(() => {
    if (active?.controller) {
      active.controller.abort();
    }
    active = null;
  });
}

function safePortPost(port, payload) {
  try {
    port.postMessage(payload);
  } catch (_error) {
    // Ignore disconnected port.
  }
}

async function processAiChatStream(payload, handlers) {
  const settings = await getSystemSettings();
  const roles = normalizeAiRoles(settings.ai.roles);
  const provider = sanitizeProvider(payload.provider || settings.ai.defaultProvider);
  const role = sanitizeAiRole(payload.role || settings.ai.defaultRole, roles);
  const showReasoning = sanitizeBoolean(payload.showReasoning, settings.ai.showReasoning);
  const model = sanitizeModel(payload.model, settings.ai.models[provider]);
  const apiKey = sanitizeApiKey(payload.apiKey || settings.ai.keys[provider]);
  const temperature = clampNumber(payload.temperature, 0, 2, settings.ai.temperature);
  const maxHistory = clampNumber(payload.maxHistory, 2, 40, settings.ai.maxHistory);
  const baseSystemPrompt = sanitizeSystemPrompt(payload.systemPrompt || settings.ai.systemPrompt);
  const systemPrompt = composeRoleSystemPrompt(baseSystemPrompt, getAiRolePrompt(role, roles));
  const messages = normalizeChatMessages(payload.messages).slice(-maxHistory * 2);
  const attachments = normalizeChatAttachments(payload.attachments);
  const signal = handlers?.signal;

  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }
  if (messages.length === 0) {
    throw new Error("No chat messages to send.");
  }

  handlers?.onStarted?.({
    provider,
    model,
    role,
    showReasoning
  });

  let reply = "";
  let reasoning = "";
  const onDelta = (delta) => {
    const text = String(delta || "");
    if (!text) {
      return;
    }
    reply += text;
    handlers?.onDelta?.(text);
  };
  const onReasoning = (delta) => {
    if (!showReasoning) {
      return;
    }
    const text = String(delta || "");
    if (!text) {
      return;
    }
    reasoning += text;
    handlers?.onReasoning?.(text);
  };

  if (provider === "deepseek") {
    await callDeepSeekChatStream({
      apiKey,
      model,
      messages: applyAttachmentsToTextMessages(messages, attachments),
      systemPrompt,
      temperature,
      onDelta,
      onReasoning,
      signal
    });
  } else if (provider === "gemini") {
    await callGeminiChatStream({
      apiKey,
      model,
      messages,
      attachments,
      systemPrompt,
      temperature,
      onDelta,
      onReasoning,
      signal
    });
  } else if (provider === "qwen") {
    await callQwenChatStream({
      apiKey,
      model,
      messages: applyAttachmentsToTextMessages(messages, attachments),
      systemPrompt,
      temperature,
      onDelta,
      onReasoning,
      signal
    });
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const finalReply = String(reply || "").trim();
  if (!finalReply) {
    throw new Error(`${provider} stream returned empty reply.`);
  }

  return {
    provider,
    model,
    role,
    reasoning: showReasoning ? String(reasoning || "").trim() : "",
    reply: finalReply
  };
}

function normalizeChatMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  const normalized = [];
  for (const item of messages) {
    if (!item) {
      continue;
    }
    const role = String(item.role || "").trim().toLowerCase();
    const content = String(item.content || "").trim();
    if (!content) {
      continue;
    }
    if (role !== "user" && role !== "assistant" && role !== "system") {
      continue;
    }
    normalized.push({ role, content });
  }
  return normalized;
}

function normalizeChatAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  const normalized = [];
  for (const item of attachments.slice(0, 5)) {
    if (!item) {
      continue;
    }

    const name = String(item.name || "").trim().slice(0, 120);
    const mimeType = String(item.mimeType || "application/octet-stream").trim().slice(0, 80);
    const size = Number(item.size || 0);
    const kind = String(item.kind || "").trim().toLowerCase();

    if (!name) {
      continue;
    }

    if (kind === "text") {
      const text = String(item.text || "");
      normalized.push({
        name,
        mimeType,
        size,
        kind: "text",
        text
      });
      continue;
    }

    if (kind === "image") {
      const dataBase64 = String(item.dataBase64 || "");
      if (!dataBase64) {
        continue;
      }
      normalized.push({
        name,
        mimeType: mimeType.startsWith("image/") ? mimeType : "image/png",
        size,
        kind: "image",
        dataBase64
      });
      continue;
    }

    if (kind === "binary") {
      const dataBase64 = String(item.dataBase64 || "");
      if (!dataBase64) {
        continue;
      }
      normalized.push({
        name,
        mimeType,
        size,
        kind: "binary",
        dataBase64
      });
    }
  }

  return normalized;
}

function applyAttachmentsToTextMessages(messages, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return messages;
  }

  const cloned = messages.map((m) => ({ ...m }));
  let idx = -1;
  for (let i = cloned.length - 1; i >= 0; i -= 1) {
    if (cloned[i].role === "user") {
      idx = i;
      break;
    }
  }

  if (idx < 0) {
    cloned.push({ role: "user", content: "" });
    idx = cloned.length - 1;
  }

  const appendix = buildAttachmentTextAppendix(attachments);
  const base = String(cloned[idx].content || "").trim();
  cloned[idx].content = base ? `${base}\n\n${appendix}` : appendix;
  return cloned;
}

function buildAttachmentTextAppendix(attachments) {
  const blocks = [];
  for (const item of attachments) {
    if (item.kind === "text") {
      blocks.push(`Attachment: ${item.name} (${item.mimeType}, ${item.size} bytes)\n${String(item.text || "")}`);
      continue;
    }
    blocks.push(`Attachment: ${item.name} (${item.mimeType}, ${item.size} bytes)`);
  }
  return blocks.join("\n\n");
}

async function callDeepSeekChat({ apiKey, model, messages, systemPrompt, temperature }) {
  const bodyMessages = [];
  if (systemPrompt) {
    bodyMessages.push({ role: "system", content: systemPrompt });
  }
  bodyMessages.push(...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })));

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: bodyMessages,
      temperature
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`DeepSeek API error ${response.status}: ${truncateText(text)}`);
  }

  const data = safeJsonParse(text);
  const reply = extractOpenAiStyleReply(data);
  if (!reply) {
    throw new Error("DeepSeek API returned empty reply.");
  }
  return {
    reply,
    reasoning: extractOpenAiStyleReasoningReply(data)
  };
}

async function callQwenChat({ apiKey, model, messages, systemPrompt, temperature }) {
  const bodyMessages = [];
  if (systemPrompt) {
    bodyMessages.push({ role: "system", content: systemPrompt });
  }
  bodyMessages.push(...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })));

  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: bodyMessages,
      temperature
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Qwen API error ${response.status}: ${truncateText(text)}`);
  }

  const data = safeJsonParse(text);
  const reply = extractOpenAiStyleReply(data);
  if (!reply) {
    throw new Error("Qwen API returned empty reply.");
  }
  return {
    reply,
    reasoning: extractOpenAiStyleReasoningReply(data)
  };
}

function buildGeminiContents(messages, attachments = []) {
  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return contents;
  }

  let userIdx = -1;
  for (let i = contents.length - 1; i >= 0; i -= 1) {
    if (contents[i].role === "user") {
      userIdx = i;
      break;
    }
  }

  if (userIdx < 0) {
    contents.push({ role: "user", parts: [] });
    userIdx = contents.length - 1;
  }

  const target = contents[userIdx];
  for (const item of attachments) {
    if (item.kind === "text") {
      target.parts.push({
        text: `Attachment: ${item.name}\n${String(item.text || "")}`
      });
      continue;
    }

    if ((item.kind === "image" || item.kind === "binary") && item.dataBase64) {
      if (!isGeminiInlineMimeSupported(item.mimeType)) {
        target.parts.push({
          text: `Attachment: ${item.name} (${item.mimeType}, ${item.size} bytes)`
        });
        continue;
      }
      target.parts.push({
        inlineData: {
          mimeType: item.mimeType,
          data: item.dataBase64
        }
      });
      continue;
    }

    target.parts.push({
      text: `Attachment: ${item.name} (${item.mimeType}, ${item.size} bytes)`
    });
  }

  return contents;
}

function isGeminiInlineMimeSupported(mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  if (!mime) {
    return false;
  }
  if (mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/")) {
    return true;
  }
  if (mime === "application/pdf") {
    return true;
  }
  return false;
}

function isGeminiFileSearchMimeSupported(mimeType) {
  const mime = String(mimeType || "").trim().toLowerCase();
  if (!mime) {
    return false;
  }
  const supported = new Set([
    "text/plain",
    "text/csv",
    "application/json",
    "application/xml",
    "application/pdf",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/x-javascript",
    "application/x-python",
    "text/javascript",
    "text/html",
    "text/css",
    "text/md",
    "text/rtf"
  ]);
  return supported.has(mime);
}

function splitGeminiAttachmentsForDelivery(attachments) {
  const promptAttachments = [];
  const fileSearchAttachments = [];

  for (const item of Array.isArray(attachments) ? attachments : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const kind = String(item.kind || "").toLowerCase();
    if (kind === "text") {
      promptAttachments.push(item);
      continue;
    }

    if ((kind === "image" || kind === "binary") && item.dataBase64) {
      if (isGeminiInlineMimeSupported(item.mimeType)) {
        promptAttachments.push(item);
        continue;
      }

      if (kind === "binary" && isGeminiFileSearchMimeSupported(item.mimeType)) {
        fileSearchAttachments.push(item);
        continue;
      }
    }

    promptAttachments.push(item);
  }

  return { promptAttachments, fileSearchAttachments };
}

function decodeBase64ToBytes(base64) {
  const text = String(base64 || "");
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createGeminiFileSearchStore(apiKey, signal) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      displayName: `amazon-ext-${Date.now()}`
    }),
    signal
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini File Search store create failed ${response.status}: ${truncateText(text)}`);
  }

  const data = safeJsonParse(text);
  const name = String(data?.name || "").trim();
  if (!name) {
    throw new Error("Gemini File Search store create failed: missing store name.");
  }
  return name;
}

async function deleteGeminiFileSearchStore(apiKey, storeName) {
  if (!storeName) {
    return;
  }
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/${storeName}` +
    `?force=true&key=${encodeURIComponent(apiKey)}`;
  try {
    await fetch(endpoint, {
      method: "DELETE"
    });
  } catch (_error) {
    // Ignore cleanup errors.
  }
}

async function uploadGeminiFile(apiKey, attachment, signal) {
  const mimeType = String(attachment?.mimeType || "application/octet-stream").trim();
  const displayName = String(attachment?.name || "attachment").slice(0, 120);
  const bytes = decodeBase64ToBytes(attachment?.dataBase64 || "");

  if (bytes.byteLength === 0) {
    throw new Error(`Attachment is empty: ${displayName}`);
  }

  const startEndpoint = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`;
  const startResponse = await fetch(startEndpoint, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      file: {
        display_name: displayName
      }
    }),
    signal
  });

  const startText = await startResponse.text();
  if (!startResponse.ok) {
    throw new Error(`Gemini file upload init failed ${startResponse.status}: ${truncateText(startText)}`);
  }

  const uploadUrl =
    startResponse.headers.get("x-goog-upload-url") ||
    startResponse.headers.get("X-Goog-Upload-URL") ||
    "";
  if (!uploadUrl) {
    throw new Error("Gemini file upload init failed: missing resumable upload URL.");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": mimeType
    },
    body: bytes,
    signal
  });

  const uploadText = await uploadResponse.text();
  if (!uploadResponse.ok) {
    throw new Error(`Gemini file upload failed ${uploadResponse.status}: ${truncateText(uploadText)}`);
  }

  const uploadData = safeJsonParse(uploadText);
  const fileName = String(uploadData?.file?.name || "").trim();
  if (!fileName) {
    throw new Error(`Gemini file upload failed: missing file name (${displayName})`);
  }
  return fileName;
}

async function importGeminiFileToSearchStore(apiKey, storeName, fileName, signal) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/${storeName}:importFile` +
    `?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fileName }),
    signal
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini file import failed ${response.status}: ${truncateText(text)}`);
  }

  const operation = safeJsonParse(text);
  const operationName = String(operation?.name || "").trim();
  if (!operationName) {
    throw new Error("Gemini file import failed: missing operation name.");
  }
  await waitGeminiOperation(apiKey, operationName, signal);
}

async function waitGeminiOperation(apiKey, operationName, signal) {
  const maxWaitMs = 180000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    if (signal?.aborted) {
      throw new Error("Request cancelled");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, { signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini operation query failed ${response.status}: ${truncateText(text)}`);
    }

    const operation = safeJsonParse(text);
    if (operation?.done) {
      if (operation?.error) {
        const message = operation.error.message || JSON.stringify(operation.error);
        throw new Error(`Gemini operation failed: ${message}`);
      }
      return;
    }
    await wait(1200);
  }

  throw new Error("Gemini operation timeout.");
}

async function prepareGeminiFileSearchStore(apiKey, attachments, signal) {
  const storeName = await createGeminiFileSearchStore(apiKey, signal);
  for (const attachment of attachments) {
    const fileName = await uploadGeminiFile(apiKey, attachment, signal);
    await importGeminiFileToSearchStore(apiKey, storeName, fileName, signal);
  }
  return storeName;
}

function buildGeminiFileSearchBody({ messages, promptAttachments, systemPrompt, temperature, storeName }) {
  const contents = buildGeminiContents(messages, promptAttachments);
  if (contents.length === 0) {
    throw new Error("Gemini chat requires at least one user/assistant message.");
  }

  const body = {
    contents,
    tools: [
      {
        fileSearch: {
          fileSearchStoreNames: [storeName]
        }
      }
    ],
    generationConfig: {
      temperature
    }
  };
  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }
  return body;
}

async function callGeminiChat({ apiKey, model, messages, attachments, systemPrompt, temperature }) {
  const { promptAttachments, fileSearchAttachments } = splitGeminiAttachmentsForDelivery(attachments);

  let storeName = "";
  try {
    if (fileSearchAttachments.length > 0) {
      storeName = await prepareGeminiFileSearchStore(apiKey, fileSearchAttachments);
      const body = buildGeminiFileSearchBody({
        messages,
        promptAttachments,
        systemPrompt,
        temperature,
        storeName
      });
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
        `:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify(body)
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}: ${truncateText(text)}`);
      }

      const data = safeJsonParse(text);
      const reply = extractGeminiReply(data);
      if (!reply) {
        throw new Error("Gemini API returned empty reply.");
      }
      return {
        reply,
        reasoning: extractGeminiReasoning(data)
      };
    }

    const contents = buildGeminiContents(messages, promptAttachments);
    if (contents.length === 0) {
      throw new Error("Gemini chat requires at least one user/assistant message.");
    }

    const body = {
      contents,
      generationConfig: {
        temperature
      }
    };
    if (systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
      `:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}: ${truncateText(text)}`);
    }

    const data = safeJsonParse(text);
    const reply = extractGeminiReply(data);
    if (!reply) {
      throw new Error("Gemini API returned empty reply.");
    }
    return {
      reply,
      reasoning: extractGeminiReasoning(data)
    };
  } finally {
    if (storeName) {
      await deleteGeminiFileSearchStore(apiKey, storeName);
    }
  }
}

async function callDeepSeekChatStream({ apiKey, model, messages, systemPrompt, temperature, onDelta, onReasoning, signal }) {
  const bodyMessages = [];
  if (systemPrompt) {
    bodyMessages.push({ role: "system", content: systemPrompt });
  }
  bodyMessages.push(...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })));

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: bodyMessages,
      temperature,
      stream: true
    }),
    signal
  });

  await parseSseJsonStream(response, {
    providerName: "DeepSeek",
    onEvent: (data) => {
      const reasoning = extractOpenAiStyleReasoningDelta(data);
      if (reasoning) {
        onReasoning?.(reasoning);
      }
      const delta = extractOpenAiStyleDelta(data);
      if (delta) {
        onDelta(delta);
      }
    }
  });
}

async function callQwenChatStream({ apiKey, model, messages, systemPrompt, temperature, onDelta, onReasoning, signal }) {
  const bodyMessages = [];
  if (systemPrompt) {
    bodyMessages.push({ role: "system", content: systemPrompt });
  }
  bodyMessages.push(...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })));

  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: bodyMessages,
      temperature,
      stream: true
    }),
    signal
  });

  await parseSseJsonStream(response, {
    providerName: "Qwen",
    onEvent: (data) => {
      const reasoning = extractOpenAiStyleReasoningDelta(data);
      if (reasoning) {
        onReasoning?.(reasoning);
      }
      const delta = extractOpenAiStyleDelta(data);
      if (delta) {
        onDelta(delta);
      }
    }
  });
}

async function callGeminiChatStream({
  apiKey,
  model,
  messages,
  attachments,
  systemPrompt,
  temperature,
  onDelta,
  onReasoning,
  signal
}) {
  const { promptAttachments, fileSearchAttachments } = splitGeminiAttachmentsForDelivery(attachments);

  let storeName = "";
  try {
    let body;
    if (fileSearchAttachments.length > 0) {
      storeName = await prepareGeminiFileSearchStore(apiKey, fileSearchAttachments, signal);
      body = buildGeminiFileSearchBody({
        messages,
        promptAttachments,
        systemPrompt,
        temperature,
        storeName
      });
    } else {
      const contents = buildGeminiContents(messages, promptAttachments);
      if (contents.length === 0) {
        throw new Error("Gemini chat requires at least one user/assistant message.");
      }
      body = {
        contents,
        generationConfig: {
          temperature
        }
      };
      if (systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }
    }

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
      `:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal
    });

    let geminiAccumulated = "";
    let geminiReasoningAccumulated = "";
    await parseSseJsonStream(response, {
      providerName: "Gemini",
      onEvent: (data) => {
        const nextReasoning = extractGeminiReasoning(data);
        if (nextReasoning) {
          let reasoningDelta = nextReasoning;
          if (nextReasoning.startsWith(geminiReasoningAccumulated)) {
            reasoningDelta = nextReasoning.slice(geminiReasoningAccumulated.length);
            geminiReasoningAccumulated = nextReasoning;
          } else {
            geminiReasoningAccumulated += nextReasoning;
          }
          if (reasoningDelta) {
            onReasoning?.(reasoningDelta);
          }
        }

        const next = extractGeminiReply(data);
        if (!next) {
          return;
        }

        let delta = next;
        if (next.startsWith(geminiAccumulated)) {
          delta = next.slice(geminiAccumulated.length);
          geminiAccumulated = next;
        } else {
          geminiAccumulated += next;
        }

        if (delta) {
          onDelta(delta);
        }
      }
    });
  } finally {
    if (storeName) {
      await deleteGeminiFileSearchStore(apiKey, storeName);
    }
  }
}

async function parseSseJsonStream(response, handlers) {
  const providerName = handlers?.providerName || "SSE";
  const onEvent = handlers?.onEvent || (() => {});

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${providerName} API error ${response.status}: ${truncateText(text)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`${providerName} stream body is unavailable.`);
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const processBuffer = () => {
    while (true) {
      const boundary = findSseBoundary(buffer);
      if (boundary < 0) {
        return;
      }

      const rawEvent = buffer.slice(0, boundary);
      const advance = buffer.startsWith("\r\n\r\n", boundary) ? 4 : 2;
      buffer = buffer.slice(boundary + advance);

      const dataText = collectSseData(rawEvent);
      if (!dataText) {
        continue;
      }
      if (dataText === "[DONE]") {
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(dataText);
      } catch (_error) {
        continue;
      }

      onEvent(parsed);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    processBuffer();
  }

  buffer += decoder.decode();
  processBuffer();

  const tail = collectSseData(buffer);
  if (tail && tail !== "[DONE]") {
    try {
      onEvent(JSON.parse(tail));
    } catch (_error) {
      // Ignore incomplete tail chunk.
    }
  }
}

function findSseBoundary(buffer) {
  const idxLf = buffer.indexOf("\n\n");
  const idxCrLf = buffer.indexOf("\r\n\r\n");
  if (idxLf < 0) {
    return idxCrLf;
  }
  if (idxCrLf < 0) {
    return idxLf;
  }
  return Math.min(idxLf, idxCrLf);
}

function collectSseData(rawEvent) {
  const lines = String(rawEvent || "").split(/\r?\n/);
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return dataLines.join("\n").trim();
}

function extractOpenAiStyleDelta(data) {
  const delta = data?.choices?.[0]?.delta;
  if (!delta) {
    return "";
  }

  if (typeof delta.content === "string") {
    return delta.content;
  }
  if (Array.isArray(delta.content)) {
    return delta.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part?.text) {
          return String(part.text);
        }
        return "";
      })
      .join("");
  }

  return "";
}

function extractOpenAiStyleReasoningDelta(data) {
  const delta = data?.choices?.[0]?.delta;
  if (!delta) {
    return "";
  }
  return extractReasoningValue(delta.reasoning_content ?? delta.reasoning);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error(`Invalid JSON response: ${truncateText(text)}`);
  }
}

function safeJsonParseLoose(text) {
  const str = String(text || "").trim();
  if (!str) {
    return {};
  }
  try {
    return JSON.parse(str);
  } catch (_error) {
    return { message: truncateText(str) };
  }
}

function extractOpenAiStyleReply(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) {
    return "";
  }
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part?.text) {
          return String(part.text);
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function extractOpenAiStyleReasoningReply(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) {
    return "";
  }
  return extractReasoningValue(message.reasoning_content ?? message.reasoning);
}

function isGeminiThoughtPart(part) {
  if (!part || typeof part !== "object") {
    return false;
  }
  if (part.thought === true || part.isThought === true) {
    return true;
  }
  const type = String(part.type || part.partType || "").toLowerCase();
  return type === "thought" || type === "reasoning";
}

function extractGeminiReply(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .map((part) => {
      if (isGeminiThoughtPart(part)) {
        return "";
      }
      return String(part?.text || "");
    })
    .join("")
    .trim();
}

function extractGeminiReasoning(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .map((part) => {
      if (!isGeminiThoughtPart(part)) {
        return "";
      }
      if (typeof part?.text === "string") {
        return part.text;
      }
      return extractReasoningValue(part?.reasoning ?? part?.thoughtText);
    })
    .join("")
    .trim();
}

function extractReasoningValue(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (typeof item?.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("");
  }
  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }
    if (typeof value.content === "string") {
      return value.content;
    }
  }
  return "";
}

function truncateText(text) {
  const str = String(text || "").replace(/\s+/g, " ").trim();
  if (str.length <= 240) {
    return str;
  }
  return `${str.slice(0, 240)}...`;
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

