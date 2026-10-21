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
# Historical expansion (20 October 2026)

The public archive contains 28,110 observations, including 24,708 workbook points and 573 additional reviewed observations. Original spreadsheet models are not published; only the existing approved steel extract is included.

- Australia REQ historical workbook: 524 points from January 2015, monthly USD/t FOB market benchmarks and AUD/t aggregate export unit values kept separate. The iron ore netback changes from 62% Fe through December 2025 to 61% Fe from January 2026; these are separate series. Premium hard coking coal observations stop at November 2023 because subsequent source cells are `na`. REQ discovery is checked daily within the existing schedule; failure preserves the archive.
- SteelOnline: 12 month/grade/region observations captured from a public 30-day chart, refreshed at the existing six times daily. These are the latest observed quote within a month, not monthly means. A 12 June 2021 article describes factory prices excluding VAT; the current quote table does not reconfirm those terms and is an intermediary quote, not an HPG disclosure.
- BigMint: three explicitly dated December 2025 HRC CNF Vietnam quotes, visually verified on page 18 of the public 2 January 2026 daily report. Public free historical access is incomplete; no paid content is bypassed.
- BVSC: 20 actual HPG monthly sales values on page 1 of 7 April 2022 report.
- VSA: 14 values from the September 2015 table image. Construction production is withheld because the table and narrative disagree. No YTD figure is divided into months.

The combined display maps only reviewed monthly coated-steel industry totals from Excel and VSA/KIS. It retains source alternatives and flags four unequal observations. Other prices, frequencies, entities, product grades and customs scopes remain distinct. The year coverage matrix explicitly identifies missing periods from 2015.

The fixture `fixtures/req-australia-extract.xlsx` contains a small public-source extract of REQ tables 21 and 22, headers and source footnotes. It tests blank XML cells, missing observations, units and the Fe transition. It contains no user workbook data.



## Bổ sung và đối soát 21/10/2026

- Bảng đã đọc trực tiếp lưu trong steel-reviewed.json: tài liệu, SHA-256, số trang, kỳ, đơn vị, phạm vi và số gốc. VietnamBiz, KIS và VCBS cùng trích VSA không được coi là ba nguồn thống kê độc lập.
- Phân biệt tháng, quý, năm và lũy kế (ytd). Không chia số quý/năm thành tháng; không đo chiều cao cột biểu đồ để tạo số chính xác.
- Giữ tổng in trong nguồn, đồng thời ghi cảnh báo nếu khác tổng các dòng. Bảng giá lặp tiêu đề năm hoặc thiếu điều kiện giao hàng được cảnh báo/giữ riêng.
- Giữ phiên bản công bố trước khi một số được điều chỉnh. Chế độ tổng hợp cho phép mở các số đối chiếu; không lấy trung bình nguồn.
- Chỉ báo nội địa, xuất khẩu/bán hàng, tồn kho/bán hàng, bán hàng/sản xuất chỉ ghép cùng tài liệu, kỳ và phạm vi. Bán hàng/sản xuất không phải công suất sử dụng. Kim ngạch lấy từ payload hải quan, tách khỏi báo giá.
- Bảng tiến độ đếm tháng thực có cho từng sản phẩm từ 2024. Độ phủ từng năm vẫn bắt đầu 2015; dữ liệu còn thiếu không được tự lấp.
- Cập nhật tự động mở rộng bài VSA có tên “ngành thép / N tháng đầu năm”, giữ kỳ lũy kế; bổ sung bảng nội địa/tồn kho KIS và thư viện báo cáo VietnamBiz mới. Bảng ảnh cần rà soát trước khi đưa vào số liệu; không đánh đồng kiểm tra thành công với có dữ liệu mới.

## Đợt bổ sung tháng và file DATA NGÀNH THÉP

- Nhập 373 điểm năm 2016–2024 từ DATA NGÀNH THÉP.xlsx, nguồn `workbook-industry`, giữ độc lập với 24.708 điểm từ DATA UPDATE THEP. Chỉ nhập lịch sử; loại 2025F–2029F, giá thiếu đơn vị và hiệu suất chưa rõ mẫu số. Dấu gạch/ô trống không đổi thành số 0.
- Sheet1: “tổng” chỉ là tổng tôn mạ và ống thép. Sheet2 xác định là NKG bằng 9 cặp số tiêu thụ khớp Sheet1. Giữ tọa độ ô, SHA-256, đơn vị và các phép kiểm tra. Có 184 kiểm tra nội bộ khớp; 73/76 tổng năm khớp tổng đủ 12 tháng của file cũ.
- BCTN NKG 2024 (PDF trang 42) ghi bán hàng tôn mạ 892.252 tấn và tổng tôn + ống 1.022.794 tấn; file lần lượt ghi 882.252 và 1.012.794. Năm 2023 file tổng ghi 860.294 so với BCTN 861.228. Giữ cả hai nguồn, đánh dấu chênh lệch, không ghi đè file gốc.
- Bổ sung bảng VietnamBiz/VSA tháng 2024–2026 và cột cùng kỳ 2022–2023. Sản xuất, bán hàng, xuất khẩu VSA của thép xây dựng/HRC/tôn mạ/ống thép đủ 12 tháng 2024. Năm 2025 còn tháng 4 ở một số chuỗi; 2026 còn tháng 7–9 và bán hàng tháng 1. Các khoảng trống được hiển thị, không nội suy.
- Giá HRC 2 mm CFR Việt Nam giữ khác chuỗi SAE1006 CFR Đông Nam Á; thép phế CFR Việt Nam khác CFR Đông Á. Chỉ nhập cột bình quân có nhãn kỳ rõ; bỏ bảng lặp nhãn năm mâu thuẫn và cột “giá hiện tại” không xác định ngày.
- `steel-reviewed.json` giữ toàn bộ bảng đã đọc, số trang và dấu vết nguồn. Lịch đám mây khôi phục dữ liệu cũ rồi hợp nhất với seed này; các bảng chưa đọc vẫn ở thư viện nguồn và không được coi là tháng đã có số.

## Rà soát tiếp ngày 21/10/2026

- Kho đã tăng từ 30.123 lên 30.291 điểm. Thêm số bán hàng tháng 1/2026 sau khi đối chiếu biểu đồ 6 VietnamBiz với mục Tiêu thụ trang 11 và nhãn số VSA quý I/2026; tiêu đề “Sản xuất” ở trang 12 là không nhất quán với nội dung. Tổng 5 nhóm khớp 2.936.813 tấn.
- HRC tháng 4/2025 chỉ có nguồn ghi “hơn 765.000 tấn”. Lưu dưới dạng ngưỡng `approximate`, không tính là đã lấp tháng có số cụ thể và không tính tỷ lệ tăng trưởng từ ngưỡng này. Tháng đang diễn ra không tính vào tiến độ các tháng đã khép lại.
- Bổ sung công bố HPG quý III/9 tháng 2026 và NKG năm 2025 đúng kỳ công bố. Thêm nhãn bán hàng thép xây dựng 2016, bảng tháng 4/2015–2016, bảng lũy kế 2015–2017 và các tổng tháng lịch sử VSA có số rõ trong văn bản. HRC PO trong bảng cũ không gộp vào HRC.
- Tôn mạ HSG/GDA/HPG 2024 trong DATA NGÀNH THÉP bằng đúng tổng tháng 1–11, thiếu lần lượt 123.557 / 61.837 / 21.764 tấn của tháng 12 so với DATA UPDATE THEP. Đây là đối chiếu phạm vi kỳ, chưa xác nhận thao tác nhập file. BCTN GDA phù hợp ở độ làm tròn 865 nghìn tấn; BCTN HPG trang 29 xác nhận đúng 446.411 tấn. HSG chưa có xác nhận độc lập theo năm dương lịch, không dùng số niên độ tháng 9 thay thế.
- BCTN HPG trang 29 ghi 708.191 tấn ống thép; Excel ghi 706.938, nguyên nhân còn mở. Tổng tôn + ống tính lại từ hai số BCTN là 1.154.602 tấn.
- BCTN NKG 2025 trang 46 xác nhận lại tổng 2024 là 1.022.794 tấn và thực hiện 2025 là 781.506 tấn. Chênh lệch 10.000 tấn so với Excel 2024 chưa có giải trình; tổng tháng Excel cũng bằng số năm Excel nên không kết luận lỗi nhập riêng ô năm.
- Chế độ Tổng hợp nguồn dùng `reconciledSteelSeries` để chọn các số năm doanh nghiệp đã rà soát, lưu số thay thế và chứng cứ. Chế độ Excel giữ số gốc. Các tổng và thị phần phụ thuộc được cảnh báo, chưa tự đổi mẫu số/phạm vi. Hồ sơ `reconciliations` và `completionAudit` được bảo toàn khi phục hồi kho công khai để chạy lịch.
# Four-workbook review — 21 October 2026

The new workbook extract contains 7,433 observations in 161 source-specific series. It does not represent 7,433 newly verified months. `steel-four.mjs` maps only reviewed tables; the public CSV retains file hashes, sheet/cell addresses, formulas, original-unit values, estimate flags and report links. Original files remain local. Shared historical construction/HRC/coated tables are not imported twice. Every cloud restoration retains `sources.workbook_four` and the seeded series.

New views include company operating volumes and domestic/export ASP, a market/partner filter, and a visible workbook review dossier. Customs “iron and steel” and “articles of iron and steel” are separate product categories from VSA finished steel. Customs amounts recorded in thousand USD are converted to USD, retaining the original cell value.

NKG Q2/2025, Q1/2026 and Q2/2026 were checked against Table 1, pages 2–3, of the October 2026 Rong Viet report linked in the workbook. The table explicitly describes coated steel; ASP is the broker’s estimate and Q1/2026 exports use customs data. Earlier mixed-scope rows remain in an unverified product category; their growth rates and derived indicators are suppressed. Q4/2021 was excluded because the cited December 2021 report only has actual monthly data through October and forecasts Q4. Q1/2020 ASP was excluded because it contradicts the workbook note against dividing by rounded volumes.

Other withheld fields include duplicate March 2024 customs dates, HSG production copied into historical HPG coated rows, model projections, empty-reference zeros, coking-coal cells referencing coke, and month values inferred from rounded aggregates. HPG HRC quotes are separate from the generic historical HRC price series. The 2015–present coverage display continues to show real gaps; workbook uploads are snapshots, while online sources retain their existing refresh schedule.

