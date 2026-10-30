// Estructura de datos común y renderizado de la tabla editable
// Esta estructura es la fuente de verdad para todos los módulos.

var datos = {
  columnas: [
    { nombre: "Edad", tipo: "numerica", valores: [18, 19, 20, 18] },
    { nombre: "Peso", tipo: "numerica", valores: [60, 65, 70, 58] },
    { nombre: "Nota", tipo: "numerica", valores: [14, 16, 15, 17] }
  ],
  filas: 4,
  seleccion: [],
  resultados: null
};

// Letra de columna estilo Excel: 0 → A, 25 → Z, 26 → AA
function letraColumna(indice) {
  var letra = "";
  indice++;
  while (indice > 0) {
    var resto = (indice - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    indice = Math.floor((indice - 1) / 26);
  }
  return letra;
}

// Escapa texto para insertarlo en HTML (nombres o celdas con comillas, <, &)
function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Icono "×" para los botones de eliminar
var TABLA_ICONO_ELIMINAR = "<svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'><path d='M7 7l10 10M17 7L7 17'/></svg>";

// Dibuja la tabla en el contenedor indicado (encabezados A, B, C… y filas 1, 2, 3…)
function dibujarTabla() {
  var contenedor = document.getElementById("contenedor-tabla");
  if (!contenedor) return;

  // Estado vacío: sin columnas o sin filas
  if (datos.columnas.length === 0 || datos.filas === 0) {
    contenedor.innerHTML =
      "<div class='tabla-vacio'>" +
      "<svg class='tabla-vacio-icono' viewBox='0 0 48 48' aria-hidden='true' focusable='false'>" +
      "<rect x='6' y='8' width='36' height='32' rx='4'/><path d='M6 18h36M6 28h36M18 8v32'/></svg>" +
      "<p class='tabla-vacio-titulo'>Aún no hay datos en la hoja</p>" +
      "<p class='tabla-vacio-texto'>Importa un archivo CSV o pega datos copiados desde Excel (Ctrl+V).</p>" +
      "<button type='button' class='tabla-btn tabla-btn--primario' onclick=\"document.getElementById('input-archivo').click()\">Importar CSV</button>" +
      "</div>";
    return;
  }

  var html = "<table class='tabla-hoja'>";

  // Fila de letras (A, B, C…) como en una hoja de cálculo
  html += "<thead><tr class='tabla-letras'>";
  html += "<th class='tabla-esquina' scope='col'><span class='tabla-oculto'>Número de fila</span></th>";
  for (var l = 0; l < datos.columnas.length; l++) {
    html += "<th class='tabla-letra' scope='col'>" + letraColumna(l) + "</th>";
  }
  html += "<th class='tabla-letra tabla-col-acciones' scope='col'><span class='tabla-oculto'>Acciones</span></th>";
  html += "</tr>";

  // Fila de nombres de variables (editables) con botón eliminar columna
  html += "<tr class='tabla-nombres'><th class='tabla-num' scope='col'>#</th>";
  for (var c = 0; c < datos.columnas.length; c++) {
    var nombre = escaparHTML(datos.columnas[c].nombre);
    html += "<th scope='col'><div class='tabla-encabezado'>";
    html += "<input type='text' class='tabla-nombre' size='10' value='" + nombre + "' ";
    html += "aria-label='Nombre de la columna " + letraColumna(c) + "' ";
    html += "onchange='cambiarNombreColumna(" + c + ", this.value)'>";
    html += "<button type='button' class='tabla-eliminar' onclick='eliminarColumna(" + c + ")' ";
    html += "aria-label='Eliminar columna " + nombre + "' title='Eliminar columna'>" + TABLA_ICONO_ELIMINAR + "</button>";
    html += "</div></th>";
  }
  html += "<th class='tabla-col-acciones' scope='col'><span class='tabla-oculto'>Acciones</span></th>";
  html += "</tr></thead>";

  // Cuerpo con celdas editables (números a la derecha, texto a la izquierda)
  html += "<tbody>";
  for (var f = 0; f < datos.filas; f++) {
    html += "<tr>";
    html += "<th class='tabla-num' scope='row'>" + (f + 1) + "</th>";
    for (var c2 = 0; c2 < datos.columnas.length; c2++) {
      var valor = datos.columnas[c2].valores[f];
      var esNumero = typeof valor === "number";
      if (valor === undefined || valor === null) valor = "";
      html += "<td class='tabla-celda" + (esNumero ? " tabla-celda--num" : "") + "'>";
      html += "<input type='text' size='8' value='" + escaparHTML(valor) + "' ";
      html += "aria-label='Fila " + (f + 1) + ", " + escaparHTML(datos.columnas[c2].nombre) + "' ";
      html += "onchange='cambiarCelda(" + f + "," + c2 + ", this.value)'>";
      html += "</td>";
    }
    html += "<td class='tabla-acciones'><button type='button' class='tabla-eliminar' onclick='eliminarFila(" + f + ")' ";
    html += "aria-label='Eliminar fila " + (f + 1) + "' title='Eliminar fila'>" + TABLA_ICONO_ELIMINAR + "</button></td>";
    html += "</tr>";
  }
  html += "</tbody></table>";

  contenedor.innerHTML = html;
}

// Cambia el valor de una celda en la estructura de datos
function cambiarCelda(fila, columna, valor) {
  if (valor === "") {
    datos.columnas[columna].valores[fila] = null;
  } else {
    var num = Number(valor);
    if (!isNaN(num) && valor.trim() !== "") {
      datos.columnas[columna].valores[fila] = num;
    } else {
      datos.columnas[columna].valores[fila] = valor;
    }
  }
  actualizarAlineacionCelda(fila, columna);
}

// Números a la derecha y texto a la izquierda también al editar una celda
function actualizarAlineacionCelda(fila, columna) {
  var contenedor = document.getElementById("contenedor-tabla");
  if (!contenedor) return;
  var filaTabla = contenedor.querySelectorAll("tbody tr")[fila];
  var celda = filaTabla ? filaTabla.querySelectorAll("td.tabla-celda")[columna] : null;
  if (celda) celda.classList.toggle("tabla-celda--num", typeof datos.columnas[columna].valores[fila] === "number");
}

// Cambia el nombre de una columna
function cambiarNombreColumna(columna, nombre) {
  datos.columnas[columna].nombre = nombre;
}

// Agrega una fila vacía
function agregarFila() {
  for (var c = 0; c < datos.columnas.length; c++) {
    datos.columnas[c].valores.push(null);
  }
  datos.filas++;
  dibujarTabla();
}

// Agrega una columna vacía
function agregarColumna() {
  var nuevoNombre = "C" + (datos.columnas.length + 1);
  var nuevaColumna = { nombre: nuevoNombre, tipo: "numerica", valores: [] };
  for (var f = 0; f < datos.filas; f++) {
    nuevaColumna.valores.push(null);
  }
  datos.columnas.push(nuevaColumna);
  dibujarTabla();
}

// Elimina una fila con confirmación
function eliminarFila(fila) {
  if (!confirm("¿Eliminar la fila " + (fila + 1) + "?")) return;
  for (var c = 0; c < datos.columnas.length; c++) {
    datos.columnas[c].valores.splice(fila, 1);
  }
  datos.filas--;
  dibujarTabla();
}

// Elimina una columna con confirmación
function eliminarColumna(columna) {
  if (!confirm("¿Eliminar la columna " + datos.columnas[columna].nombre + "?")) return;
  datos.columnas.splice(columna, 1);
  dibujarTabla();
}

// Reemplaza toda la estructura de datos (usado por importación)
function reemplazarDatos(nuevasColumnas) {
  datos.columnas = nuevasColumnas;
  datos.filas = 0;
  if (nuevasColumnas.length > 0) {
    datos.filas = nuevasColumnas[0].valores.length;
  }
  datos.seleccion = [];
  datos.resultados = null;
  dibujarTabla();
}