"""Datos y medios de los capítulos 04 «La costa no duerme» y 05 «Seis horas de luz» del atlas.

    python -X utf8 scripts/preparar_cap45.py

Lee las cifras ya verificadas de los videos (Nuevas_Ideas/1_Consumo/DATOS_VIDEO, Nuevas_Ideas/2_ZNI/VIDEO/DATOS_VIDEO,
Nuevas_Ideas/2_ZNI/resultados y las capas de VIDEO_v2) y escribe, sin escribir cifras a mano:

- assets/datos/costa.json: perfiles horarios de XM (ene-2024), cifras de los seis actos, 1.064 municipios con consumo
  residencial por persona (SUI/DANE), cobertura (ICEE 2024) y temperatura a las 3 a. m. (ERA5-Land, muestreada en la
  cabecera), crecimiento 2021–2026 y el contorno de Colombia.
- assets/datos/luz.json: 162 localidades ZNI con telemetría (IPSE), horarios de la CREG, 2.550 puntos de viviendas
  rurales sin servicio (400 por punto, dentro de cada municipio), 460 subestaciones de la UPME, las 25 cabeceras del
  modelo híbrido, facturación y subsidio 2023–2025 y las cifras del capítulo.
- assets/media/costa-*.webp y luz-*.webp: láminas comparativas hechas con las capas del video (relieve 250 m, VIIRS,
  ERA5) y clips de Google Flow a 720 px.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter

SITE = Path(__file__).resolve().parents[1]
RAIZ = SITE.parents[1]                      # VIDEO_ISA
NI = RAIZ / "Nuevas_Ideas"
V2 = NI / "VIDEO_v2"
OUT = SITE / "assets/datos"
MEDIA = SITE / "assets/media"


def js(path):
    s = Path(path).read_text(encoding="utf-8")
    return json.loads(s[s.index("{"): s.rindex("}") + 1])


def contorno():
    """Contorno de Colombia (geo.js del video 1, coordenadas de mundo x=(lon+180)*100, y=(40-lat)*100) en lon/lat."""
    g = js(RAIZ / "GRUPO_1/VIDEO1/PRODUCCION/proyecto/assets/geo.js")
    anillos = []
    import re
    for sub in re.split(r"(?=M)", g["colombia"]):
        pts = [(round(float(x) / 100 - 180, 3), round(40 - float(y) / 100, 3)) for x, y in re.findall(r"(-?[\d.]+),(-?[\d.]+)", sub)]
        if len(pts) > 12:
            anillos.append(pts[::2])
    return anillos


def muestrear_tif(path, lons, lats):
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(path)
    a = np.asarray(im, dtype=np.float32)
    sx, sy = im.tag_v2[33550][:2]
    tp = im.tag_v2[33922]
    c = (np.asarray(lons) - tp[3]) / sx - 0.5
    f = (tp[4] - np.asarray(lats)) / sy - 0.5
    from scipy import ndimage
    a = np.where(np.isfinite(a) & (a > -60) & (a < 60), a, np.nan)   # el mar viene con un valor «sin dato» muy negativo
    # rellenar NaN con el vecino válido (costas)
    m = np.isnan(a)
    idx = ndimage.distance_transform_edt(m, return_distances=False, return_indices=True)
    a = a[tuple(idx)]
    return ndimage.map_coordinates(a, [f, c], order=1, mode="nearest")


def costa():
    DV = NI / "1_Consumo/DATOS_VIDEO"
    a1, a2, a3, a5, a6 = (json.loads((DV / f"acto{i}.json").read_text(encoding="utf-8")) for i in (1, 2, 3, 5, 6))
    p = a2["perfiles"]["2024-01"]
    tab = pd.read_csv(NI / "2_ZNI/resultados/municipios_cobertura.csv", encoding="utf-8-sig", dtype={"cod": str})
    tab = tab[np.isfinite(tab.sin_kwh_hab_dia)].copy()
    tab["t03"] = muestrear_tif(NI / "1_Consumo/GEE/temperatura_03h_2024_ene_feb.tif", tab.lon, tab.lat)
    mun = [[r.cod, r.nom_mpio.title(), r.dpto.title(), round(r.lon, 3), round(r.lat, 3), round(r.sin_kwh_hab_dia, 3),
            None if not np.isfinite(r.icee_total) else round(r.icee_total, 1), int(r.poblacion), round(float(r.t03), 1)]
           for r in tab.itertuples()]
    # coherencia con las cifras del video
    por = {m[0]: m for m in mun}
    assert abs(por["08001"][5] - 2.557) < 0.01 and abs(por["25754"][5] - 0.939) < 0.01
    assert all(-5 < m[8] < 35 for m in mun), "temperaturas fuera de rango"
    D = {
        "fuente": "XM (demanda por mercado, ene-2024; demanda comercial 2021–2026) · SUI y DANE (consumo residencial ene–feb 2024) · UPME (ICEE 2024; proyección de demanda rev. jul-2026; Res. 355 de 2004) · ECMWF ERA5-Land (GEE)",
        "mercados": [{"id": k, "nombre": n, "color": c, "lon": lo, "lat": la, "mwh": [round(v, 1) for v in p[k]["mwh_por_hora"]], "pico": p[k]["pico"]}
                     for k, n, c, lo, la in (("Cali-Yumbo", "Cali–Yumbo", "#ffc21c", -76.52, 3.44), ("Bogotá-Cundinamarca", "Bogotá–Cundinamarca", "#2b3bff", -74.08, 4.65),
                                             ("Antioquia", "Antioquia", "#16bfae", -75.57, 6.24), ("Caribe", "Caribe", "#ff5b3a", -74.80, 10.98))],
        "madrugada": {"caribe": a1["Caribe_MWh"], "bogota": a1["Bogota_Cundinamarca_MWh"], "razon": a1["razon"],
                      "pob_caribe": a1["poblacion_Caribe_aprox"], "pob_bogota": a1["poblacion_Bogota_Cundinamarca_aprox"]},
        "calor": {"barranquilla_03": a3["temperatura_ERA5_GEE"]["Barranquilla_03h_C"], "bogota_14": a3["temperatura_ERA5_GEE"]["Bogota_14h_C"],
                  "bogota_03": a3["temperatura_ERA5_GEE"]["Bogota_03h_C"], "aire_caribe": a3["hogares_aire_acondicionado_pct"]["Caribe"],
                  "aire_oriental": a3["hogares_aire_acondicionado_pct"]["Oriental"], "ventiladores": a3["ventiladores_pct_consumo_residencial_caribe"],
                  "sub_bajo": a3["subsistencia_kWh_mes"]["menos_de_1000_m"], "sub_alto": a3["subsistencia_kWh_mes"]["desde_1000_m"]},
        "guajira": {"razon": a5["razon_Riohacha_Uribia"], "icee_uribia": a5["ICEE"]["Uribia"]["ICEE Total"], "icee_riohacha": a5["ICEE"]["Riohacha"]["ICEE Total"]},
        "historia": {"anios": list(a6["GWh_dia_por_anio"].keys()), "Caribe": list(a6["GWh_dia_por_anio"].values()),
                     **{k: list(v["GWh_dia_por_anio"].values()) for k, v in a6["comparativos"].items()},
                     "crec_caribe": a6["crecimiento_2021_2026_pct"], "crec_bogota": a6["comparativos"]["Bogotá-Cundinamarca"]["crecimiento_2021_2026_pct"],
                     "participacion": a6["participacion_nacional_2026_pct"]},
        "columnas_municipios": ["cod", "nombre", "dpto", "lon", "lat", "kwh_hab_dia", "icee", "poblacion", "t03"],
        "municipios": mun,
        "colombia": contorno(),
    }
    (OUT / "costa.json").write_text(json.dumps(D, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"costa.json: {(OUT / 'costa.json').stat().st_size / 1e3:.0f} kB · {len(mun)} municipios")


def luz():
    DV = NI / "2_ZNI/VIDEO/DATOS_VIDEO"
    a1, a2, a3, a4, a5 = (json.loads((DV / f"acto{i}.json").read_text(encoding="utf-8")) for i in range(1, 6))
    d5 = js(V2 / "cap5/assets/datos5.js")
    fac = pd.read_csv(NI / "2_ZNI/resultados/facturacion_zni_2023_2025.csv", encoding="utf-8-sig")
    mun = pd.read_csv(NI / "2_ZNI/resultados/municipios_cobertura.csv", encoding="utf-8-sig", dtype={"cod": str})
    mun = mun[mun.km_subestacion.notna()]
    bos = pd.read_csv(NI / "2_ZNI/resultados/bosque_trazados.csv", encoding="utf-8-sig").drop_duplicates("corredor")
    D = {
        "fuente": "IPSE (telemetría oct-2025 a sep-2026) · CREG (Doc. 901 299 de 2025) · UPME (ICEE 2024, red y subestaciones, PIEC 2024–2028) · DANE (IPM 2018) · SUI-Superservicios (facturación ZNI) · modelo propio con NASA POWER y ERA5",
        "horarios": a1["horarios"],
        "localidades": [[round(p["lon"], 3), round(p["lat"], 3), round(p["horas_dia"], 2), p["nombre"].title()] for p in a3["puntos"]],
        "cifras": {
            "viviendas_sin_servicio": a2["viviendas_sin_servicio"], "rurales_sin_servicio": a2["rurales_sin_servicio"],
            "rural_cerca_pct": a2["rural_cerca_pct"], "cobertura_alta": a2["cobertura_rural_alta_pct"], "cobertura_baja": a2["cobertura_rural_baja_pct"],
            "caribe_pct": a2["caribe_pct"], "caribe_oscuras_pct": d5["caribe_oscuras_pct"],
            "localidades": a3["localidades_unicas"]["n"], "menos12": a3["localidades_unicas"]["menos_de_12_h"], "mediana_h": a3["localidades_unicas"]["mediana_h"],
            "subsidio": a3["subsidio_COP_kWh"], "usuario": a3["usuarios_COP_kWh"], "razon": a3["subsidio_sobre_pago_usuario"], "mitu_subsidio": a3["subsidio_mitu_COP_kWh"],
            "pobres_pct": a4["rural_en_municipios_pobres_pct"], "piec_billones": a4["inversion_billones_COP_2023"], "piec_millones_vivienda": a4["millones_COP_por_vivienda"],
            "microrred_inversion_pct": a4["inversion_microrred_pct"], "microrred_viviendas_pct": a4["viviendas_microrred_pct"],
            "hibrido_gana": a5["hibrido_gana_a_diesel"], "cabeceras": a5["cabeceras"], "inversion_mm": a5["inversion_millones_COP"],
            "repago": a5["repago_simple_mediana_anos"], "repago_rango": a5["repago_rango_anos"], "galones": a5["galones_ahorrados_ano"],
            "co2_t": a5["CO2_t_ano"], "mitu_solar": a5["mitu_solar_pct"], "linea_gana": a5["linea_gana"],
        },
        "facturacion": [{"anio": int(r["año"]), "subsidio": round(r.subsidio_por_kWh, 1), "usuario": round(r.paga_usuario_por_kWh, 1)} for _, r in fac.iterrows()],
        "cabeceras": d5["acto5"]["cabeceras"],
        "trazados": [{"corredor": r.corredor, "bosque_pct": round(r.pct_bosque_wc, 1)} for r in bos.itertuples()],
        "columnas_puntos": ["lon", "lat", "km_subestacion_cabecera", "elev_cabecera_m", "caribe", "ipm_rural_50"],
        "puntos": [[round(p[0], 3), round(p[1], 3), p[3], p[4], p[5], p[6]] for p in d5["puntos"] if p[2] == 1],
        "subestaciones": [[round(s[0], 3), round(s[1], 3)] for s in d5["subestaciones"]],
        # cálculo exacto del porcentaje a cualquier radio: (km de la cabecera a la subestación, viviendas rurales sin servicio)
        "municipios_km": [[round(float(r.km_subestacion), 1), int(r.viv_sin_servicio_rural)] for r in mun.itertuples() if r.viv_sin_servicio_rural and r.viv_sin_servicio_rural > 0],
        "colombia": contorno(),
    }
    mk = np.array(D["municipios_km"], dtype=float)
    exacto = 100 * mk[mk[:, 0] < 50, 1].sum() / mk[:, 1].sum()
    assert abs(exacto - a2["rural_cerca_pct"]) < 0.01, f"el cálculo municipal da {exacto:.3f} %"
    pts = np.array([p[2] for p in D["puntos"]])
    assert abs((pts < 50).mean() * 100 - a2["rural_cerca_pct"]) < 0.5, "los puntos no reproducen el 89,7 %"
    (OUT / "luz.json").write_text(json.dumps(D, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"luz.json: {(OUT / 'luz.json').stat().st_size / 1e3:.0f} kB · {len(D['puntos'])} puntos · {len(D['localidades'])} localidades")


def lamina(capas, nombre, recorte=(150, 150, 3400, 4480), ancho=900):
    """Compone capas RGBA de VIDEO_v2 (3500 × 4500, extensión −80…−66 E, 13,5…−4,5 N) y recorta Colombia."""
    base = None
    for archivo, op in capas:
        im = Image.open(archivo).convert("RGBA")
        if op < 1:
            a = np.asarray(im).astype(np.float32); a[..., 3] *= op; im = Image.fromarray(a.astype(np.uint8))
        base = im if base is None else Image.alpha_composite(base, im)
    fondo = Image.new("RGBA", base.size, (8, 14, 22, 255))
    out = Image.alpha_composite(fondo, base).crop(recorte)
    out = out.resize((ancho, round(ancho * out.height / out.width)), Image.LANCZOS).convert("RGB")
    out.save(MEDIA / nombre, quality=84, method=6)
    print(f"  {nombre}: {out.size}")


def puntos_sobre(base_png, puntos, color, nombre_tmp, r=4):
    im = Image.open(base_png).convert("RGBA")
    capa = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    for lon, lat in puntos:
        x, y = (lon + 80) * 250, (13.5 - lat) * 250
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)
    capa = Image.alpha_composite(capa.filter(ImageFilter.GaussianBlur(5)), capa)
    p = MEDIA / nombre_tmp
    capa.save(p)
    return p


def clip(src, nombre, inicio=0.0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(inicio), "-i", str(src)]
    if dur: cmd += ["-t", str(dur)]
    subprocess.run(cmd + ["-vf", "scale=720:-2:flags=lanczos", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "25",
                          "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(MEDIA / nombre)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", str(MEDIA / nombre), "-frames:v", "1", "-c:v", "libwebp", "-quality", "82",
                    str(MEDIA / nombre.replace(".mp4", ".webp"))], check=True)
    print(f"  {nombre}: {(MEDIA / nombre).stat().st_size / 1e6:.1f} MB")


def medios():
    c4, c5 = V2 / "cap4/assets", V2 / "cap5/assets"
    print("láminas…")
    lamina([(c4 / "relieve_noche.webp", 1), (c4 / "temp_03.webp", 1)], "costa-temp-03.webp")
    lamina([(c4 / "relieve_dia.webp", 1), (c4 / "temp_14.webp", 1)], "costa-temp-14.webp")
    lamina([(c5 / "relieve_noche.webp", 1), (c5 / "luces_halo.webp", 1), (c5 / "luces.webp", 1)], "luz-noche.webp")
    d5 = js(c5 / "datos5.js")
    tmp = puntos_sobre(c5 / "relieve_noche.webp", [(p[0], p[1]) for p in d5["puntos"] if p[2] == 1], (255, 196, 90, 235), "_tmp_puntos.png", r=5)
    lamina([(c5 / "relieve_noche.webp", 1), (c5 / "zni.webp", 0.75), (tmp, 1)], "luz-sin-servicio.webp")
    tmp.unlink()
    print("portadas animadas (vuelos de Blender del Grupo 1, franja 16:9 como en preparar_clips.py)…")
    premium = RAIZ / "PRODUCCION_3D/vuelos_premium"
    franja = "crop=iw:trunc(iw*9/16/2)*2:0:(ih-oh)*0.46,scale=1080:-2"
    for fuente, nombre, segundo in (("D3_arenosa_anochecer.mp4", "costa", 5.6), ("D5_darien_proyecto_noche.mp4", "luz", 3.0)):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(premium / fuente), "-t", "7.2", "-an", "-vf", f"{franja},fps=24",
                        "-c:v", "libx264", "-crf", "24", "-preset", "fast", "-g", "6", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                        str(MEDIA / f"{nombre}-vuelo.mp4")], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(segundo), "-i", str(premium / fuente), "-frames:v", "1", "-vf", franja,
                        "-c:v", "libwebp", "-quality", "85", str(MEDIA / f"{nombre}-portada.webp")], check=True)
        print(f"  {nombre}-vuelo.mp4 y {nombre}-portada.webp")
    print("clips de Google Flow…")
    clip(NI / "OPUS_FLOW/flow_1_caribe_3am.mp4", "flow-caribe-3am.mp4")
    clip(NI / "OPUS_FLOW/flow_2_caseta_diesel.mp4", "flow-caseta-diesel.mp4")
    clip(NI / "OPUS_FLOW/flow_3_microrred_amazonia.mp4", "flow-microrred.mp4")


FUENTES = {
    4: [
        ("Demanda comercial por mercado", "Demanda horaria por mercado de comercialización, consultada en la API de XM. Base de los perfiles de 24 horas y del crecimiento 2021–2026.", "XM · Sinergox", "https://sinergox.xm.com.co/", "WEB", "2021-01 a 2026-10"),
        ("Índice de Cobertura de Energía Eléctrica 2024", "Boletín del ICEE por municipio: cobertura total, urbana y rural.", "UPME · SIMEC", "https://docs.upme.gov.co/SIMEC/Energia%20Electrica/Documents/Informes_cobertura/Boletin_ICEE_2024.pdf", "PDF", "2024"),
        ("Proyección de demanda de energía eléctrica", "Revisión de julio de 2026 de la proyección de demanda y potencia máxima.", "UPME", "https://docs.upme.gov.co/DemandayEficiencia/Documents/Proyecciones_demanda_Energia_Electrica_y_Potencia_Maxima_Rev_Julio_2026_VRF.pdf", "PDF", "Julio de 2026"),
        ("Consumo de subsistencia · Resolución UPME 355 de 2004", "Define el consumo de subsistencia según la altura del municipio (por debajo o por encima de 1.000 m).", "UPME · gestor normativo de la CREG", "https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0355_2004.htm", "WEB", "2004"),
        ("ERA5-Land por hora", "Temperatura del aire a 2 m. El capítulo usa la media de las 3 a. m. de enero y febrero de 2024, exportada desde Earth Engine.", "ECMWF · Google Earth Engine", "https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_HOURLY", "WEB", "2024-01 a 2024-02"),
        ("Sistema Único de Información", "Consumo residencial facturado por municipio, enero y febrero de 2024. Se divide por la población del DANE.", "Superservicios · SUI", "https://sui.superservicios.gov.co/", "WEB", "2024-01 a 2024-02"),
    ],
    5: [
        ("Informes de telemetría de las ZNI", "Horas de servicio diarias de las localidades monitoreadas por el Centro Nacional de Monitoreo.", "IPSE", "https://ipse.gov.co/", "WEB", "2025-10 a 2026-09"),
        ("Documento CREG 901 299 de 2025", "Horarios mínimos de prestación según el número de usuarios de cada localidad.", "CREG", "https://gestornormativo.creg.gov.co/gestor/entorno/docs/originales/Proyecto_Resoluci%C3%B3n_CREG_701_113_2025/Documento_CREG_901_299_2025.pdf", "PDF", "2025"),
        ("Plan Indicativo de Expansión de Cobertura 2024–2028", "Viviendas sin servicio, inversión estimada y solución propuesta (red, microrred o solución individual).", "UPME", "https://docs.upme.gov.co/SIMEC/Energia%20Electrica/PIEC/2024-2028/PIEC_2024-2028_Vfinal.pdf", "PDF", "2024–2028"),
        ("Capa del PIEC en el geoportal", "Servicio de mapas de la UPME con las capas del plan de cobertura.", "UPME · geoportal", "https://geo.upme.gov.co/server/rest/services/Capas_EnergiaElectrica/plan_indicativo_expansion_cobertura/FeatureServer/32", "WEB", ""),
        ("Boletín tarifario de las ZNI", "Tarifa, subsidio y consumo facturado por localidad. Base del cálculo de cuánto pone el Estado por cada kWh.", "Superservicios", "https://www.superservicios.gov.co/sites/default/files/inline-files/Boletin-Tarifario-ZNI-III-Trimestre-de-2025_1.pdf", "PDF", "III trimestre de 2025"),
        ("Medida de pobreza multidimensional de fuente censal", "IPM rural por municipio, CNPV 2018.", "DANE", "https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/pobreza-y-desigualdad/medida-de-pobreza-multidimensional-de-fuente-censal", "WEB", "2018"),
        ("NASA POWER", "Radiación solar diaria en superficie para dimensionar el híbrido solar de cada cabecera.", "NASA Langley", "https://power.larc.nasa.gov/", "WEB", ""),
    ],
}


def catalogo():
    """Tablas descargables de los capítulos 04 y 05 (archivos/video-4 y video-5) y sus fichas en metadatos/catalogo.*.
    Se puede correr solo: python -X utf8 scripts/preparar_cap45.py --catalogo"""
    import csv
    import hashlib
    C = json.loads((OUT / "costa.json").read_text(encoding="utf-8"))
    Z = json.loads((OUT / "luz.json").read_text(encoding="utf-8"))
    mun = pd.read_csv(NI / "2_ZNI/resultados/municipios_cobertura.csv", encoding="utf-8-sig", dtype={"cod": str})
    mun = mun[mun.km_subestacion.notna() & (mun.viv_sin_servicio_rural > 0)]
    H = C["historia"]
    tablas = {
        4: [
            ("Demanda por hora de cuatro mercados", "Promedio por hora de la demanda comercial regulada en enero de 2024, en MWh y hora de Colombia. Es la base del reloj de 24 horas.",
             "demanda_horaria_mercados_2024-01.csv", "2024-01",
             pd.DataFrame({"hora": range(24), **{f"{m['id']}_MWh": m["mwh"] for m in C["mercados"]}})),
            ("Consumo, cobertura y calor por municipio", "Consumo residencial por persona y día (SUI y DANE, ene–feb 2024), cobertura de energía (ICEE 2024) y temperatura a las 3 a. m. (ERA5-Land, muestreada en la cabecera).",
             "municipios_consumo_cobertura_temperatura.csv", "2024",
             pd.DataFrame(C["municipios"], columns=["cod_dane", "municipio", "departamento", "lon", "lat", "kwh_persona_dia", "icee_pct", "poblacion", "temp_03h_C"])),
            ("Demanda diaria por mercado, 2021–2026", "Demanda comercial media por día, de enero a octubre de cada año, en GWh. El Caribe incluye a Cesar desde agosto de 2026.",
             "demanda_diaria_por_mercado_2021_2026.csv", "2021 a 2026 (ene–oct)",
             pd.DataFrame({"anio": H["anios"], **{f"{k}_GWh_dia": H[k] for k in ("Caribe", "Bogotá-Cundinamarca", "Antioquia", "Cali-Yumbo", "Nacional")}})),
        ],
        5: [
            ("Horas de luz por localidad", "Horas de servicio por día en las 162 localidades de las Zonas No Interconectadas con telemetría del IPSE.",
             "localidades_zni_horas_servicio.csv", "2025-10 a 2026-09",
             pd.DataFrame([[p[3], p[0], p[1], p[2]] for p in Z["localidades"]], columns=["localidad", "lon", "lat", "horas_dia"])),
            ("Horarios mínimos de la CREG", "Horas de servicio exigidas según el número de usuarios de la localidad.",
             "horarios_creg_zni.csv", "2025", pd.DataFrame(Z["horarios"]).rename(columns={"usuarios": "usuarios_localidad"})),
            ("Distancia a la red y viviendas sin servicio", "Distancia de cada cabecera municipal a la subestación más cercana de la UPME y viviendas rurales sin servicio (PIEC). Con esta tabla se calcula el anillo de 50 km.",
             "municipios_distancia_subestacion.csv", "2024",
             pd.DataFrame({"cod_dane": mun.cod, "municipio": mun.nom_mpio.str.title(), "departamento": mun.dpto.str.title(),
                           "km_cabecera_subestacion": mun.km_subestacion.round(1), "viviendas_rurales_sin_servicio": mun.viv_sin_servicio_rural.astype(int)})),
            ("Costo de la energía en 25 cabeceras", "Modelo propio, hora por hora: costo actual con diésel y costo con un híbrido solar o con una línea a la red, en pesos por kWh.",
             "cabeceras_hibrido_solar.csv", "2026",
             pd.DataFrame([{"cod_dane": c["cod"], "cabecera": c["n"], "lon": c["lon"], "lat": c["lat"], "fraccion_solar": c["solar"], "diesel_COP_kWh": c["diesel"],
                            "hibrido_COP_kWh": c["hib"], "linea_COP_kWh": c["linea"], "galones_ahorrados_ano": c["galones"], "mejor_opcion": c["mejor"]} for c in Z["cabeceras"]])),
            ("Lo que paga el usuario y el subsidio", "Promedio por kWh en las Zonas No Interconectadas: lo que paga el usuario y lo que pone el Estado.",
             "facturacion_subsidio_zni.csv", "2023 a 2025",
             pd.DataFrame([{"anio": f["anio"], "paga_usuario_COP_kWh": f["usuario"], "subsidio_COP_kWh": f["subsidio"]} for f in Z["facturacion"]])),
        ],
    }
    assert abs(100 * tablas[5][2][4].query("km_cabecera_subestacion < 50").viviendas_rurales_sin_servicio.sum()
               / tablas[5][2][4].viviendas_rurales_sin_servicio.sum() - Z["cifras"]["rural_cerca_pct"]) < 0.05
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    nuevas = []
    for v, filas in tablas.items():
        carpeta = SITE / f"archivos/video-{v}"
        carpeta.mkdir(parents=True, exist_ok=True)
        fuente = "XM, SUI, DANE, UPME y ERA5-Land" if v == 4 else "IPSE, CREG, UPME, Superservicios y modelo propio"
        for titulo, desc, nombre, periodo, df in filas:
            p = carpeta / nombre
            df.to_csv(p, index=False, encoding="utf-8", lineterminator="\n")
            nuevas.append({"videos": [v], "title": titulo, "description": desc, "source": fuente, "sourceUrl": "", "storage": "github", "filename": nombre,
                           "format": "CSV", "path": f"archivos/video-{v}/{nombre}", "sha256": sha(p), "columns": list(df.columns), "rows": len(df),
                           "bytes": p.stat().st_size, "period": periodo})
        j = OUT / ("costa.json" if v == 4 else "luz.json")
        nuevas.append({"videos": [v], "title": f"Datos de la página del capítulo 0{v}", "description": "Todo lo que dibujan las escenas interactivas, en un solo archivo: series, municipios, puntos y el contorno de Colombia.",
                       "source": C["fuente"] if v == 4 else Z["fuente"], "sourceUrl": "", "storage": "github", "filename": j.name, "format": "JSON",
                       "path": f"assets/datos/{j.name}", "sha256": sha(j), "bytes": j.stat().st_size, "period": "2021 a 2026" if v == 4 else "2018 a 2026"})
        for titulo, desc, fuente_o, url, fmt_, periodo in FUENTES[v]:
            nuevas.append({"videos": [v], "title": titulo, "description": desc, "source": fuente_o, "sourceUrl": url, "storage": "source", "format": fmt_, "period": periodo})
    for e in nuevas:                                     # sin campos vacíos, como el resto del catálogo
        for k in [k for k, x in e.items() if x in ("", None)]: del e[k]
    cat_j = SITE / "metadatos/catalogo.json"
    previas = [e for e in json.loads(cat_j.read_text(encoding="utf-8")) if not set(e["videos"]) <= {4, 5}]
    base = max(int(e["id"].split("-")[1]) for e in previas)
    nuevas = [{"id": f"recurso-{i:02d}", **e} for i, e in enumerate(nuevas, start=base + 1)]
    todo = previas + nuevas
    cat_j.write_text(json.dumps(todo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cols = ["id", "videos", "title", "description", "source", "sourceUrl", "storage", "format", "period", "filename", "bytes", "rows", "features", "columns", "sha256", "path", "notes"]
    with open(SITE / "metadatos/catalogo.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for e in todo:
            w.writerow({c: (" | ".join(map(str, e[c])) if isinstance(e.get(c), list) else e.get(c, "")) for c in cols})
    print(f"catálogo: {len(previas)} fichas previas + {len(nuevas)} de los capítulos 04 y 05")


if __name__ == "__main__":
    import sys
    OUT.mkdir(parents=True, exist_ok=True)
    if "--catalogo" not in sys.argv:
        costa()
        luz()
        medios()
    catalogo()
