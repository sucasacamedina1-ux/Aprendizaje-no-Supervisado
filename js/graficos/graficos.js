// Gráficos con SVG nativo (sin librerías externas)
// Cada gráfico usa viewBox (se adapta al ancho del contenedor) y se devuelve
// dentro de una tarjeta <div class="graf-tarjeta"> lista para mostrarGrafico().
// Los colores de estructura (ejes, rejilla, textos) vienen de css/graficos.css;
// los de las series se leen de las variables --graf-* de css/variables.css.

var SVG_NS = "http://www.w3.org/2000/svg";

// Tamaño del sistema de coordenadas de todos los gráficos
var GRAF_ANCHO = 720;
var GRAF_ALTO = 420;

// Medidas aproximadas de texto (para calcular márgenes sin medir en el DOM)
var GRAF_ANCHO_CARACTER = 6.6;
var GRAF_FUENTE = "Inter, Arial, sans-serif";

// Paleta de series en orden de uso: [variable CSS, valor de respaldo acordado]
var GRAF_PALETA = [
  ["--graf-azul", "#3b82f6"],
  ["--graf-purpura", "#8b5cf6"],
  ["--graf-esmeralda", "#10b981"],
  ["--graf-coral", "#f43f5e"]
];

// Contador para ids únicos (clipPath) cuando hay varios gráficos en la página
var grafContadorIds = 0;

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

// Añade un texto; la clase define su color (por defecto, texto secundario)
function svgTexto(padre, x, y, texto, tamano, anclaje, clase) {
  var t = svgElemento("text", {
    x: x,
    y: y,
    "font-size": tamano || 12,
    "font-family": GRAF_FUENTE,
    "text-anchor": anclaje,
    "class": "graf-texto" + (clase ? " " + clase : "")
  }, padre);
  t.textContent = texto;
  return t;
}

// Añade una línea; el trazo lo da la clase CSS
function svgLinea(padre, x1, y1, x2, y2, clase) {
  return svgElemento("line", { x1: x1, y1: y1, x2: x2, y2: y2, "class": clase }, padre);
}

// Añade un círculo; color opcional para series (relleno)
function svgCirculo(padre, cx, cy, r, clase, color) {
  return svgElemento("circle", { cx: cx, cy: cy, r: r, "class": clase, fill: color }, padre);
}

// Recorta un texto largo con "…"
function recortarTexto(texto, maxCaracteres) {
  texto = String(texto);
  if (texto.length <= maxCaracteres) return texto;
  return texto.slice(0, Math.max(1, maxCaracteres - 1)) + "…";
}

// Redondea coordenadas a 2 decimales (SVG más liviano al exportar)
function redondear2(v) {
  return Math.round(v * 100) / 100;
}

// Retraso escalonado de la animación de entrada (con tope para datos grandes)
function retrasoAnimacion(el, indice, pasoMs, topeMs) {
  el.style.setProperty("--graf-retraso", Math.min(indice * pasoMs, topeMs) + "ms");
}

// =============================================================================
// COLORES
// =============================================================================

// Valor de una variable CSS de :root, o el respaldo si aún no existe
function colorVariable(nombre, respaldo) {
  var valor = "";
  try {
    valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  } catch (e) {
    valor = "";
  }
  return valor || respaldo;
}

// Convierte "#rgb", "#rrggbb" o "rgb(r, g, b)" a [r, g, b]; null si no se reconoce
function colorARgb(color) {
  var c = String(color).trim();
  var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (m) {
    var h = m[1].length === 3 ? m[1].replace(/(.)/g, "$1$1") : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// Mezcla un color con blanco (cantidad > 0) o con negro (cantidad < 0)
function variarColor(color, cantidad) {
  var rgb = colorARgb(color);
  if (!rgb) return color;
  var destino = cantidad > 0 ? 255 : 0;
  var t = Math.abs(cantidad);
  var partes = rgb.map(function (v) {
    var h = Math.round(v + (destino - v) * t).toString(16);
    return h.length === 1 ? "0" + h : h;
  });
  return "#" + partes.join("");
}

// Color de la serie i: primero la paleta; desde la 5.ª, versiones más oscuras y luego más claras
function colorSerie(i) {
  var base = GRAF_PALETA[i % GRAF_PALETA.length];
  var color = colorVariable(base[0], base[1]);
  var vuelta = Math.floor(i / GRAF_PALETA.length);
  if (vuelta === 0) return color;
  return variarColor(color, vuelta % 2 === 1 ? -0.35 * Math.ceil(vuelta / 2) : 0.35 * (vuelta / 2));
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

// Recorte al área de trazado (para elipses que podrían salirse)
function recorteArea(svg, area) {
  var id = "graf-recorte-" + (++grafContadorIds);
  var defs = svgElemento("defs", {}, svg);
  var clip = svgElemento("clipPath", { id: id }, defs);
  svgElemento("rect", {
    x: area.izquierda, y: area.arriba,
    width: area.derecha - area.izquierda, height: area.abajo - area.arriba
  }, clip);
  return "url(#" + id + ")";
}

// Título del gráfico centrado sobre el área
function dibujarTituloGrafico(svg, area, titulo) {
  var t = svgTexto(svg, area.ancho / 2, 26, recortarTexto(titulo, 80), 15, "middle", "graf-titulo");
  t.setAttribute("font-weight", "600");
  return t;
}

// Líneas guía punteadas: horizontales (ticks de Y) y, si hay escala X, verticales
function dibujarRejilla(svg, escalas, area) {
  var g = svgElemento("g", { "class": "graf-rejilla" }, svg);
  var i;
  if (escalas.y) {
    for (i = 0; i < escalas.y.ticks.length; i++) {
      var y = escalas.y(escalas.y.ticks[i]);
      if (Math.abs(y - area.abajo) > 0.5) svgLinea(g, area.izquierda, y, area.derecha, y, "graf-rejilla-linea");
    }
  }
  if (escalas.x) {
    for (i = 0; i < escalas.x.ticks.length; i++) {
      var x = escalas.x(escalas.x.ticks[i]);
      if (Math.abs(x - area.izquierda) > 0.5) svgLinea(g, x, area.arriba, x, area.abajo, "graf-rejilla-linea");
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
    svgLinea(g, area.izquierda, area.arriba, area.izquierda, area.abajo, "graf-eje");
    for (i = 0; i < escalas.y.ticks.length; i++) {
      var y = escalas.y(escalas.y.ticks[i]);
      svgLinea(g, area.izquierda - 5, y, area.izquierda, y, "graf-eje");
      var ty = svgTexto(g, area.izquierda - 8, y, formatearTick(escalas.y.ticks[i], escalas.y.paso), 11, "end", "graf-tick");
      ty.setAttribute("dy", "0.32em");
    }
  }

  // Eje X
  if (opciones.ejeX !== false) {
    svgLinea(g, area.izquierda, area.abajo, area.derecha, area.abajo, "graf-eje");
  }
  if (escalas.x) {
    for (i = 0; i < escalas.x.ticks.length; i++) {
      var x = escalas.x(escalas.x.ticks[i]);
      svgLinea(g, x, area.abajo, x, area.abajo + 5, "graf-eje");
      svgTexto(g, x, area.abajo + 19, formatearTick(escalas.x.ticks[i], escalas.x.paso), 11, "middle", "graf-tick");
    }
  }

  // Títulos de ejes (siempre dentro del viewBox)
  if (opciones.tituloX) {
    var tx = svgTexto(g, (area.izquierda + area.derecha) / 2, area.alto - 12, recortarTexto(opciones.tituloX, 70), 12, "middle", "graf-titulo-eje");
    tx.setAttribute("font-weight", "500");
  }
  if (opciones.tituloY) {
    var cy = (area.arriba + area.abajo) / 2;
    var tt = svgTexto(g, 18, cy, recortarTexto(opciones.tituloY, 45), 12, "middle", "graf-titulo-eje");
    tt.setAttribute("transform", "rotate(-90 18 " + cy + ")");
    tt.setAttribute("dy", "0.32em");
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
// MARCAS (barras, puntos, etiquetas)
// =============================================================================

// Barra con las esquinas superiores redondeadas; crece desde la base al animarse
function dibujarBarra(padre, x, y, ancho, alto, color, indice) {
  var r = Math.max(0, Math.min(4, ancho / 2, alto));
  var x2 = x + ancho;
  var base = y + alto;
  var d = "M" + redondear2(x) + "," + redondear2(base) +
    "V" + redondear2(y + r) +
    "Q" + redondear2(x) + "," + redondear2(y) + " " + redondear2(x + r) + "," + redondear2(y) +
    "H" + redondear2(x2 - r) +
    "Q" + redondear2(x2) + "," + redondear2(y) + " " + redondear2(x2) + "," + redondear2(y + r) +
    "V" + redondear2(base) + "Z";
  var barra = svgElemento("path", { d: d, fill: color, stroke: color, "class": "graf-barra" }, padre);
  retrasoAnimacion(barra, indice, 40, 600);
  return barra;
}

// Punto de datos con borde blanco (se distinguen al superponerse)
function dibujarPunto(padre, cx, cy, color, indice) {
  var p = svgCirculo(padre, redondear2(cx), redondear2(cy), 5.5, "graf-punto", color);
  retrasoAnimacion(p, indice, 12, 500);
  return p;
}

// Etiqueta con fondo redondeado para que se lea sobre los datos; "partes" son
// trozos de texto que se separan con un espacio fijo (SVG junta los espacios)
function dibujarEtiquetaConFondo(padre, x, y, partes, anclaje, clase) {
  var g = svgElemento("g", { "class": "graf-etiqueta" }, padre);
  var separacion = 14;
  var caracteres = partes.join("").length;
  var ancho = caracteres * 6.2 + separacion * (partes.length - 1) + 18;
  var izquierda = anclaje === "end" ? x - ancho : x;
  svgElemento("rect", { x: izquierda, y: y - 12, width: ancho, height: 24, rx: 6, "class": "graf-etiqueta-fondo" }, g);
  var t = svgTexto(g, izquierda + 9, y, "", 11.5, "start", clase);
  t.setAttribute("dy", "0.32em");
  for (var i = 0; i < partes.length; i++) {
    var trozo = svgElemento("tspan", { dx: i > 0 ? separacion : null }, t);
    trozo.textContent = partes[i];
  }
  return g;
}

// Coeficiente con 4 cifras significativas, sin ceros sobrantes (1.2e-7 → 1.2×10⁻⁷)
function formatearCoeficiente(v) {
  var texto = String(Number(Number(v).toPrecision(4)));
  var partes = texto.split("e");
  if (partes.length === 1) return texto;
  var superindices = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  var exponente = partes[1].replace("+", "").replace(/./g, function (c) { return superindices[c] || c; });
  return partes[0] + "×10" + exponente;
}

// Elipse de dispersión de un grupo (≈95 % si los datos fueran normales), en píxeles
function dibujarElipseGrupo(padre, puntos, color) {
  var n = puntos.length;
  if (n === 0) return null;
  var mx = 0;
  var my = 0;
  for (var i = 0; i < n; i++) { mx += puntos[i][0]; my += puntos[i][1]; }
  mx /= n;
  my /= n;

  var sxx = 0;
  var syy = 0;
  var sxy = 0;
  for (var j = 0; j < n; j++) {
    var dx = puntos[j][0] - mx;
    var dy = puntos[j][1] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n;
  syy /= n;
  sxy /= n;

  // Valores propios de la matriz de covarianza 2×2 → semiejes y giro
  var medio = (sxx + syy) / 2;
  var radical = Math.sqrt(Math.pow((sxx - syy) / 2, 2) + sxy * sxy);
  var l1 = medio + radical;
  var l2 = Math.max(0, medio - radical);
  var angulo = 0.5 * Math.atan2(2 * sxy, sxx - syy) * 180 / Math.PI;
  var k = 2.45; // raíz de chi² con 2 g.l. al 95 %
  var holgura = 9; // para que el borde no corte los puntos

  return svgElemento("ellipse", {
    cx: redondear2(mx),
    cy: redondear2(my),
    rx: redondear2(Math.max(16, k * Math.sqrt(l1) + holgura)),
    ry: redondear2(Math.max(16, k * Math.sqrt(l2) + holgura)),
    transform: "rotate(" + redondear2(angulo) + " " + redondear2(mx) + " " + redondear2(my) + ")",
    fill: color,
    stroke: color,
    "class": "graf-elipse"
  }, padre);
}

// Marca "×" para centroides/medoides, con halo blanco para que resalte
function dibujarCruz(padre, cx, cy, color) {
  var g = svgElemento("g", { "class": "graf-centroide" }, padre);
  var t = 6;
  svgLinea(g, cx - t, cy - t, cx + t, cy + t, "graf-centroide-halo");
  svgLinea(g, cx - t, cy + t, cx + t, cy - t, "graf-centroide-halo");
  svgElemento("line", { x1: cx - t, y1: cy - t, x2: cx + t, y2: cy + t, stroke: color, "class": "graf-centroide-trazo" }, g);
  svgElemento("line", { x1: cx - t, y1: cy + t, x2: cx + t, y2: cy - t, stroke: color, "class": "graf-centroide-trazo" }, g);
  return g;
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

  var color = colorSerie(0);
  var g = svgElemento("g", { "class": "graf-barras" }, svg);
  for (var j = 0; j < intervalos.length; j++) {
    var it = intervalos[j];
    var li = intervalos.length === 1 && it.limiteInferior === it.limiteSuperior ? desde : it.limiteInferior;
    var ls = intervalos.length === 1 && it.limiteInferior === it.limiteSuperior ? hasta : it.limiteSuperior;
    var x = escX(li) + 1;
    var anchoBarra = Math.max(1, escX(ls) - escX(li) - 2);
    var y = escY(it.absoluta);
    if (it.absoluta > 0) dibujarBarra(g, x, y, anchoBarra, area.abajo - y, color, j);

    if (it.absoluta > 0 && anchoBarra >= 14) {
      svgTexto(g, x + anchoBarra / 2, y - 6, String(it.absoluta), 10.5, "middle", "graf-valor");
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
  var ejeX = svgElemento("g", { "class": "graf-ejes" }, svg);
  for (var e = 0; e < limites.length; e += salto) {
    var xe = escX(limites[e]);
    svgLinea(ejeX, xe, area.abajo, xe, area.abajo + 5, "graf-eje");
    svgTexto(ejeX, xe, area.abajo + 19, formatearNumero(limites[e], decimales), 11, "middle", "graf-tick");
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
  var separacion = Math.min(anchoBanda * 0.25, 18);
  var salto = rotar ? Math.max(1, Math.ceil(13 / anchoBanda)) : 1;
  var color = colorSerie(0);
  var g = svgElemento("g", { "class": "graf-barras" }, svg);

  for (var j = 0; j < filas.length; j++) {
    var f = filas[j];
    var x = area.izquierda + j * anchoBanda + separacion / 2;
    var anchoBarra = Math.max(1, anchoBanda - separacion);
    var y = escY(f.absoluta);
    if (f.absoluta > 0) dibujarBarra(g, x, y, anchoBarra, area.abajo - y, color, j);

    if (f.absoluta > 0 && anchoBarra >= 14) {
      svgTexto(g, x + anchoBarra / 2, y - 6, String(f.absoluta), 10.5, "middle", "graf-valor");
    }
    if (j % salto !== 0) continue;
    var cx = x + anchoBarra / 2;
    var etiqueta = svgTexto(g, cx, area.abajo + 18, recortarTexto(f.valor, 14), 11, rotar ? "end" : "middle", "graf-tick");
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

  var color = colorSerie(0);
  var g = svgElemento("g", { "class": "graf-caja" }, svg);
  var cx = (area.izquierda + area.derecha) / 2;
  var anchoCaja = 120;
  var anchoBigote = 44;

  // Bigotes (de la caja al min y al max) con sus topes
  svgLinea(g, cx, escY(max), cx, escY(q3), "graf-bigote");
  svgLinea(g, cx - anchoBigote / 2, escY(max), cx + anchoBigote / 2, escY(max), "graf-bigote");
  svgLinea(g, cx, escY(q1), cx, escY(min), "graf-bigote");
  svgLinea(g, cx - anchoBigote / 2, escY(min), cx + anchoBigote / 2, escY(min), "graf-bigote");

  // Caja (q3 a q1) con relleno suave
  svgElemento("rect", {
    x: cx - anchoCaja / 2,
    y: escY(q3),
    width: anchoCaja,
    height: Math.max(0, escY(q1) - escY(q3)),
    rx: 4,
    fill: color,
    stroke: color,
    "class": "graf-caja-rect"
  }, g);

  // Mediana (q2)
  svgLinea(g, cx - anchoCaja / 2, escY(q2), cx + anchoCaja / 2, escY(q2), "graf-mediana");

  // Atípicos como puntos huecos
  for (var k = 0; k < atipicos.length; k++) {
    svgCirculo(g, cx, escY(atipicos[k]), 4, "graf-atipico");
  }

  // Etiquetas de los cuantiles (a la derecha de la caja), separadas si quedan muy juntas
  var xEtiqueta = cx + anchoCaja / 2 + 14;
  var etiquetas = [["máx", max], ["Q3", q3], ["Mediana", q2], ["Q1", q1], ["mín", min]];
  var posiciones = separarEtiquetas(etiquetas.map(function (et) { return escY(et[1]); }), 15, area.arriba, area.abajo);
  for (var e = 0; e < etiquetas.length; e++) {
    var te = svgTexto(g, xEtiqueta, posiciones[e], etiquetas[e][0] + " = " + formatearNumero(etiquetas[e][1], 2), 11, "start", e === 2 ? "graf-valor-fuerte" : "graf-valor");
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
  var color = colorSerie(0);
  var puntos = svgElemento("g", { "class": "graf-puntos" }, svg);
  for (var i = 0; i < x.length; i++) {
    dibujarPunto(puntos, escX(x[i]), escY(y[i]), color, i);
  }

  // Recta de regresión con su ecuación y R²
  if (reg) {
    svgLinea(svg, escX(rx.min), escY(reg.b0 + reg.b1 * rx.min), escX(rx.max), escY(reg.b0 + reg.b1 * rx.max), "graf-recta");

    var signo = reg.b1 < 0 ? " − " : " + ";
    var partes = ["Ŷ = " + formatearCoeficiente(reg.b0) + signo + formatearCoeficiente(Math.abs(reg.b1)) + "·X"];
    if (reg.r2 !== null && reg.r2 !== undefined) partes.push("R² = " + formatearNumero(reg.r2, 3));
    // Pendiente positiva: la esquina superior izquierda suele quedar libre; negativa: la derecha
    var aLaDerecha = reg.b1 < 0;
    dibujarEtiquetaConFondo(svg, aLaDerecha ? plano.area.derecha - 8 : plano.area.izquierda + 8, plano.area.arriba + 16, partes, aLaDerecha ? "end" : "start", "graf-etiqueta-recta");
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

  // Puntos de cada cluster en píxeles (para las elipses)
  var grupos = [];
  for (var j = 0; j < matriz.length; j++) {
    var gr = asignaciones[j];
    if (!grupos[gr]) grupos[gr] = [];
    grupos[gr].push([escX(xs[j]), escY(ys[j])]);
  }

  // Elipses punteadas semitransparentes (recortadas al área de trazado)
  var elipses = svgElemento("g", { "class": "graf-elipses", "clip-path": recorteArea(svg, plano.area) }, svg);
  for (var e = 0; e < grupos.length; e++) {
    if (grupos[e]) dibujarElipseGrupo(elipses, grupos[e], colorSerie(e));
  }

  // Puntos
  var puntos = svgElemento("g", { "class": "graf-puntos" }, svg);
  for (var p = 0; p < matriz.length; p++) {
    dibujarPunto(puntos, escX(xs[p]), escY(ys[p]), colorSerie(asignaciones[p]), p);
  }

  // Centroides o medoides marcados con "×"
  if (centroides) {
    var marcas = svgElemento("g", { "class": "graf-centroides" }, svg);
    for (var c2 = 0; c2 < centroides.length; c2++) {
      var cx = escX(centroides[c2][0]);
      var cy = escY(centroides[c2][1]);
      dibujarCruz(marcas, cx, cy, colorSerie(c2));
      // La etiqueta va al lado con más espacio para no salirse del área
      var aLaIzquierda = cx > plano.area.derecha - 30;
      var te = svgTexto(marcas, aLaIzquierda ? cx - 10 : cx + 10, cy, "C" + (c2 + 1), 11, aLaIzquierda ? "end" : "start", "graf-valor-fuerte graf-halo");
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
