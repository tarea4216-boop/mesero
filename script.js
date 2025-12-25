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
let audioPedidoListo = null;
let sonidoHabilitado = false;

// 🔓 Se ejecuta SOLO una vez con el primer click real del usuario
function inicializarSonidoPedidoListo() {
  if (sonidoHabilitado) return;

  audioPedidoListo = new Audio("noti.mp3");
  audioPedidoListo.volume = 0.9;

  audioPedidoListo.currentTime = 0;
  audioPedidoListo
    .play()
    .then(() => {
      audioPedidoListo.pause();
      audioPedidoListo.currentTime = 0;
      sonidoHabilitado = true;
      console.log("🔊 Sonido de notificación desbloqueado");
    })
    .catch(() => {});
}

// 🔔 Reproduce el sonido SOLO si ya fue desbloqueado
function reproducirSonidoPedidoListo() {
  if (!sonidoHabilitado || !audioPedidoListo) return;
  audioPedidoListo.currentTime = 0;
  audioPedidoListo.play().catch(() => {});
}

// 👂 Listener invisible → primer click del usuario
document.addEventListener(
  "click",
  () => {
    inicializarSonidoPedidoListo();
  },
  { once: true }
);

// -------------------- DOM ELEMENTS --------------------
const loginSection = document.getElementById("loginSection");
const meseroSection = document.getElementById("meseroSection");

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const buscarInput = document.getElementById("buscarInput");
const lista = document.getElementById("listaProductos");
const totalTexto = document.getElementById("totalTexto");

const verBoletaBtn = document.getElementById("verBoletaBtn");
const guardarBtn = document.getElementById("guardarBtn");
const editarBtn = document.getElementById("editarBtn");
const completarBtn = document.getElementById("completarBtn");
const verPendientesBtn = document.getElementById("verPendientesBtn");
const enviarBoletaBtn = document.getElementById("enviarBoletaBtn");
const dividirCuentaBtn = document.getElementById("dividirCuentaBtn");

const contenedorFormasPago = document.getElementById("contenedorFormasPago");

// -------------------- EVENT LISTENERS --------------------
verBoletaBtn?.addEventListener("click", verBoleta);
editarBtn?.addEventListener("click", editarPedido);
completarBtn?.addEventListener("click", completarPedido);
verPendientesBtn?.addEventListener("click", verPedidosPendientes);
enviarBoletaBtn?.addEventListener("click", enviarBoleta);
guardarBtn?.addEventListener("click", guardarPedido);


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

let mesaSeleccionada = null;



function actualizarUI(user) {
  if (user) {
    loginSection && (loginSection.style.display = "none");
    meseroSection && (meseroSection.style.display = "block");
    currentMeseroEmail = user.email;
    cargarProductos();
    renderMesas();
  } else {
    loginSection && (loginSection.style.display = "block");
    meseroSection && (meseroSection.style.display = "none");
    limpiarCampos();
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    const rolRef = ref(db, "roles/" + uid);
    get(rolRef).then(snapshot => {
      if (snapshot.exists() && snapshot.val() === "mesero") {
        actualizarUI(user);
      } else {
        showToast("🚫 Acceso denegado", "error");
        signOut(auth);
      }
    });
  } else {
    actualizarUI(null);
  }
});

loginBtn?.addEventListener("click", () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    return showToast("Completa los campos", "error");
  }

  signInWithEmailAndPassword(auth, email, password)
    .then(() => showToast("¡Bienvenido!", "success"))
    .catch(() => showToast("Credenciales incorrectas", "error"));
});

logoutBtn?.addEventListener("click", () => {
  signOut(auth).then(() =>
    showToast("Sesión cerrada", "info")
  );
});

function limpiarCampos() {
  buscarInput && (buscarInput.value = "");
  lista && (lista.innerHTML = "");
  totalTexto && (totalTexto.textContent = "Total: S/ 0.00");
  total = 0;
}

// -------------------- MESAS --------------------

async function renderMesas() {
  const cont = document.getElementById("mesasGrid");
  if (!cont) return;

  cont.innerHTML = "";

  const snapshot = await get(ref(db, "pedidos"));
  const pedidos = snapshot.exists() ? snapshot.val() : {};

  for (let i = 1; i <= 21; i++) {
    const btn = document.createElement("button");
    btn.textContent = `Mesa ${i}`;

    btn.className =
      "mesa-btn " +
      (pedidos[i] ? "mesa-ocupada " : "mesa-libre ") +
      (mesaSeleccionada === i ? "seleccionada" : "");

    btn.addEventListener("click", () => {
      mesaSeleccionada = i;
      renderMesas();

      if (pedidos[i]) {
        abrirOpcionesMesa(i);
      } else {
        abrirFormularioPedido(i);
      }
    });

    cont.appendChild(btn);
  }
}

// -------------------- MODAL OPCIONES MESA --------------------

const modalOpcionesMesa = document.getElementById("modalOpcionesMesa");
const tituloOpcionesMesa = document.getElementById("tituloOpcionesMesa");
const btnAgregarEditarMesa = document.getElementById("btnAgregarEditarMesa");
const btnVerPedidoMesa = document.getElementById("btnVerPedidoMesa");

function abrirOpcionesMesa(mesa) {
  mesaSeleccionada = mesa;
  tituloOpcionesMesa.textContent = `Mesa ${mesa}`;
  modalOpcionesMesa.style.display = "flex";
}

function cerrarOpcionesMesa() {
  modalOpcionesMesa.style.display = "none";
}

window.cerrarOpcionesMesa = cerrarOpcionesMesa;

// 👉 BOTÓN: AGREGAR / EDITAR
btnAgregarEditarMesa.addEventListener("click", () => {
  if (!mesaSeleccionada) return;

  cerrarOpcionesMesa();
  abrirFormularioPedido(mesaSeleccionada);
});

// 👉 BOTÓN: VER PEDIDO
btnVerPedidoMesa.addEventListener("click", () => {
  if (!mesaSeleccionada) return;

  cerrarOpcionesMesa();
  abrirModalBoleta(mesaSeleccionada);
});

// -------------------- MODAL PEDIDO --------------------

const modalPedido = document.getElementById("modalPedido");
const tituloMesa = document.getElementById("tituloMesa");

function abrirFormularioPedido(mesa) {
  mesaSeleccionada = mesa;
  tituloMesa.textContent = `Mesa ${mesa}`;
  modalPedido.style.display = "flex";
}

function cerrarFormularioPedido() {
  modalPedido.style.display = "none";
  limpiarCampos();
}

window.cerrarFormularioPedido = cerrarFormularioPedido;

// -------------------- BOLETA + EDICIÓN --------------------

async function abrirModalBoleta(mesa) {
  const modal = document.getElementById("modalBoleta");
  modal.innerHTML = "";
  modal.style.display = "flex";

  const refMesa = ref(db, "pedidos/" + mesa);
  const snapshot = await get(refMesa);

  if (!snapshot.exists()) {
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Mesa ${mesa}</h3>
        <p>No hay pedido registrado</p>
        <button id="cerrarBoletaBtn">Cerrar</button>
      </div>
    `;
    document.getElementById("cerrarBoletaBtn").onclick = () => modal.style.display = "none";
    return;
  }

  const datos = snapshot.val();
  let pedido = [...datos.items];

  function puedeEditar(item) {
    if (!item.creadoEn) return false;
    const diezMin = 10 * 60 * 1000;
    return Date.now() - item.creadoEn <= diezMin;
  }

  function render() {
    let html = `
      <div class="modal-content boleta">
        <h3>Pedido - Mesa ${mesa}</h3>
        <div class="pedido-mesero">Mesero: ${datos.mesero}</div>
        <div class="pedido-productos">
    `;

    pedido.forEach((item, i) => {
      const editable = puedeEditar(item);

      html += `
        <div class="pedido-producto-row">
          <div class="pedido-info">
            <strong>${item.nombre}</strong> x${item.cantidad}
            ${item.comentario ? `<span class="comentario">(${item.comentario})</span>` : ""}
          </div>

          ${
            editable
              ? `
              <div class="pedido-acciones">
                <button data-action="minus" data-index="${i}">➖</button>
                <button data-action="plus" data-index="${i}">➕</button>
                <button data-action="delete" data-index="${i}">🗑️</button>
              </div>
            `
              : `<span class="no-editable">⏱️</span>`
          }
        </div>
      `;
    });

    const total = pedido.reduce(
      (acc, p) => acc + (p.precio || 0) * (p.cantidad || 1),
      0
    );

    html += `
        </div>
        <div class="pedido-total">Total: S/ ${total.toFixed(2)}</div>

        <div class="button-group">
          <button id="guardarCambiosBoleta">Guardar cambios</button>
          <button id="cerrarBoletaBtn" class="secondary">Cerrar</button>
        </div>
      </div>
    `;

    modal.innerHTML = html;

    // Acciones
    modal.querySelectorAll("button[data-action]").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.index);
        const action = btn.dataset.action;

        if (!puedeEditar(pedido[idx])) {
          showToast("⏱️ Tiempo de edición expirado", "error");
          return;
        }

       if (action === "plus") {
  pedido[idx].cantidad++;

  // 🔧 CLAVE: si ya había productos listos, NO tocar cantidadLista
  if (typeof pedido[idx].cantidadLista !== "number") {
    pedido[idx].cantidadLista = 0;
  }
}

       if (action === "minus" && pedido[idx].cantidad > 1) {
  pedido[idx].cantidad--;

  // Ajuste de seguridad
  if (
    typeof pedido[idx].cantidadLista === "number" &&
    pedido[idx].cantidadLista > pedido[idx].cantidad
  ) {
    pedido[idx].cantidadLista = pedido[idx].cantidad;
  }
}

        if (action === "delete") pedido.splice(idx, 1);

        render();
      };
    });

    document.getElementById("cerrarBoletaBtn").onclick = () => {
      modal.style.display = "none";
    };

    document.getElementById("guardarCambiosBoleta").onclick = async () => {
      await set(refMesa, {
        ...datos,
        items: pedido,
        total,
        actualizadoPor: currentMeseroEmail,
        actualizadoEn: Date.now()
      });

      showToast("✏ Pedido actualizado", "success");
      modal.style.display = "none";
      renderMesas();
    };
  }

  render();
}



// -------------------- PRODUCTOS & PEDIDOS --------------------

let productoSeleccionado = null;

// 🔹 Mesa activa
function obtenerMesaActiva() {
  if (!mesaSeleccionada) {
    showToast("Selecciona una mesa", "error");
    return null;
  }
  return mesaSeleccionada;
}

// 🔹 Total
function actualizarTotal(mesa) {
  const pedido = pedidosLocales[mesa] || [];
  total = pedido.reduce(
    (acc, item) => acc + (item.precio || 0) * item.cantidad,
    0
  );
  totalTexto.textContent = `Total: S/ ${total.toFixed(2)}`;
}

// 🔹 Buscar productos
buscarInput?.addEventListener("input", () => {
  const texto = buscarInput.value.toLowerCase();
  lista.innerHTML = "";

  productos
    .filter(p => p.nombre.toLowerCase().includes(texto))
    .forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${p.nombre}</strong><br>
        <small>${p.descripcion || ""}</small>
      `;
      li.onclick = () => seleccionarProducto(p);
      lista.appendChild(li);
    });
});

// 🔹 Al seleccionar producto → abrir modal
function seleccionarProducto(producto) {
  const mesa = obtenerMesaActiva();
  if (!mesa) return;

  productoSeleccionado = producto;

  document.getElementById("tituloAgregarProducto").textContent =
    `Agregar: ${producto.nombre}`;

  document.getElementById("cantidadProducto").value = 1;
  document.getElementById("comentarioProducto").value = "";

  document.getElementById("modalAgregarProducto").style.display = "flex";
}

// 🔹 Confirmar agregar producto
document
  .getElementById("confirmarAgregarProducto")
  .addEventListener("click", () => {
    const mesa = obtenerMesaActiva();
    if (!mesa || !productoSeleccionado) return;

    const cant = parseInt(
      document.getElementById("cantidadProducto").value
    );

    if (!cant || cant <= 0 || cant > 20) {
      showToast("Cantidad inválida", "error");
      return;
    }

    const comentario =
      document.getElementById("comentarioProducto").value.trim();

    if (!pedidosLocales[mesa]) pedidosLocales[mesa] = [];
    const pedido = pedidosLocales[mesa];

    const existente = pedido.find(
      p =>
        p.nombre === productoSeleccionado.nombre &&
        p.comentario === comentario
    );

    if (existente) {
      existente.cantidad += cant;
    } else {
      pedido.push({
        ...productoSeleccionado,
        cantidad: cant,
        comentario,
        creadoEn: Date.now()
      });
    }

    actualizarTotal(mesa);
    cerrarModalAgregarProducto();
  });

// 🔹 Cerrar modal
function cerrarModalAgregarProducto() {
  document.getElementById("modalAgregarProducto").style.display = "none";
  productoSeleccionado = null;
}

// 🔹 Guardar pedido
async function guardarPedido() {
  const mesa = obtenerMesaActiva();
  if (!mesa) return;

  const pedidoNuevo = pedidosLocales[mesa];
  if (!pedidoNuevo || pedidoNuevo.length === 0) {
    showToast("Pedido vacío", "error");
    return;
  }

  try {
    const refMesa = ref(db, "pedidos/" + mesa);
    const snapshot = await get(refMesa);

    let pedidoFinal = [];
    let meseroAsignado = currentMeseroEmail;

    if (snapshot.exists()) {
      const datos = snapshot.val();
      pedidoFinal = [...(datos.items || [])];
      meseroAsignado = datos.mesero || currentMeseroEmail;

      pedidoNuevo.forEach(nuevo => {
        const encontrado = pedidoFinal.find(
          p =>
            p.nombre === nuevo.nombre &&
            p.comentario === nuevo.comentario
        );
        if (encontrado) {
          encontrado.cantidad += nuevo.cantidad;
        } else {
          pedidoFinal.push(nuevo);
        }
      });
    } else {
      pedidoFinal = pedidoNuevo;
    }

    const totalCalc = pedidoFinal.reduce(
      (acc, item) => acc + (item.precio || 0) * item.cantidad,
      0
    );

    await set(refMesa, {
      mesa,
      total: totalCalc,
      items: pedidoFinal,
      mesero: meseroAsignado,
      actualizadoPor: currentMeseroEmail,
      actualizadoEn: Date.now()
    });

    showToast("Pedido guardado", "success");
    delete pedidosLocales[mesa];
    cerrarFormularioPedido();
    renderMesas();
  } catch (err) {
    console.error(err);
    showToast("Error al guardar", "error");
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

  try {
    const refMesa = ref(db, "pedidos/" + mesa);
    const snapshot = await get(refMesa);

    if (!snapshot.exists()) {
      showToast("❌ No hay pedido", "error");
      return;
    }

    const pedido = snapshot.val();

    await push(ref(db, "historial"), {
      ...pedido,
      mesa,
      completadoEn: Date.now()
    });

    await remove(refMesa);

    showToast(`✅ Pedido de mesa ${mesa} completado`, "success");

    limpiarCampos();

    // 🔑 CLAVE: liberar estado local
    mesaSeleccionada = null;

    // 🔁 Re-render desde Firebase
    renderMesas();

  } catch (err) {
    console.error(err);
    showToast("❌ Error al completar pedido", "error");
  }
}


async function verPedidosPendientes() {
  try {
    const refPedidos = ref(db, "pedidos");
    const refOnline = ref(db, "pedidosOnline");

    // 🧩 Obtener ambas tablas en paralelo
    const [snapLocal, snapOnline] = await Promise.all([get(refPedidos), get(refOnline)]);

    const pedidosLocal = snapLocal.exists() ? snapLocal.val() : {};
    const pedidosOnline = snapOnline.exists() ? snapOnline.val() : {};

    if (!snapLocal.exists() && !snapOnline.exists()) {
      showToast("📭 No hay pedidos pendientes", "info");
      limpiarCampos();
      return;
    }

    // 🖼️ Construir el HTML del modal
    let html = `<div class="pedidos-modal-content">`;
    html += `<h2 style="color:#d63384;margin-bottom:18px;">Pedidos Pendientes</h2>`;
    html += `<div class="pedidos-grid">`;

    // 🧾 === Pedidos locales ===
    for (const mesa in pedidosLocal) {
      const pedido = pedidosLocal[mesa];
      html += `
        <div class="pedido-card">
          <h3>🍽️ Mesa ${mesa}</h3>
          <div class="pedido-mesero">Mesero: ${pedido.mesero || "—"}</div>
          <div class="pedido-productos">
      `;
      (pedido.items || []).forEach(item => {
        const cantidad = item.cantidad || item.qty || 1;
        html += `<div class="pedido-producto">
          <strong>${item.nombre}</strong> x${cantidad}
          ${item.comentario ? `<span style="color:#ad1457;"> (${item.comentario})</span>` : ""}
        </div>`;
      });
      html += `</div>
        <div class="pedido-total">Total: S/ ${(pedido.total || 0).toFixed(2)}</div>
        </div>
      `;
    }

    // 🌐 === Pedidos Online ===
    for (const id in pedidosOnline) {
      const pedido = pedidosOnline[id];
      html += `
        <div class="pedido-card" style="border-color:#2196f3;">
          <h3>💻 Pedido Online</h3>
          <div class="pedido-mesero">Cliente: ${pedido.cliente || "Anónimo"}</div>
          <div class="pedido-productos">
      `;
      (pedido.items || []).forEach(item => {
        const cantidad = item.cantidad || item.qty || 1;
        html += `<div class="pedido-producto">
          <strong>${item.nombre}</strong> x${cantidad}
          ${item.comentario ? `<span style="color:#1565c0;"> (${item.comentario})</span>` : ""}
        </div>`;
      });
      html += `</div>
        <div class="pedido-total">Total: S/ ${(pedido.total || 0).toFixed(2)}</div>
        <div class="pedido-info" style="font-size:0.85rem;color:#555;">
          <b>Ubicación:</b> ${pedido.ubicacion ? `(${pedido.ubicacion.lat.toFixed(4)}, ${pedido.ubicacion.lng.toFixed(4)})` : "—"}
        </div>
        </div>
      `;
    }

    html += `</div>`; // cierra grid
    html += `<button class="custom-modal-btn" id="cerrarPedidosPendientes">Cerrar</button></div>`;

    // 🪟 Mostrar modal
    const modal = document.getElementById("modalPedidosPendientes") || createModal(html);
    if (modal.id !== "modalPedidosPendientes") modal.id = "modalPedidosPendientes";
    else modal.innerHTML = html;

    modal.className = "pedidos-modal-overlay";
    modal.style.display = "flex";
    modal.querySelector("#cerrarPedidosPendientes").onclick = () => (modal.style.display = "none");

  } catch (err) {
    console.error("Error al cargar pedidos pendientes:", err);
    showToast("❌ Error al cargar pedidos pendientes", "error");
  }
}


async function enviarBoleta() {
  const mesa = await prompt("Número de mesa:");
  if (!mesa) return;

  const refHistorial = ref(db, "historial");
  const snapshot = await get(refHistorial);

  if (!snapshot.exists()) {
    return showToast("❌ No hay historial de pedidos", "error");
  }

  const historial = Object.values(snapshot.val());

  // 🔑 Buscar boleta reciente (3 minutos)
  const recientes = historial.filter(
    p => p.mesa == mesa && Date.now() - p.completadoEn < 180000
  );

  if (recientes.length === 0) {
    return showToast(
      "⚠️ No hay boleta reciente para esta mesa (menos de 3 min)",
      "info"
    );
  }

  const boleta = recientes[recientes.length - 1];

  // 🔔 Elegir opción
  const opcion = await prompt(
    "Escribe una opción:\n1 = Enviar por WhatsApp\n2 = Descargar PDF"
  );

  if (opcion === "1") {
    enviarBoletaPorWhatsapp(boleta);
  } else if (opcion === "2") {
    generarBoletaPDF(boleta);
  } else {
    showToast("❌ Opción no válida", "error");
  }
}

async function enviarBoletaPorWhatsapp(boleta) {
  const numero = await prompt("Número de WhatsApp del cliente (sin +51):");
  if (!numero || isNaN(numero)) {
    return showToast("❌ Número de WhatsApp no válido", "error");
  }

  let texto = `🍽 *Boleta - Mesa ${boleta.mesa}*\n\n`;

  boleta.items.forEach((item, i) => {
    texto += `${i + 1}. ${item.nombre} x${item.cantidad}`;
    if (item.comentario) texto += ` (${item.comentario})`;
    texto += `\n`;
  });

  texto += `\n💵 Total: S/ ${boleta.total.toFixed(2)}`;
  texto += `\n🕐 ${new Date(boleta.completadoEn).toLocaleString()}`;

  const link = `https://wa.me/51${numero}?text=${encodeURIComponent(texto)}`;
  window.open(link, "_blank");
}

function generarBoletaPDF(boleta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  // ================================
  // 🟨 CABECERA
  // ================================
  doc.setFillColor(255, 184, 28);
  doc.rect(0, 0, 210, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(50, 32, 0);
  doc.text("El Camarón de Oro", 15, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Comprobante de Pedido", 195, 20, { align: "right" });

  doc.setDrawColor(180, 180, 180);
  doc.line(10, 36, 200, 36);

  // ================================
  // 📝 DATOS
  // ================================
  let y = 48;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(12);

  const datos = [
    `Mesa: ${boleta.mesa}`,
    `Fecha: ${new Date(boleta.completadoEn).toLocaleString()}`,
    `Atendido por: ${boleta.mesero || "—"}`
  ];

  datos.forEach(t => {
    doc.text(t, 15, y);
    y += 7;
  });

  doc.line(10, y + 4, 200, y + 4);
  y += 15;

  // ================================
  // 🍽️ ITEMS
  // ================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Detalle del Pedido", 15, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Producto", 15, y);
  doc.text("Cant.", 120, y);
  doc.text("Subtotal", 195, y, { align: "right" });
  y += 5;

  doc.line(10, y, 200, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  boleta.items.forEach(it => {
    doc.text(it.nombre, 15, y);
    doc.text(String(it.cantidad), 120, y);
    doc.text(
      `S/ ${(it.precio * it.cantidad).toFixed(2)}`,
      195,
      y,
      { align: "right" }
    );
    y += 7;
  });

  // ================================
  // 💳 TOTAL
  // ================================
  y += 10;
  doc.setFillColor(255, 236, 180);
  doc.roundedRect(10, y, 190, 14, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(60, 40, 0);
  doc.text(`TOTAL:  S/ ${boleta.total.toFixed(2)}`, 20, y + 10);

  // ================================
  // ❤️ PIE
  // ================================
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Gracias por confiar en nosotros ❤️\nEl Camarón de Oro – Sabor que te acompaña",
    15,
    275
  );

  doc.save(`Boleta_Mesa_${boleta.mesa}.pdf`);
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

async function finalizarDivision(pedido, mesa, formasPago) {
  if (!pedido || !mesa || !formasPago) {
    return showToast(
      "Error interno: Faltan datos para finalizar la división.",
      "error"
    );
  }

  try {
    const timestamp = Date.now();
    const refHistorial = ref(db, "historial");

    // 1️⃣ Guardar en historial con el MISMO formato que completarPedido
    const historialEntry = {
      ...pedido,
      mesa, // 🔑 CLAVE para WhatsApp
      completadoEn: timestamp, // 🔑 MISMO campo que enviarBoletaWhatsapp
      pagadoPor: "División de cuenta",
      division: {
        personas: formasPago.length,
        detalle: formasPago
      }
    };

    await push(refHistorial, historialEntry);

    // 2️⃣ Eliminar pedido activo
    const refMesa = ref(db, "pedidos/" + mesa);
    await remove(refMesa);

    // 3️⃣ Limpiar datos temporales de división
    const refTemp = ref(db, "divisionTemporal/" + mesa);
    await remove(refTemp).catch(() => {});
    localStorage.removeItem("divisionTemporal_local_" + mesa);

    // 4️⃣ Resetear estado global
    currentDivision = null;
    mesaSeleccionada = null; // 🔑 CLAVE (igual que completarPedido)

    // 5️⃣ Refrescar UI desde Firebase
    limpiarCampos();
    renderMesas(); // 🔑 CLAVE

    showToast(
      `✅ División de mesa ${mesa} completada y archivada.`,
      "success"
    );

  } catch (error) {
    console.error("Error en finalizarDivision:", error);
    showToast("Error al archivar la división de cuenta.", "error");
  }
}



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

// ==============================
// 🔔 ESCUCHA DE PEDIDOS LISTOS
// ==============================

let estadoAnteriorPedidos = {};
let primeraCarga = true;

// 🔥 ESCUCHAR AMBOS NODOS
escucharPedidosListos("pedidos");
escucharPedidosListos("pedidosOnline");

function escucharPedidosListos(ruta) {
  const pedidosRef = ref(db, ruta);

  onValue(pedidosRef, (snapshot) => {
    const pedidos = snapshot.val() || {};
    const nuevoEstado = {};

    Object.entries(pedidos).forEach(([mesa, pedido]) => {
      (pedido.items || []).forEach((item, index) => {
        if (item.categoria !== "plato") return;

        const total = item.cantidad || 1;
        const lista = item.cantidadLista || 0;

        const clave = `${ruta}-${mesa}-${index}`;
        const firmaActual = `${lista}/${total}`;
        const firmaAnterior = estadoAnteriorPedidos[clave];

        const ahoraListo = lista >= total;
        const estabaListo =
          firmaAnterior && firmaAnterior.startsWith(`${total}/`);

        // 🔔 Notificar SOLO cuando pasa a listo
        if (!primeraCarga && ahoraListo && !estabaListo) {
          showToast(
            `✅ Pedido listo: ${item.nombre} (${ruta === "pedidos" ? "Mesa" : "Online"} ${mesa})`,
            "success"
          );
          reproducirSonidoPedidoListo();
        }

        nuevoEstado[clave] = firmaActual;
      });
    });

    estadoAnteriorPedidos = {
      ...estadoAnteriorPedidos,
      ...nuevoEstado
    };

    primeraCarga = false;
  });
}

// --- FIN: AÑADIR ESTE BLOQUE FINAL ---

