// Gráficos con SVG nativo (sin librerías externas)
// Cada gráfico usa viewBox (se adapta al ancho del contenedor) y se devuelve
// dentro de una tarjeta <div class="graf-tarjeta"> lista para mostrarGrafico().

var SVG_NS = "http://www.w3.org/2000/svg";

// Tamaño del sistema de coordenadas de todos los gráficos
var GRAF_ANCHO = 720;
var GRAF_ALTO = 420;

// Medidas aproximadas de texto (para calcular márgenes sin medir en el DOM)
var GRAF_ANCHO_CARACTER = 6.6;
var GRAF_FUENTE = "Inter, Arial, sans-serif";

// =============================================================================
// HELPERS BÁSICOS
// =============================================================================

// Crea un elemento SVG con sus atributos y, si se indica, lo añade al padre
function svgElemento(tipo, atributos, padre) {
  var el = document.createElementNS(SVG_NS, tipo);
  for (var nombre in atributos) {
    if (atributos.hasOwnProperty(nombre) && atributos[nombre] !== undefined && atributos[nombre] !== null) {
      el.setAttribute(nombre, atributos[nombre]);
    }
  }
  if (padre) padre.appendChild(el);
  return el;
}

// Crea un SVG adaptable: el viewBox fija las coordenadas y el CSS da el ancho real
function crearSVG(ancho, alto) {
  return svgElemento("svg", {
    viewBox: "0 0 " + ancho + " " + alto,
    preserveAspectRatio: "xMidYMid meet",
    width: "100%",
    "class": "graf-svg"
  });
}

// Envuelve el SVG en la tarjeta que se muestra en el panel de resultados
function crearTarjetaGrafico(svg, tipo, titulo) {
  var tarjeta = document.createElement("div");
  tarjeta.className = "graf-tarjeta";
  tarjeta.setAttribute("data-tipo", tipo);
  tarjeta.setAttribute("data-titulo", titulo);

  var cuerpo = document.createElement("div");
  cuerpo.className = "graf-cuerpo";
  cuerpo.appendChild(svg);
  tarjeta.appendChild(cuerpo);
  return tarjeta;
}

// Añade un texto al SVG
function svgTexto(svg, x, y, texto, tamano, anclaje) {
  var t = svgElemento("text", {
    x: x,
    y: y,
    "font-size": tamano || 12,
    "font-family": GRAF_FUENTE,
    fill: "#334155",
    "text-anchor": anclaje,
    "class": "graf-texto"
  }, svg);
  t.textContent = texto;
  return t;
}

// Añade una línea al SVG
function svgLinea(svg, x1, y1, x2, y2, color, grosor) {
  return svgElemento("line", {
    x1: x1, y1: y1, x2: x2, y2: y2,
    stroke: color || "#333",
    "stroke-width": grosor || 1
  }, svg);
}

// Añade un rectángulo al SVG
function svgRect(svg, x, y, ancho, alto, color, borde) {
  return svgElemento("rect", {
    x: x, y: y,
    width: Math.max(0, ancho),
    height: Math.max(0, alto),
    fill: color,
    stroke: borde
  }, svg);
}

// Añade un círculo al SVG
function svgCirculo(svg, cx, cy, r, color, borde) {
  return svgElemento("circle", { cx: cx, cy: cy, r: r, fill: color, stroke: borde }, svg);
}

// Escala lineal simple (se conserva por compatibilidad)
function escalar(valor, min, max, rangoPixeles) {
  if (max === min) return rangoPixeles / 2;
  return ((valor - min) / (max - min)) * rangoPixeles;
}

// Recorta un texto largo con "…"
function recortarTexto(texto, maxCaracteres) {
  texto = String(texto);
  if (texto.length <= maxCaracteres) return texto;
  return texto.slice(0, Math.max(1, maxCaracteres - 1)) + "…";
}

// =============================================================================
// ESCALAS Y TICKS
// =============================================================================

// Escala lineal: convierte un valor del dominio [d0, d1] al rango de píxeles [r0, r1]
function escalaLineal(dominio, rango) {
  var d0 = dominio[0];
  var d1 = dominio[1];
  var r0 = rango[0];
  var r1 = rango[1];
  var escala = function (v) {
    if (d1 === d0) return (r0 + r1) / 2;
    return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  };
  escala.dominio = [d0, d1];
  escala.rango = [r0, r1];
  escala.ticks = [];
  escala.paso = 1;
  return escala;
}

// Paso "bonito" (1, 2 o 5 × 10^n) para dividir un rango en unas n partes
function pasoBonito(rango, n) {
  var bruto = rango / Math.max(1, n);
  var potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  var f = bruto / potencia;
  var base = f <= 1 ? 1 : (f <= 2 ? 2 : (f <= 5 ? 5 : 10));
  return base * potencia;
}

// Decimales necesarios para mostrar valores múltiplos de un paso
function decimalesPaso(paso) {
  return Math.max(0, -Math.floor(Math.log10(paso) + 1e-9));
}

// Texto de un tick con los decimales justos (evita "-0" y errores de coma flotante);
// con pasos grandes abrevia en miles (k) o millones (M)
function formatearTick(valor, paso) {
  var sufijo = "";
  if (paso >= 1e5) { valor /= 1e6; paso /= 1e6; sufijo = "M"; }
  else if (paso >= 1e3) { valor /= 1e3; paso /= 1e3; sufijo = "k"; }
  var texto = Number(valor).toFixed(decimalesPaso(paso));
  return Number(texto) === 0 ? "0" : texto + sufijo;
}

// Ticks bonitos que cubren [min, max]: devuelve dominio redondeado, paso y valores
function ticksBonitos(min, max, n, soloEnteros) {
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (max === min) {
    var holgura = Math.abs(min) * 0.1 || 1;
    min -= holgura;
    max += holgura;
  }
  var paso = pasoBonito(max - min, n || 5);
  if (soloEnteros && paso < 1) paso = 1;
  var inicio = Math.floor(min / paso + 1e-9) * paso;
  var fin = Math.ceil(max / paso - 1e-9) * paso;
  var decimales = decimalesPaso(paso);
  var valores = [];
  var cantidad = Math.round((fin - inicio) / paso);
  for (var i = 0; i <= cantidad; i++) {
    valores.push(Number((inicio + i * paso).toFixed(decimales)));
  }
  return { min: valores[0], max: valores[valores.length - 1], paso: paso, valores: valores };
}

// Ticks bonitos dejando una holgura (fracción del rango) entre los datos y los bordes
function ticksConHolgura(min, max, n, holgura) {
  var margenDatos = (max - min) * holgura;
  return ticksBonitos(min - margenDatos, max + margenDatos, n);
}

// Escala lineal cuyo dominio son los ticks bonitos (para pasarla a ejes y rejilla)
function escalaDeTicks(t, rango) {
  var escala = escalaLineal([t.min, t.max], rango);
  escala.ticks = t.valores;
  escala.paso = t.paso;
  return escala;
}

// Mínimo y máximo de un arreglo de números
function extremos(valores) {
  var min = Infinity;
  var max = -Infinity;
  for (var i = 0; i < valores.length; i++) {
    if (valores[i] < min) min = valores[i];
    if (valores[i] > max) max = valores[i];
  }
  return { min: min, max: max };
}

// =============================================================================
// ÁREA, EJES Y REJILLA
// =============================================================================

// Márgenes comunes; el izquierdo crece con el ancho de las etiquetas del eje Y
function margenGrafico(ticksY, pasoY, extra) {
  var maxCaracteres = 1;
  for (var i = 0; i < (ticksY || []).length; i++) {
    maxCaracteres = Math.max(maxCaracteres, formatearTick(ticksY[i], pasoY).length);
  }
  var margen = { arriba: 44, derecha: 28, abajo: 60, izquierda: Math.max(64, 44 + maxCaracteres * GRAF_ANCHO_CARACTER) };
  if (extra) {
    for (var lado in extra) {
      if (extra.hasOwnProperty(lado)) margen[lado] += extra[lado];
    }
  }
  return margen;
}

// Área de trazado: bordes en píxeles a partir del tamaño total y los márgenes
function areaGrafico(ancho, alto, margen) {
  return {
    ancho: ancho,
    alto: alto,
    izquierda: margen.izquierda,
    derecha: ancho - margen.derecha,
    arriba: margen.arriba,
    abajo: alto - margen.abajo
  };
}

// Título del gráfico centrado sobre el área
function dibujarTituloGrafico(svg, area, titulo) {
  var t = svgTexto(svg, area.ancho / 2, 26, recortarTexto(titulo, 80), 15, "middle");
  t.setAttribute("font-weight", "600");
  t.setAttribute("class", "graf-texto graf-titulo");
  return t;
}

// Líneas guía horizontales (ticks de Y) y, si hay escala X, verticales
function dibujarRejilla(svg, escalas, area) {
  var g = svgElemento("g", { "class": "graf-rejilla", stroke: "#e2e8f0", "stroke-width": 1 }, svg);
  var i;
  if (escalas.y) {
    for (i = 0; i < escalas.y.ticks.length; i++) {
      var y = escalas.y(escalas.y.ticks[i]);
      if (Math.abs(y - area.abajo) > 0.5) svgLinea(g, area.izquierda, y, area.derecha, y, "#e2e8f0", 1);
    }
  }
  if (escalas.x) {
    for (i = 0; i < escalas.x.ticks.length; i++) {
      var x = escalas.x(escalas.x.ticks[i]);
      if (Math.abs(x - area.izquierda) > 0.5) svgLinea(g, x, area.arriba, x, area.abajo, "#e2e8f0", 1);
    }
  }
  return g;
}

// Ejes con ticks y títulos. opciones: tituloX, tituloY, ejeX (false = sin línea X)
function dibujarEjes(svg, escalas, area, opciones) {
  opciones = opciones || {};
  var g = svgElemento("g", { "class": "graf-ejes" }, svg);
  var i;

  // Eje Y
  if (escalas.y) {
    svgLinea(g, area.izquierda, area.arriba, area.izquierda, area.abajo, "#94a3b8", 1);
    for (i = 0; i < escalas.y.ticks.length; i++) {
      var y = escalas.y(escalas.y.ticks[i]);
      svgLinea(g, area.izquierda - 5, y, area.izquierda, y, "#94a3b8", 1);
      var ty = svgTexto(g, area.izquierda - 8, y, formatearTick(escalas.y.ticks[i], escalas.y.paso), 11, "end");
      ty.setAttribute("dy", "0.32em");
    }
  }

  // Eje X
  if (opciones.ejeX !== false) {
    svgLinea(g, area.izquierda, area.abajo, area.derecha, area.abajo, "#94a3b8", 1);
  }
  if (escalas.x) {
    for (i = 0; i < escalas.x.ticks.length; i++) {
      var x = escalas.x(escalas.x.ticks[i]);
      svgLinea(g, x, area.abajo, x, area.abajo + 5, "#94a3b8", 1);
      svgTexto(g, x, area.abajo + 19, formatearTick(escalas.x.ticks[i], escalas.x.paso), 11, "middle");
    }
  }

  // Títulos de ejes (siempre dentro del viewBox)
  if (opciones.tituloX) {
    var tx = svgTexto(g, (area.izquierda + area.derecha) / 2, area.alto - 12, recortarTexto(opciones.tituloX, 70), 12, "middle");
    tx.setAttribute("class", "graf-texto graf-titulo-eje");
    tx.setAttribute("font-weight", "500");
  }
  if (opciones.tituloY) {
    var cy = (area.arriba + area.abajo) / 2;
    var tt = svgTexto(g, 18, cy, recortarTexto(opciones.tituloY, 45), 12, "middle");
    tt.setAttribute("transform", "rotate(-90 18 " + cy + ")");
    tt.setAttribute("dy", "0.32em");
    tt.setAttribute("class", "graf-texto graf-titulo-eje");
    tt.setAttribute("font-weight", "500");
  }
  return g;
}

// Cada cuántas etiquetas mostrar una para que no se encimen
function saltoEtiquetas(cantidad, espacio, maxCaracteres) {
  var necesario = maxCaracteres * GRAF_ANCHO_CARACTER + 8;
  return Math.max(1, Math.ceil(necesario / Math.max(1, espacio)));
}

// Reparte posiciones verticales (ordenadas de arriba a abajo) con una separación
// mínima, sin salir de [arriba, abajo]
function separarEtiquetas(ys, separacion, arriba, abajo) {
  var r = ys.slice();
  var i;
  for (i = 1; i < r.length; i++) r[i] = Math.max(r[i], r[i - 1] + separacion);
  if (r.length > 0 && r[r.length - 1] > abajo) r[r.length - 1] = abajo;
  for (i = r.length - 2; i >= 0; i--) r[i] = Math.min(r[i], r[i + 1] - separacion);
  if (r.length > 0 && r[0] < arriba) {
    r[0] = arriba;
    for (i = 1; i < r.length; i++) r[i] = Math.max(r[i], r[i - 1] + separacion);
  }
  return r;
}

// =============================================================================
// GRÁFICOS
// =============================================================================

// === HISTOGRAMA ===
function dibujarHistograma(valores, nombreVariable, numIntervalos) {
  var tabla = tablaFrecuenciasIntervalos(valores, numIntervalos);
  if (!tabla || tabla.intervalos.length === 0) return null;
  var intervalos = tabla.intervalos;

  var maxFrec = 0;
  for (var i = 0; i < intervalos.length; i++) {
    if (intervalos[i].absoluta > maxFrec) maxFrec = intervalos[i].absoluta;
  }

  var titulo = "Histograma: " + nombreVariable;
  var ejeY = ticksBonitos(0, Math.max(maxFrec * 1.08, 1), 5, true); // holgura para la etiqueta de la barra
  var area = areaGrafico(GRAF_ANCHO, GRAF_ALTO, margenGrafico(ejeY.valores, ejeY.paso));
  var svg = crearSVG(GRAF_ANCHO, GRAF_ALTO);
  dibujarTituloGrafico(svg, area, titulo);

  // Eje X continuo entre el primer y el último límite
  var desde = intervalos[0].limiteInferior;
  var hasta = intervalos[intervalos.length - 1].limiteSuperior;
  if (hasta === desde) { desde -= 0.5; hasta += 0.5; }
  var escX = escalaLineal([desde, hasta], [area.izquierda, area.derecha]);
  var escY = escalaDeTicks(ejeY, [area.abajo, area.arriba]);

  dibujarRejilla(svg, { y: escY }, area);
  dibujarEjes(svg, { y: escY }, area, { tituloX: nombreVariable, tituloY: "Frecuencia" });

  var g = svgElemento("g", { "class": "graf-barras" }, svg);
  for (var j = 0; j < intervalos.length; j++) {
    var it = intervalos[j];
    var li = intervalos.length === 1 && it.limiteInferior === it.limiteSuperior ? desde : it.limiteInferior;
    var ls = intervalos.length === 1 && it.limiteInferior === it.limiteSuperior ? hasta : it.limiteSuperior;
    var x = escX(li) + 1;
    var anchoBarra = Math.max(1, escX(ls) - escX(li) - 2);
    var y = escY(it.absoluta);
    svgRect(g, x, y, anchoBarra, area.abajo - y, "#3498db", "#2980b9");

    if (it.absoluta > 0 && anchoBarra >= 14) {
      svgTexto(g, x + anchoBarra / 2, y - 5, String(it.absoluta), 10, "middle");
    }
  }

  // Etiquetas en los límites de clase
  var amplitud = (hasta - desde) / intervalos.length;
  var decimales = Math.min(4, Math.max(1, decimalesPaso(amplitud) + 1));
  var limites = [intervalos[0].limiteInferior];
  for (var k = 0; k < intervalos.length; k++) limites.push(intervalos[k].limiteSuperior);
  if (intervalos.length === 1 && limites[0] === limites[1]) limites = [limites[0]];
  var maxCar = 1;
  for (var m = 0; m < limites.length; m++) maxCar = Math.max(maxCar, formatearNumero(limites[m], decimales).length);
  var salto = saltoEtiquetas(limites.length, (area.derecha - area.izquierda) / Math.max(1, limites.length - 1), maxCar);
  for (var e = 0; e < limites.length; e += salto) {
    var xe = escX(limites[e]);
    svgLinea(g, xe, area.abajo, xe, area.abajo + 5, "#94a3b8", 1);
    svgTexto(g, xe, area.abajo + 19, formatearNumero(limites[e], decimales), 11, "middle");
  }

  return crearTarjetaGrafico(svg, "histograma", titulo);
}

// === GRÁFICO DE BARRAS ===
function dibujarBarras(valores, nombreVariable) {
  var tabla = tablaFrecuencias(valores);
  if (!tabla || tabla.filas.length === 0) return null;
  var filas = tabla.filas;

  var maxFrec = 0;
  var maxCar = 1;
  for (var i = 0; i < filas.length; i++) {
    if (filas[i].absoluta > maxFrec) maxFrec = filas[i].absoluta;
    maxCar = Math.max(maxCar, String(filas[i].valor).length);
  }

  // Si las categorías no caben en horizontal, se rotan y se amplía el margen inferior
  var titulo = "Gráfico de barras: " + nombreVariable;
  var ejeY = ticksBonitos(0, Math.max(maxFrec * 1.08, 1), 5, true); // holgura para la etiqueta de la barra
  var margen = margenGrafico(ejeY.valores, ejeY.paso);
  var espacio = (GRAF_ANCHO - margen.izquierda - margen.derecha) / filas.length;
  var carVisibles = Math.min(maxCar, 14);
  var rotar = carVisibles * GRAF_ANCHO_CARACTER + 6 > espacio;
  if (rotar) margen.abajo += Math.round(carVisibles * GRAF_ANCHO_CARACTER * 0.64);

  var area = areaGrafico(GRAF_ANCHO, GRAF_ALTO, margen);
  var svg = crearSVG(GRAF_ANCHO, GRAF_ALTO);
  dibujarTituloGrafico(svg, area, titulo);

  var escY = escalaDeTicks(ejeY, [area.abajo, area.arriba]);
  dibujarRejilla(svg, { y: escY }, area);
  dibujarEjes(svg, { y: escY }, area, { tituloX: nombreVariable, tituloY: "Frecuencia" });

  var anchoBanda = (area.derecha - area.izquierda) / filas.length;
  var separacion = Math.min(anchoBanda * 0.2, 16);
  var salto = rotar ? Math.max(1, Math.ceil(13 / anchoBanda)) : 1;
  var g = svgElemento("g", { "class": "graf-barras" }, svg);

  for (var j = 0; j < filas.length; j++) {
    var f = filas[j];
    var x = area.izquierda + j * anchoBanda + separacion / 2;
    var anchoBarra = Math.max(1, anchoBanda - separacion);
    var y = escY(f.absoluta);
    svgRect(g, x, y, anchoBarra, area.abajo - y, "#1abc9c", "#16a085");

    if (f.absoluta > 0 && anchoBarra >= 14) {
      svgTexto(g, x + anchoBarra / 2, y - 5, String(f.absoluta), 10, "middle");
    }
    if (j % salto !== 0) continue;
    var cx = x + anchoBarra / 2;
    var etiqueta = svgTexto(g, cx, area.abajo + 18, recortarTexto(f.valor, 14), 11, rotar ? "end" : "middle");
    if (rotar) etiqueta.setAttribute("transform", "rotate(-40 " + cx + " " + (area.abajo + 18) + ")");
  }

  return crearTarjetaGrafico(svg, "barras", titulo);
}

// === DIAGRAMA DE CAJA Y BIGOTES ===
function dibujarCaja(valores, nombreVariable) {
  var validos = valoresNumericosValidos(valores);
  if (validos.length < 2) return null;

  var cuart = cuartiles(validos);
  var q1 = cuart.q1;
  var q2 = cuart.q2;
  var q3 = cuart.q3;
  var iqr = q3 - q1;
  var limInf = q1 - 1.5 * iqr;
  var limSup = q3 + 1.5 * iqr;

  // Bigotes: valores más extremos dentro de los límites
  var min = null;
  var max = null;
  for (var i = 0; i < validos.length; i++) {
    var v = validos[i];
    if (v >= limInf && (min === null || v < min)) min = v;
    if (v <= limSup && (max === null || v > max)) max = v;
  }
  if (min === null) min = q1;
  if (max === null) max = q3;

  // Atípicos
  var atipicos = [];
  for (var j = 0; j < validos.length; j++) {
    if (validos[j] < limInf || validos[j] > limSup) atipicos.push(validos[j]);
  }

  // Rango vertical
  var rango = extremos([min, max, q1, q3].concat(atipicos));
  var titulo = "Diagrama de caja: " + nombreVariable;
  var ejeY = ticksConHolgura(rango.min, rango.max, 5, 0.05);
  // Sin eje X: el margen inferior solo necesita separar la caja del borde
  var area = areaGrafico(GRAF_ANCHO, GRAF_ALTO, margenGrafico(ejeY.valores, ejeY.paso, { abajo: -36 }));
  var escY = escalaDeTicks(ejeY, [area.abajo, area.arriba]);

  var svg = crearSVG(GRAF_ANCHO, GRAF_ALTO);
  dibujarTituloGrafico(svg, area, titulo);
  dibujarRejilla(svg, { y: escY }, area);
  dibujarEjes(svg, { y: escY }, area, { tituloY: nombreVariable, ejeX: false });

  var g = svgElemento("g", { "class": "graf-caja" }, svg);
  var cx = (area.izquierda + area.derecha) / 2;
  var anchoCaja = 120;
  var anchoBigote = 48;

  // Bigote superior (max)
  svgLinea(g, cx, escY(max), cx, escY(q3), "#333", 1);
  svgLinea(g, cx - anchoBigote / 2, escY(max), cx + anchoBigote / 2, escY(max), "#333", 1);

  // Caja (q3 a q1)
  svgRect(g, cx - anchoCaja / 2, escY(q3), anchoCaja, escY(q1) - escY(q3), "#aed6f1", "#2980b9");

  // Mediana (q2)
  svgLinea(g, cx - anchoCaja / 2, escY(q2), cx + anchoCaja / 2, escY(q2), "#c0392b", 2);

  // Bigote inferior (min)
  svgLinea(g, cx, escY(q1), cx, escY(min), "#333", 1);
  svgLinea(g, cx - anchoBigote / 2, escY(min), cx + anchoBigote / 2, escY(min), "#333", 1);

  // Atípicos
  for (var k = 0; k < atipicos.length; k++) {
    svgCirculo(g, cx, escY(atipicos[k]), 3.5, "#e74c3c", "#c0392b");
  }

  // Etiquetas de los cuantiles (a la derecha de la caja), separadas si quedan muy juntas
  var xEtiqueta = cx + anchoCaja / 2 + 12;
  var etiquetas = [["max", max], ["Q3", q3], ["Q2", q2], ["Q1", q1], ["min", min]];
  var posiciones = separarEtiquetas(etiquetas.map(function (et) { return escY(et[1]); }), 15, area.arriba, area.abajo);
  for (var e = 0; e < etiquetas.length; e++) {
    var te = svgTexto(g, xEtiqueta, posiciones[e], etiquetas[e][0] + " = " + formatearNumero(etiquetas[e][1], 2), 11);
    te.setAttribute("dy", "0.32em");
  }

  return crearTarjetaGrafico(svg, "caja", titulo);
}

// === DISPERSIÓN (con o sin recta de regresión) ===
function dibujarDispersion(x, y, nombreX, nombreY, reg) {
  if (x.length !== y.length || x.length === 0) return null;

  var rx = extremos(x);
  var ry = extremos(y);

  // La recta se traza en el rango de X; sus extremos también deben caber en Y
  if (reg) {
    ry = extremos([ry.min, ry.max, reg.b0 + reg.b1 * rx.min, reg.b0 + reg.b1 * rx.max]);
  }

  var titulo = (reg ? "Dispersión con recta ajustada" : "Dispersión") + ": " + nombreX + " vs " + nombreY;
  var plano = prepararPlanoXY(rx, ry, titulo, nombreX, nombreY);
  var svg = plano.svg;
  var escX = plano.x;
  var escY = plano.y;

  // Puntos
  var puntos = svgElemento("g", { "class": "graf-puntos" }, svg);
  for (var i = 0; i < x.length; i++) {
    svgCirculo(puntos, escX(x[i]), escY(y[i]), 4.5, "#2980b9", "#1c5980");
  }

  // Recta de regresión
  if (reg) {
    var l = svgLinea(svg, escX(rx.min), escY(reg.b0 + reg.b1 * rx.min), escX(rx.max), escY(reg.b0 + reg.b1 * rx.max), "#c0392b", 2);
    l.setAttribute("class", "graf-recta");
  }

  return crearTarjetaGrafico(svg, "dispersion", titulo);
}

// === GRÁFICO DE CLUSTERS ===
function dibujarClusters(matriz, asignaciones, nombresVariables, centroides, esMedoide) {
  if (matriz.length === 0 || matriz[0].length < 2) return null;

  // Solo las dos primeras variables
  var xs = [];
  var ys = [];
  for (var i = 0; i < matriz.length; i++) {
    xs.push(matriz[i][0]);
    ys.push(matriz[i][1]);
  }

  // Incluir centroides/medoides en el rango
  var todosX = xs.slice();
  var todosY = ys.slice();
  if (centroides) {
    for (var c = 0; c < centroides.length; c++) {
      todosX.push(centroides[c][0]);
      todosY.push(centroides[c][1]);
    }
  }

  var titulo = (esMedoide ? "Clusters (K-medoids)" : "Clusters (K-means)") + ": " + nombresVariables[0] + " vs " + nombresVariables[1];
  var plano = prepararPlanoXY(extremos(todosX), extremos(todosY), titulo, nombresVariables[0], nombresVariables[1]);
  var svg = plano.svg;
  var escX = plano.x;
  var escY = plano.y;

  // Colores por cluster
  var colores = ["#e74c3c", "#3498db", "#27ae60", "#f39c12", "#8e44ad", "#16a085", "#d35400", "#2c3e50"];

  // Puntos
  var puntos = svgElemento("g", { "class": "graf-puntos" }, svg);
  for (var j = 0; j < matriz.length; j++) {
    var color = colores[asignaciones[j] % colores.length];
    svgCirculo(puntos, escX(xs[j]), escY(ys[j]), 4.5, color, "#222");
  }

  // Centroides o medoides
  if (centroides) {
    var marcas = svgElemento("g", { "class": "graf-centroides" }, svg);
    for (var c2 = 0; c2 < centroides.length; c2++) {
      var cx = escX(centroides[c2][0]);
      var cy = escY(centroides[c2][1]);
      svgRect(marcas, cx - 5, cy - 5, 10, 10, "#000", "#fff");
      // La etiqueta va al lado con más espacio para no salirse del área
      var aLaIzquierda = cx > plano.area.derecha - 30;
      var te = svgTexto(marcas, aLaIzquierda ? cx - 9 : cx + 9, cy, "C" + (c2 + 1), 11, aLaIzquierda ? "end" : "start");
      te.setAttribute("dy", "0.32em");
    }
  }

  return crearTarjetaGrafico(svg, "clusters", titulo);
}

// Plano cartesiano común a dispersión y clusters: escalas, rejilla y ejes
function prepararPlanoXY(rx, ry, titulo, nombreX, nombreY) {
  var ejeX = ticksConHolgura(rx.min, rx.max, 8, 0.05);
  var ejeY = ticksConHolgura(ry.min, ry.max, 6, 0.05);
  var area = areaGrafico(GRAF_ANCHO, GRAF_ALTO, margenGrafico(ejeY.valores, ejeY.paso));
  var escX = escalaDeTicks(ejeX, [area.izquierda, area.derecha]);
  var escY = escalaDeTicks(ejeY, [area.abajo, area.arriba]);

  var svg = crearSVG(GRAF_ANCHO, GRAF_ALTO);
  dibujarTituloGrafico(svg, area, titulo);
  dibujarRejilla(svg, { x: escX, y: escY }, area);
  dibujarEjes(svg, { x: escX, y: escY }, area, { tituloX: nombreX, tituloY: nombreY });
  return { svg: svg, area: area, x: escX, y: escY };
}
