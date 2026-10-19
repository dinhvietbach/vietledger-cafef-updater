# DATA NGÀNH – Thép

Monthly workspace with charts, tables, point-level sources, coverage and CSV.
Sources are checked with the existing six daily Vietnam schedule windows.
The browser reads the published snapshot; it does not scrape third parties.

## User workbook import (19 October 2026)

`DATA UPDATE THEP.xlsx` adds 24,708 observations: 11,069 monthly, 13,589 quarterly and 50 annual. Workbook data stays in distinct series with file/sheet/cell provenance and the original cached value/formula. The public CSV contains only the imported industry data, not the full private workbook or financial model.

- Coated steel monthly production, regional sales, exports, inventory and calculated total sales: January 2016–June 2025. Company and coating subtypes are retained.
- Construction and hot/cold-rolled quarterly operating data: Q1/2016–Q2/2025, with company/product detail. HRC and CRC never share an HRC-only label.
- HPG quarterly data in Update KQKD through Q3/2025 stays separately identified; annual actual operating rows from REV use A columns only.
- Four price series in Sheet8: January 2017–April 2025, USD/tonne. No unsupported monthly-average or incoterm assumption is added.
- Construction market shares are converted from fractions to percent.

The monthly coated headers were stored as dates in 2025 with the intended two-digit year in the day field. All 114 mappings are established by the quarterly SUM references, not guessed from dates. 4,943 formula results and 3,155 monthly-to-quarter sums were checked independently.

Quarterly inventory totals in the workbook sum three monthly stocks. These are retained as `inventory_sum`, explicitly not quarter-end inventory; `inventory` uses the final monthly stock. Four distinct negative inventory cells are recorded as issues and excluded from charts. Four March/April 2023 differences against existing VSA/KIS observations remain visible in the source comparison, with both series preserved.

The file import is a snapshot, not a file watcher. Existing Internet sources keep their schedule. Imports survive cloud restoration; newer workbook timestamps take precedence over older snapshots. Forecast/model assumptions, unlabelled Last Price data, ambiguous prices and financial statement tabs are not relabelled as actual industry data.

## Coverage at initial publication (19 October 2026)

- World Bank iron ore: 141 monthly averages, January 2015–September 2026.
- UN Comtrade: Vietnam / world monthly trade, queried January 2015–September 2026. The public API returned observations through December 2023. Absent/zero-with-positive-value weights are gaps. Estimated net weights retain the source flag.
- VSA: explicit dated HRC/coking-coal quotes and monthly prices, plus total finished-steel production and sales where published as text. A dated quote is not a monthly average; coking coal is not coke.
- KIS reports hosted by CafeF: VSA monthly production, sales and member exports for construction steel, coated steel and pipes. Initial validated coverage: 19 months from July 2021 to August 2023, with gaps. Mixed comma/dot thousands separators are normalized. Inconsistent period headings are excluded.
- HRC and billet production/sales, and market-price histories for construction steel, coated steel, pipes, billet and coke, remain unfilled. Customs unit values are presented separately and must not be represented as market prices.

This is not a complete 2015–present dataset for every requested product. Coverage is visible for each series. Missing observations are never replaced by zero or interpolated. Unlabelled source images are linked for reading rather than converted into guessed values.

## Customs scope

HRC proxy HS 7208 also includes hot-rolled plate; construction 7213+7214 requires both headings; coated 7210 includes several coatings; pipe 7306 excludes seamless and large-diameter headings; billet proxy 7207 also includes bloom/slab. Coke 270400 is separate from raw coking coal. The scope is shown on every chart and source detail. Trade unit value is primaryValue USD / netWgt tonnes, not a quoted price.

## Updating

`steel-sources.mjs` refreshes the World Bank workbook, recent VSA posts, new matching KIS PDFs from the CafeF analysis catalogue, six recent Comtrade months, missing historical checks and a rotating historical month. Only explicitly supported PDF tables are imported; other documents remain linked. Source errors preserve prior observations and report the last successful check. Revised/newer source publications take precedence over older articles.

`steel-pdf.py` uses pinned pypdf 6.10.0. PDFs remain on the original host and are downloaded only to private temporary collection storage; the public site contains factual observations, metadata and source links.

`steel-seed.json` bootstraps the public source package. Each cloud run restores the last public steel asset before merging source updates. The static build verifies asset hashes and observation validity. Existing financial statements are exported through the unchanged snapshot pipeline.
