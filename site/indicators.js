/* 指標定義（要增刪改指標改這裡就好）
 * 比率型：num／den 是 export_data.py 產生的旗標名稱；den 為 "n" ＝全部案件。
 * better：high＝越高越好、low＝越低越好、null＝不評好壞（只看分布）。
 * minDen：分母少於此數時標示「樣本少」，不參與好壞判定。
 * ref：對應 REFS 的 key（出處）。
 */
const GROUPS = {
  ops: "勤務概況",
  time: "時效",
  ohca: "OHCA 到院前心跳停止",
  stroke: "疑似腦中風",
  chest: "胸痛／ACS",
  med: "內科急症",
  trauma: "創傷",
  triage: "檢傷",
  dq: "紀錄品質",
};

const RATE_IND = [
  { id: "transport", g: "ops", name: "送醫率", num: "transported", den: "n", better: null, desc: "有送往醫院且有送達時間的案件 ÷ 全部案件" },
  { id: "empty", g: "ops", name: "空跑／誤報率", num: "empty", den: "n", better: null, desc: "案件細項為空跑、誤(謊)報，或勾選未發現／中途取消" },
  { id: "refuse", g: "ops", name: "拒送率", num: "refuse", den: "n", better: null, desc: "勾選「拒送」÷ 全部案件；高拒送率是醫療指導常見的稽核重點（拒送需完整告知與紀錄）", ref: "nemsqa" },
  { id: "critical", g: "ops", name: "危急個案比例", num: "critical", den: "n", better: null, desc: "勾選「危急個案」÷ 全部案件" },
  { id: "refuse_vs", g: "ops", name: "拒送者生命徵象完整", num: "refuse_vs", den: "refuse_base", better: "high", minDen: 10, desc: "拒送案件中現場第一筆生命徵象完整（NEMSQA TTR-01：未運送者記錄基本生命徵象）", ref: "nemsqa" },
  { id: "crit_emtp", g: "ops", name: "危急個案有 EMTP 出勤", num: "crit_emtp", den: "critical", better: "high", minDen: 10, desc: "危急個案中，出勤人員任一人證照為 EMTP 的比例" },

  { id: "ohca_bcpr", g: "ohca", name: "旁觀者 CPR 率", num: "ohca_bcpr", den: "ohca", better: "high", minDen: 5, desc: "OHCA 中勾選「有旁觀者CPR」", ref: "utstein" },
  { id: "ohca_aed", g: "ohca", name: "AED 使用率", num: "ohca_aed", den: "ohca", better: "high", minDen: 5, desc: "OHCA 中勾選「使用AED」（救護人員）", ref: "utstein" },
  { id: "ohca_epi", g: "ohca", name: "Epinephrine 給藥率（內科 OHCA）", num: "ohca_epi", den: "ohca_medical", better: "high", minDen: 5, desc: "非創傷 OHCA 中有給 Epinephrine 的比例", ref: "aha" },
  { id: "ohca_sga", g: "ohca", name: "高級呼吸道（SGA）置放率", num: "ohca_sga", den: "ohca", better: "high", minDen: 5, desc: "OHCA 中勾選聲門上呼吸道", ref: "utstein" },
  { id: "ohca_mcpr", g: "ohca", name: "自動心肺復甦機使用率", num: "ohca_mcpr", den: "ohca", better: null, minDen: 5, desc: "OHCA 中勾選自動心肺復甦機" },
  { id: "ohca_etco2", g: "ohca", name: "EtCO₂ 有紀錄", num: "ohca_etco2", den: "ohca", better: "high", minDen: 5, desc: "OHCA 的「其它(呼吸道處置)」有 EtCO₂ 數值（自由文字辨識，可能低估）", ref: "aha" },
  { id: "ohca_rosc", g: "ohca", name: "到院前 ROSC 率", num: "ohca_rosc", den: "ohca", better: "high", minDen: 5, desc: "OHCA 中勾選「有到院前ROSC」或有 ROSC 時間", ref: "utstein" },

  { id: "stroke_weak_screen", g: "stroke", name: "肢體無力者有做中風篩檢", num: "stroke_weak_screen", den: "stroke_weak", better: "high", minDen: 10, desc: "主訴勾選「肢體無力」（非創傷、非 OHCA）中，「是否異常(符合疑似腦中風指標)」有填的比例", ref: "nemsqa" },
  { id: "stroke_fast", g: "stroke", name: "疑似中風者 FAST 完整", num: "stroke_fast", den: "stroke_pos", better: "high", minDen: 5, desc: "篩檢陽性者，微笑／舉臂／言語三項都有填", ref: "nemsqa" },
  { id: "stroke_bundle", g: "stroke", name: "中風 bundle（FAST＋血糖＋血壓）", num: "stroke_bundle", den: "stroke_pos", better: "high", minDen: 5, desc: "篩檢陽性者 FAST 三項、血糖、任一筆血壓數值全部都有紀錄（仿 NHS AQI K4b 中風診斷 bundle）", ref: "nhs" },
  { id: "stroke_bg", g: "stroke", name: "疑似中風者有測血糖", num: "stroke_bg", den: "stroke_pos", better: "high", minDen: 5, desc: "篩檢陽性者有血糖檢測（排除低血糖偽中風）", ref: "ml" },
  { id: "stroke_scene15", g: "stroke", name: "疑似中風現場時間 ≤15 分", num: "stroke_scene15", den: "stroke_pos", better: "high", minDen: 5, desc: "篩檢陽性者 到達→離開現場 ≤15 分鐘", ref: "montana" },
  { id: "stroke_lkw", g: "stroke", name: "疑似中風者有最後正常時間", num: "stroke_lkw_time", den: "stroke_pos", better: "high", minDen: 5, desc: "篩檢陽性者「最後正常時間(T)」填了具體時間（填「無法得知」不算）", ref: "aha_stroke" },

  { id: "chest_ekg", g: "chest", name: "胸痛者有做 12 導程心電圖", num: "chest_ekg", den: "chest", better: "high", minDen: 5, desc: "勾選胸痛/悶或 12 小時內胸痛者，勾選 EKG 檢查或備註有 EKG/STEMI 字樣", ref: "nemsqa" },

  { id: "altered_bg", g: "med", name: "意識改變者有測血糖", num: "altered_bg", den: "altered", better: "high", minDen: 10, desc: "現場意識非「清」或 GCS<15（非 OHCA）中，有血糖檢測或血糖值", ref: "nemsqa" },
  { id: "hypo_tx", g: "med", name: "低血糖者有給糖", num: "hypo_tx", den: "hypo", better: "high", minDen: 5, desc: "任一次血糖 <60 mg/dL 中，給 D10W、50% Glucose 或口服葡萄糖液", ref: "nemsqa" },
  { id: "hypoxia_o2", g: "med", name: "低血氧者有給氧", num: "hypoxia_o2", den: "hypoxia", better: "high", minDen: 10, desc: "現場第一筆 SpO₂ <94%（非 OHCA）中，有鼻管／面罩／NRM／BVM／霧化" },

  { id: "trauma_cs_doc", g: "trauma", name: "創傷有評估頸椎", num: "trauma_cs_doc", den: "trauma", better: "high", minDen: 10, desc: "車禍／創傷案件中「評估頸椎是否損傷？」有填" },
  { id: "trauma_scene10", g: "trauma", name: "危急創傷現場時間 ≤10 分", num: "trauma_crit_scene10", den: "trauma_crit", better: "high", minDen: 5, desc: "危急個案且為車禍／創傷，到達→離開現場 ≤10 分鐘", ref: "nemsqa" },

  { id: "tri_unrated", g: "triage", name: "到院前檢傷「未評」", num: "tri_unrated", den: "dq_base", better: "low", minDen: 10, desc: "非空跑案件中，到院前檢傷分級為未評或空白" },
  { id: "tri_under", g: "triage", name: "到院前檢傷低估", num: "tri_under", den: "tri_pair", better: "low", minDen: 10, desc: "兩邊都有級數的送醫案件中，到院前級數比急診檢傷輕（數字較大）" },
  { id: "tri_same", g: "triage", name: "到院前與急診檢傷一致", num: "tri_same", den: "tri_pair", better: "high", minDen: 10, desc: "兩邊級數相同" },

  { id: "dq_rr18", g: "dq", name: "呼吸次數填 18 的比例", num: "dq_rr18", den: "dq_rr_num", better: "low", minDen: 10, desc: "現場第一筆呼吸次數恰為 18 的比例；過高代表可能未實際測量（預設值效應）" },
  { id: "dq_vs_full", g: "dq", name: "現場生命徵象完整", num: "dq_vs_full", den: "dq_base", better: "high", minDen: 10, desc: "非空跑案件，第一筆有脈搏、呼吸、SpO₂、GCS 及血壓（數值或測量方式）", ref: "nemsqa" },
  { id: "dq_bp1", g: "dq", name: "現場血壓有數值", num: "dq_bp1", den: "dq_base", better: "high", minDen: 10, desc: "第一筆（現場）收縮壓有數字" },
  { id: "dq_time", g: "dq", name: "時間戳缺漏", num: "dq_time_missing", den: "n", better: "low", minDen: 10, desc: "出勤／到達／離開現場（送醫者含送達）任一缺漏或為 0001/01/01" },
];

/* 時間型：v 為 export_data.py 的數列名稱（分鐘） */
const TIME_IND = [
  { id: "resp", g: "time", name: "反應時間", sub: "出勤→到達現場", better: "low", ref: "nemsqa" },
  { id: "scene", g: "time", name: "現場時間", sub: "到達→離開現場", better: "low" },
  { id: "trans", g: "time", name: "運送時間", sub: "離開現場→送達醫院", better: null },
  { id: "total", g: "time", name: "到院前總時間", sub: "出勤→送達醫院", better: "low" },
  { id: "wall", g: "time", name: "醫院滯留時間", sub: "送達→離開醫院（交接／床邊等待）", better: "low", ref: "wall" },
  { id: "cycle", g: "time", name: "勤務總時間", sub: "出勤→返隊待命", better: null },
  { id: "crit_scene", g: "time", name: "危急個案現場時間", sub: "危急個案 到達→離開現場", better: "low" },
  { id: "trauma_crit_scene", g: "trauma", name: "危急創傷現場時間", sub: "危急創傷 到達→離開現場", better: "low", ref: "nemsqa" },
  { id: "ohca_resp", g: "ohca", name: "OHCA 反應時間", sub: "OHCA 出勤→到達", better: "low", ref: "utstein" },
  { id: "ohca_scene", g: "ohca", name: "OHCA 現場時間", sub: "OHCA 到達→離開現場", better: null },
  { id: "ohca_epi", g: "ohca", name: "到達→第一劑 Epinephrine", sub: "OHCA 有給藥者", better: "low", ref: "aha" },
  { id: "stroke_scene", g: "stroke", name: "疑似中風現場時間", sub: "篩檢陽性 到達→離開現場", better: "low", ref: "aha_stroke" },
  { id: "chest_scene", g: "chest", name: "胸痛現場時間", sub: "胸痛 到達→離開現場", better: null },
];

/* 出處（研究完成後補上） */
const REFS = {
  nemsqa: { t: "NEMSQA National EMS Quality Alliance — Quality Measures（Stroke-01、Hypoglycemia-01、Respiratory-02、Trauma-08、TTR-01 等 21 項）", u: "https://www.nemsqa.org/measures" },
  nhs: { t: "NHS England Ambulance Quality Indicators（AmbSYS／AmbCO 規格：mean＋90th centile、STEMI／中風／post-ROSC bundle）", u: "https://www.england.nhs.uk/statistics/statistical-work-areas/ambulance-quality-indicators/" },
  utstein: { t: "Bray JE, et al. Cardiac arrest and CPR outcome reports: 2024 update of the Utstein OHCA Registry template. Resuscitation 2024. doi:10.1016/j.resuscitation.2024.110288", u: "https://doi.org/10.1016/j.resuscitation.2024.110288" },
  aha: { t: "AHA Mission: Lifeline EMS Recognition Criteria（12 導程 ≤10 分、中風篩檢／血糖／LKW、OHCA 去顫時效）", u: "https://www.heart.org/-/media/Files/Professional/Quality-Improvement/Mission-Lifeline/2027/ML-EMS-Recognition-Criteria-2027.pdf" },
  ml: { t: "AHA Mission: Lifeline EMS（疑似中風血糖評估 AHAEMS3、胸痛 12 導程與現場時間）", u: "https://www.heart.org/-/media/Files/Professional/Quality-Improvement/Mission-Lifeline/2027/ML-EMS-Recognition-Criteria-2027.pdf" },
  aha_stroke: { t: "AHA Mission: Lifeline EMS 2026–27：中風陽性者 Last Known Well 記錄、到院前通報", u: "https://www.heart.org/-/media/Files/Professional/Quality-Improvement/Mission-Lifeline/2027/ML-EMS-Recognition-Criteria-2027.pdf" },
  montana: { t: "Montana DPHHS 2024 EMS Stroke Report（Coverdell：現場時間 <15 分等 7 項）", u: "https://dphhs.mt.gov/assets/publichealth/EMSTS/Data/2024_EMS_Stroke_Report.pdf" },
  wall: { t: "NHS AQI：醫院交接時間（hospital handover，mean 與 90th）", u: "https://www.england.nhs.uk/statistics/statistical-work-areas/ambulance-quality-indicators/" },
  funnel: { t: "Siriwardena AN, et al. Development and pilot of clinical performance indicators for English ambulance services. Emerg Med J 2010;27:327（以 funnel plot 比較各救護單位）", u: "https://emj.bmj.com/content/27/4/327" },
  spiegel: { t: "Spiegelhalter DJ. Funnel plots for comparing institutional performance. Stat Med 2005;24:1185–1202", u: "https://doi.org/10.1002/sim.1970" },
  spc: { t: "Scottish Ambulance Service Board Quality Report（control chart 5 條、run chart 4 條判讀規則）", u: "https://www.scottishambulance.com/media/q1jksk50/boardquality.pdf" },
  benneyan: { t: "Benneyan JC, Lloyd RC, Plsek PE. Statistical process control as a tool for research and healthcare improvement. Qual Saf Health Care 2003;12:458", u: "https://qualitysafety.bmj.com/content/12/6/458" },
  pap: { t: "Pap R, et al. Development of prehospital care quality indicators for the Australian setting. Emerg Med J 2022;39:57（一般時間間隔指標不被視為有效品質指標→當營運指標看）", u: "https://emj.bmj.com/content/39/1/57" },
  blackwell: { t: "Blackwell TH, Kaufman JS. Response time effectiveness: comparison of response time and survival in an urban EMS system. Acad Emerg Med 2002;9:288", u: "https://doi.org/10.1197/aemj.9.4.288" },
  redlener: { t: "Redlener M, et al. A National Assessment of EMS Performance at the Response and Agency Level. Prehosp Emerg Care 2024（NEMSQA 指標的單位間差異）", u: "https://doi.org/10.1080/10903127.2023.2283886" },
  karimi: { t: "Karimi S, et al. Performance Indicators in EMS: A Scoping Review of Dashboard Applications. Arch Acad Emerg Med 2026;14(1)", u: "https://journals.sbmu.ac.ir/aaem/index.php/AAEM/article/view/3075" },
  cares: { t: "CARES 2023 年報（全國旁觀者 CPR 41.2%、Utstein 存活 32.8%；以全國平均線作基準比較）", u: "https://mycares.net/sitepages/uploads/2023/CARES%202023%20Metrics%20Summary.pdf" },
};

/* 外部基準線（只做參考，跟本地資料定義不完全相同） */
const BENCH = {
  ohca_bcpr: { v: 0.412, label: "CARES 2023 全美 41.2%", ref: "cares" },
};
