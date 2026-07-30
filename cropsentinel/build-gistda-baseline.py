#!/usr/bin/env python3
"""
สร้าง gistda-baseline.js จากบริการข้อมูลเปิดของ GISTDA

รันใหม่เมื่อไรก็ได้:  python3 build-gistda-baseline.py

ทุกตัวเลขในไฟล์ผลลัพธ์มาจากการเรียก API จริง ไม่มีค่าที่พิมพ์เอง
สคริปต์นี้มีไว้ให้ตรวจสอบย้อนกลับได้ว่าเลขบนหน้าจอมาจากไหน

กับดักที่ต้องรู้: GISTDA มี ArcGIS สอง estate คนละ path
  /arcgis/rest/services/Hosted/   -> ชั้นข้อมูลข้าว, โรงสี
  /data/rest/services/            -> ขอบเขตการปกครอง, น้ำท่วมซ้ำซาก
เขียน base URL เดียวแล้วอีกครึ่งหนึ่งจะพังเงียบ ๆ (ตอบ HTTP 200 พร้อม error body)
"""

import json
import ssl
import urllib.parse
import urllib.request
from collections import Counter

HOSTED = "https://gistdaportal.gistda.or.th/arcgis/rest/services/Hosted"
DATA = "https://gistdaportal.gistda.or.th/data/rest/services"

PROVINCE_TH = "ปทุมธานี"

# วินเทจข้าวล่าสุดที่เผยแพร่ ณ วันที่สร้างไฟล์นี้ (เช็ครายการได้ที่ Hosted?f=json)
RICE_SERVICE = "20260415_rice_40m"
RICE_LABEL = "15 เมษายน 2569"
RICE_PIXEL_M = 40  # ความละเอียดจุดภาพของผลิตภัณฑ์นี้ = 40 เมตร = 1,600 ตร.ม. = 1 ไร่พอดี

# พื้นที่จังหวัดปทุมธานี ใช้ตรวจความสมเหตุสมผลของตัวเลขพื้นที่นา
PROVINCE_AREA_KM2 = 1525.856
RAI_PER_KM2 = 1_000_000 / 1600


def get(url):
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": "CropSentinel/2.0"})
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        body = json.loads(r.read().decode("utf-8"))
    # ArcGIS ตอบ HTTP 200 พร้อม error body เวลา path ผิด ต้องดักเอง
    if isinstance(body, dict) and "error" in body:
        raise RuntimeError(f"ArcGIS error {body['error'].get('code')}: {body['error'].get('message')} @ {url}")
    return body


def q(base, service, server, layer, **params):
    params.setdefault("f", "json")
    params.setdefault("returnGeometry", "false")
    url = f"{base}/{urllib.parse.quote(service)}/{server}/{layer}/query?" + urllib.parse.urlencode(params)
    return get(url)


def fetch_rice():
    """ข้าวรายแปลงของปทุมธานี พร้อมช่วงปลูก/เก็บเกี่ยว/โครงการชลประทาน"""
    d = q(HOSTED, RICE_SERVICE, "FeatureServer", 0,
          where=f"p_name='{PROVINCE_TH}'",
          outFields="rai,product,a_name,t_name,start_name,harv_name,proj_name,irr_office",
          resultRecordCount=5000)
    return [f["attributes"] for f in d.get("features", [])]


def fetch_amphoe_geojson():
    """ขอบเขตอำเภอจริง ลดจุดฝั่ง server ให้เหลือขนาดที่ฝังในเว็บได้"""
    url = (f"{DATA}/L05_AdminBoundary/L05_Amphoe_GISTDA_50k/MapServer/0/query?"
           + urllib.parse.urlencode({
               "where": f"PV_TN='{PROVINCE_TH}'",
               "outFields": "AP_TN,AP_EN,AP_IDN",
               "returnGeometry": "true",
               "outSR": "4326",
               "maxAllowableOffset": "0.002",
               "f": "geojson",
           }))
    return get(url)


def fetch_flood():
    """ความถี่น้ำท่วมซ้ำซาก 2548-2559 รวมยอดฝั่ง server ได้ 7 อำเภอในคำขอเดียว"""
    stats = json.dumps([
        {"statisticType": "sum", "onStatisticField": "area_rai", "outStatisticFieldName": "rai"},
        {"statisticType": "max", "onStatisticField": "flood_freq", "outStatisticFieldName": "maxfreq"},
    ], ensure_ascii=False)
    d = q(DATA, "FL_Flood/FL_RepeatedFlooding_GISTDA_50k_Y2005_Y2016", "FeatureServer", 0,
          where=f"pv_tn='{PROVINCE_TH}'",
          outFields="ap_tn",
          groupByFieldsForStatistics="ap_tn",
          outStatistics=stats)
    return {f["attributes"]["ap_tn"]: f["attributes"] for f in d.get("features", [])}


def fetch_mills():
    d = q(HOSTED, "โรงสีข้าว", "FeatureServer", 0,
          where="1=1", outFields="name,province,x,y", resultRecordCount=3000)
    return [f["attributes"] for f in d.get("features", [])]


def to_svg(geojson, width=760, height=480, pad=18):
    # ขนาดต้องตรงกับ viewBox ของ <svg className="map-svg"> ใน module1.jsx
    # ถ้าไม่ตรง ขอบเขตจังหวัดจะไม่เต็มกรอบและป้ายชื่อจะเลื่อน
    """ฉายพิกัดจริงลงผืนผ้าใบ SVG โดยรักษาสัดส่วนตามละติจูด"""
    xs, ys = [], []
    for f in geojson["features"]:
        for poly in ring_sets(f["geometry"]):
            for ring in poly:
                for x, y in ring:
                    xs.append(x)
                    ys.append(y)
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    # 1 องศาลองจิจูดสั้นกว่าละติจูดตาม cos(lat) ไม่ชดเชยแล้วแผนที่จะยืดออกด้านข้าง
    import math
    coslat = math.cos(math.radians((miny + maxy) / 2))
    w = (maxx - minx) * coslat
    h = maxy - miny
    scale = min((width - 2 * pad) / w, (height - 2 * pad) / h)
    offx = (width - w * scale) / 2
    offy = (height - h * scale) / 2

    def project(x, y):
        return (round(offx + (x - minx) * coslat * scale, 1),
                round(offy + (maxy - y) * scale, 1))

    out = {}
    for f in geojson["features"]:
        name = f["properties"]["AP_TN"]
        best = max((r for poly in ring_sets(f["geometry"]) for r in poly), key=len)
        out[name] = " ".join(f"{px},{py}" for px, py in (project(x, y) for x, y in best))
    return out


def ring_sets(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


def main():
    print("ดึงข้อมูลจาก GISTDA ...")
    rice = fetch_rice()
    gj = fetch_amphoe_geojson()
    flood = fetch_flood()
    mills = fetch_mills()

    amphoe_order = [f["properties"]["AP_TN"] for f in gj["features"]]
    svg = to_svg(gj)

    rai_by_amphoe = Counter()
    for a in rice:
        rai_by_amphoe[a["a_name"]] += a["rai"] or 0

    harvest = Counter()
    for a in rice:
        if a.get("harv_name"):
            harvest[a["harv_name"]] += a["rai"] or 0

    project = Counter()
    for a in rice:
        if a.get("proj_name") and a["proj_name"].strip():
            project[a["proj_name"]] += a["rai"] or 0

    # product เป็นค่าคงที่ทั้งจังหวัด ไม่ใช่ผลผลิตที่วัดรายแปลง ต้องแจ้งบนหน้าจอ
    products = sorted({round(a["product"], 2) for a in rice if a.get("product")})

    total_rai = sum(rai_by_amphoe.values())
    province_rai = PROVINCE_AREA_KM2 * RAI_PER_KM2
    if total_rai > province_rai:
        raise SystemExit(f"ตรวจไม่ผ่าน: พื้นที่นา {total_rai:,.0f} ไร่ มากกว่าพื้นที่จังหวัด {province_rai:,.0f} ไร่")

    districts = []
    for name in amphoe_order:
        fl = flood.get(name, {})
        districts.append({
            "nameTh": name,
            "riceRai": round(rai_by_amphoe.get(name, 0), 1),
            "floodExposureRai": round(fl.get("rai", 0), 1),
            "floodMaxFreq": fl.get("maxfreq"),
            "poly": svg[name],
        })

    payload = {
        "source": {
            "riceService": f"{HOSTED}/{RICE_SERVICE}/FeatureServer/0",
            "riceLabelTh": RICE_LABEL,
            "ricePixelM": RICE_PIXEL_M,
            "amphoeService": f"{DATA}/L05_AdminBoundary/L05_Amphoe_GISTDA_50k/MapServer/0",
            "floodService": f"{DATA}/FL_Flood/FL_RepeatedFlooding_GISTDA_50k_Y2005_Y2016/FeatureServer/0",
            "millService": f"{HOSTED}/โรงสีข้าว/FeatureServer/0",
        },
        "province": {
            "nameTh": PROVINCE_TH,
            "areaKm2": PROVINCE_AREA_KM2,
            "areaRai": round(province_rai),
            "riceRai": round(total_rai),
            "riceParcels": len(rice),
            "riceShareOfProvince": round(total_rai / province_rai, 4),
            "productKgPerRai": products,
        },
        "districts": districts,
        "harvestWindows": [{"windowTh": k, "rai": round(v)} for k, v in
                           sorted(harvest.items(), key=lambda kv: -kv[1])],
        "irrigationProjects": [{"nameTh": k, "rai": round(v)} for k, v in project.most_common()],
        "mills": {
            "national": len(mills),
            "inProvince": [{"name": m["name"], "lng": m["x"], "lat": m["y"]}
                           for m in mills if m.get("province") and PROVINCE_TH in str(m["province"])],
        },
    }

    header = (
        "// สร้างอัตโนมัติโดย build-gistda-baseline.py — อย่าแก้ด้วยมือ\n"
        "// ทุกตัวเลขในไฟล์นี้ดึงจากบริการข้อมูลเปิดของ GISTDA ไม่มีค่าที่กรอกเอง\n"
        f"// ข้าวรายแปลง: {RICE_SERVICE} ({RICE_LABEL}) ความละเอียด {RICE_PIXEL_M} ม.\n"
        "// รันใหม่: python3 build-gistda-baseline.py\n"
    )
    with open("gistda-baseline.js", "w", encoding="utf-8") as f:
        f.write(header + "window.CS_GISTDA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n")

    print(f"  ข้าว {len(rice)} แปลง รวม {total_rai:,.0f} ไร่ "
          f"({total_rai / province_rai * 100:.1f}% ของจังหวัด) — ผ่านการตรวจความสมเหตุสมผล")
    print(f"  อำเภอ {len(districts)} อำเภอ: {', '.join(amphoe_order)}")
    print(f"  ช่วงเก็บเกี่ยว {len(harvest)} ช่วง — สูงสุด {harvest.most_common(1)[0][0]} "
          f"{harvest.most_common(1)[0][1]:,.0f} ไร่ ({harvest.most_common(1)[0][1] / total_rai * 100:.1f}%)")
    print(f"  โรงสีในจังหวัด {len(payload['mills']['inProvince'])} แห่ง (ทั้งประเทศ {len(mills)})")
    print("เขียน gistda-baseline.js แล้ว")


if __name__ == "__main__":
    main()
