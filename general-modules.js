/* NOVA DIGITEX — catálogo de módulos generales para todos los rubros */
(() => {
  const modules = [
    ["Dashboard principal","Indicadores de ventas, compras, gastos, utilidad y alertas.","Automático"],
    ["Punto de venta (POS)","Ventas rápidas, códigos de barras, pagos, descuentos y devoluciones.","Automático"],
    ["Productos y servicios","Catálogo, categorías, unidades, costos, precios y márgenes.","Común"],
    ["Inventario","Entradas, salidas, transferencias, kardex y existencias.","Automático"],
    ["Compras","Solicitudes, órdenes, recepción y actualización de costos y stock.","Automatizable"],
    ["Proveedores","Contactos, historial de compras y cuentas por pagar.","Común"],
    ["Clientes y CRM","Datos, historial de compras, segmentación y seguimiento comercial.","Común"],
    ["Caja","Apertura, cierre, arqueo, ingresos, egresos y diferencias.","Automatizable"],
    ["Bancos y tesorería","Cuentas, movimientos y conciliación de pagos.","Automatizable"],
    ["Créditos y cobranzas","Créditos autorizados, cuotas, saldos, vencimientos y recordatorios.","Automatizable"],
    ["Cotizaciones y pedidos","Cotizaciones, seguimiento y conversión a ventas.","Automatizable"],
    ["Devoluciones y garantías","Cambios, reingresos, bajas, garantías y notas de crédito.","Controlado"],
    ["Gastos empresariales","Registro de gastos, categorías, comprobantes y presupuestos.","Automatizable"],
    ["Facturación electrónica SUNAT","Boletas, facturas, notas de crédito/débito y seguimiento de XML/CDR.","Integración requerida"],
    ["Reportes","Ventas, compras, inventario, márgenes y resultados por periodo.","Automático"],
    ["Usuarios y permisos","Roles y permisos por módulo y operación.","Controlado"],
    ["Auditoría","Registro de accesos, cambios, anulaciones y responsables.","Automático"],
    ["Empresas y sucursales","Empresas, sedes, cajas, almacenes y separación de información.","Administrativo"],
    ["Configuración general","Datos fiscales, moneda, impuestos, series, pagos e impresoras.","Configurable"],
    ["Automatización","Reglas para stock, precios, alertas, reportes y tareas programadas.","Configurable"],
    ["Notificaciones","Alertas de stock, deudas, vencimientos y operaciones pendientes.","Automático"],
    ["Copias de seguridad","Respaldos programados, verificación y restauración controlada.","Automático"],
    ["Modo offline y sincronización","Cola local, reintentos y control de duplicados al recuperar internet.","Automatizable"],
    ["Integraciones","Lectores, impresoras, pasarelas de pago y servicios externos compatibles.","Integración requerida"],
    ["Configuración adaptable por rubro","Campos, unidades, categorías y funciones activadas según el negocio.","Configurable"]
  ];

  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));

  function renderGeneralModules(filter = "") {
    const root = document.getElementById("view");
    if (!root) return;
    const q = filter.toLocaleLowerCase("es");
    const filtered = modules.filter(m => m.join(" ").toLocaleLowerCase("es").includes(q));
    root.innerHTML = `
      <div class="eyebrow">NOVA DIGITEX · Funciones compartidas</div>
      <h1 class="heading">Módulos generales</h1>
      <p class="sub">Los mismos módulos base para cualquier rubro. Las automatizaciones se ejecutan según reglas configuradas y permisos del usuario.</p>
      <div class="toolbar">
        <button class="light" onclick="home()">← Inicio / Rubros</button>
        <input id="generalModuleSearch" class="search" style="max-width:420px" placeholder="Buscar módulo o función..." value="${esc(filter)}">
        <span class="pill">${filtered.length} de ${modules.length} módulos</span>
      </div>
      <div class="grid" id="generalModuleGrid">
        ${filtered.map((m,i)=>`
          <article class="rubric" style="--accent:${["#147bd1","#15935c","#6740b5","#087c9b"][i%4]};min-height:145px">
            <div class="rubrichead">
              <div class="ico">${["▦","▣","▤","↻","🛒","♧","♙","$","⇄","◷","▧","↩","◉","▤","▥","♙","☷","▦","⚙","⚡","♧","▣","⇅","🔌","◇"][i%25]}</div>
              <div><strong>${esc(m[0])}</strong><small>${esc(m[2])}</small></div>
            </div>
            <small>${esc(m[1])}</small>
          </article>`).join("") || '<div class="empty">No se encontraron módulos.</div>'}
      </div>
      <div class="notice"><b>Importante:</b> esta pantalla documenta el catálogo general de módulos. Las funciones que dependan de Supabase, SUNAT, impresoras o servicios externos requieren configurar y probar esas integraciones antes de utilizarlas en producción.</div>
    `;
    document.getElementById("generalModuleSearch").addEventListener("input", e => renderGeneralModules(e.target.value));
  }

  window.generalModulesPage = function () {
    view = "general";
    if (typeof nav === "function") nav("general");
    if (typeof setAccent === "function") setAccent(null);
    renderGeneralModules("");
  };

  document.addEventListener("DOMContentLoaded", () => {
    const navRoot = document.querySelector(".nav");
    if (navRoot && !navRoot.querySelector('[data-v="general"]')) {
      const button = document.createElement("button");
      button.dataset.v = "general";
      button.textContent = "▦  Módulos generales";
      button.addEventListener("click", window.generalModulesPage);
      navRoot.appendChild(button);
    }
  });
})();
