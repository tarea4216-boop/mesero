// ✅ MÓDULO COMPLETO PARA MESERO 1 (adaptado para funcionar con múltiples meseros)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

// 🔐 Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAYXlV5SEgWfbRtacAEjec2Ve8x6hJtNBA",
  authDomain: "proyecto-restaurante-60eb0.firebaseapp.com",
  databaseURL: "https://proyecto-restaurante-60eb0-default-rtdb.firebaseio.com",
  projectId: "proyecto-restaurante-60eb0",
  storageBucket: "proyecto-restaurante-60eb0.appspot.com",
  messagingSenderId: "459872565031",
  appId: "1:459872565031:web:1633ecd0beb3c98a7c5b02",
  measurementId: "G-JDCPHQ94VV"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentMeseroEmail = "";

// Elementos DOM para autenticación
const loginSection = document.getElementById("loginSection");
const meseroSection = document.getElementById("meseroSection");

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const mesaInput = document.getElementById("mesaInput");
const buscarInput = document.getElementById("buscarInput");
const lista = document.getElementById("listaProductos");
const totalTexto = document.getElementById("totalTexto");

const verBoletaBtn = document.getElementById("verBoletaBtn");
const guardarBtn = document.getElementById("guardarBtn");
const editarBtn = document.getElementById("editarBtn");
const completarBtn = document.getElementById("completarBtn");
const verPendientesBtn = document.getElementById("verPendientesBtn");
const enviarWhatsappBtn = document.getElementById("enviarWhatsappBtn");

let productos = [];
let pedidosLocales = {};
let total = 0;

function actualizarUI(user) {
  if (user) {
    loginSection.style.display = "none";
    meseroSection.style.display = "block";
    currentMeseroEmail = user.email;
    cargarProductos();
  } else {
    loginSection.style.display = "block";
    meseroSection.style.display = "none";
    limpiarCampos();
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
    const rolRef = ref(db, 'roles/' + uid);
    get(rolRef).then((snapshot) => {
      if (snapshot.exists() && snapshot.val() === 'mesero') {
        actualizarUI(user);
      } else {
        alert("🚫 Acceso denegado: No tienes el rol de mesero.");
        signOut(auth);
      }
    });
  } else {
    actualizarUI(null);
  }
});

loginBtn.addEventListener("click", () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Por favor ingresa email y contraseña.");
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("✅ Inicio de sesión exitoso");
      emailInput.value = "";
      passwordInput.value = "";
    })
    .catch((error) => {
      alert("❌ Error al iniciar sesión: " + error.message);
    });
});

logoutBtn.addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      alert("✅ Has cerrado sesión");
    })
    .catch((error) => {
      alert("❌ Error al cerrar sesión: " + error.message);
    });
});

function limpiarCampos() {
  mesaInput.value = "";
  buscarInput.value = "";
  lista.innerHTML = "";
  totalTexto.textContent = "Total: S/ 0.00";
  total = 0;
}

function obtenerNumeroMesa() {
  const mesa = mesaInput.value.trim();
  if (!mesa) {
    alert("⚠️ Ingresa el número de mesa");
    return null;
  }
  return mesa;
}

function actualizarTotal(mesa) {
  const pedido = pedidosLocales[mesa] || [];
  total = pedido.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  totalTexto.textContent = `Total: S/ ${total.toFixed(2)}`;
}

buscarInput.addEventListener("input", () => {
  const texto = buscarInput.value.toLowerCase();
  lista.innerHTML = "";
  productos.filter(p => p.nombre.toLowerCase().includes(texto)).forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${p.nombre}</strong><br><small>${p.descripcion}</small>`;
    li.style.cursor = "pointer";
    li.onclick = () => seleccionarProducto(p);
    lista.appendChild(li);
  });
});

function seleccionarProducto(producto) {
  const mesa = obtenerNumeroMesa();
  if (!mesa) return;

  const cantidad = prompt(`¿Cuántos "${producto.nombre}"?`);
  if (!cantidad || isNaN(cantidad)) return;

  const comentario = prompt("Comentario (opcional):") || "";
  const cant = parseInt(cantidad);

  if (!pedidosLocales[mesa]) pedidosLocales[mesa] = [];

  const pedido = pedidosLocales[mesa];
  const existente = pedido.find(p => p.nombre === producto.nombre && p.comentario === comentario);
  if (existente) {
    existente.cantidad += cant;
  } else {
    pedido.push({ ...producto, cantidad: cant, comentario });
  }

  actualizarTotal(mesa);
}

function guardarPedido() {
  const mesa = obtenerNumeroMesa();
  if (!mesa) return;

  const pedidoNuevo = pedidosLocales[mesa];
  if (!pedidoNuevo || pedidoNuevo.length === 0) return alert("❗ No hay productos");

  const referencia = ref(db, "pedidos/" + mesa);
  get(referencia).then(snapshot => {
    let pedidoFinal = [];
    let totalFinal = 0;
    let creadoPor = currentMeseroEmail;

    if (snapshot.exists()) {
      const dataAnterior = snapshot.val();
      pedidoFinal = [...dataAnterior.items];
      creadoPor = dataAnterior.mesero;

      pedidoNuevo.forEach(nuevo => {
        const existente = pedidoFinal.find(p => p.nombre === nuevo.nombre && p.comentario === nuevo.comentario);
        if (existente) {
          existente.cantidad += nuevo.cantidad;
        } else {
          pedidoFinal.push(nuevo);
        }
      });
    } else {
      pedidoFinal = [...pedidoNuevo];
    }

    totalFinal = pedidoFinal.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

    set(referencia, {
      mesa,
      total: totalFinal,
      items: pedidoFinal,
      mesero: creadoPor,
      modificadoPor: currentMeseroEmail
    }).then(() => {
      alert(`✅ Pedido de mesa ${mesa} guardado correctamente`);
      limpiarCampos();
      delete pedidosLocales[mesa];
    });
  });
}

function verBoleta() {
  const mesa = prompt("Número de mesa:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  get(refMesa).then(snapshot => {
    if (!snapshot.exists()) return alert("❌ No hay pedido guardado");
    const datos = snapshot.val();
    let resumen = `Mesa ${mesa} (por ${datos.mesero}):\n\n`;
    let totalLocal = 0;
    datos.items.forEach((item, i) => {
      const sub = item.precio * item.cantidad;
      totalLocal += sub;
      resumen += `${i + 1}. ${item.nombre} x${item.cantidad} = S/ ${sub.toFixed(2)}\n`;
      if (item.comentario) resumen += `   (${item.comentario})\n`;
    });
    resumen += `\nTOTAL: S/ ${totalLocal.toFixed(2)}`;
    alert(resumen);
    limpiarCampos();
  });
}

function editarPedido() {
  const mesa = prompt("Mesa a editar:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  get(refMesa).then(snapshot => {
    if (!snapshot.exists()) return alert("❌ No hay pedido");
    const datos = snapshot.val();
    const pedido = datos.items;
    const seleccion = prompt(pedido.map((p, i) => `${i + 1}. ${p.nombre} x${p.cantidad}`).join("\n"));
    const index = parseInt(seleccion) - 1;
    if (isNaN(index) || index < 0 || index >= pedido.length) return;
    const accion = prompt("+, -, x:");
    if (accion === "+") pedido[index].cantidad++;
    else if (accion === "-") {
      pedido[index].cantidad--;
      if (pedido[index].cantidad <= 0) pedido.splice(index, 1);
    } else if (accion === "x") {
      pedido.splice(index, 1);
    }
    set(refMesa, {
      mesa,
      total: pedido.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
      items: pedido,
      mesero: datos.mesero,
      modificadoPor: currentMeseroEmail
    }).then(() => {
      alert("✏ Pedido actualizado");
      limpiarCampos();
    });
  });
}

function completarPedido() {
  const mesa = prompt("Número de mesa a completar:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  get(refMesa).then(snapshot => {
    if (!snapshot.exists()) return alert("❌ No hay pedido");
    const pedido = snapshot.val();
    const timestamp = Date.now();
    const refHistorial = ref(db, "historial");
    push(refHistorial, {
      ...pedido,
      fecha: timestamp
    }).then(() => {
      remove(refMesa).then(() => {
        alert(`✅ Pedido de mesa ${mesa} completado y archivado`);
        limpiarCampos();
      });
    });
  });
}

function verPedidosPendientes() {
  const referencia = ref(db, "pedidos");
  get(referencia).then(snapshot => {
    if (!snapshot.exists()) return alert("📭 No hay pedidos pendientes");
    const pedidos = snapshot.val();
    let resumen = "📋 Pedidos pendientes:\n\n";
    for (const mesa in pedidos) {
      resumen += `Mesa ${mesa} (por ${pedidos[mesa].mesero}):\n`;
      pedidos[mesa].items.forEach(item => {
        resumen += `  - ${item.nombre} x${item.cantidad}`;
        if (item.comentario) resumen += ` (${item.comentario})`;
        resumen += "\n";
      });
      resumen += `Total: S/ ${pedidos[mesa].total.toFixed(2)}\n\n`;
    }
    alert(resumen);
    limpiarCampos();
  });
}

function enviarBoletaWhatsapp() {
  const mesa = prompt("Número de mesa:");
  const numero = prompt("Número de WhatsApp del cliente (sin +51):");

  // Validaciones básicas
  if (!mesa || !numero || isNaN(numero)) {
    return alert("❌ Número de mesa o WhatsApp no válidos.");
  }

  const refHistorial = ref(db, "historial");

  get(refHistorial).then(snapshot => {
    if (!snapshot.exists()) return alert("❌ No hay historial de pedidos");

    const historial = Object.values(snapshot.val());
    const recientes = historial.filter(p => p.mesa === mesa && Date.now() - p.fecha < 180000);

    if (recientes.length === 0) {
      return alert("⚠️ No hay boleta reciente para esta mesa (menos de 3 min)");
    }

    const boleta = recientes[recientes.length - 1];

    // Construir mensaje
    let texto = `🍽 *Boleta - Mesa ${mesa}*\n\n`;
    boleta.items.forEach((item, i) => {
      texto += `${i + 1}. ${item.nombre} x${item.cantidad}`;
      if (item.comentario) texto += ` (${item.comentario})`;
      texto += `\n`;
    });

    texto += `\n💵 Total: S/ ${boleta.total.toFixed(2)}\n🕐 ${new Date(boleta.fecha).toLocaleString()}`;

    // Abrir WhatsApp con mensaje prellenado
    const link = `https://wa.me/51${numero}?text=${encodeURIComponent(texto)}`;
    window.open(link, "_blank");
  });
}

function cargarProductos() {
  const refProductos = ref(db, "productos");
  get(refProductos).then(snapshot => {
    if (!snapshot.exists()) return alert("❌ No hay productos cargados");
    productos = Object.values(snapshot.val());
    lista.innerHTML = "";
  });
}
// ---------------------- DIVIDIR / PAUSAR / REANUDAR (mejorado: confirmación por producto) ----------------------
// Estado global
let estadoDivision = "activa";
let datosDivisionTemporal = null;
let currentDivision = null; // { pedido, mesa, num, originalProductTotals, saldoProductos, pagosConfirmados, confirmadosFlags }

// Función auxiliar: redondeo 2 decimales
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// ✅ Función para finalizar división y guardar en historial
// (Se supone que ya tienes esta función en el script global; si no, adapta la llamada)
function finalizarDivision(pedido, mesa, formasPago) {
  const usuario = auth.currentUser;
  if (!usuario) return alert("⚠️ No estás autenticado.");

  const registroHistorial = {
    mesa: mesa,
    pedido: pedido,
    formasPago: formasPago,
    fecha: new Date().toISOString(),
    atendidoPor: usuario.email || usuario.uid
  };

  const refHistorial = ref(db, "historial/" + mesa + "_" + Date.now());

  set(refHistorial, registroHistorial)
    .then(() => remove(ref(db, "pedidos/" + mesa)))
    .then(() => remove(ref(db, "divisionTemporal/" + mesa)))
    .then(() => {
      alert("✅ División finalizada y guardada en historial.");
      estadoDivision = "activa";
      datosDivisionTemporal = null;
      currentDivision = null;
      document.getElementById("modalDividir").style.display = "none";
    })
    .catch(err => {
      console.error("Error al finalizar división:", err);
      alert("⚠️ Ocurrió un error al finalizar la división.");
    });
}

// Guardar división temporal (Firebase o local)
function guardarDivisionTemporal(formasPagoTemp, pedido, mesa, num) {
  const payload = {
    pedido,
    formasPagoTemp,
    mesa,
    num,
    timestamp: Date.now()
  };
  const refTemp = ref(db, "divisionTemporal/" + mesa);
  return set(refTemp, payload).then(() => ({ remote: true })).catch(err => {
    console.warn("No se pudo guardar en Firebase, guardando localmente:", err);
    try {
      localStorage.setItem("divisionTemporal_local_" + mesa, JSON.stringify(payload));
      return { remote: false };
    } catch (e) {
      console.error("Error guardando localmente:", e);
      throw err;
    }
  });
}

// Mostrar formulario de división (con botones "Pagar" por producto)
function mostrarFormularioDivision(pedido, mesa, invocacionDesdeFirebase = false, prefillFormas = null, numPrefill = null) {
  const productos = pedido.items || pedido.productos || [];
  if (!Array.isArray(productos) || productos.length === 0) return alert("No hay productos en el pedido.");

  // Determinar número de personas
  let num;
  if (numPrefill && Number.isInteger(numPrefill) && numPrefill > 0) {
    num = numPrefill;
  } else {
    const partes = prompt("¿Entre cuántas personas dividirás la cuenta?");
    num = parseInt(partes);
    if (!num || num < 1) return alert("Número no válido");
  }

  // Datos iniciales
  const originalProductTotals = productos.map(p =>
    round2((parseFloat(p.precio) || 0) * (parseInt(p.cantidad) || 1))
  );
  let saldoProductos = originalProductTotals.slice();

  const pagosConfirmados = Array.from({ length: num }, () => Array(productos.length).fill(0));
  const confirmadosFlags = Array.from({ length: num }, () => Array(productos.length).fill(false));

  currentDivision = { pedido, mesa, num, originalProductTotals, saldoProductos, pagosConfirmados, confirmadosFlags };

  const contenedor = document.getElementById("contenedorFormasPago");
  if (!contenedor) return alert("No se encontró contenedor del modal.");
  contenedor.innerHTML = "";

  // Resumen de productos
  let resumenHtml = `<div id="productosResumen">`;
  productos.forEach((p, j) => {
    resumenHtml += `
      <div class="resumen-producto">
        <strong>${p.nombre}</strong> — Total: S/ ${originalProductTotals[j].toFixed(2)} —
        <span id="prodSaldo_${j}">Restante: S/ ${saldoProductos[j].toFixed(2)}</span>
      </div>`;
  });
  resumenHtml += `</div>`;
  contenedor.insertAdjacentHTML("beforeend", resumenHtml);

  // Crear formulario por persona
  for (let i = 0; i < num; i++) {
    let rowHtml = `
      <div class="formulario-persona" data-index="${i}">
        <div class="persona-header">
          <strong>Persona ${i + 1}</strong>
          <div class="subtotal">Subtotal: S/ <span id="subtotal_${i}">0.00</span></div>
        </div>
        <div class="persona-instruccion">
          Ingrese cuánto pagará por cada producto y presione <em>Pagar</em> para reservar ese monto:
        </div>
    `;

    productos.forEach((prod, j) => {
      rowHtml += `
        <div class="producto-pago">
          <div class="producto-info">
            <strong>${prod.nombre}</strong> — S/ ${(parseFloat(prod.precio) * (prod.cantidad || 1)).toFixed(2)}
          </div>
          <div class="producto-input">
            <input type="number" min="0" step="0.01" id="pago_${i}_${j}" placeholder="0.00" />
          </div>
          <div class="producto-btn">
            <button id="btnPagar_${i}_${j}" class="pagar-btn">Pagar</button>
          </div>
          <div class="producto-confirm">
            <small id="conf_${i}_${j}" class="pago-confirmado"></small>
          </div>
        </div>
      `;
    });

    rowHtml += `
        <div class="metodo-pago">
          <label>Método:</label>
          <select id="metodo_${i}">
            <option value="efectivo" selected>Efectivo</option>
            <option value="Yape">Yape</option>
            <option value="Plin">Plin</option>
            <option value="tarjeta">Tarjeta</option>
          </select>

          <div id="efectivo_wrap_${i}" class="efectivo-wrap">
            <label>Monto entregado:</label>
            <input type="number" id="entregado_${i}" min="0" step="0.01" />
            <div><small id="vuelto_${i}" class="vuelto"></small></div>
          </div>
        </div>
      </div>
    `;
    contenedor.insertAdjacentHTML("beforeend", rowHtml);
  }

  // Mostrar modal
  document.getElementById("modalDividir").style.display = "flex";
  contenedor.scrollTop = 0; // Siempre desde Persona 1

  // Funciones auxiliares
  const updateProdSaldoUI = (j) => {
    const el = document.getElementById(`prodSaldo_${j}`);
    if (el) {
      const val = round2(saldoProductos[j]);
      el.textContent = val > 0 ? `Restante: S/ ${val.toFixed(2)}` : `Pagado`;
    }
  };

  const updateSubtotalUIForPerson = (i) => {
    let s = 0;
    for (let j = 0; j < productos.length; j++) {
      const val = parseFloat(document.getElementById(`pago_${i}_${j}`)?.value) || 0;
      s += val;
    }
    document.getElementById(`subtotal_${i}`).textContent = round2(s).toFixed(2);

    const entregado = parseFloat(document.getElementById(`entregado_${i}`)?.value);
    const vueltoSpan = document.getElementById(`vuelto_${i}`);
    if (!isNaN(entregado)) {
      const vuelto = round2(entregado - s);
      vueltoSpan.textContent = vuelto >= 0 ? `Vuelto: S/ ${vuelto.toFixed(2)}` : "Monto insuficiente";
    } else {
      vueltoSpan.textContent = "";
    }
  };

  // Eventos para cada persona y producto
  for (let i = 0; i < num; i++) {
    for (let j = 0; j < productos.length; j++) {
      const pagoInp = document.getElementById(`pago_${i}_${j}`);
      const btnPagar = document.getElementById(`btnPagar_${i}_${j}`);
      const confSpan = document.getElementById(`conf_${i}_${j}`);

      pagoInp.addEventListener("input", () => updateSubtotalUIForPerson(i));

      btnPagar.addEventListener("click", () => {
        const monto = round2(parseFloat(pagoInp.value) || 0);
        if (monto <= 0) return alert("Ingresa un monto mayor que 0 para confirmar.");
        if (monto > saldoProductos[j] + 0.0001) {
          return alert(`El monto excede el saldo para "${productos[j].nombre}". Saldo: S/ ${saldoProductos[j].toFixed(2)}`);
        }

        pagosConfirmados[i][j] = monto;
        confirmadosFlags[i][j] = true;
        saldoProductos[j] = round2(saldoProductos[j] - monto);

        pagoInp.disabled = true;
        btnPagar.disabled = true;

        confSpan.innerHTML = `✓ S/ ${monto.toFixed(2)} <button id="undo_${i}_${j}" class="deshacer-btn">↩</button>`;

        document.getElementById(`undo_${i}_${j}`).addEventListener("click", () => {
          saldoProductos[j] = round2(saldoProductos[j] + pagosConfirmados[i][j]);
          pagosConfirmados[i][j] = 0;
          confirmadosFlags[i][j] = false;

          pagoInp.disabled = false;
          btnPagar.disabled = false;
          pagoInp.value = "";
          confSpan.textContent = "";

          updateProdSaldoUI(j);
          updateSubtotalUIForPerson(i);
        });

        updateProdSaldoUI(j);
        updateSubtotalUIForPerson(i);
      });
    }

    const metodoSelect = document.getElementById(`metodo_${i}`);
    const efectivoWrap = document.getElementById(`efectivo_wrap_${i}`);
    const entregadoInput = document.getElementById(`entregado_${i}`);

    metodoSelect.addEventListener("change", function () {
      efectivoWrap.style.display = this.value === "efectivo" ? "block" : "none";
      if (this.value !== "efectivo") {
        entregadoInput.value = "";
        document.getElementById(`vuelto_${i}`).textContent = "";
      }
    });

    entregadoInput.addEventListener("input", () => updateSubtotalUIForPerson(i));

    metodoSelect.dispatchEvent(new Event("change"));
    updateSubtotalUIForPerson(i);
  }

  // Prefill datos si existen
  if (Array.isArray(prefillFormas)) {
    setTimeout(() => {
      prefillFormas.forEach(fp => {
        const idx = fp.persona ? fp.persona - 1 : fp.index;
        if (idx == null || idx < 0 || idx >= num) return;

        (fp.pagos || []).forEach((monto, j) => {
          const inp = document.getElementById(`pago_${idx}_${j}`);
          if (!inp) return;
          inp.value = monto ?? inp.value;
          if (fp.confirmados?.[j]) {
            const btn = document.getElementById(`btnPagar_${idx}_${j}`);
            if (btn && !btn.disabled) btn.click();
          }
        });

        if (fp.metodo) {
          const sel = document.getElementById(`metodo_${idx}`);
          if (sel) {
            sel.value = fp.metodo;
            sel.dispatchEvent(new Event("change"));
          }
        }
        if (fp.entregado != null) {
          const ent = document.getElementById(`entregado_${idx}`);
          if (ent) ent.value = fp.entregado;
        }
        updateSubtotalUIForPerson(idx);
      });
      for (let j = 0; j < productos.length; j++) updateProdSaldoUI(j);
    }, 80);
  }
}


// Reanudar división desde Firebase/localStorage
function reanudarDivisionDesdeFirebase(mesa) {
  const refTemp = ref(db, "divisionTemporal/" + mesa);
  get(refTemp).then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const prefill = data.formasPagoTemp ?? null;
      mostrarFormularioDivision(data.pedido, mesa, true, prefill, data.num);
      return;
    }
    // fallback localStorage
    const local = localStorage.getItem("divisionTemporal_local_" + mesa);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        const prefill = parsed.formasPagoTemp ?? null;
        mostrarFormularioDivision(parsed.pedido, mesa, true, prefill, parsed.num);
        return;
      } catch (e) {
        console.error("Error parsing local division", e);
      }
    }
    alert("❌ No hay división pausada para esta mesa.");
  

  }).catch(err => {
    console.error("Error leyendo divisionTemporal:", err);
    // intentar localStorage igual
    const local = localStorage.getItem("divisionTemporal_local_" + mesa);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        mostrarFormularioDivision(parsed.pedido, mesa, true, parsed.formasPagoTemp);
        return;
      } catch (e) {
        console.error("Error parsing local fallback", e);
      }
    }
    alert("Error al reanudar la división (ver consola).");
  });
}

// Botón Confirmar (finaliza sólo si la suma de pagos == total del pedido)
document.getElementById("btnConfirmarDivision").addEventListener("click", () => {
  if (!currentDivision) return alert("No hay división abierta.");
  const { pedido, mesa, num, originalProductTotals } = currentDivision;
  const productos = pedido.items || pedido.productos || [];

  // Construir formasPago por persona, y validar por producto que no se pague más que el total
  const formasPago = [];
  const pagosPorProductoTotal = Array(productos.length).fill(0);

  for (let i = 0; i < num; i++) {
    const pagosPersona = [];
    let sumaPersona = 0;
    for (let j = 0; j < productos.length; j++) {
      const val = parseFloat(document.getElementById(`pago_${i}_${j}`)?.value) || 0;
      pagosPersona.push(round2(val));
      pagosPorProductoTotal[j] += round2(val);
      sumaPersona += round2(val);
    }

    const metodo = document.getElementById(`metodo_${i}`)?.value || "efectivo";
    let entregado = null;
    if (metodo === "efectivo") {
      entregado = parseFloat(document.getElementById(`entregado_${i}`)?.value);
      if (isNaN(entregado)) {
        return alert(`Persona ${i + 1}: debes ingresar el monto entregado en efectivo.`);
      }
      const vuelto = round2(entregado - sumaPersona);
      if (vuelto < 0) return alert(`Persona ${i + 1}: monto entregado insuficiente.`);
    }

    formasPago.push({
      persona: i + 1,
      metodo,
      pagos: pagosPersona,
      monto: round2(sumaPersona),
      entregado: entregado ?? null,
      vuelto: entregado != null ? round2(entregado - sumaPersona) : null
    });
  }

  // Validar pagos por producto
  for (let j = 0; j < productos.length; j++) {
    const totalPagado = round2(pagosPorProductoTotal[j]);
    const totalNecesario = round2(originalProductTotals[j]);
    if (totalPagado > totalNecesario + 0.01) {
      return alert(`El total pagado por "${productos[j].nombre}" excede su precio. Revisa los pagos.`);
    }
  }

  // Validar suma total vs pedido.total
  const totalPedido = round2(originalProductTotals.reduce((a, b) => a + b, 0));
  const totalPagos = round2(formasPago.reduce((s, f) => s + f.monto, 0));
  if (Math.abs(totalPedido - totalPagos) > 0.01) {
    return alert(`La suma de los pagos (S/ ${totalPagos.toFixed(2)}) no coincide con el total del pedido (S/ ${totalPedido.toFixed(2)}). Ajusta los montos antes de confirmar.`);
  }

  // Si todo bien, finalizar
  finalizarDivision(pedido, mesa, formasPago);
});

// Botón Pausar
document.getElementById("btnPausarDivision").addEventListener("click", () => {
  if (!currentDivision) return alert("No hay división abierta.");
  const { pedido, mesa, num } = currentDivision;
  const productos = pedido.items || pedido.productos || [];

  const formasPagoTemp = [];
  for (let i = 0; i < num; i++) {
    const pagos = productos.map((_, j) => round2(parseFloat(document.getElementById(`pago_${i}_${j}`)?.value) || 0));
    const confirmados = productos.map((_, j) => !!(document.getElementById(`btnPagar_${i}_${j}`)?.disabled && (document.getElementById(`conf_${i}_${j}`)?.textContent)));
    const metodo = document.getElementById(`metodo_${i}`)?.value || "efectivo";
    const entregadoRaw = document.getElementById(`entregado_${i}`)?.value;
    formasPagoTemp.push({
      persona: i + 1,
      pagos,
      confirmados,
      metodo,
      entregado: entregadoRaw ? parseFloat(entregadoRaw) : null
    });
  }

  guardarDivisionTemporal(formasPagoTemp, pedido, mesa, num).then(res => {
    if (res?.remote === true) {
      alert("⏸️ División pausada (guardada en Firebase).");
    } else {
      alert("⏸️ División pausada (guardada localmente).");
    }
    estadoDivision = "pausada";
    datosDivisionTemporal = { pedido, mesa };
    currentDivision = null;
    document.getElementById("modalDividir").style.display = "none";
  }).catch(err => {
    console.error("Error guardando division temporal:", err);
    alert("Error al pausar la división. Revisa la consola.");
  });
});

// Botón principal "Dividir Cuenta" (pide mesa por prompt)
document.getElementById("dividirCuentaBtn").addEventListener("click", () => {
  const mesa = prompt("Ingresa el número de mesa:");
  if (!mesa || mesa.trim() === "") return alert("⚠️ Debes ingresar un número de mesa.");

  // Verificar si hay división pausada en Firebase
  get(ref(db, "divisionTemporal/" + mesa.trim())).then(snapshotTemp => {
    if (snapshotTemp.exists()) {
      // Hay división pausada → reanudar
      reanudarDivisionDesdeFirebase(mesa.trim());
    } else {
      // No hay división pausada → flujo normal
      get(ref(db, "pedidos/" + mesa.trim())).then(snapshot => {
        if (!snapshot.exists()) return alert("No hay pedido para esta mesa.");
        mostrarFormularioDivision(snapshot.val(), mesa.trim());
      });
    }
  }).catch(err => {
    console.error("Error al buscar división pausada:", err);
    alert("Ocurrió un error al verificar la división pausada.");
  });
});


// Eventos globales para otros botones
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("guardarBtn").addEventListener("click", guardarPedido);
  document.getElementById("verBoletaBtn").addEventListener("click", verBoleta);
  document.getElementById("editarBtn").addEventListener("click", editarPedido);
  document.getElementById("completarBtn").addEventListener("click", completarPedido);
  document.getElementById("verPendientesBtn").addEventListener("click", verPedidosPendientes);
  document.getElementById("enviarWhatsappBtn").addEventListener("click", enviarBoletaWhatsapp);
});
