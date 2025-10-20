import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import {
  getDatabase, ref, set, get, remove, push, onValue
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

// -------------------- CONFIG FIREBASE --------------------

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

// -------------------- ESTADO GLOBAL --------------------
let currentMeseroEmail = "";
let productos = [];
let pedidosLocales = {};
let total = 0;

// --- INICIO: AÑADIR ESTE BLOQUE ---
let audioPedidoListo;
let estadoAnteriorPedidos = {}; // para detectar cambios
let primeraCarga = true;

function inicializarSonidoPedidoListo() {
  if (!audioPedidoListo) {
    audioPedidoListo = new Audio("noti.mp3"); // coloca tu notificación
  }
  // "Desbloquea" el audio en navegadores modernos
  audioPedidoListo.muted = true;
  audioPedidoListo.play().then(() => {
    audioPedidoListo.pause();
    audioPedidoListo.currentTime = 0;
    audioPedidoListo.muted = false;
  }).catch(() => {});
}

function reproducirSonidoPedidoListo() {
  audioPedidoListo?.play().catch(() => {});
}
// --- FIN: AÑADIR ESTE BLOQUE ---


// -------------------- DOM ELEMENTS --------------------
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
const dividirCuentaBtn = document.getElementById("dividirCuentaBtn");

const contenedorFormasPago = document.getElementById("contenedorFormasPago");

// --- INICIO: AÑADIR ESTE BLOQUE DE CÓDIGO ---

// Event listeners para los botones de acción del panel de mesero
verBoletaBtn?.addEventListener("click", verBoleta);
editarBtn?.addEventListener("click", editarPedido);
completarBtn?.addEventListener("click", completarPedido);
verPendientesBtn?.addEventListener("click", verPedidosPendientes);
enviarWhatsappBtn?.addEventListener("click", enviarBoletaWhatsapp);

// Event listener para iniciar la división de cuenta
dividirCuentaBtn?.addEventListener("click", async () => {
  const mesa = await prompt("Número de mesa a dividir:");
  if (!mesa) return;

  const refMesa = ref(db, "pedidos/" + mesa);
  const snapshot = await get(refMesa);
  if (!snapshot.exists()) {
    return showToast("❌ No hay un pedido activo para esa mesa.", "error");
  }
  const pedido = snapshot.val();

  // Reanudar división pausada (lógica de reanudación)
  let datosGuardados = null;
  const refTemp = ref(db, "divisionTemporal/" + mesa);
  const snapshotTemp = await get(refTemp).catch(() => null);

  if (snapshotTemp && snapshotTemp.exists()) {
    const continuar = await confirm("⏯ Hay una división pausada para esta mesa. ¿Deseas reanudarla?");
    if (continuar) {
      datosGuardados = snapshotTemp.val();
    } else {
      await remove(refTemp).catch(() => {});
      localStorage.removeItem("divisionTemporal_local_" + mesa);
    }
  } else {
    const local = localStorage.getItem("divisionTemporal_local_" + mesa);
    if (local) {
      const continuarLocal = await confirm("⏯ Hay una división pausada localmente. ¿Deseas reanudarla?");
      if (continuarLocal) {
        datosGuardados = JSON.parse(local);
      } else {
        localStorage.removeItem("divisionTemporal_local_" + mesa);
      }
    }
  }

  // Llamada a la función principal para mostrar el formulario
  mostrarFormularioDivision(pedido, mesa, datosGuardados);
});

// --- FIN: AÑADIR ESTE BLOQUE DE CÓDIGO ---


// -------------------- UTIL --------------------
const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fadeOut");
    toast.addEventListener("animationend", () => toast.remove());
  }, 2200);
}

// -------------------- MODALES PERSONALIZADOS --------------------
function createModal(html) {
  const modal = document.createElement("div");
  modal.className = "custom-modal-overlay";
  modal.innerHTML = `<div class="custom-modal">${html}</div>`;
  document.body.appendChild(modal);
  return modal;
}

function showModalMessage(message, botonText = "Aceptar") {
  return new Promise(resolve => {
    const modal = createModal(`
      <div class="custom-modal-message">${message}</div>
      <div style="text-align:center;margin-top:12px;">
        <button class="custom-modal-btn" id="modal_ok">${botonText}</button>
      </div>
    `);
    modal.querySelector("#modal_ok").onclick = () => {
      document.body.removeChild(modal);
      resolve();
    };
  });
}

function showInputModal(message, placeholder = "") {
  return new Promise(resolve => {
    const modal = createModal(`
      <div class="custom-modal-message">${message}</div>
      <input class="custom-modal-input" id="modal_input" type="text" placeholder="${placeholder}" />
      <div class="custom-modal-actions">
        <button class="custom-modal-btn" id="modal_accept">Aceptar</button>
        <button class="custom-modal-btn cancel" id="modal_cancel">Cancelar</button>
      </div>
    `);
    const input = modal.querySelector("#modal_input");
    modal.querySelector("#modal_accept").onclick = () => {
      const v = input.value;
      document.body.removeChild(modal);
      resolve(v);
    };
    modal.querySelector("#modal_cancel").onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };
    setTimeout(() => input.focus(), 50);
  });
}

function showConfirmModal(message, yesText = "Sí", noText = "No") {
  return new Promise(resolve => {
    const modal = createModal(`
      <div class="custom-modal-message">${message}</div>
      <div class="custom-modal-actions" style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button class="custom-modal-btn" id="modal_yes">${yesText}</button>
        <button class="custom-modal-btn cancel" id="modal_no">${noText}</button>
      </div>
    `);
    modal.querySelector("#modal_yes").onclick = () => { document.body.removeChild(modal); resolve(true); };
    modal.querySelector("#modal_no").onclick = () => { document.body.removeChild(modal); resolve(false); };
  });
}

// override window.prompt/confirm/alert for consistency (used en varias partes)
window.alert = async function(msg) { await showModalMessage(msg); };
window.confirm = async function(msg) { return await showConfirmModal(msg); };
window.prompt = async function(msg, placeholder = "") { return await showInputModal(msg, placeholder); };

// -------------------- AUTH & UI --------------------
function actualizarUI(user) {
  if (user) {
    loginSection && (loginSection.style.display = "none");
    meseroSection && (meseroSection.style.display = "block");
    currentMeseroEmail = user.email;
    cargarProductos();
  } else {
    loginSection && (loginSection.style.display = "block");
    meseroSection && (meseroSection.style.display = "none");
    limpiarCampos();
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    const rolRef = ref(db, 'roles/' + uid);
    get(rolRef).then(snapshot => {
      if (snapshot.exists() && snapshot.val() === 'mesero') {
        actualizarUI(user);
      } else {
        showToast("🚫 Acceso denegado: No tienes el rol de mesero.", "error");
        signOut(auth);
      }
    }).catch(() => actualizarUI(user));
  } else {
    actualizarUI(null);
  }
});

loginBtn?.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return showToast("Por favor ingresa tu correo y contraseña.", "error");
  signInWithEmailAndPassword(auth, email, password)
    .then(() => showToast("¡Bienvenido!", "success"))
    .catch(() => showToast("Credenciales incorrectas o usuario no encontrado.", "error"));
});

logoutBtn?.addEventListener("click", () => {
  signOut(auth).then(() => showToast("Sesión cerrada correctamente.", "info"))
    .catch(() => showToast("Error al cerrar sesión.", "error"));
});

function limpiarCampos() {
  mesaInput && (mesaInput.value = "");
  buscarInput && (buscarInput.value = "");
  lista && (lista.innerHTML = "");
  totalTexto && (totalTexto.textContent = "Total: S/ 0.00");
  total = 0;
}

// -------------------- PRODUCTOS & PEDIDOS --------------------
async function obtenerNumeroMesa() {
  const mesa = mesaInput.value.trim();
  if (!mesa) {
    showToast("⚠️ Ingresa el número de mesa", "error");
    return null;
  }
  return mesa;
}

function actualizarTotal(mesa) {
  const pedido = pedidosLocales[mesa] || [];
  total = pedido.reduce((acc, item) => acc + (item.precio || 0) * (item.cantidad || 1), 0);
  totalTexto && (totalTexto.textContent = `Total: S/ ${total.toFixed(2)}`);
}

buscarInput?.addEventListener("input", () => {
  const texto = buscarInput.value.toLowerCase();
  lista.innerHTML = "";
  productos.filter(p => p.nombre.toLowerCase().includes(texto)).forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${p.nombre}</strong><br><small>${p.descripcion || ""}</small>`;
    li.style.cursor = "pointer";
    li.onclick = () => seleccionarProducto(p);
    lista.appendChild(li);
  });
});

// ==================== BLOQUE COMPLETO CORREGIDO ====================

// Limita directamente el input de mesa a un máximo de 20
if (mesaInput) mesaInput.setAttribute("max", "20");

async function seleccionarProducto(producto) {
  const mesa = await obtenerNumeroMesa();
  if (!mesa) return;

  // Verifica que la mesa no sea mayor a 20 antes de continuar
  if (parseInt(mesa) > 20) {
    showToast("⚠️ El número de mesa no puede ser mayor a 20.", "error");
    return;
  }

  const cantidad = await prompt(`¿Cuántos "${producto.nombre}"?`);
  if (!cantidad || isNaN(cantidad)) return;
  const cant = parseInt(cantidad);

  // 🔹 Validar que la cantidad no sobrepase 20
  if (cant > 20) {
    showToast("⚠️ No se puede agregar más de 20 unidades de un solo producto.", "error");
    return;
  }

  const comentario = await prompt("Comentario (opcional):") || "";

  // Si la mesa no tiene pedidos locales aún, crearla
  if (!pedidosLocales[mesa]) pedidosLocales[mesa] = [];
  const pedido = pedidosLocales[mesa];

  // Si ya existe el mismo producto con el mismo comentario, sumar cantidades
  const existente = pedido.find(p => p.nombre === producto.nombre && p.comentario === comentario);
  if (existente) {
    // 🔹 Si la suma excede 20, bloquearla
    if (existente.cantidad + cant > 20) {
      showToast("⚠️ No se pueden tener más de 20 unidades del mismo producto en un solo pedido.", "error");
      return;
    }
    existente.cantidad += cant;
  } else {
    pedido.push({ ...producto, cantidad: cant, comentario });
  }

  actualizarTotal(mesa);
}

async function guardarPedido() {
  const mesa = mesaInput.value.trim();

  // 🔹 Validar mesa vacía o inválida
  if (!mesa) return showToast("⚠️ Ingresa el número de mesa", "error");

  // 🔹 Validar que el número de mesa no sea mayor a 20
  if (parseInt(mesa) > 20) {
    showToast("⚠️ El número de mesa no puede ser mayor a 20.", "error");
    return;
  }

  const pedidoNuevo = pedidosLocales[mesa];
  if (!pedidoNuevo || pedidoNuevo.length === 0)
    return showToast("No hay productos en el pedido.", "error");

  // 🔹 Verificar que ningún producto exceda 20 unidades
  for (const item of pedidoNuevo) {
    if (item.cantidad > 20) {
      showToast(`⚠️ El producto "${item.nombre}" tiene más de 20 unidades. Corrige antes de guardar.`, "error");
      return;
    }
  }

  try {
    const referencia = ref(db, "pedidos/" + mesa);
    const snapshot = await get(referencia);
    let pedidoFinal = [];
    let meseroAsignado = currentMeseroEmail;

    if (snapshot.exists()) {
      const datos = snapshot.val();
      const existentes = datos.items || [];
      meseroAsignado = datos.mesero || currentMeseroEmail;
      pedidoFinal = [...existentes];

      pedidoNuevo.forEach(nuevo => {
        const encontrado = pedidoFinal.find(
          p => p.nombre === nuevo.nombre && p.comentario === nuevo.comentario
        );

        if (encontrado) {
          // 🔹 Bloquear si la suma supera 20
          if (encontrado.cantidad + nuevo.cantidad > 20) {
            showToast(`⚠️ No se pueden tener más de 20 unidades del producto "${nuevo.nombre}".`, "error");
            throw new Error("Cantidad excedida");
          }
          encontrado.cantidad += nuevo.cantidad;
        } else {
          pedidoFinal.push(nuevo);
        }
      });
    } else {
      pedidoFinal = pedidoNuevo;
    }

    const totalCalc = pedidoFinal.reduce(
      (acc, item) => acc + (item.precio || 0) * (item.cantidad || 1),
      0
    );

    await set(referencia, {
      mesa,
      total: totalCalc,
      items: pedidoFinal,
      mesero: meseroAsignado,
      actualizadoPor: currentMeseroEmail,
      actualizadoEn: Date.now()
    });

    showToast(`✅ Pedido de mesa ${mesa} guardado correctamente`, "success");
    limpiarCampos();
    delete pedidosLocales[mesa];
  } catch (err) {
    if (err.message !== "Cantidad excedida") {
      console.error("Error en guardarPedido:", err);
      showToast("Error al guardar el pedido.", "error");
    }
  }
}

// ================================================================


async function verBoleta() {
  const mesa = await prompt("Número de mesa:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  const snapshot = await get(refMesa);
  if (!snapshot.exists()) {
    showToast("❌ No hay pedido guardado", "error");
    limpiarCampos();
    return;
  }
  const datos = snapshot.val();
  let html = `<div class="pedidos-modal-content">`;
  html += `<div class="pedido-card">
    <h3>Mesa ${mesa}</h3>
    <div class="pedido-mesero">Mesero: ${datos.mesero}</div>
    <div class="pedido-productos">`;
  datos.items.forEach((item, i) => {
    html += `<div class="pedido-producto">
      <strong>${item.nombre}</strong> x${item.cantidad}
      ${item.comentario ? `<span style="color:#ad1457;"> (${item.comentario})</span>` : ""}
    </div>`;
  });
  const totalItems = datos.items.reduce((acc, item) => acc + (item.precio || 0) * (item.cantidad || 1), 0);
  html += `</div>
    <div class="pedido-total">Total: S/ ${totalItems.toFixed(2)}</div>
    </div>
    <button class="custom-modal-btn" id="cerrarBoleta">Cerrar</button>
    </div>`;
  const modal = document.getElementById("modalBoleta") || createModal(html);
  if (modal.id !== "modalBoleta") {
    modal.id = "modalBoleta";
  } else {
    modal.innerHTML = html;
  }
  modal.className = "pedidos-modal-overlay";
  modal.style.display = "flex";
  modal.querySelector("#cerrarBoleta").onclick = () => {
    modal.style.display = "none";
    limpiarCampos();
  };
}

async function editarPedido() {
  const mesa = await prompt("Mesa a editar:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  const snapshot = await get(refMesa);
  if (!snapshot.exists()) return showToast("❌ No hay pedido", "error");
  const datos = snapshot.val();
  let pedido = datos.items;
  function renderEdit(pedidoArray) {
    let html = `<div class="custom-modal-message"><strong>Editar pedido de mesa ${mesa}</strong></div>`;
    html += `<div style="margin-bottom:16px;">`;
    pedidoArray.forEach((p, i) => {
      html += `
        <div class="editar-producto-row">
          <span class="editar-producto-nombre"><strong>${p.nombre}</strong> ${p.comentario ? `<span style="color:#ad1457;">(${p.comentario})</span>` : ""}</span>
          <button class="custom-modal-btn editar-producto-btn" data-action="minus" data-index="${i}">-</button>
          <span class="editar-producto-cantidad">${p.cantidad}</span>
          <button class="custom-modal-btn editar-producto-btn" data-action="plus" data-index="${i}">+</button>
          <button class="custom-modal-btn editar-producto-btn delete" data-action="delete" data-index="${i}">🗑️</button>
        </div>
      `;
    });
    html += `</div>
      <button class="custom-modal-btn" id="guardarCambiosPedido">Guardar cambios</button>
      <button class="custom-modal-btn cancel" id="cancelarEdicionPedido">Cancelar</button>
    `;
    const modal = createModal(html);
    modal.querySelectorAll("button[data-action]").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute("data-index"));
        const action = btn.getAttribute("data-action");
        if (action === "plus") {
          pedidoArray[idx].cantidad++;
        } else if (action === "minus") {
          if (pedidoArray[idx].cantidad > 1) pedidoArray[idx].cantidad--;
        } else if (action === "delete") {
          pedidoArray.splice(idx, 1);
        }
        document.body.removeChild(modal);
        renderEdit(pedidoArray);
      };
    });
    modal.querySelector("#guardarCambiosPedido").onclick = async () => {
      await set(refMesa, {
        mesa,
        total: pedidoArray.reduce((acc, i) => acc + (i.precio || 0) * (i.cantidad || 1), 0),
        items: pedidoArray,
        mesero: datos.mesero,
        modificadoPor: currentMeseroEmail
      });
      document.body.removeChild(modal);
      showToast("✏ Pedido actualizado", "success");
      limpiarCampos();
    };
    modal.querySelector("#cancelarEdicionPedido").onclick = () => {
      document.body.removeChild(modal);
    };
  }
  renderEdit(pedido);
}

async function completarPedido() {
  const mesa = await prompt("Número de mesa a completar:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  const snapshot = await get(refMesa);
  if (!snapshot.exists()) return showToast("❌ No hay pedido", "error");
  const pedido = snapshot.val();
  const timestamp = Date.now();
  const refHistorial = ref(db, "historial");
  push(refHistorial, { ...pedido, fecha: timestamp }).then(() => {
    remove(refMesa).then(() => {
      showToast(`✅ Pedido de mesa ${mesa} completado y archivado`, "success");
      limpiarCampos();
    });
  });
}

async function verPedidosPendientes() {
  const referencia = ref(db, "pedidos");
  const snapshot = await get(referencia);
  if (!snapshot.exists()) {
    showToast("📭 No hay pedidos pendientes", "info");
    limpiarCampos();
    return;
  }
  const pedidos = snapshot.val();
  let html = `<div class="pedidos-modal-content">`;
  html += `<h2 style="color:#d63384;margin-bottom:18px;">Pedidos Pendientes</h2>`;
  html += `<div class="pedidos-grid">`;
  for (const mesa in pedidos) {
    html += `
      <div class="pedido-card">
        <h3>Mesa ${mesa}</h3>
        <div class="pedido-mesero">Mesero: ${pedidos[mesa].mesero}</div>
        <div class="pedido-productos">
    `;
    pedidos[mesa].items.forEach(item => {
      html += `<div class="pedido-producto">
        <strong>${item.nombre}</strong> x${item.cantidad}
        ${item.comentario ? `<span style="color:#ad1457;"> (${item.comentario})</span>` : ""}
      </div>`;
    });
    html += `</div>
      <div class="pedido-total">Total: S/ ${pedidos[mesa].total.toFixed(2)}</div>
      </div>
    `;
  }
  html += `</div>`; // cierra grid
  html += `<button class="custom-modal-btn" id="cerrarPedidosPendientes">Cerrar</button></div>`;
  const modal = document.getElementById("modalPedidosPendientes") || createModal(html);
  if (modal.id !== "modalPedidosPendientes") modal.id = "modalPedidosPendientes"; else modal.innerHTML = html;
  modal.className = "pedidos-modal-overlay";
  modal.style.display = "flex";
  modal.querySelector("#cerrarPedidosPendientes").onclick = () => modal.style.display = "none";
}

async function enviarBoletaWhatsapp() {
  const mesa = await prompt("Número de mesa:");
  const numero = await prompt("Número de WhatsApp del cliente (sin +51):");
  if (!mesa || !numero || isNaN(numero)) return showToast("❌ Número de mesa o WhatsApp no válidos.", "error");
  const refHistorial = ref(db, "historial");
  const snapshot = await get(refHistorial);
  if (!snapshot.exists()) return showToast("❌ No hay historial de pedidos", "error");
  const historial = Object.values(snapshot.val());
  const recientes = historial.filter(p => p.mesa === mesa && Date.now() - p.fecha < 180000);
  if (recientes.length === 0) return showToast("⚠️ No hay boleta reciente para esta mesa (menos de 3 min)", "info");
  const boleta = recientes[recientes.length - 1];
  let texto = `🍽 *Boleta - Mesa ${mesa}*\n\n`;
  boleta.items.forEach((item, i) => {
    texto += `${i + 1}. ${item.nombre} x${item.cantidad}`;
    if (item.comentario) texto += ` (${item.comentario})`;
    texto += `\n`;
  });
  texto += `\n💵 Total: S/ ${boleta.total.toFixed(2)}\n🕐 ${new Date(boleta.fecha).toLocaleString()}`;
  const link = `https://wa.me/51${numero}?text=${encodeURIComponent(texto)}`;
  window.open(link, "_blank");
}

function cargarProductos() {
  const refProductos = ref(db, "productos");
  get(refProductos).then(snapshot => {
    if (!snapshot.exists()) return showToast("❌ No hay productos cargados", "error");
    productos = Object.values(snapshot.val());
    lista && (lista.innerHTML = "");
  }).catch(err => {
    console.error("Error cargarProductos:", err);
  });
}

// -------------------- DIVIDIR CUENTA (MEJORADA) --------------------
// Estado division
let estadoDivision = "activa"; // activa | pausada
let currentDivision = null;

// Guardar division temporal (db + local)
function guardarDivisionTemporalLocal(mesa) {
  if (!currentDivision) return;
  try {
    localStorage.setItem("divisionTemporal_local_" + mesa, JSON.stringify(currentDivision));
    return true;
  } catch (e) { console.warn("No se pudo guardar localmente:", e); return false; }
}
async function guardarDivisionTemporalDB(mesa) {
  if (!currentDivision) return;
  const refTemp = ref(db, "divisionTemporal/" + mesa);
  await set(refTemp, { ...currentDivision, timestamp: Date.now() });
}

// Mostrar modal de acción (mejor UX móvil)
function showActionModal(producto, saldo, maxUnidades, unitPrice) { // <-- Se añaden unitPrice y maxUnidades es ahora el valor calculado
  return new Promise(resolve => {
    // --- INICIO: Lógica para deshabilitar la opción de unidades si no es viable ---
    const puedePagarPorUnidad = maxUnidades > 0 && unitPrice > 0;
    const infoUnidades = puedePagarPorUnidad 
      ? `<span>Pagar unidades</span><input type="number" min="1" max="${maxUnidades}" placeholder="Máx: ${maxUnidades}" />`
      : `<span class="disabled">Pagar unidades</span><small class="disabled">No hay unidades completas por pagar.</small>`;
    // --- FIN: Lógica de deshabilitación ---

    const html = `
      <h3>${producto.nombre}</h3>
      <p>Saldo pendiente: <strong>S/ ${saldo.toFixed(2)}</strong></p>
      <div class="opciones-pago">
        <div class="opcion-pago" id="opt_complete">
          <span>Pagar completo</span>
          <small>Paga el saldo total de este producto.</small>
        </div>
        <div class="opcion-pago ${!puedePagarPorUnidad ? 'disabled' : ''}" id="opt_unidades">
          ${infoUnidades}
        </div>
        <div class="opcion-pago" id="opt_monto">
          <span>Pagar monto</span>
          <input type="number" min="0.01" step="0.01" placeholder="Monto (ej: 12.50)" />
        </div>
      </div>
      <button class="btn-cancelar" id="opt_cancel">Cancelar</button>
    `;

    const modal = createModal(html);

    modal.querySelector("#opt_complete").onclick = () => {
      document.body.removeChild(modal);
      resolve({ action: "complete" });
    };

    // Solo añadir el listener si la opción está habilitada
    if (puedePagarPorUnidad) {
      modal.querySelector("#opt_unidades input").oninput = function () {
        const val = parseInt(this.value);
        if (val && val >= 1 && val <= maxUnidades) {
          modal.querySelector("#opt_unidades").onclick = () => {
            document.body.removeChild(modal);
            resolve({ action: "units", value: val });
          };
        } else {
          modal.querySelector("#opt_unidades").onclick = null;
        }
      };
    }

    modal.querySelector("#opt_monto input").oninput = function () {
      const val = parseFloat(this.value);
      if (val && val > 0 && val <= saldo) {
        modal.querySelector("#opt_monto").onclick = () => {
          document.body.removeChild(modal);
          resolve({ action: "amount", value: val });
        };
      } else {
        modal.querySelector("#opt_monto").onclick = null;
      }
    };

    modal.querySelector("#opt_cancel").onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };
  });
}

// --- INICIO: AÑADIR ESTA FUNCIÓN COMPLETA ---
async function finalizarDivision(pedido, mesa, formasPago) {
  if (!pedido || !mesa || !formasPago) {
    return showToast("Error interno: Faltan datos para finalizar la división.", "error");
  }

  try {
    const timestamp = Date.now();
    const refHistorial = ref(db, "historial");
    
    // 1. Crear la entrada para el historial con el detalle de la división
    const historialEntry = {
      ...pedido, // Incluye los items originales, total, etc.
      fecha: timestamp,
      pagadoPor: "Division de cuenta",
      division: {
        personas: formasPago.length,
        detalle: formasPago
      }
    };

    // 2. Guardar el pedido completado en el historial
    await push(refHistorial, historialEntry);

    // 3. Eliminar el pedido de la lista de pedidos activos
    const refMesa = ref(db, "pedidos/" + mesa);
    await remove(refMesa);

    // 4. Limpiar los datos temporales de la división
    const refTemp = ref(db, "divisionTemporal/" + mesa);
    await remove(refTemp).catch(() => {}); // Ignorar error si no existe
    localStorage.removeItem("divisionTemporal_local_" + mesa);

    // 5. Resetear el estado y la UI
    currentDivision = null;
    showToast(`✅ División de mesa ${mesa} completada y archivada.`, "success");
    limpiarCampos(); // Limpia los campos del panel principal

  } catch (error) {
    console.error("Error en finalizarDivision:", error);
    showToast("Error al archivar la división de cuenta.", "error");
  }
}
// --- FIN: AÑADIR ESTA FUNCIÓN COMPLETA ---


// Función principal para mostrar división (similar a la versión previa pero con action modal)
async function mostrarFormularioDivision(pedido, mesa, datosGuardados = null) {
  const productosList = pedido.items || pedido.productos || [];
  if (!Array.isArray(productosList) || productosList.length === 0) return showToast("No hay productos en el pedido.", "error");

  let modoAsignarSaldo = false;

  let num;
  if (datosGuardados?.num && Number.isInteger(datosGuardados.num) && datosGuardados.num > 0) {
    num = datosGuardados.num;
  } else {
    const partes = await prompt("¿Entre cuántas personas dividirás la cuenta?");
    num = parseInt(partes);
    if (!num || num < 1) return showToast("Número no válido", "error");
  }

  const originalProductTotals = productosList.map(p => round2((parseFloat(p.precio) || 0) * (parseInt(p.cantidad) || 1)));

  currentDivision = {
    pedido,
    mesa,
    num,
    productos: productosList,
    originalProductTotals,
    pagos: datosGuardados?.pagos || Array.from({ length: num }, () => Array(productosList.length).fill(0)),
    metodo: datosGuardados?.metodo || Array(num).fill("efectivo"),
    entregado: datosGuardados?.entregado || Array(num).fill(null),
    historial: datosGuardados?.historial || Array.from({ length: num }, () => []),
  };

  if (!contenedorFormasPago) return showToast("No se encontró contenedorFormasPago en el DOM", "error");
  contenedorFormasPago.innerHTML = "";

  let resumenHtml = `
    <div class="division-resumen">
      <h2>Dividir cuenta - Mesa ${mesa}</h2>
      <div><strong>Total pedido:</strong> S/ ${originalProductTotals.reduce((a,b)=>a+b,0).toFixed(2)}</div>
      <div><strong>Pendiente:</strong> S/ <span id="pendienteTotal">0.00</span></div>
    </div>
  `;
  contenedorFormasPago.insertAdjacentHTML("beforeend", resumenHtml);

  for (let i = 0; i < num; i++) {
    const personaHtml = document.createElement("div");
    personaHtml.className = "division-persona-card";
    personaHtml.dataset.index = i;
    let inner = `<h4>Persona ${i + 1}</h4>`;
    inner += `<div class="division-persona-productos">`;
    productosList.forEach((prod, j) => {
      inner += `
        <div class="division-producto-row" id="row_${i}_${j}">
          <span class="division-producto-nombre">${prod.nombre} x${prod.cantidad}</span>
          <span id="saldo_${i}_${j}" class="division-saldo pendiente"></span>
          <div class="button-wrapper">
            <button class="division-btn btn-pagar" id="btnAccion_${i}_${j}">Pagar</button>
            <button class="division-btn btn-asignar" id="btnAsignar_${i}_${j}" style="display:none;">Asignar Saldo</button>
            <button class="division-btn deshacer-btn" id="btnDeshacer_${i}_${j}" style="display:none;">Deshacer</button>
          </div>
          <span id="conf_${i}_${j}" class="division-confirm"></span>
        </div>
      `;
    });
    inner += `</div>`;
    inner += `<div class="division-subtotal">Subtotal: S/ <span id="subtotal_${i}">0.00</span></div>`;
    inner += `
      <div class="division-metodo-pago">
        <label>Método:</label>
        <select id="metodo_${i}">
          <option value="efectivo" ${currentDivision.metodo[i] === 'efectivo' ? 'selected' : ''}>Efectivo</option>
          <option value="Yape" ${currentDivision.metodo[i] === 'Yape' ? 'selected' : ''}>Yape</option>
          <option value="Plin" ${currentDivision.metodo[i] === 'Plin' ? 'selected' : ''}>Plin</option>
          <option value="tarjeta" ${currentDivision.metodo[i] === 'tarjeta' ? 'selected' : ''}>Tarjeta</option>
        </select>
        <div id="efectivo_wrap_${i}" class="efectivo-wrap" style="display:none;">
          <label>Monto entregado:</label>
          <input type="number" id="entregado_${i}" min="0" step="0.01" placeholder="Ej: 50.00" value="${currentDivision.entregado[i] || ''}" />
          <div><small id="vuelto_${i}" class="vuelto"></small></div>
        </div>
      </div>
    `;
    personaHtml.innerHTML = inner;
    contenedorFormasPago.appendChild(personaHtml);
  }

  contenedorFormasPago.insertAdjacentHTML("beforeend", `

    <div class="division-actions">
      <button id="btnCancelarDivision">Cancelar</button>
      <button id="btnPausarDivision">Pausar</button>
      <button id="btnConfirmarDivision">Confirmar división</button>
    </div>
  `);
  document.getElementById("modalDividir").style.display = "flex";

  function calcularSaldoProducto(j) {
    const totalPagado = currentDivision.pagos.reduce((sum, arr) => sum + (arr[j] || 0), 0);
    return round2(currentDivision.originalProductTotals[j] - totalPagado);
  }
  function calcularSubtotalPersona(i) {
    return round2(currentDivision.pagos[i].reduce((a,b)=>a+b,0));
  }

  // --- INICIO: VERSIÓN CORREGIDA DE registrarPago ---
  function registrarPago(i, j, monto) {
    if (!currentDivision) return;
    const saldo = calcularSaldoProducto(j);
    const montoFinal = monto > saldo ? saldo : monto;
    currentDivision.pagos[i][j] = round2((currentDivision.pagos[i][j] || 0) + montoFinal);
    currentDivision.historial[i].push({ producto: j, monto: montoFinal });
    // La línea "modoAsignarSaldo = false" se elimina de aquí para corregir el bug.
    renderUI();
  }
  // --- FIN: VERSIÓN CORREGIDA ---

  function deshacerPagoProducto(i, j) {
    if (!currentDivision) return;
    const historialPersona = currentDivision.historial[i];
    const indiceEnHistorial = historialPersona.map(p => p.producto).lastIndexOf(j);
    if (indiceEnHistorial === -1) return showToast("No hay pago de este producto para deshacer.", "info");
    const transaccionDeshecha = historialPersona.splice(indiceEnHistorial, 1)[0];
    const montoDeshecho = transaccionDeshecha.monto;
    currentDivision.pagos[i][j] = round2(currentDivision.pagos[i][j] - montoDeshecho);
    renderUI();
    showToast(`Pago de S/ ${montoDeshecho.toFixed(2)} deshecho para Persona ${i + 1}.`, "success");
  }

  function renderUI() {
    for (let j = 0; j < productosList.length; j++) {
      const saldo = calcularSaldoProducto(j);
      const productoPagado = saldo < 0.01;
      document.querySelectorAll(`[id^="saldo_"][id$="_${j}"]`).forEach(span => {
        span.textContent = productoPagado ? "Pagado" : `S/ ${saldo.toFixed(2)}`;
        span.className = "division-saldo " + (productoPagado ? "pagado" : "pendiente");
      });
      for (let i = 0; i < currentDivision.num; i++) {
        const btnPagar = document.getElementById(`btnAccion_${i}_${j}`);
        const btnAsignar = document.getElementById(`btnAsignar_${i}_${j}`);
        const btnDeshacer = document.getElementById(`btnDeshacer_${i}_${j}`);
        const pagoPersonaEnProducto = currentDivision.pagos[i][j] > 0;
        if (productoPagado) {
          btnPagar.style.display = 'none';
          btnAsignar.style.display = 'none';
        } else {
          if (modoAsignarSaldo) {
            btnPagar.style.display = 'none';
            btnAsignar.style.display = 'inline-block';
          } else {
            btnPagar.style.display = 'inline-block';
            btnAsignar.style.display = 'none';
          }
        }
        btnDeshacer.style.display = pagoPersonaEnProducto ? 'inline-block' : 'none';
      }
    }
    for (let i = 0; i < currentDivision.num; i++) {
      const sub = calcularSubtotalPersona(i);
      const subtotalEl = document.getElementById(`subtotal_${i}`);
      if (subtotalEl) subtotalEl.textContent = sub.toFixed(2);
      if (currentDivision.metodo[i] === "efectivo") {
        const entEl = document.getElementById(`entregado_${i}`);
        const entregado = entEl ? parseFloat(entEl.value) || null : null;
        currentDivision.entregado[i] = entregado;
        const vueltoSpan = document.getElementById(`vuelto_${i}`);
        if (vueltoSpan) {
          if (entregado != null) {
            const vuelto = round2(entregado - sub);
            vueltoSpan.textContent = vuelto >= 0 ? `Vuelto: S/ ${vuelto.toFixed(2)}` : "Monto insuficiente";
          } else {
            vueltoSpan.textContent = "";
          }
        }
      }
    }
    const totalPedido = currentDivision.originalProductTotals.reduce((a, b) => a + b, 0);
    const totalPagado = currentDivision.pagos.flat().reduce((a, b) => a + b, 0);
    const pendienteTotal = round2(totalPedido - totalPagado);
    const pendienteTotalEl = document.getElementById("pendienteTotal");
    if (pendienteTotalEl) pendienteTotalEl.textContent = pendienteTotal.toFixed(2);
  }

  // EVENTOS
  for (let i = 0; i < currentDivision.num; i++) {
    for (let j = 0; j < productosList.length; j++) {
      document.getElementById(`btnAccion_${i}_${j}`)?.addEventListener("click", async () => {
        // --- INICIO: CORRECCIÓN AÑADIDA ---
        modoAsignarSaldo = false; // Resetea el modo al iniciar un pago normal
        // --- FIN: CORRECCIÓN AÑADIDA ---
        const saldo = calcularSaldoProducto(j);
        if (saldo <= 0) return;
        const producto = productosList[j];
        const unitPrice = round2((currentDivision.originalProductTotals[j] / (producto.cantidad || 1)) || 0);
        const maxUnidadesPagables = unitPrice > 0 ? Math.floor(saldo / unitPrice) : 0;
        const action = await showActionModal(producto, saldo, maxUnidadesPagables, unitPrice);
        if (!action) return;
        if (action.action === "complete") registrarPago(i, j, saldo);
        else if (action.action === "units") registrarPago(i, j, round2(unitPrice * action.value));
        else if (action.action === "amount") {
          if (action.value > saldo + 0.001) return showToast(`El monto excede el saldo. Saldo: S/ ${saldo.toFixed(2)}`, "error");
          registrarPago(i, j, round2(action.value));
        }
      });
      document.getElementById(`btnAsignar_${i}_${j}`)?.addEventListener("click", () => {
        const saldo = calcularSaldoProducto(j);
        if (saldo > 0) {
          registrarPago(i, j, saldo);
          showToast(`Saldo de S/ ${saldo.toFixed(2)} asignado a Persona ${i + 1}`, "success");
        }
      });
      document.getElementById(`btnDeshacer_${i}_${j}`)?.addEventListener("click", () => {
        deshacerPagoProducto(i, j);
      });
    }
    const metodoSel = document.getElementById(`metodo_${i}`);
    metodoSel?.addEventListener("change", function () {
      currentDivision.metodo[i] = this.value;
      const efectivoWrap = document.getElementById(`efectivo_wrap_${i}`);
      if (efectivoWrap) efectivoWrap.style.display = this.value === "efectivo" ? "block" : "none";
      if (this.value !== "efectivo") {
        currentDivision.entregado[i] = null;
        const entInput = document.getElementById(`entregado_${i}`);
        if (entInput) entInput.value = "";
      }
      renderUI();
    });
    metodoSel?.dispatchEvent(new Event("change"));
    document.getElementById(`entregado_${i}`)?.addEventListener("input", () => renderUI());
  }

  document.getElementById("btnCancelarDivision").addEventListener("click", async () => {
    const seguro = await confirm("¿Estás seguro de cancelar la división? Se perderán los cambios no guardados.");
    if (seguro) {
      const refTemp = ref(db, "divisionTemporal/" + mesa);
      await remove(refTemp).catch(() => {});
      localStorage.removeItem("divisionTemporal_local_" + mesa);
      currentDivision = null;
      document.getElementById("modalDividir").style.display = "none";
      contenedorFormasPago.innerHTML = "";
      showToast("❌ División cancelada.", "error");
    }
  });
  document.getElementById("btnPausarDivision").addEventListener("click", async () => {
    try {
      await guardarDivisionTemporalDB(mesa);
      guardarDivisionTemporalLocal(mesa);
      showToast("⏸ División pausada. Puedes reanudar más tarde.", "info");
    } catch (e) {
      guardarDivisionTemporalLocal(mesa);
      showToast("⏸ División pausada localmente (error guardando en DB).", "info");
    }
    document.getElementById("modalDividir").style.display = "none";
  });
  document.getElementById("btnConfirmarDivision").addEventListener("click", async () => {
    if (!currentDivision) return;
    const totalPedido = currentDivision.originalProductTotals.reduce((a, b) => a + b, 0);
    const totalPagado = currentDivision.pagos.flat().reduce((a, b) => a + b, 0);
    const pendienteTotal = round2(totalPedido - totalPagado);
    if (pendienteTotal > 0.01) {
      modoAsignarSaldo = true;
      renderUI();
      showToast(`⚠️ Aún queda un saldo de S/ ${pendienteTotal.toFixed(2)}. Asigna el saldo a un cliente para continuar.`, "error");
    } else {
      const formasPago = currentDivision.pagos.map((arrPagos,i)=>{
        const subtotal = arrPagos.reduce((a,b)=>a+b,0);
        return {
          persona: i+1,
          metodo: currentDivision.metodo[i] || "efectivo",
          entregado: currentDivision.entregado[i] ?? null,
          subtotal: round2(subtotal),
          pagos: arrPagos.map(v => round2(v))
        };
      });
      await finalizarDivision(currentDivision.pedido, currentDivision.mesa, formasPago);
      document.getElementById("modalDividir").style.display = "none";
    }
  });

  renderUI();
}

// --- INICIO: AÑADIR ESTE BLOQUE FINAL ---

// === Notificación cuando un producto se marca como listo en cocina ===
function escucharPedidosListos() {
  const pedidosRef = ref(db, "pedidos"); 
  onValue(pedidosRef, (snapshot) => {    
    const pedidos = snapshot.val();
    if (!pedidos) {
      estadoAnteriorPedidos = {};
      return;
    }

    Object.entries(pedidos).forEach(([mesa, pedido]) => {
      (pedido.items || []).forEach((item, i) => {
        const clave = mesa + "-" + i;
        const ahoraListo = item.listo === true;
        const estabaListo = estadoAnteriorPedidos[clave];

        // Evita notificar en la primera carga de la página
        if (!primeraCarga) {
          if (ahoraListo && !estabaListo) {
            showToast(`✅ Pedido listo: ${item.nombre} (Mesa ${mesa})`, "success");
            reproducirSonidoPedidoListo();
          }
        }

        estadoAnteriorPedidos[clave] = ahoraListo;
      });
    });

    primeraCarga = false;
  });
}

// Iniciar la escucha de pedidos listos cuando el script carga
escucharPedidosListos();

// --- FIN: AÑADIR ESTE BLOQUE FINAL ---

