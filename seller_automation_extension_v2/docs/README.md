# Seller Automation Extension V2

## Purpose
This V2 extension is a migration-safe base for Seller Central automation.
It keeps the old plugin untouched and focuses on one stable flow first:
- Download order reports from `allOrders` page.

## Non-intrusive design
- Content script only matches one page path:
  - `https://sellercentral.amazon.com/order-reports-and-feeds/reports/allOrders*`
- No script runs on other websites.
- Scheduler-created tabs are opened in background (`active: false`).
- Temporary automation tab is closed after run (configurable).
- No DOM decoration or persistent overlays are injected into Seller Central.

## Current modules
- Orders: implemented (`orders.execute` workflow)
- Ads reports: planned (module slot reserved)
- Payments requests: planned (module slot reserved)

## Files
- `manifest.json`: MV3 extension setup and minimal permissions
- `background.js`: task bus, scheduler, safe tab handling, logs
- `content.js`: allOrders page workflow and download target resolution
- `sidepanel.html/css/js`: manual run, settings, scheduler, logs

## Run locally
1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Load unpacked extension from this folder
4. Log in to Seller Central US site
5. Open the extension side panel and click `立即下载订单报告`

## Known limitations
- Amazon DOM selectors may change; this version uses resilient text + table heuristics.
- Date preset is stored/configured, but exact date filter controls are not yet fully bound.
- If report download is button-only (without URL), workflow falls back to in-page click.

## Next phase
1. Bind exact order report filter controls by stable selectors
2. Add Ads report automation module using the same task contract
3. Add payment request module + schedule templates