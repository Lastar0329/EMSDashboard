# EMSDashboard — 嘉義市／嘉義縣 EMS 品管儀表板（樣板，2026-10-15 起）

醫療指導醫師（使用者本人）用的品管看板：全局與單一分隊兩種檢視；手機（iPhone 加入主畫面的 PWA）與電腦版可切換。

## 架構

- `export_data.py`：唯讀連 PSQL `emr_data.ems_cyfd_record`（由 ERTrending 的 EMS 分頁寫入，見 `ERTrending\docs\ems.md`）→ `site/data/dashboard.json`。連線走 `Code\psql_conn.py`。
- `site/`：純靜態網頁，沒有建置步驟。`index.html`、`app.css`、`app.js`（頁面與圖表）、`indicators.js`（**指標定義與出處都在這裡**）、`vendor/`（ECharts 5.5.1、Leaflet 1.9.4 放本機，不靠 CDN；cdnjs 上 echarts 5.5.1 的路徑是 404）、`version.json`（版本檢查用）。
- 本機預覽：`.claude/launch.json` 的 `ems-dashboard`（`python -m http.server 8765 --directory site`）。

## 資料規則

- **JSON 只放彙總**：以（日期, 地區, 分隊）為一格，格內是旗標計數與匿名的時間數列（分鐘）；座標只到 0.01° 網格。不得放姓名、身分證、住址、病歷號、TEMSIS、單號、EMT 姓名、精確座標。之後要做病人層級功能時另開有登入的通道，別塞進這份 JSON。
- 新增指標＝在 `export_data.py::case_features` 加旗標（分子、分母各一個），再到 `indicators.js` 的 `RATE_IND`／`TIME_IND` 加一列；前端會自動出現在成績單、funnel、管制圖選單。
- 資料涵蓋（2026-10-15）：嘉義市 2026-09-01 起連續（4、7 月只有零星幾天），嘉義縣 2026-10-01 起 → 前端會自動跳涵蓋不足提示；跟前期比較時，前期有資料的天數不到本期 80% 就不比。

## 判讀設計（出處在 `indicators.js` 的 REFS）

- 時效一律中位＋P90（NHS AQI）；時間間隔當營運指標、不單獨當品質（Pap 2022）。
- 分隊比較用 funnel plot（Siriwardena 2010、Spiegelhalter 2005），分母不足 `minDen` 標「樣本少」不判好壞。
- 趨勢監測用 p-chart，判讀規則目前只做「單點出界」與「連 8 點同側」（Scottish Ambulance 報告有完整 5 條）。

## PWA 注意

- 設定存 localStorage，但網址 hash（`#p=&r=&rg=&v=`）也帶得回來，讀完不要清 hash。
- 版本：`app.js` 的 `BUILD` 與 `site/version.json` 的 `build` 要一起改；設定頁「檢查更新」比對兩者，換版用 `?v=` 重載。
- 偵錯 log 在 localStorage `debug_log`，設定頁可看、可複製；不得寫病人資料。

## 部署（2026-10-15 上線）

- 網址 https://lastar0329.github.io/EMSDashboard/ ；repo `Lastar0329/EMSDashboard`（Public，免費帳號 Pages 需公開）。
- 發布＝`python publish.py`（匯出→commit→推 main→`git subtree split --prefix site` 成 gh-pages 強制推）；Pages 來源＝gh-pages 分支根目錄。AP8006 沒有 gh CLI，git 推送靠 Windows 認證管理員。
- 改前端後記得同時改 `BUILD` 與 `version.json` 再發布，否則主畫面 PWA 不會提示更新。

## 下一步

- 資料自動更新（哪台機器、多久跑一次 `publish.py`）尚未決定。
- 使用者看完樣板後會調整指標與圖表。
