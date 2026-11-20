/******************************************************************************
 * WATTS a WOW – Video 1: El Niño y el riesgo de apagón en Colombia
 * Script para el Code Editor de Google Earth Engine (code.earthengine.google.com)
 *
 * Uso: pegar todo, Run, y en la pestaña "Tasks" darle RUN a cada exportación.
 * Todo se guarda en Google Drive en la carpeta  WATTS_WOW_GEE
 *
 * Exportaciones:
 *  01  SST anomalía mensual Pacífico (OISST)               -> GeoTIFF multibanda
 *  02  Serie Niño 3.4 diaria (OISST)                        -> CSV
 *  03  Lluvia: anomalía % mensual Colombia (CHIRPS)         -> GeoTIFF multibanda
 *  04  Lluvia: serie mensual promedio en cuencas del SIN    -> CSV
 *  05  NDVI anomalía (MODIS) – vegetación seca              -> GeoTIFF multibanda
 *  06  Temperatura superficial anomalía (MODIS LST)          -> GeoTIFF multibanda
 *  07  Embalses: área de agua mensual (Sentinel-2, MNDWI)   -> CSV
 *  08  Embalses: imágenes RGB "antes / ahora"               -> GeoTIFF
 *  09  Relieve (Copernicus DEM 250 m)                       -> GeoTIFF
 *  10  Luces nocturnas (VIIRS)                              -> GeoTIFF
 *  11  Cuencas HydroBASINS nivel 5 + ríos principales        -> SHP
 *  12  Límites Colombia y departamentos                     -> SHP
 ******************************************************************************/

// ---------------------------- PARÁMETROS ------------------------------------
var CARPETA = 'WATTS_WOW_GEE';
var INICIO  = '2023-01-01';     // incluye El Niño 2023-24 para comparar
var FIN     = '2026-11-01';     // exclusivo
var CLIMA_INI = 1991, CLIMA_FIN = 2020;   // climatología de referencia

// Regiones
var colombia = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
  .filter(ee.Filter.eq('country_na', 'Colombia'));
var deptos = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM0_NAME', 'Colombia'));
var bboxColombia = ee.Geometry.Rectangle([-80, -4.5, -66, 13.5], null, false);
// Pacífico ecuatorial + Colombia (encuadre del "origen" del Niño)
var bboxPacifico = ee.Geometry.Rectangle([-180, -25, -65, 25], null, false);
var nino34 = ee.Geometry.Rectangle([-170, -5, -120, 5], null, false);

// Embalses (cajas aproximadas: AJUSTAR en el mapa si hace falta)
var embalses = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Rectangle([-75.25, 6.15, -75.05, 6.36]), {nombre: 'Penol_Guatape'}),
  ee.Feature(ee.Geometry.Rectangle([-73.62, 4.62, -73.42, 4.80]), {nombre: 'Guavio'}),
  ee.Feature(ee.Geometry.Rectangle([-75.60, 2.60, -75.35, 2.82]), {nombre: 'Betania'}),
  ee.Feature(ee.Geometry.Rectangle([-76.35, 7.85, -76.05, 8.15]), {nombre: 'Urra'})
]);

// Lista de meses (client side, para nombrar bandas)
function listaMeses(ini, fin) {
  var out = [], d = new Date(ini + 'T00:00:00Z'), f = new Date(fin + 'T00:00:00Z');
  while (d < f) {
    out.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}
var MESES = listaMeses(INICIO, FIN);
print('Meses a procesar:', MESES.length, MESES);

function nombreBanda(ym) { return 'm' + ym.replace('-', '_'); }

// Construye una imagen multibanda (una banda por mes) a partir de una función mes->imagen
function apilar(fnMes) {
  var imgs = MESES.map(function (ym) {
    return fnMes(ym).rename(nombreBanda(ym));
  });
  return ee.ImageCollection(imgs).toBands()
    .rename(MESES.map(nombreBanda));
}

function exportarImg(img, nombre, region, escala) {
  Export.image.toDrive({
    image: img.toFloat(), description: nombre, folder: CARPETA,
    fileNamePrefix: nombre, region: region, scale: escala,
    crs: 'EPSG:4326', maxPixels: 1e13
  });
}

// ---------------------------- 01-02 SST / NIÑO 3.4 ---------------------------
var oisst = ee.ImageCollection('NOAA/CDR/OISST/V2_1').select('anom');

var sstAnom = apilar(function (ym) {
  var ini = ee.Date(ym + '-01');
  return oisst.filterDate(ini, ini.advance(1, 'month')).mean().multiply(0.01); // °C
});
exportarImg(sstAnom, '01_SST_anomalia_mensual_C', bboxPacifico, 27830); // ~0.25°

var serieNino = oisst.filterDate('2015-01-01', FIN).map(function (im) {
  var v = im.multiply(0.01).reduceRegion({
    reducer: ee.Reducer.mean(), geometry: nino34, scale: 27830, maxPixels: 1e9
  }).get('anom');
  return ee.Feature(null, {fecha: im.date().format('YYYY-MM-dd'), anom_nino34_C: v});
});
Export.table.toDrive({
  collection: serieNino, description: '02_Nino34_anomalia_diaria',
  folder: CARPETA, fileFormat: 'CSV', selectors: ['fecha', 'anom_nino34_C']
});

// ---------------------------- 03-04 LLUVIA CHIRPS ----------------------------
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD').select('precipitation');

// Climatología mensual 1991-2020 (mm/mes)
var climaMes = ee.ImageCollection(ee.List.sequence(1, 12).map(function (m) {
  var anios = ee.List.sequence(CLIMA_INI, CLIMA_FIN);
  var sumas = ee.ImageCollection(anios.map(function (a) {
    var ini = ee.Date.fromYMD(a, m, 1);
    return chirps.filterDate(ini, ini.advance(1, 'month')).sum();
  }));
  return sumas.mean().set('mes', m);
}));

// Imagen vacía (enmascarada) con las bandas pedidas: evita errores en meses sin datos
function vacia(bandas) {
  return ee.Image.constant(bandas.map(function () { return 0; }))
    .rename(bandas).updateMask(0).toFloat();
}
// CHIRPS se publica con ~1-2 meses de retraso: los meses sin datos salen enmascarados
function lluviaMes(ym) {
  var ini = ee.Date(ym + '-01');
  var col = chirps.filterDate(ini, ini.advance(1, 'month'));
  return ee.Image(ee.Algorithms.If(col.size().gt(0), col.sum().toFloat(), vacia(['precipitation'])));
}
var lluviaAnomPct = apilar(function (ym) {
  var m = parseInt(ym.slice(5, 7), 10);
  var clima = climaMes.filter(ee.Filter.eq('mes', m)).first();
  clima = ee.Image(clima).rename('precipitation');
  return ee.Image(lluviaMes(ym)).subtract(clima).divide(clima.max(1)).multiply(100);
});
exportarImg(lluviaAnomPct.clip(bboxColombia), '03_Lluvia_anomalia_pct_CHIRPS', bboxColombia, 5566);

// Cuencas que alimentan los embalses del SIN: HydroBASINS nivel 5 que tocan Colombia
var cuencas = ee.FeatureCollection('WWF/HydroSHEDS/v1/Basins/hybas_5')
  .filterBounds(colombia);

var lluviaColombia = ee.FeatureCollection(MESES.map(function (ym) {
  var m = parseInt(ym.slice(5, 7), 10);
  var clima = ee.Image(climaMes.filter(ee.Filter.eq('mes', m)).first()).rename('clima');
  var obs = ee.Image(lluviaMes(ym)).rename('lluvia');
  var r = obs.addBands(clima).reduceRegion({
    reducer: ee.Reducer.mean(), geometry: colombia.geometry(), scale: 5566, maxPixels: 1e10
  });
  return ee.Feature(null, {
    mes: ym, lluvia_mm: r.get('lluvia', null), clima_mm: r.get('clima', null)
  });
}));
Export.table.toDrive({
  collection: lluviaColombia, description: '04_Lluvia_mensual_Colombia_vs_clima',
  folder: CARPETA, fileFormat: 'CSV', selectors: ['mes', 'lluvia_mm', 'clima_mm']
});

// ---------------------------- 05 NDVI ----------------------------------------
var ndvi = ee.ImageCollection('MODIS/061/MOD13A2').select('NDVI');
var ndviClima = ee.ImageCollection(ee.List.sequence(1, 12).map(function (m) {
  return ndvi.filterDate('2003-01-01', '2021-01-01')
    .filter(ee.Filter.calendarRange(m, m, 'month')).mean().set('mes', m);
}));
var ndviAnom = apilar(function (ym) {
  var ini = ee.Date(ym + '-01');
  var m = parseInt(ym.slice(5, 7), 10);
  return ndvi.filterDate(ini, ini.advance(1, 'month')).mean()
    .subtract(ndviClima.filter(ee.Filter.eq('mes', m)).first()).multiply(0.0001);
});
exportarImg(ndviAnom.clip(bboxColombia), '05_NDVI_anomalia_MODIS', bboxColombia, 2000);

// ---------------------------- 06 LST -----------------------------------------
var lst = ee.ImageCollection('MODIS/061/MOD11A2').select('LST_Day_1km');
var lstClima = ee.ImageCollection(ee.List.sequence(1, 12).map(function (m) {
  return lst.filterDate('2003-01-01', '2021-01-01')
    .filter(ee.Filter.calendarRange(m, m, 'month')).mean().set('mes', m);
}));
var lstAnom = apilar(function (ym) {
  var ini = ee.Date(ym + '-01');
  var m = parseInt(ym.slice(5, 7), 10);
  return lst.filterDate(ini, ini.advance(1, 'month')).mean()
    .subtract(lstClima.filter(ee.Filter.eq('mes', m)).first()).multiply(0.02); // °C
});
exportarImg(lstAnom.clip(bboxColombia), '06_LST_anomalia_C_MODIS', bboxColombia, 2000);

// ---------------------------- 07-08 EMBALSES Sentinel-2 ----------------------
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
function mascaraS2(im) {
  var scl = im.select('SCL');
  var ok = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)); // sombra, nubes, cirros
  return im.updateMask(ok);
}
// Área de agua mensual (km2) con MNDWI > 0
var MESES_S2 = listaMeses('2019-01-01', FIN);
var areaAgua = ee.FeatureCollection(embalses.map(function (emb) {
  var geom = emb.geometry();
  var feats = ee.List(MESES_S2.map(function (ym) {
    var ini = ee.Date(ym + '-01');
    var col = s2.filterBounds(geom).filterDate(ini, ini.advance(1, 'month'))
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70)).map(mascaraS2);
    // meses sin imágenes (antes de 2019 en S2_SR o 100 % nublados) -> enmascarado
    var comp = ee.Image(ee.Algorithms.If(col.size().gt(0),
      col.median().select(['B3', 'B11']), vacia(['B3', 'B11'])));
    var mndwi = comp.normalizedDifference(['B3', 'B11']).rename('mndwi');
    var validos = mndwi.mask().rename('v').reduceRegion({
      reducer: ee.Reducer.mean(), geometry: geom, scale: 20, maxPixels: 1e9
    }).get('v');
    var area = mndwi.gt(0).multiply(ee.Image.pixelArea()).divide(1e6).rename('a')
      .reduceRegion({reducer: ee.Reducer.sum(), geometry: geom, scale: 20, maxPixels: 1e9
    }).get('a');
    return ee.Feature(null, {
      embalse: emb.get('nombre'), mes: ym, n_imagenes: col.size(),
      area_agua_km2: area, fraccion_pixeles_validos: validos
    });
  }));
  return ee.FeatureCollection(feats);
})).flatten();
Export.table.toDrive({
  collection: areaAgua, description: '07_Embalses_area_agua_mensual_S2',
  folder: CARPETA, fileFormat: 'CSV',
  selectors: ['embalse', 'mes', 'area_agua_km2', 'n_imagenes', 'fraccion_pixeles_validos']
});
// Nota: meses con fraccion_pixeles_validos baja (<0.8) son poco confiables (nubes).

// RGB "antes vs ahora" de cada embalse (año húmedo 2022 vs últimos meses 2026)
var fechasRGB = [['antes', '2022-06-01', '2022-12-31'], ['ahora', '2026-08-01', '2026-11-01']];
embalses.aggregate_array('nombre').evaluate(function (nombres) {
  nombres.forEach(function (n) {
    var geom = embalses.filter(ee.Filter.eq('nombre', n)).geometry();
    fechasRGB.forEach(function (f) {
      var rgb = s2.filterBounds(geom).filterDate(f[1], f[2])
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60)).map(mascaraS2)
        .median().select(['B4', 'B3', 'B2']);
      Export.image.toDrive({
        image: rgb.toUint16(), description: '08_RGB_' + n + '_' + f[0], folder: CARPETA,
        fileNamePrefix: '08_RGB_' + n + '_' + f[0], region: geom, scale: 10,
        crs: 'EPSG:4326', maxPixels: 1e10
      });
    });
  });
});

// ---------------------------- 09 DEM -----------------------------------------
var dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').mosaic()
  .setDefaultProjection('EPSG:4326', null, 30);
exportarImg(dem.clip(bboxColombia), '09_DEM_Colombia_250m', bboxColombia, 250);

// ---------------------------- 10 LUCES NOCTURNAS -----------------------------
var viirs = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
  .select('avg_rad').filterDate('2025-01-01', FIN).median();
exportarImg(viirs.clip(bboxColombia), '10_Luces_nocturnas_VIIRS', bboxColombia, 500);

// ---------------------------- 11-12 VECTORES ---------------------------------
Export.table.toDrive({
  collection: cuencas, description: '11a_Cuencas_HydroBASINS_n5',
  folder: CARPETA, fileFormat: 'SHP'
});
var rios = ee.FeatureCollection('WWF/HydroSHEDS/v1/FreeFlowingRivers')
  .filterBounds(bboxColombia).filter(ee.Filter.gte('RIV_ORD', 1)).filter(ee.Filter.lte('RIV_ORD', 5));
Export.table.toDrive({
  collection: rios, description: '11b_Rios_principales_HydroRIVERS',
  folder: CARPETA, fileFormat: 'SHP'
});
Export.table.toDrive({ collection: colombia, description: '12a_Limite_Colombia', folder: CARPETA, fileFormat: 'SHP' });
// 12b Departamentos: NO se exporta, se usa la capa oficial local (Departamentos_Diciembre_2025)

// ---------------------------- VISTA PREVIA -----------------------------------
Map.setCenter(-74, 4, 5);
Map.addLayer(sstAnom.select(nombreBanda(MESES[MESES.length - 1])),
  {min: -3, max: 3, palette: ['313695', '74add1', 'ffffbf', 'f46d43', 'a50026']}, 'SST anomalía último mes');
Map.addLayer(lluviaAnomPct.select(nombreBanda(MESES[MESES.length - 2])).clip(colombia),
  {min: -60, max: 60, palette: ['8c510a', 'd8b365', 'f5f5f5', '5ab4ac', '01665e']}, 'Lluvia anomalía %');
Map.addLayer(embalses, {color: 'cyan'}, 'Cajas embalses (revisar)');
Map.addLayer(nino34, {color: 'red'}, 'Región Niño 3.4', false);
