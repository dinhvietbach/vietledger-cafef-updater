# VietLedger CafeF updater

Public website: https://vietledger.pages.dev/ . This repository contains the website code and the CafeF update workflow. The repository variable ENABLE_CAFEF_SCHEDULE controls whether scheduled updates run; enable it only after a successful manual deployment.

The workflow restores the previous public dataset, checks the CafeF catalogue and statements, validates a new static build, then deploys it to the existing Cloudflare Pages project vietledger. A failed run leaves the last published website intact. Financial source gaps and source warnings are preserved.

Required configuration after repository creation:

- Repository variable CLOUDFLARE_ACCOUNT_ID: the owner's Cloudflare account.
- Repository secret CLOUDFLARE_API_TOKEN: an approved token with Pages Edit permission for that account. Never commit credentials.
- Run workflow_dispatch once and verify the public deployment before enabling the schedule.
- Set ENABLE_CAFEF_SCHEDULE=true only after successful end-to-end verification. Until then scheduled jobs are skipped.

Vietnam target times: 00:00, 09:00, 12:00, 15:00, 18:00, 21:00 (UTC+7). GitHub cron may be delayed or skipped during load and public repository schedules may be disabled after inactivity. Use standard free GitHub-hosted runners in an approved public repository, not larger paid runners.

The newest-quarter earnings view compares income statements against the same quarter last year, the preceding quarter and cumulative Q1-to-current-quarter figures. Eight recent quarters are indexed. Exact source decimals are retained; missing quarters, nonpositive growth bases and differing scopes are disclosed. Per-company detail includes all income-statement rows and source links. Period labels follow CafeF and may refer to non-calendar fiscal years.

The earnings table defaults to CafeF industry groups, supports an industry filter and includes the industry in CSV exports. Classification comes from the CafeF company directory, refreshed with each scheduled catalogue check; unclassified companies remain explicitly unknown. An incomplete directory response preserves the last successful classification.

The growth watchlist requires both revenue and after-tax profit to grow strictly above 10% (or the selected higher threshold) versus the same fiscal quarter last year. It uses exact decimals, positive comparison bases and matching scopes. It saves numerical drivers, source-linked reviewed business explanations and caution notes per period. Reviewed explanations are suppressed if the corresponding source figures change. Filing links are discovered from CafeF disclosures, with curated official sources in growth-research.json. Unconfirmed publication dates never pass the recent-publication filter; import dates are not publication dates. Source gaps are explicit. This screen is a research filter and does not evaluate valuation or recommend trades.

The company financial chart view includes sixteen charts, selectable reporting frequency and year range, series visibility, per-period figures and source links, and CSV export. It preserves gaps, uses sector-aware income labels, and converts quarterly cash flow from cumulative statements only with compatible consecutive periods. Values are visible on chart points by default. The valuation group separates CafeF annual P/E and per-share data from daily observations of overview P/E and P/B. Daily observations start when collection begins; they are never backfilled into previous quarters or years. Source labels and timestamps are retained, and annual zero placeholders remain gaps.

The analysis-report library collects the entire paginated CafeF analysis catalogue with no date, company or publisher filter. Each six-times-daily cloud run restores the saved archive, checks every source page, validates counts, IDs and stable pagination, and publishes searchable metadata with original document and CafeF links. Missing source titles or documents are explicit. Source corrections replace the matching ID; older entries disappearing from the source remain marked as archived. Failed updates retain the last complete archive and expose the error and last successful check time. PDFs and other documents remain hosted by the original source. The browser supports ticker, text, publisher, category and date filters, pagination, chronological sorting and CSV export. Clicking the company analysis shortcut selects its ticker.

The website data is public company data from CafeF; copying fidelity is not independent financial verification. Historical raw archives remain on the owner's local machine. Cloud runs retain source URLs and hashes in the public dataset; temporary raw files are discarded with the CI runner.
