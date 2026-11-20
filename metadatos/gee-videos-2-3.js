/******************************************************************************
 * A4 · WATTS a WOW · Equipos 2 y 3 · 11-nov-2026
 * Pegar en https://code.earthengine.google.com/ · Run · Tasks > RUN cada tarea.
 * Destino Drive: carpeta WATTS_WOW_GEE_V23.
 * Los meses ausentes se exportan enmascarados; nunca se convierten en ceros.
 ******************************************************************************/
var CARPETA = 'WATTS_WOW_GEE_V23';
var region = ee.Geometry.Rectangle([-82, -5.5, -66, 13.5], null, false);
var lsib = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
var colombia = lsib.filter(ee.Filter.eq('country_na', 'Colombia'));
var vecinos = lsib.filter(ee.Filter.inList('country_na', ['Ecuador','Peru','Panama','Venezuela']));
var diagnostico = [];
function meses(ini,fin) {
  var out=[],d=new Date(ini+'T00:00:00Z'),e=new Date(fin+'T00:00:00Z');
  while(d<e){out.push(d.toISOString().slice(0,7));d.setUTCMonth(d.getUTCMonth()+1);}
  return out;
}
function vacia(banda){return ee.Image.constant(0).rename(banda).updateMask(ee.Image.constant(0));}
function bandaMes(ym){return 'm'+ym.replace('-','_');}
function apilar(lista,fn){return ee.ImageCollection.fromImages(lista.map(function(ym){return fn(ym).rename(bandaMes(ym));})).toBands().rename(lista.map(bandaMes));}
function exportar(img,nombre,geom,escala){Export.image.toDrive({image:img.toFloat(),description:nombre,folder:CARPETA,fileNamePrefix:nombre,region:geom,scale:escala,crs:'EPSG:4326',maxPixels:1e13,fileFormat:'GeoTIFF',formatOptions:{cloudOptimized:true,noData:-9999}});}

// 01 · ERA5-Land: la banda *_sum contiene SUMA mensual de J/m².
// Sumar los 12 meses y dividir por días DEL AÑO y 3.6e6. No dividir por 24.
var era=ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR').select('surface_solar_radiation_downwards_sum');
var anuales=[];var nombres=[];
for(var y=2020;y<=2025;y++){
  var inicio=ee.Date.fromYMD(y,1,1),fin=inicio.advance(1,'year');
  var col=era.filterDate(inicio,fin),n=col.size();
  var img=ee.Image(ee.Algorithms.If(n.eq(12),col.sum().divide(fin.difference(inicio,'day')).divide(3.6e6),vacia('surface_solar_radiation_downwards_sum')));
  // Acumulaciones negativas son artefactos conocidos: se enmascaran, no se recortan a cero.
  img=img.updateMask(img.gte(0)).clipToCollection(colombia).rename('y'+y);
  anuales.push(img);nombres.push('y'+y);
  diagnostico.push(ee.Feature(null,{producto:'ERA5_Land',periodo:String(y),imagenes:n,esperadas:12}));
}
exportar(ee.ImageCollection.fromImages(anuales).toBands().rename(nombres),'01_radiacion_anual_kWh_m2_dia_2020_2025',colombia.geometry(),11132);

// 02 · VIIRS: radiancia mensual y número de observaciones despejadas por separado.
// Un cero con cf_cvg=0 NO significa apagón. No atribuir variaciones a cortes sin
// contraste con nubosidad, calendario y datos oficiales; no es una película nocturna.
var viirs=ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG');
var mv=meses('2023-01-01','2025-07-01');
function viirsMes(ym,band){
  var d=ee.Date(ym+'-01'),c=viirs.filterDate(d,d.advance(1,'month'));
  var img=ee.Image(ee.Algorithms.If(c.size().gt(0),c.select(['avg_rad','cf_cvg']).mean(),vacia('avg_rad').addBands(vacia('cf_cvg'))));
  return band==='avg_rad'?img.select(band).updateMask(img.select('cf_cvg').gte(1)):img.select(band);
}
mv.forEach(function(ym){var d=ee.Date(ym+'-01');diagnostico.push(ee.Feature(null,{producto:'VIIRS',periodo:ym,imagenes:viirs.filterDate(d,d.advance(1,'month')).size(),esperadas:1}));});
exportar(apilar(mv,function(ym){return viirsMes(ym,'avg_rad');}),'02_VIIRS_radiancia_mensual_202301_202506',region,500);
exportar(apilar(mv,function(ym){return viirsMes(ym,'cf_cvg');}),'02b_VIIRS_observaciones_202301_202506',region,500);

// 03 · CHIRPS PENTAD: suma mensual mm; anomalía respecto al mismo mes 1991–2020.
// Se exige el número habitual de 6 pentadas por mes y 30 años de referencia.
var chirps=ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD').select('precipitation');
function lluvia(ym){var d=ee.Date(ym+'-01'),c=chirps.filterDate(d,d.advance(1,'month'));return ee.Image(ee.Algorithms.If(c.size().eq(6),c.sum(),vacia('precipitation'))).rename('precipitation');}
var clima={};
for(var m=1;m<=12;m++){
  var imgs=[];
  for(var a=1991;a<=2020;a++)imgs.push(lluvia(a+'-'+('0'+m).slice(-2)));
  var ic=ee.ImageCollection.fromImages(imgs);
  clima[m]=ic.mean().updateMask(ic.count().eq(30));
}
var mc=meses('2023-01-01','2026-01-01');
var anom=apilar(mc,function(ym){
  var normal=clima[Number(ym.slice(5))],actual=lluvia(ym);
  var d=ee.Date(ym+'-01');diagnostico.push(ee.Feature(null,{producto:'CHIRPS',periodo:ym,imagenes:chirps.filterDate(d,d.advance(1,'month')).size(),esperadas:6}));
  return actual.subtract(normal).divide(normal).multiply(100).updateMask(normal.gt(0));
});
exportar(anom,'03_CHIRPS_anomalia_pct_2023_2025_base1991_2020',region,5566);

// 04 · Límites: LSIB simplificado 2017, no demarcación legal de precisión.
Export.table.toDrive({collection:vecinos,description:'04_limites_vecinos_LSIB',folder:CARPETA,fileFormat:'GeoJSON'});
Export.table.toDrive({collection:vecinos,description:'04b_limites_vecinos_LSIB_SHP',folder:CARPETA,fileFormat:'SHP'});
Export.table.toDrive({collection:ee.FeatureCollection(diagnostico),description:'00_cobertura_productos',folder:CARPETA,fileFormat:'CSV',selectors:['producto','periodo','imagenes','esperadas']});
Map.centerObject(colombia,5);
Map.addLayer(anuales[5],{min:2,max:6,palette:['173d6b','6ab7b0','ffe46b','ed8d2b']},'Radiación 2025 kWh/m²/día');
Map.addLayer(viirsMes('2024-10','avg_rad'),{min:0,max:30},'VIIRS octubre 2024',false);
Map.addLayer(anom.select('m2024_10'),{min:-80,max:80,palette:['a76a25','ffffff','277ab1']},'Lluvia anomalía octubre 2024',false);
Map.addLayer(vecinos.style({color:'35d6ee',fillColor:'00000000',width:1}),{},'Países vecinos');
print('Cobertura: revisar antes de usar los mapas',ee.FeatureCollection(diagnostico));
print('Destino Drive',CARPETA);
// Catálogos y metodología:
// https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_MONTHLY_AGGR
// https://developers.google.com/earth-engine/datasets/catalog/NOAA_VIIRS_DNB_MONTHLY_V1_VCMSLCFG
// https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_PENTAD
// https://developers.google.com/earth-engine/datasets/catalog/USDOS_LSIB_SIMPLE_2017
