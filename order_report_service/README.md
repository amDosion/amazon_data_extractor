# Order Report Headless Service

This service runs outside the extension and uses Puppeteer to open Seller Central,
trigger order report generation, and save the downloaded file to a local directory.

## 1. Install

```bash
cd C:\Users\12180\amazon_data_extractor\order_report_service
npm install
```

## 2. Start Modes

### Mode A: Service-managed browser profile

First login run (recommended with visible browser):

```bash
set BROWSER_MODE=launch
set HEADLESS=false
node server.js
```

After login/session is persisted, run headless:

```bash
set BROWSER_MODE=launch
set HEADLESS=true
node server.js
```

### Mode B: Reuse your current Chrome session (same login session)

1. Start Chrome with remote debugging enabled:

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

2. In that Chrome window, ensure Seller Central is already logged in.

3. Start service in connect mode:

```bash
set BROWSER_MODE=connect
set CHROME_DEBUG_URL=http://127.0.0.1:9222
node server.js
```

## 3. Service Endpoints

- `GET /health`
- `POST /api/orders/report`

Example request:

```json
{
  "options": {
    "reportNamePrefix": "orders-report",
    "pageTimeoutMs": 180000
  },
  "output": {
    "downloadDir": "amazon"
  }
}
```

## 4. Extension Settings

In extension `设置` page:

1. Set `运行模式` to `无头服务模式`.
2. Set `服务地址` to `http://127.0.0.1:8787`.
3. Click `测试服务连接`.
4. Save settings.

## Environment Variables

- `PORT` default `8787`
- `BROWSER_MODE` default `launch` (`launch` or `connect`)
- `HEADLESS` default `true`
- `PROFILE_DIR` default `./.chrome-profile`
- `CHROME_DEBUG_URL` default `http://127.0.0.1:9222` (used in `connect` mode)
- `CHROME_WS_ENDPOINT` optional exact websocket endpoint (used in `connect` mode)
- `OUTPUT_ROOT` default `./downloads`
- `MAX_TIMEOUT_MS` default `300000`
