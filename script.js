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

let audioPedidoListo;

function inicializarSonidoPedidoListo() {
  if (!audioPedidoListo) {
    audioPedidoListo = new Audio("noti.mp3"); // 📂 tu archivo de sonido
  }

  // 🔓 "Desbloquea" el sonido ejecutándolo en silencio al primer click
  audioPedidoListo.muted = true;
  audioPedidoListo.play().then(() => {
    audioPedidoListo.pause();
    audioPedidoListo.currentTime = 0;
    audioPedidoListo.muted = false;
    console.log("🎵 Sonido pedido listo desbloqueado");
  }).catch(err => console.warn("No se pudo inicializar sonido:", err));
}

function reproducirSonidoPedidoListo() {
  if (audioPedidoListo) {
    audioPedidoListo.play().catch(err => console.warn("⚠️ No se pudo reproducir:", err));
  }
}



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
    get(rolRef).then(async (snapshot) => {
 if (snapshot.exists() && snapshot.val() === 'mesero') {
  actualizarUI(user);
} else {
  showToast("🚫 Acceso denegado: No tienes el rol de mesero.", "error");
  signOut(auth);
}

    });
  } else {
    actualizarUI(null);
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast("Por favor ingresa tu correo y contraseña.", "error");
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      showToast("¡Bienvenido!", "success");
    })
    .catch((error) => {
      showToast("Credenciales incorrectas o usuario no encontrado.", "error");
    });
});

logoutBtn.addEventListener("click", async () => {
  signOut(auth)
    .then(() => {
      showToast("Sesión cerrada correctamente.", "info");
    })
    .catch((error) => {
      showToast("Error al cerrar sesión.", "error");
    });
});

function limpiarCampos() {
  mesaInput.value = "";
  buscarInput.value = "";
  lista.innerHTML = "";
  totalTexto.textContent = "Total: S/ 0.00";
  total = 0;
}

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

async function seleccionarProducto(producto) {
  const mesa = await obtenerNumeroMesa();
  if (!mesa) return;

  const cantidad = await prompt(`¿Cuántos "${producto.nombre}"?`);
  if (!cantidad || isNaN(cantidad)) return;

  const comentario = await prompt("Comentario (opcional):") || "";
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

async function guardarPedido() {
  const mesa = mesaInput.value.trim();
  if (!mesa) {
    showToast("⚠️ Ingresa el número de mesa", "error");
    return;
  }

  const pedidoNuevo = pedidosLocales[mesa];
  if (!pedidoNuevo || pedidoNuevo.length === 0) {
    showToast("No hay productos en el pedido.", "error");
    return;
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

      // 🔹 Fusionar los productos nuevos con los existentes
      pedidoFinal = [...existentes];
      pedidoNuevo.forEach(nuevo => {
        const encontrado = pedidoFinal.find(p =>
          p.nombre === nuevo.nombre && p.comentario === nuevo.comentario
        );
        if (encontrado) {
          encontrado.cantidad += nuevo.cantidad;
        } else {
          pedidoFinal.push(nuevo);
        }
      });
    } else {
      // 🔹 Si no existía pedido previo, solo guardar el nuevo
      pedidoFinal = pedidoNuevo;
    }

    // 🔹 Calcular el total acumulado
    const total = pedidoFinal.reduce(
      (acc, item) => acc + (item.precio || 0) * (item.cantidad || 1),
      0
    );

    // 🔹 Guardar en Firebase
    await set(referencia, {
      mesa,
      total,
      items: pedidoFinal,
      mesero: meseroAsignado,
      actualizadoPor: currentMeseroEmail,
      actualizadoEn: Date.now()
    });

    showToast(`✅ Pedido de mesa ${mesa} actualizado correctamente`, "success");
    limpiarCampos();
    delete pedidosLocales[mesa];
  } catch (err) {
    console.error("Error en guardarPedido:", err);
    showToast("Error al guardar el pedido.", "error");
  }
}


// Listener único de Guardar Pedido (fuera de la función)
const _guardarBtn = document.getElementById("guardarBtn");
if (_guardarBtn && !_guardarBtn.dataset.listenerGuard) {
  _guardarBtn.addEventListener("click", async () => {
    await guardarPedido();
    inicializarSonidoPedidoListo();
  });
  _guardarBtn.dataset.listenerGuard = "1";
}



async function verBoleta() {
  const mesa = await prompt("Número de mesa:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  get(refMesa).then(async snapshot => {
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
    html += `</div>
      <div class="pedido-total">Total: S/ ${datos.items.reduce((acc, item) => acc + item.precio * item.cantidad, 0).toFixed(2)}</div>
      </div>
      <button class="custom-modal-btn" id="cerrarBoleta">Cerrar</button>
      </div>`;

    // Mostrar modal
    const modal = document.getElementById("modalBoleta");
    modal.innerHTML = html;
    modal.className = "pedidos-modal-overlay";
    modal.style.display = "flex";
    document.getElementById("cerrarBoleta").onclick = () => {
      modal.style.display = "none";
      limpiarCampos();
    };
  });
}

async function editarPedido() {
  const mesa = await prompt("Mesa a editar:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  get(refMesa).then(async snapshot => {
   if (!snapshot.exists()) return showToast("❌ No hay pedido", "error");

    const datos = snapshot.val();
    let pedido = datos.items;

    // Construir el formulario visual
    let html = `<div class="custom-modal-message"><strong>Editar pedido de mesa ${mesa}</strong></div>`;
    html += `<div style="margin-bottom:16px;">`;
    pedido.forEach((p, i) => {
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

    // Mostrar modal
    const modal = createModal(html);

    // Eventos para los botones
    modal.querySelectorAll("button[data-action]").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute("data-index"));
        const action = btn.getAttribute("data-action");
        if (action === "plus") {
          pedido[idx].cantidad++;
        } else if (action === "minus") {
          if (pedido[idx].cantidad > 1) pedido[idx].cantidad--;
        } else if (action === "delete") {
          pedido.splice(idx, 1);
        }
        // Actualizar el modal con los nuevos valores
        document.body.removeChild(modal);
        editarPedidoRedraw(mesa, datos, pedido);
      };
    });

    // Guardar cambios
    modal.querySelector("#guardarCambiosPedido").onclick = async () => {
await set(refMesa, {
  mesa,
  total: pedido.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
  items: pedido,
  mesero: datos.mesero,
  modificadoPor: currentMeseroEmail
});
document.body.removeChild(modal);
showToast("✏ Pedido actualizado", "success");

limpiarCampos();

    };

    // Cancelar edición
    modal.querySelector("#cancelarEdicionPedido").onclick = () => {
      document.body.removeChild(modal);
    };
  });
}

// Función auxiliar para redibujar el formulario tras cada cambio
async function editarPedidoRedraw(mesa, datos, pedido) {
  let html = `<div class="custom-modal-message"><strong>Editar pedido de mesa ${mesa}</strong></div>`;
  html += `<div style="margin-bottom:16px;">`;

pedido.forEach((p, i) => {
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
        pedido[idx].cantidad++;
      } else if (action === "minus") {
        if (pedido[idx].cantidad > 1) pedido[idx].cantidad--;
      } else if (action === "delete") {
        pedido.splice(idx, 1);
      }
      document.body.removeChild(modal);
      editarPedidoRedraw(mesa, datos, pedido);
    };
  });

  modal.querySelector("#guardarCambiosPedido").onclick = async () => {
    await set(ref(db, "pedidos/" + mesa), {
      mesa,
      total: pedido.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
      items: pedido,
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

async function completarPedido() {
  const mesa = await prompt("Número de mesa a completar:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  get(refMesa).then(async snapshot => {
  if (!snapshot.exists()) return showToast("❌ No hay pedido", "error");
    const pedido = snapshot.val();
    const timestamp = Date.now();
    const refHistorial = ref(db, "historial");
    push(refHistorial, {
      ...pedido,
      fecha: timestamp
    }).then(() => {
      remove(refMesa).then(async () => {
      showToast(`✅ Pedido de mesa ${mesa} completado y archivado`, "success");
        limpiarCampos();
      });
    });
  });
}

async function verPedidosPendientes() {
  const referencia = ref(db, "pedidos");
  get(referencia).then(async snapshot => {
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
    html += `</div>`; // Cierra pedidos-grid
    html += `<button class="custom-modal-btn" id="cerrarPedidosPendientes">Cerrar</button></div>`;

    // Mostrar modal
    const modal = document.getElementById("modalPedidosPendientes");
    modal.innerHTML = html;
    modal.className = "pedidos-modal-overlay";
    modal.style.display = "flex";
    document.getElementById("cerrarPedidosPendientes").onclick = () => {
      modal.style.display = "none";
      limpiarCampos();
    };
  });
}

async function enviarBoletaWhatsapp() {
  const mesa = await prompt("Número de mesa:");
  const numero = await prompt("Número de WhatsApp del cliente (sin +51):");

  // Validaciones básicas
if (!mesa || !numero || isNaN(numero)) {
  return showToast("❌ Número de mesa o WhatsApp no válidos.", "error");
}

  const refHistorial = ref(db, "historial");

  get(refHistorial).then(async snapshot => {
  if (!snapshot.exists()) return showToast("❌ No hay historial de pedidos", "error");

    const historial = Object.values(snapshot.val());
    const recientes = historial.filter(p => p.mesa === mesa && Date.now() - p.fecha < 180000);

  if (recientes.length === 0) {
  return showToast("⚠️ No hay boleta reciente para esta mesa (menos de 3 min)", "info");
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
  get(refProductos).then(async snapshot => {
if (!snapshot.exists()) return showToast("❌ No hay productos cargados", "error");

    productos = Object.values(snapshot.val());
    lista.innerHTML = "";
  });
}

// ---------------------- DIVIDIR / PAUSAR / REANUDAR (versión extendida y corregida) ----------------------

// Estado global
let estadoDivision = "activa";
let datosDivisionTemporal = null;
let currentDivision = null;

// Función auxiliar: redondeo 2 decimales
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// ✅ Función para finalizar división y guardar en historial
async function finalizarDivision(pedido, mesa, formasPago) {
  const usuario = auth.currentUser;
  if (!usuario) return showToast("⚠️ No estás autenticado.", "error");

  const timestamp = Date.now();

  const registroHistorial = {
    mesa,
    total: pedido.total || pedido.items?.reduce((acc, i) => acc + i.precio * i.cantidad, 0) || 0,
    items: pedido.items || pedido.productos || [],
    formasPago,
    fecha: timestamp,
    atendidoPor: usuario.email || usuario.uid
  };

  const refHistorial = ref(db, "historial");
  push(refHistorial, registroHistorial)
    .then(() => remove(ref(db, "pedidos/" + mesa)))
    .then(() => remove(ref(db, "divisionTemporal/" + mesa)))
    .then(() => {
      showToast("✅ División finalizada y guardada en historial.", "success");
      estadoDivision = "activa";
      datosDivisionTemporal = null;
      currentDivision = null;
      document.getElementById("modalDividir").style.display = "none";
    })
    .catch(err => {
      console.error("Error al finalizar división:", err);
      showToast("⚠️ Ocurrió un error al finalizar la división.", "error");
    });
}


// Guardar división temporal (Firebase o local)
function guardarDivisionTemporal(pedido, mesa) {
  if (!currentDivision) return;
  const payload = {
    pedido,
    mesa,
    num: currentDivision.num,
    pagos: currentDivision.pagos,
    metodo: currentDivision.metodo,
    entregado: currentDivision.entregado,
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

// Mostrar formulario de división
async function mostrarFormularioDivision(pedido, mesa, datosGuardados = null) {
  const productos = pedido.items || pedido.productos || [];
if (!Array.isArray(productos) || productos.length === 0) return showToast("No hay productos en el pedido.", "error");

  // Determinar número de personas
  let num;
  if (datosGuardados?.num && Number.isInteger(datosGuardados.num) && datosGuardados.num > 0) {
    num = datosGuardados.num;
  } else {
    const partes = await prompt("¿Entre cuántas personas dividirás la cuenta?");
    num = parseInt(partes);
  if (!num || num < 1) return showToast("Número no válido", "error");
  }

  // Calcular totales originales
  const originalProductTotals = productos.map(p =>
    round2((parseFloat(p.precio) || 0) * (parseInt(p.cantidad) || 1))
  );

  // Estado centralizado
  currentDivision = {
    pedido,
    mesa,
    num,
    productos,
    originalProductTotals,
    pagos: datosGuardados?.pagos || Array.from({ length: num }, () => Array(productos.length).fill(0)),
    metodo: datosGuardados?.metodo || Array(num).fill("efectivo"),
    entregado: datosGuardados?.entregado || Array(num).fill(null),
  };

  // Contenedor
  const contenedor = document.getElementById("contenedorFormasPago");
if (!contenedor) return showToast("No se encontró contenedor del modal.", "error");
  contenedor.innerHTML = "";

  // Renderizar resumen inicial con TOTAL y PENDIENTE
  let resumenHtml = `
    <div class="division-resumen animate-fadein">
      <h2>Dividir cuenta - Mesa ${mesa}</h2>
      <div><strong>Total pedido:</strong> S/ ${originalProductTotals.reduce((a, b) => a + b, 0).toFixed(2)}</div>
      <div><strong>Pendiente:</strong> S/ <span id="pendienteTotal">0.00</span></div>
      <div class="division-productos-list">
        ${productos.map((p, j) => `
          <div class="division-producto-item">
            <strong>${p.nombre}</strong> x${p.cantidad} — S/ ${originalProductTotals[j].toFixed(2)}
          </div>
        `).join("")}
      </div>
      <div class="division-instruccion">
        <span>Indica cuánto pagará cada persona por cada producto.<br>
        Presiona <b>Pagar</b> para reservar el monto.<br>
        El botón <b>Confirmar división</b> se habilitará cuando todo esté pagado.</span>
      </div>
    </div>
  `;
  contenedor.insertAdjacentHTML("beforeend", resumenHtml);

  // Crear tarjetas por persona
  for (let i = 0; i < num; i++) {
    let cardHtml = `
      <div class="division-persona-card animate-fadein" data-index="${i}">
        <h4>Persona ${i + 1}</h4>
        <div class="division-persona-productos">
          ${productos.map((prod, j) => `
            <div class="division-producto-row" id="row_${i}_${j}">
              <span class="division-producto-nombre">${prod.nombre}</span>
              <input type="number" min="0" step="0.01" id="pago_${i}_${j}" 
                placeholder="0.00" class="division-input" value="${currentDivision.pagos[i][j] || ""}" />
              <button id="btnPagar_${i}_${j}" class="division-btn">Pagar</button>
              <span id="saldo_${j}" class="division-saldo pendiente"></span>
              <span id="conf_${i}_${j}" class="division-confirm"></span>
            </div>
          `).join("")}
        </div>
        <div class="division-subtotal">Subtotal: S/ <span id="subtotal_${i}">0.00</span></div>
        <div class="division-metodo-pago">
          <label>Método:</label>
          <select id="metodo_${i}">
            <option value="efectivo" ${currentDivision.metodo[i]==="efectivo"?"selected":""}>Efectivo</option>
            <option value="Yape" ${currentDivision.metodo[i]==="Yape"?"selected":""}>Yape</option>
            <option value="Plin" ${currentDivision.metodo[i]==="Plin"?"selected":""}>Plin</option>
            <option value="tarjeta" ${currentDivision.metodo[i]==="tarjeta"?"selected":""}>Tarjeta</option>
          </select>
          <div id="efectivo_wrap_${i}" class="efectivo-wrap" style="display:${currentDivision.metodo[i]==="efectivo"?"block":"none"};">
            <label>Monto entregado:</label>
            <input type="number" id="entregado_${i}" min="0" step="0.01" value="${currentDivision.entregado[i] || ""}" />
            <div><small id="vuelto_${i}" class="vuelto"></small></div>
          </div>
        </div>
      </div>
    `;
    contenedor.insertAdjacentHTML("beforeend", cardHtml);
  }

  // Botones de acciones (nuevo: Cancelar)
  contenedor.insertAdjacentHTML("beforeend", `
    <div class="division-actions">
      <button id="btnCancelarDivision" class="division-btn">❌ Cancelar</button>
      <button id="btnPausarDivision" class="division-btn">⏸ Pausar</button>
      <button id="btnConfirmarDivision" class="division-btn division-btn-disabled" disabled>✅ Confirmar división</button>
    </div>
  `);

  // Mostrar modal
  document.getElementById("modalDividir").style.display = "flex";
  contenedor.scrollTop = 0;

  // ===== FUNCIONES AUXILIARES =====
  function calcularSaldoProducto(j) {
    const totalPagado = currentDivision.pagos.reduce((sum, arr) => sum + arr[j], 0);
    return round2(originalProductTotals[j] - totalPagado);
  }

  function calcularSubtotalPersona(i) {
    return round2(currentDivision.pagos[i].reduce((a, b) => a + b, 0));
  }

  function registrarPago(i, j, monto) {
    currentDivision.pagos[i][j] = monto;
    renderUI();
  }

  function deshacerPago(i, j) {
    currentDivision.pagos[i][j] = 0;
    renderUI();
  }

  function renderUI() {
    // Actualizar saldos por producto
    for (let j = 0; j < productos.length; j++) {
      const saldo = calcularSaldoProducto(j);
      const spans = document.querySelectorAll(`#saldo_${j}`);
      spans.forEach(span => {
        span.textContent = saldo > 0 ? `Falta: S/ ${saldo.toFixed(2)}` : "Pagado";
        span.className = "division-saldo " + (saldo > 0 ? "pendiente" : "pagado");
      });
    }

    // Subtotales y vuelto
    for (let i = 0; i < num; i++) {
      document.getElementById(`subtotal_${i}`).textContent = calcularSubtotalPersona(i).toFixed(2);

      for (let j = 0; j < productos.length; j++) {
        const conf = document.getElementById(`conf_${i}_${j}`);
        const btn = document.getElementById(`btnPagar_${i}_${j}`);
        const inp = document.getElementById(`pago_${i}_${j}`);
        const monto = currentDivision.pagos[i][j];

        if (monto > 0) {
          inp.disabled = true;
          btn.disabled = true;
          conf.innerHTML = `<span class="division-confirm-ok">✓ S/ ${monto.toFixed(2)}</span> 
                            <button id="undo_${i}_${j}" class="deshacer-btn">↩</button>`;
          document.getElementById(`undo_${i}_${j}`).onclick = () => deshacerPago(i, j);
        } else {
          inp.disabled = false;
          btn.disabled = false;
          conf.textContent = "";
        }
      }

      if (currentDivision.metodo[i] === "efectivo") {
        const entregado = parseFloat(document.getElementById(`entregado_${i}`).value) || null;
        currentDivision.entregado[i] = entregado;
        const vueltoSpan = document.getElementById(`vuelto_${i}`);
        if (entregado != null) {
          const vuelto = round2(entregado - calcularSubtotalPersona(i));
          vueltoSpan.textContent = vuelto >= 0 ? `Vuelto: S/ ${vuelto.toFixed(2)}` : "Monto insuficiente";
        } else {
          vueltoSpan.textContent = "";
        }
      }
    }

    // 🔹 Actualizar pendiente total
    const totalPedido = originalProductTotals.reduce((a, b) => a + b, 0);
    const totalPagado = currentDivision.pagos.flat().reduce((a, b) => a + b, 0);
    document.getElementById("pendienteTotal").textContent = (totalPedido - totalPagado).toFixed(2);

    checkConfirmButton();
  }

  function checkConfirmButton() {
    const btnConfirmar = document.getElementById("btnConfirmarDivision");
    if (!btnConfirmar) return;
    const allPagado = currentDivision.productos.every((_, j) => calcularSaldoProducto(j) <= 0.01);
    btnConfirmar.disabled = !allPagado;
    btnConfirmar.classList.toggle("division-btn-disabled", !allPagado);
  }

  // ===== EVENTOS =====
  for (let i = 0; i < num; i++) {
    for (let j = 0; j < productos.length; j++) {
      const pagoInp = document.getElementById(`pago_${i}_${j}`);
      const btnPagar = document.getElementById(`btnPagar_${i}_${j}`);

      btnPagar.addEventListener("click", async () => {
        const monto = round2(parseFloat(pagoInp.value) || 0);
        const saldo = calcularSaldoProducto(j);
    if (monto <= 0) return showToast("Monto inválido", "error");
if (monto > saldo + 0.0001) return showToast(`El monto excede el saldo. Saldo: S/ ${saldo.toFixed(2)}`, "error");

        registrarPago(i, j, monto);
      });
    }

    const metodoSelect = document.getElementById(`metodo_${i}`);
    const efectivoWrap = document.getElementById(`efectivo_wrap_${i}`);
    const entregadoInput = document.getElementById(`entregado_${i}`);

    metodoSelect.addEventListener("change", function () {
      currentDivision.metodo[i] = this.value;
      efectivoWrap.style.display = this.value === "efectivo" ? "block" : "none";
      renderUI();
    });

    entregadoInput.addEventListener("input", () => renderUI());
  }

  // 🔹 Cancelar
  document.getElementById("btnCancelarDivision").addEventListener("click", () => {
    estadoDivision = "activa";
    datosDivisionTemporal = null;
    currentDivision = null;
    document.getElementById("modalDividir").style.display = "none";
    showToast("❌ División cancelada.", "error");
  });

  // Pausar
  document.getElementById("btnPausarDivision").addEventListener("click", async () => {
    await guardarDivisionTemporal(pedido, mesa);
 showToast("⏸ División pausada. Puedes reanudar más tarde.", "info");

    document.getElementById("modalDividir").style.display = "none";
  });

// Confirmar
document.getElementById("btnConfirmarDivision").addEventListener("click", async () => {
  if (!currentDivision) return showToast("No hay división en curso.", "error");

  const formasPago = currentDivision.pagos.map((arrPagos, i) => {
    const subtotal = arrPagos.reduce((a, b) => a + b, 0);
    return {
      persona: i + 1,
      metodo: currentDivision.metodo[i] || "efectivo",
      entregado: currentDivision.entregado[i] ?? null, // 👈 evita undefined
      subtotal: round2(subtotal),
      pagos: arrPagos.map(v => round2(v))
    };
  });

  await finalizarDivision(currentDivision.pedido, currentDivision.mesa, formasPago);
});


  // Inicial
  renderUI();
}


// ---------------------- MODALES PERSONALIZADOS ----------------------
function createModal(html) {
  let modal = document.createElement("div");
  modal.className = "custom-modal-overlay";
  modal.innerHTML = `<div class="custom-modal">${html}</div>`;
  document.body.appendChild(modal);
  return modal;
}

function showModal(message) {
  return new Promise(resolve => {
    const modal = createModal(`
      <div class="custom-modal-message">${message}</div>
      <button class="custom-modal-btn">Aceptar</button>
    `);
    modal.querySelector(".custom-modal-btn").onclick = () => {
      document.body.removeChild(modal);
      resolve();
    };
  });
}

function showInputModal(message, placeholder = "") {
  return new Promise(resolve => {
    const modal = createModal(`
      <div class="custom-modal-message">${message}</div>
      <input class="custom-modal-input" type="text" placeholder="${placeholder}" />
      <div class="custom-modal-actions">
        <button class="custom-modal-btn">Aceptar</button>
        <button class="custom-modal-btn cancel">Cancelar</button>
      </div>
    `);
    const input = modal.querySelector(".custom-modal-input");
    modal.querySelector(".custom-modal-btn").onclick = () => {
      const value = input.value;
      document.body.removeChild(modal);
      resolve(value);
    };
    modal.querySelector(".custom-modal-btn.cancel").onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };
    input.focus();
  });
}

function showConfirmModal(message) {
  return new Promise(resolve => {
    const modal = createModal(`
      <div class="custom-modal-message">${message}</div>
      <div class="custom-modal-actions">
        <button class="custom-modal-btn">Sí</button>
        <button class="custom-modal-btn cancel">No</button>
      </div>
    `);
    modal.querySelector(".custom-modal-btn").onclick = () => {
      document.body.removeChild(modal);
      resolve(true);
    };
    modal.querySelector(".custom-modal-btn.cancel").onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };
  });
}

// Reemplaza alert, prompt y confirm
window.alert = async function(msg) { await showModal(msg); };
window.prompt = async function(msg, placeholder = "") { return await showInputModal(msg, placeholder); };
window.confirm = async function(msg) { return await showConfirmModal(msg); };

// ---------------------- TOASTS PERSONALIZADOS ----------------------
function showToast(message, type = "info") {
  // Crear contenedor si no existe
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // Crear el toast
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Agregar al contenedor
  container.appendChild(toast);

  // Eliminar automáticamente después de la animación
  toast.addEventListener("animationend", (e) => {
    if (e.animationName === "fadeOut") {
      toast.remove();
    }
  });
}



// ================== ENLACES BOTONES ==================
// (eliminado listener duplicado de guardarBtn)
document.getElementById("verBoletaBtn")?.addEventListener("click", verBoleta);
document.getElementById("editarBtn")?.addEventListener("click", editarPedido);
document.getElementById("completarBtn")?.addEventListener("click", completarPedido);
document.getElementById("verPendientesBtn")?.addEventListener("click", verPedidosPendientes);
document.getElementById("enviarWhatsappBtn")?.addEventListener("click", enviarBoletaWhatsapp);
document.getElementById("dividirCuentaBtn")?.addEventListener("click", async () => {
  const mesa = await prompt("Número de mesa a dividir:");
  if (!mesa) return;
  const refMesa = ref(db, "pedidos/" + mesa);
  const snapshot = await get(refMesa);
  if (!snapshot.exists()) return showToast("❌ No hay pedido", "error");
  const pedido = snapshot.val();

  try {
    const refTemp = ref(db, "divisionTemporal/" + mesa);
    const snapshotTemp = await get(refTemp);
    let datosGuardados = null;

    if (snapshotTemp.exists()) {
      const continuar = await confirm("⏯ Hay una división pausada. ¿Deseas reanudarla?");
      if (!continuar) {
        await remove(refTemp);
      } else {
        datosGuardados = snapshotTemp.val();
      }
    } else {
      const localData = localStorage.getItem("divisionTemporal_local_" + mesa);
      if (localData) {
        const continuarLocal = await confirm("⏯ Hay una división pausada localmente. ¿Deseas reanudarla?");
        if (continuarLocal) {
          datosGuardados = JSON.parse(localData);
        } else {
          localStorage.removeItem("divisionTemporal_local_" + mesa);
        }
      }
    }

    mostrarFormularioDivision(pedido, mesa, datosGuardados);

  } catch (err) {
    console.error("Error al verificar división guardada:", err);
   showToast("⚠️ Ocurrió un error al verificar divisiones pausadas.", "error");
  }
});


// === Notificación cuando un producto se marca como listo en cocina ===
let estadoAnteriorPedidos = {}; // para detectar cambios
let primeraCarga = true;

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

        if (!primeraCarga) {
          if (ahoraListo && !estabaListo) {
            showToast(`✅ Pedido listo: ${item.nombre} (Mesa ${mesa})`, "success");
            reproducirSonidoPedidoListo?.();
          }
        }

        estadoAnteriorPedidos[clave] = ahoraListo;
      });
    });

    primeraCarga = false;
  });
}


// Llamar después del login de mesero
escucharPedidosListos();
