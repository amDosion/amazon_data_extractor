# V2 Testing Notes

## Scope
Current implemented scope:
- Orders module
- Product extraction module
- Side-menu navigation
- Scheduler, logs, settings persistence

## Quick checks
1. Load extension successfully in Chrome.
2. Open side panel from extension icon.
3. In `订单报告`, run `立即下载订单报告`.
4. In `产品提取`, input ASIN and run export.
5. In `运行日志`, verify both module logs appear.
6. Enable scheduler and confirm periodic runs.

## Non-intrusive checks
1. Open non-SellerCentral sites and verify no extension behavior.
2. During scheduler runs, ensure current active tab focus is not stolen.
3. Verify no DOM widgets are injected automatically on Seller Central pages.

## Known limits
- allOrders DOM may change; selectors use text/table heuristics.
- Product export format is CSV (legacy was xlsx multi-sheet).
- If Seller Central tab was opened before extension reload, refresh tab once.

## Next tests after Ads/Payments modules
- Module isolation tests
- Retry/backoff behavior tests
- Permission minimization audit
