"""EMS 品管儀表板資料匯出：PSQL ems_cyfd_record（唯讀）→ site/data/dashboard.json

只輸出「彙總」：以 (日期, 地區, 分隊) 為一格，格內是計數與匿名的時間間隔數列。
不輸出姓名、身分證、住址、電話、病歷號、TEMSIS ID、單號、EMT 姓名、精確座標。
座標只輸出 0.01°（約 1 公里）網格的件數。

用法：python export_data.py            （寫到 site/data/dashboard.json）
      python export_data.py --out X.json
"""
import argparse
import collections
import datetime
import json
import os
import re
import sys

CODE_DIR = r"C:\Users\07619\Desktop\Code"
sys.path.insert(0, CODE_DIR)

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(HERE, "site", "data", "dashboard.json")

# 送往醫院名稱統一（市縣兩邊寫法不同）
HOSP_ALIAS = {"聖馬爾定醫院": "聖馬爾定", "陽明醫院": "陽明", "嘉長醫院": "嘉義長庚", "部嘉": "嘉義醫院",
              "署嘉": "嘉義醫院", "慈濟大林": "大林慈濟"}

TRAUMA_TYPES = {"車禍", "創傷"}
EMPTY_TYPES = {"空跑", "誤(謊)報"}


def ts(s):
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y%m%d%H%M%S"):
        try:
            t = datetime.datetime.strptime(s[:19], fmt)
            return t if t.year >= 2000 else None       # 消防局用 0001/01/01 當空值
        except ValueError:
            continue
    return None


def num(s):
    try:
        return float(str(s).strip())
    except (TypeError, ValueError):
        return None


def mins(a, b, lo=0, hi=240):
    """a→b 的分鐘數；缺值或不合理（負值、超過 hi）回 None。"""
    if a is None or b is None:
        return None
    m = (b - a).total_seconds() / 60
    return round(m, 1) if lo <= m <= hi else None


def v(d, k):
    return bool((d.get(k) or "").strip())


def triage_level(s):
    m = re.search(r"第(\d)級", s or "")
    return int(m.group(1)) if m else None


def age_band(a):
    if a is None:
        return "不明"
    if a < 18:
        return "<18"
    if a < 65:
        return "18-64"
    if a < 80:
        return "65-79"
    return "≥80"


def case_features(row):
    """一筆紀錄 → (flags: set[str], vals: dict[str, float], cats: dict[str, str], extra)。"""
    (region, unit, case_type, case_detail, case_time, dispatch, arrive, depart, hosp_t,
     hospital, critical, pre_tri, er_tri, sex, age, a, b) = row
    a = a or {}
    b = b or {}
    f, vals, cats = set(), {}, {}

    leave_hosp = ts(a.get("離開醫院時間"))
    back = ts(a.get("返隊待命時間"))
    if dispatch is not None and dispatch.year < 2000:
        dispatch = None
    if arrive is not None and arrive.year < 2000:
        arrive = None
    if depart is not None and depart.year < 2000:
        depart = None
    if hosp_t is not None and hosp_t.year < 2000:
        hosp_t = None

    detail = (case_detail or "").strip() or "未填"
    cats["type"] = detail
    cats["cat"] = (case_type or "").strip() or "未填"
    hospital = (hospital or "").strip()
    hospital = HOSP_ALIAS.get(hospital, hospital)
    transported = bool(hospital) and hosp_t is not None
    if transported:
        f.add("transported")
        cats["hosp"] = hospital
    empty = detail in EMPTY_TYPES or v(a, "未發現") or v(a, "中途取消") or v(a, "誤報")
    if empty:
        f.add("empty")
    if v(a, "拒送"):
        f.add("refuse")
    if (critical or "").strip():
        f.add("critical")
    trauma = detail in TRAUMA_TYPES
    if trauma:
        f.add("trauma")
    cats["sex"] = (sex or "").strip() or "不明"
    cats["age"] = age_band(age)

    # ── 時效 ──
    resp = mins(dispatch, arrive, hi=120)
    scene = mins(arrive, depart, hi=180)
    trans = mins(depart, hosp_t, hi=180) if transported else None
    total = mins(dispatch, hosp_t, hi=300) if transported else None
    wall = mins(hosp_t, leave_hosp, hi=240) if transported else None
    cycle = mins(dispatch, back, hi=480)
    for k, x in (("resp", resp), ("scene", scene), ("trans", trans), ("total", total), ("wall", wall),
                 ("cycle", cycle)):
        if x is not None:
            vals[k] = x
    if wall is not None:
        vals[f"wall@{hospital}"] = wall                # 各醫院滯留時間分開存，前端才能依醫院比
    if dispatch is None or arrive is None or depart is None or (transported and hosp_t is None):
        f.add("dq_time_missing")

    # ── OHCA ──
    ohca_med = v(a, "到院前心肺功能停止(非創傷)") or v(a, "快速檢傷-OHCA-內科")
    ohca_tra = v(a, "到院前心肺功能停止(創傷)") or v(a, "快速檢傷-OHCA-外科")
    ohca = ohca_med or ohca_tra
    if ohca:
        f.add("ohca")
        f.add("ohca_trauma" if ohca_tra and not ohca_med else "ohca_medical")
        if v(a, "有目擊者"):
            f.add("ohca_witnessed")
        if v(a, "有旁觀者CPR"):
            f.add("ohca_bcpr")
        if v(a, "無旁觀者CPR"):
            f.add("ohca_no_bcpr")
        if v(a, "有使用PAD"):
            f.add("ohca_pad")
        if v(a, "使用AED"):
            f.add("ohca_aed")
        shocks = (num(a.get("AED電擊次數")) or 0) + (num(a.get("PAD電擊次數")) or 0) + (num(a.get("手動電擊次數")) or 0)
        if shocks > 0:
            f.add("ohca_shock")
        if v(a, "聲門上呼吸道(SGA)"):
            f.add("ohca_sga")
        if v(a, "自動心肺復甦機"):
            f.add("ohca_mcpr")
        if v(a, "BVM(正壓輔助呼吸)"):
            f.add("ohca_bvm")
        if v(a, "有到院前ROSC") or ts(a.get("到院前ROSC時間")):
            f.add("ohca_rosc")
        airway_note = (a.get("其它(呼吸道處置)") or "")
        if re.search(r"etco2|\d+\s*[-:：,，]\s*\d+", airway_note, re.I):
            f.add("ohca_etco2")
        if v(a, "現場死亡"):
            f.add("ohca_dead_scene")
        epi_times = []
        for i in (1, 2, 3, 4, 5):
            name = (b.get(f"給藥-項目/藥名{i}") or "").lower()
            if "epinephrine" in name:
                t = ts(b.get(f"給藥-時間{i}"))
                if t:
                    epi_times.append(t)
        if epi_times:
            f.add("ohca_epi")
            x = mins(arrive, min(epi_times), hi=60)
            if x is not None:
                vals["ohca_epi"] = x
        if scene is not None:
            vals["ohca_scene"] = scene
        if resp is not None:
            vals["ohca_resp"] = resp

    # ── 中風 ──
    screened = v(a, "是否異常(符合疑似腦中風指標)")
    if screened and not ohca:
        f.add("stroke_screen")
    if v(a, "肢體無力") and not ohca and not trauma:
        f.add("stroke_weak")                           # 主訴肢體無力：理應做中風篩檢
        if screened:
            f.add("stroke_weak_screen")
    if not ohca:
        if (a.get("是否異常(符合疑似腦中風指標)") or "").strip() == "是":
            f.add("stroke_pos")
            if v(a, "微笑測試(F)") and v(a, "舉臂測試(A)") and v(a, "言語測試(S)"):
                f.add("stroke_fast")
            lkw = (a.get("最後正常時間(T)") or "").strip()
            if lkw:
                f.add("stroke_lkw_doc")
            if lkw and lkw != "無法得知":
                f.add("stroke_lkw_time")
            if scene is not None:
                vals["stroke_scene"] = scene
                if scene <= 15:
                    f.add("stroke_scene15")
            stroke_bg = v(a, "血糖檢測") or any(v(b, k) for k in ("血糖值", "血糖值#2", "血糖值#3"))
            if stroke_bg:
                f.add("stroke_bg")
            any_bp = any(num(b.get(k)) is not None for k in ("血壓收縮壓", "血壓收縮壓#2", "血壓收縮壓#3"))
            if "stroke_fast" in f and stroke_bg and any_bp:
                f.add("stroke_bundle")                 # NHS K4b：FAST、血糖、血壓都有紀錄
            if total is not None:
                vals["stroke_total"] = total
            if hospital:
                cats["stroke_hosp"] = hospital

    # ── 胸痛 ──
    if (v(a, "胸痛/悶") or v(a, "12小時內有胸痛或胸悶")) and not ohca:
        f.add("chest")
        other = (a.get("其他#2") or "")
        if v(a, "EKG檢查") or re.search(r"ekg|stemi|十二導程|12導程", other, re.I):
            f.add("chest_ekg")
        if v(a, "協助使用Aspirin") or any("aspirin" in (b.get(f"給藥-項目/藥名{i}") or "").lower() for i in (1, 2, 3)):
            f.add("chest_asa")
        if scene is not None:
            vals["chest_scene"] = scene
            if scene <= 15:
                f.add("chest_scene15")

    # ── 生命徵象與意識 ──
    e, m_, vv = num(b.get("昏迷E")), num(b.get("昏迷M")), num(b.get("昏迷V"))
    gcs = (e + m_ + vv) if None not in (e, m_, vv) else None
    loc = (b.get("意識") or "").strip()
    altered = (loc and loc != "清") or (gcs is not None and gcs < 15)
    bgs = [x for x in (num(b.get("血糖值")), num(b.get("血糖值#2")), num(b.get("血糖值#3"))) if x is not None]
    bg_checked = v(a, "血糖檢測") or bool(bgs) or v(b, "血糖值")
    if altered and not ohca:
        f.add("altered")
        if bg_checked:
            f.add("altered_bg")
    if bgs and min(bgs) < 60 and not ohca:
        f.add("hypo")
        given = (v(a, "D10W(IV)") or v(a, "給予口服葡萄糖液")
                 or any("glucose" in (b.get(f"給藥-項目/藥名{i}") or "").lower() for i in (1, 2, 3)))
        if given:
            f.add("hypo_tx")
    spo2 = num(b.get("SpO2"))
    o2 = any(v(a, k) for k in ("鼻管", "面罩", "非再呼吸型面罩", "BVM(正壓輔助呼吸)", "霧化吸入型面罩"))
    if spo2 is not None and spo2 < 94 and not ohca:
        f.add("hypoxia")
        if o2:
            f.add("hypoxia_o2")
    if o2 and spo2 is not None and spo2 >= 98 and not ohca and not altered:
        f.add("o2_high_spo2")

    # ── 創傷 ──
    if trauma:
        cs = (b.get("評估頸椎是否損傷？") or "").strip()
        if cs:
            f.add("trauma_cs_doc")
        if cs.startswith("是"):
            f.add("trauma_cs_pos")
            if v(a, "頸圈") or v(a, "長背板固定") or v(a, "KED固定"):
                f.add("trauma_cs_smr")
        if "critical" in f and not ohca:
            f.add("trauma_crit")
            if scene is not None:
                vals["trauma_crit_scene"] = scene
                if scene <= 10:
                    f.add("trauma_crit_scene10")
        if v(a, "包紮止血") or v(a, "止血帶"):
            f.add("trauma_bleed")
    if "critical" in f and scene is not None:
        vals["crit_scene"] = scene

    # ── 處置 ──
    if v(a, "靜脈輸液") or v(a, "0.9%NS(IV)") or v(a, "L/R(IV)") or v(a, "D5W(IV)") or v(a, "D10W(IV)"):
        f.add("iv")
    if any(v(b, f"給藥-項目/藥名{i}") for i in (1, 2, 3)):
        f.add("drug")
    if any((a.get(f"EMT證照{i}") or "").strip() == "EMTP" for i in range(1, 7)):
        f.add("emtp")
        if "critical" in f:
            f.add("crit_emtp")

    # ── 檢傷 ──
    pl, el = triage_level(pre_tri), triage_level(er_tri)
    if (pre_tri or "").strip() in ("未評", "") and not empty:
        f.add("tri_unrated")
    if pl and el and transported:
        f.add("tri_pair")
        if pl == el:
            f.add("tri_same")
        elif pl > el:
            f.add("tri_under")                         # 到院前判得比急診輕
        else:
            f.add("tri_over")
        cats["tri_pair"] = f"{pl}-{el}"

    # ── 紀錄品質 ──
    if not empty:
        f.add("dq_base")
        rr = num(b.get("呼吸"))
        if rr is not None:
            f.add("dq_rr_num")
            if rr == 18:
                f.add("dq_rr18")
        if num(b.get("血壓收縮壓")) is not None:
            f.add("dq_bp1")
        sets = sum(1 for k in ("脈搏", "呼吸", "SpO2", "昏迷E") if num(b.get(k)) is not None)
        if sets == 4 and (num(b.get("血壓收縮壓")) is not None or (b.get("血壓測量下拉項目") or "").strip()):
            f.add("dq_vs_full")
        if num(b.get("體溫")) is not None:
            f.add("dq_temp")
        if "refuse" in f:
            f.add("refuse_base")
            if "dq_vs_full" in f:
                f.add("refuse_vs")                     # NEMSQA TTR-01：未運送者有完整生命徵象
        if v(b, "時間#2"):
            f.add("dq_vs2")

    extra = {"hour": None, "dow": None}
    if case_time:
        extra["hour"] = case_time.hour
        extra["dow"] = case_time.weekday()
    lat, lon = num(a.get("發生地點座標-緯度")), num(a.get("發生地點座標-經度"))
    if lat and lon and 22.9 < lat < 23.8 and 120.0 < lon < 121.0:
        extra["grid"] = (round(lat, 2), round(lon, 2))
    return f, vals, cats, extra


def fetch_rows():
    import psycopg

    import psql_conn
    with psycopg.connect(host=psql_conn.PSQL_HOST, port=psql_conn.PSQL_PORT, dbname=psql_conn.PSQL_DB,
                         user=psql_conn.PSQL_USER, password=psql_conn.read_password(),
                         **psql_conn.CONN_KWARGS) as c:
        c.read_only = True
        cur = c.cursor()
        cur.execute("""SELECT region, unit, case_type, case_detail, case_time, dispatch_time, arrive_time,
                              depart_scene_time, hospital_time, hospital, critical, prehosp_triage, er_triage,
                              sex, age, sheet1, sheet2
                       FROM ems_cyfd_record WHERE case_time IS NOT NULL ORDER BY case_time""")
        rows = cur.fetchall()
        cur.execute("SELECT region, day, complete, rows FROM ems_cyfd_record_daylog ORDER BY region, day")
        daylog = cur.fetchall()
    return rows, daylog


def build(rows, daylog):
    cells = {}
    grid = collections.Counter()
    units = collections.defaultdict(collections.Counter)
    for row in rows:
        region, unit = row[0], (row[1] or "未填").strip()
        case_time = row[4]
        f, vals, cats, extra = case_features(row)
        key = (case_time.date().isoformat(), region, unit)
        cell = cells.get(key)
        if cell is None:
            cell = cells[key] = {"d": key[0], "r": region, "u": unit, "n": 0, "c": collections.Counter(),
                                 "v": collections.defaultdict(list), "h": [0] * 24, "w": [0] * 7}
        cell["n"] += 1
        for k in f:
            cell["c"][k] += 1
        for k, x in cats.items():
            cell["c"][f"{k}:{x}"] += 1
        for k, x in vals.items():
            cell["v"][k].append(x)
        if extra["hour"] is not None:
            cell["h"][extra["hour"]] += 1
            cell["w"][extra["dow"]] += 1
        if extra.get("grid"):
            grid[(region, unit, key[0][:7]) + extra["grid"]] += 1
        units[region][unit] += 1

    out_cells = []
    for cell in sorted(cells.values(), key=lambda c: (c["d"], c["r"], c["u"])):
        out_cells.append({"d": cell["d"], "r": cell["r"], "u": cell["u"], "n": cell["n"], "c": dict(cell["c"]),
                          "v": {k: sorted(x) for k, x in cell["v"].items()}, "h": cell["h"], "w": cell["w"]})
    cover = collections.defaultdict(list)
    for region, day, complete, n in daylog:
        cover[region].append([day.isoformat(), bool(complete), n])
    return {
        "schema": 1,
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": "PSQL emr_data.ems_cyfd_record（消防局救護紀錄表，嘉義市／嘉義縣）",
        "total": len(rows),
        "regions": {r: [u for u, _ in c.most_common()] for r, c in units.items()},
        "coverage": cover,
        "cells": out_cells,
        "grid": [[r, u, m, la, lo, n] for (r, u, m, la, lo), n in sorted(grid.items())],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()
    rows, daylog = fetch_rows()
    data = build(rows, daylog)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    tmp = args.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, args.out)
    print(f"寫入 {args.out}：{data['total']} 筆 → {len(data['cells'])} 格，{os.path.getsize(args.out) // 1024} KB")


if __name__ == "__main__":
    main()
