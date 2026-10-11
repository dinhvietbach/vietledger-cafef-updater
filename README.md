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

The website data is public company data from CafeF; copying fidelity is not independent financial verification. Historical raw archives remain on the owner's local machine. Cloud runs retain source URLs and hashes in the public dataset; temporary raw files are discarded with the CI runner.
