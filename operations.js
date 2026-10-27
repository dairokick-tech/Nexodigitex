/* NOVA DIGITEX — gestión general multiempresa (frontend) */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cash = n => 'S/ ' + Number(n || 0).toFixed(2);
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
  const write = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'nv-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  const userKey = prefix => prefix + (currentUser?.id || 'local');
  const companyId = () => currentUser ? localStorage.getItem('nova_active_company_' + currentUser.id) : localStorage.getItem('nova_last_company_id');
  const setCompany = id => { if(id){ localStorage.setItem('nova_last_company_id',id); if(currentUser) localStorage.setItem('nova_active_company_' + currentUser.id,id); } };
  const localKey = table => 'nova_' + table + '_' + (companyId() || 'local');
  const requireSession = () => {
    if (!sb || !currentUser) { alert('Conecta Supabase e entra con tu cuenta en Supabase y configuración para administrar empresas y sincronizar datos.'); if(typeof settingsPage==='function') settingsPage(); return false; }
    return true;
  };
  const activeCompany = async () => {
    if(!requireSession()) return null;
    const id=companyId();
    if(!id) { await window.companiesPage(); alert('Crea una empresa y selecciónala antes de registrar operaciones.'); return null; }
    const {data,error}=await sb.from('companies').select('id,name,tax_id,industry,currency').eq('id',id).maybeSingle();
    if(error || !data) { localStorage.removeItem('nova_active_company_'+currentUser.id); alert('Selecciona una empresa válida.'); await window.companiesPage(); return null; }
    return data;
  };
  const loadRows = async (table, localFallback=true) => {
    const cid=companyId();
    if(sb && currentUser && cid) {
      const {data,error}=await sb.from(table).select('*').eq('company_id',cid).order('created_at',{ascending:false}).limit(500);
      if(!error) return {rows:data||[],remote:true};
      console.warn('NOVA '+table+':',error.message);
    }
    return {rows:localFallback?read(localKey(table)):[],remote:false};
  };
  const saveRow = async (table,row) => {
    const cid=companyId();
    if(sb && currentUser && cid) {
      const {data,error}=await sb.from(table).insert({...row,company_id:cid,created_by:currentUser.id}).select().single();
      if(!error) return {row:data,remote:true};
      throw new Error(error.message);
    }
    const rows=read(localKey(table)); rows.unshift({...row,id:row.id||uid(),created_at:new Date().toISOString(),status:'local'}); write(localKey(table),rows);
    return {row:rows[0],remote:false};
  };
  const top = (eyebrow,title,sub,actions='') => '<div class="eyebrow">'+esc(eyebrow)+'</div><h1 class="heading">'+esc(title)+'</h1><p class="sub">'+esc(sub)+'</p><div class="toolbar"><button class="light" onclick="home()">← Inicio</button>'+actions+'</div>';
  const notice = msg => '<div class="notice">'+msg+'</div>';
  const table = (headers,rows,empty='No hay registros todavía.') => '<div class="panel tablewrap"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td class="empty" colspan="'+headers.length+'">'+esc(empty)+'</td></tr>')+'</tbody></table></div>';

  window.companiesPage = async function() {
    view='companies'; nav('companies'); setAccent(null);
    $('view').innerHTML=top('Administración empresarial','Empresas y sucursales','Crea empresas, selecciona el espacio de trabajo y administra sus locales.')+
      '<div class="panel"><h3>Crear empresa</h3><form id="companyForm"><div class="field"><label>Razón social o nombre comercial</label><input id="coName" required minlength="2" maxlength="160" placeholder="Mi empresa S.A.C."></div><div class="field"><label>RUC (opcional)</label><input id="coTax" maxlength="20" placeholder="RUC"></div><div class="field"><label>Rubro principal</label><select id="coIndustry"><option>Comercio general</option><option>Bodega y minimarket</option><option>Ropa y calzado</option><option>Ferretería</option><option>Restaurante</option><option>Farmacia</option><option>Distribuidora</option><option>Servicios</option><option>Otro</option></select></div><button class="primary">Crear empresa</button></form><p class="sub" id="coMessage" style="margin:12px 0 0"></p></div><div id="companyList"></div>'+
      notice('La empresa se crea en la base central con políticas de acceso por membresía. Para crear bases PostgreSQL físicas separadas por empresa se necesita un backend privado adicional; esta aplicación de navegador no contiene claves administrativas.');
    const form=$('companyForm');
    form.onsubmit=async e=>{
      e.preventDefault(); if(!requireSession()) return;
      const name=$('coName').value.trim(),tax_id=$('coTax').value.trim(),industry=$('coIndustry').value;
      const {data,error}=await sb.from('companies').insert({name,tax_id:tax_id||null,industry,created_by:currentUser.id}).select('id,name,tax_id,industry').single();
      if(error){$('coMessage').textContent='No se pudo crear la empresa: '+error.message;return;}
      setCompany(data.id); $('coMessage').textContent='Empresa creada y seleccionada.'; form.reset(); await window.companiesPage();
    };
    const list=$('companyList');
    if(!requireSession()){list.innerHTML=notice('Inicia sesión para crear y consultar empresas. El catálogo de módulos sigue disponible en modo demostración.');return;}
    const {data,error}=await sb.from('companies').select('id,name,tax_id,industry,currency,created_at').order('created_at',{ascending: false});
    if(error){list.innerHTML=notice('No se pudieron cargar las empresas. Verifica que ejecutaste supabase/schema.sql: '+esc(error.message));return;}
    const companies=data||[];
    list.innerHTML='<h3 style="margin-top:22px">Mis empresas ('+companies.length+')</h3>'+companies.map(c=>'<div class="panel" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><strong>'+esc(c.name)+'</strong><div class="sub" style="margin:5px 0 0">'+esc(c.industry||'Comercio general')+' · RUC: '+esc(c.tax_id||'No registrado')+'</div></div><div class="toolbar"><span class="pill">'+(c.id===companyId()?'Seleccionada':'Empresa')+'</span><button class="'+(c.id===companyId()?'success':'primary')+'" onclick="selectNovaCompany(\''+c.id+'\')">'+(c.id===companyId()?'Seleccionada':'Usar empresa')+'</button><button class="light" onclick="branchesPage(\''+c.id+'\')">Sucursales</button></div></div>').join('')||notice('Todavía no hay empresas. Crea la primera arriba.');
  };
  window.selectNovaCompany = async id => { setCompany(id); await window.companiesPage(); setStatus('● Empresa seleccionada','ok'); };
  window.branchesPage = async function(companyOverride) {
    if(companyOverride) setCompany(companyOverride);
    const co=await activeCompany(); if(!co)return;
    view='branches'; nav('companies'); setAccent(null);
    $('view').innerHTML=top('Organización','Sucursales','Empresa activa: '+co.name)+
      '<div class="panel"><h3>Registrar sucursal</h3><form id="branchForm"><div class="field"><label>Código</label><input id="brCode" required placeholder="SEDE-01"></div><div class="field"><label>Nombre de sucursal</label><input id="brName" required placeholder="Local principal"></div><div class="field"><label>Dirección (opcional)</label><input id="brAddress"></div><button class="primary">Guardar sucursal</button></form></div><div id="branchRows"></div>';
    $('branchForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('branches').insert({company_id:co.id,code:$('brCode').value.trim(),name:$('brName').value.trim(),address:$('brAddress').value.trim()||null});if(error){alert(error.message);return}await window.branchesPage();};
    const {data,error}=await sb.from('branches').select('*').eq('company_id',co.id).order('created_at',{ascending:false});
    $('branchRows').innerHTML=error?notice(esc(error.message)):table(['Código','Sucursal','Dirección','Estado'],(data||[]).map(x=>'<tr><td>'+esc(x.code)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.address||'—')+'</td><td>'+(x.active?'Activa':'Inactiva')+'</td></tr>'));
  };
  window.productsPage = async function() {
    const co=await activeCompany(); if(!co)return; view='products';nav('products');setAccent(null);
    $('view').innerHTML=top('Catálogo general','Productos e inventario','Empresa activa: '+co.name+'. Registra artículos y consulta sus movimientos.')+
      '<div class="panel"><h3>Nuevo producto</h3><form id="productForm"><div class="field"><label>Nombre del producto</label><input id="prName" required></div><div class="field"><label>Código interno / SKU</label><input id="prSku"></div><div class="field"><label>Código de barras</label><input id="prBar"></div><div class="field"><label>Categoría</label><input id="prCat" value="General"></div><div class="field"><label>Unidad de medida</label><input id="prUnit" value="unidad"></div><div class="field"><label>Costo (S/)</label><input id="prCost" type="number" min="0" step=".0001" value="0" required></div><div class="field"><label>Precio de venta (S/)</label><input id="prPrice" type="number" min="0" step=".0001" value="0" required></div><div class="field"><label>Stock inicial</label><input id="prInitial" type="number" min="0" step=".001" value="0" required></div><div class="field"><label>Stock mínimo</label><input id="prMin" type="number" min="0" step=".001" value="0" required></div><button class="primary">Guardar producto</button></form><p id="prMessage" class="sub" style="margin:12px 0 0"></p></div><div id="productsRows"></div>';
    $('productForm').onsubmit=async e=>{e.preventDefault();const row={company_id:co.id,name:$('prName').value.trim(),sku:$('prSku').value.trim()||null,barcode:$('prBar').value.trim()||null,category:$('prCat').value.trim()||'General',unit:$('prUnit').value.trim()||'unidad',cost:Number($('prCost').value),price:Number($('prPrice').value),initial_stock:Number($('prInitial').value),min_stock:Number($('prMin').value),created_by:currentUser.id};
      const {error}=await sb.from('products').insert(row);if(error){$('prMessage').textContent='No se pudo guardar: '+error.message;return}e.target.reset();$('prCat').value='General';$('prUnit').value='unidad';$('prCost').value='0';$('prPrice').value='0';$('prInitial').value='0';$('prMin').value='0';await window.productsPage();};
    const {data,error}=await sb.from('products').select('*').eq('company_id',co.id).order('created_at',{ascending:false}).limit(500);
    $('productsRows').innerHTML=error?notice(esc(error.message)):table(['Producto','SKU / barras','Categoría','Costo','Precio','Margen bruto','Stock inicial','Stock mínimo'],(data||[]).map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.sku||'—')+' / '+esc(p.barcode||'—')+'</td><td>'+esc(p.category)+'</td><td>'+cash(p.cost)+'</td><td>'+cash(p.price)+'</td><td>'+cash(Number(p.price)-Number(p.cost))+'</td><td>'+esc(p.initial_stock||0)+'</td><td>'+esc(p.min_stock)+'</td></tr>'),'No hay productos registrados.');
  };
  window.suppliersPage = async function() {
    const co=await activeCompany();if(!co)return;view='suppliers';nav('suppliers');setAccent(null);
    $('view').innerHTML=top('Abastecimiento','Proveedores','Empresa activa: '+co.name)+
      '<div class="panel"><h3>Nuevo proveedor</h3><form id="supplierForm"><div class="field"><label>Nombre / razón social</label><input id="suName" required></div><div class="field"><label>RUC o documento</label><input id="suTax"></div><div class="field"><label>Teléfono</label><input id="suPhone"></div><div class="field"><label>Correo</label><input id="suEmail" type="email"></div><div class="field"><label>Dirección</label><input id="suAddress"></div><button class="primary">Guardar proveedor</button></form></div><div id="supplierRows"></div>';
    $('supplierForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('suppliers').insert({company_id:co.id,name:$('suName').value.trim(),tax_id:$('suTax').value.trim()||null,phone:$('suPhone').value.trim()||null,email:$('suEmail').value.trim()||null,address:$('suAddress').value.trim()||null,created_by:currentUser.id});if(error){alert(error.message);return}await window.suppliersPage();};
    const {data,error}=await sb.from('suppliers').select('*').eq('company_id',co.id).order('created_at',{ascending:false}).limit(500);
    $('supplierRows').innerHTML=error?notice(esc(error.message)):table(['Proveedor','RUC/documento','Teléfono','Correo','Dirección'],(data||[]).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.tax_id||'—')+'</td><td>'+esc(x.phone||'—')+'</td><td>'+esc(x.email||'—')+'</td><td>'+esc(x.address||'—')+'</td></tr>'));
  };
  window.expensesPage = async function() {
    const co=await activeCompany();if(!co)return;view='expenses';nav('expenses');setAccent(null);
    $('view').innerHTML=top('Finanzas','Gastos empresariales','Empresa activa: '+co.name)+
      '<div class="panel"><h3>Registrar gasto</h3><form id="expenseForm"><div class="field"><label>Categoría</label><select id="exCat"><option>Servicios</option><option>Alquiler</option><option>Transporte</option><option>Mercadería</option><option>Personal</option><option>Impuestos</option><option>Otros</option></select></div><div class="field"><label>Descripción</label><input id="exDesc" required></div><div class="field"><label>Importe (S/)</label><input id="exAmount" type="number" min="0.01" step=".01" required></div><div class="field"><label>N.º comprobante (opcional)</label><input id="exDoc"></div><div class="field"><label>Fecha</label><input id="exDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" required></div><button class="primary">Guardar gasto</button></form></div><div id="expenseRows"></div>';
    $('expenseForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('expenses').insert({company_id:co.id,category:$('exCat').value,description:$('exDesc').value.trim(),amount:Number($('exAmount').value),document_number:$('exDoc').value.trim()||null,expense_date:$('exDate').value,created_by:currentUser.id});if(error){alert(error.message);return}await window.expensesPage();};
    const {data,error}=await sb.from('expenses').select('*').eq('company_id',co.id).order('expense_date',{ascending:false}).limit(500);
    $('expenseRows').innerHTML=error?notice(esc(error.message)):table(['Fecha','Categoría','Descripción','Comprobante','Importe','Estado'],(data||[]).map(x=>'<tr><td>'+esc(x.expense_date)+'</td><td>'+esc(x.category)+'</td><td>'+esc(x.description)+'</td><td>'+esc(x.document_number||'—')+'</td><td><b>'+cash(x.amount)+'</b></td><td>'+esc(x.status)+'</td></tr>'));
  };
  window.quotesPage = async function() {
    const co=await activeCompany();if(!co)return;view='quotes';nav('quotes');setAccent(null);
    $('view').innerHTML=top('Ventas comerciales','Cotizaciones y pedidos','Empresa activa: '+co.name)+
      '<div class="panel"><h3>Nueva cotización</h3><form id="quoteForm"><div class="field"><label>Cliente</label><input id="qtCustomer" required></div><div class="field"><label>Detalle (texto o JSON)</label><textarea id="qtItems" rows="3" required placeholder="Producto, cantidad, precio..."></textarea></div><div class="field"><label>Total (S/)</label><input id="qtTotal" type="number" min="0" step=".01" required></div><div class="field"><label>Válida hasta</label><input id="qtDate" type="date"></div><button class="primary">Guardar cotización</button></form></div><div id="quoteRows"></div>';
    $('quoteForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('quotes').insert({company_id:co.id,customer_name:$('qtCustomer').value.trim(),items:[{detail:$('qtItems').value.trim()}],total:Number($('qtTotal').value),valid_until:$('qtDate').value||null,created_by:currentUser.id});if(error){alert(error.message);return}await window.quotesPage();};
    const {data,error}=await sb.from('quotes').select('*').eq('company_id',co.id).order('created_at',{ascending:false}).limit(500);
    $('quoteRows').innerHTML=error?notice(esc(error.message)):table(['Fecha','Cliente','Detalle','Total','Estado','Vigencia'],(data||[]).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleDateString('es-PE')+'</td><td>'+esc(x.customer_name)+'</td><td>'+esc((x.items||[]).map(i=>i.detail||i.name||'').join(', '))+'</td><td>'+cash(x.total)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.valid_until||'—')+'</td></tr>'));
  };
  window.cashPage = async function() {
    const co=await activeCompany();if(!co)return;view='cash';nav('cash');setAccent(null);
    $('view').innerHTML=top('Tesorería','Caja y arqueo','Empresa activa: '+co.name)+
      '<div class="panel"><h3>Apertura de caja</h3><form id="cashForm"><div class="field"><label>Fondo inicial (S/)</label><input id="cashOpening" type="number" min="0" step=".01" value="0" required></div><button class="primary">Abrir caja</button></form></div><div id="cashRows"></div>';
    $('cashForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('cash_sessions').insert({company_id:co.id,user_id:currentUser.id,opening_amount:Number($('cashOpening').value)});if(error){alert(error.message);return}await window.cashPage();};
    const {data,error}=await sb.from('cash_sessions').select('*').eq('company_id',co.id).order('opened_at',{ascending:false}).limit(100);
    $('cashRows').innerHTML=error?notice(esc(error.message)):table(['Apertura','Usuario','Fondo','Estado','Esperado','Contado','Diferencia','Acción'],(data||[]).map(x=>'<tr><td>'+new Date(x.opened_at).toLocaleString('es-PE')+'</td><td>'+esc(x.user_id===currentUser.id?'Yo':x.user_id)+'</td><td>'+cash(x.opening_amount)+'</td><td>'+esc(x.status)+'</td><td>'+cash(x.expected_amount)+'</td><td>'+cash(x.counted_amount)+'</td><td>'+cash(x.difference)+'</td><td>'+(x.status==='open'&&x.user_id===currentUser.id?'<button class="light" onclick="closeNovaCash(\''+x.id+'\')">Cerrar y arquear</button>':'—')+'</td></tr>')));
  };
  window.closeNovaCash = async id => {
    const {data:s,error}=await sb.from('cash_sessions').select('*').eq('id',id).single();if(error){alert(error.message);return}
    const counted=prompt('Importe contado en caja (S/)',''+Number(s.opening_amount).toFixed(2));if(counted===null)return;const n=Number(counted);if(!Number.isFinite(n)||n<0){alert('Importe inválido');return}
    const {error:err}=await sb.from('cash_sessions').update({counted_amount:n,expected_amount:Number(s.opening_amount),difference:n-Number(s.opening_amount),status:'closed',closed_at:new Date().toISOString()}).eq('id',id);
    if(err){alert(err.message);return}await window.cashPage();
  };
  window.generalReportsPage = async function() {
    const co=await activeCompany();if(!co)return;view='reports';nav('reports');setAccent(null);
    const [s,e,p,prod]=await Promise.all([
      sb.from('sales').select('total,created_at,status').eq('company_id',co.id),
      sb.from('expenses').select('amount,expense_date').eq('company_id',co.id),
      sb.from('purchases').select('total,status').eq('company_id',co.id),
      sb.from('products').select('id,price,cost,min_stock').eq('company_id',co.id)
    ]);
    const total=(s.data||[]).reduce((a,x)=>a+Number(x.total||0),0),expenses=(e.data||[]).reduce((a,x)=>a+Number(x.amount||0),0),purchases=(p.data||[]).reduce((a,x)=>a+Number(x.total||0),0);
    $('view').innerHTML=top('Análisis empresarial','Reportes generales','Empresa activa: '+co.name)+
      '<div class="metrics"><div class="metric"><span>Ventas sincronizadas</span><strong>'+cash(total)+'</strong></div><div class="metric"><span>Gastos registrados</span><strong>'+cash(expenses)+'</strong></div><div class="metric"><span>Compras registradas</span><strong>'+cash(purchases)+'</strong></div><div class="metric"><span>Productos activos</span><strong>'+(prod.data||[]).length+'</strong></div></div>'+
      '<div class="panel"><h3>Resumen financiero</h3><p>Ventas registradas: <b>'+cash(total)+'</b></p><p>Gastos registrados: <b>'+cash(expenses)+'</b></p><p>Compras registradas: <b>'+cash(purchases)+'</b></p><p>Resultado simple ventas menos gastos: <b>'+cash(total-expenses)+'</b></p></div>'+
      notice('Este resumen no es un estado financiero contable ni una declaración tributaria. Solo considera datos sincronizados en estas tablas; valida impuestos, costo de ventas, devoluciones y periodos antes de usarlo para decisiones oficiales.');
  };
  window.generalAutomationPage = async function() {
    const co=await activeCompany();if(!co)return;view='automation';nav('automation');setAccent(null);
    const keys=[['low_stock','Alertas de stock mínimo'],['daily_reports','Resumen diario'],['due_reminders','Alertas de cuentas por cobrar'],['expiry_alerts','Alertas de vencimientos (si aplica)'],['sync_offline','Sincronización de operaciones'],['purchase_approval','Aprobación de órdenes de compra']];
    const {data,error}=await sb.from('company_module_settings').select('*').eq('company_id',co.id);
    const saved=new Map((data||[]).map(x=>[x.module_key,x]));
    $('view').innerHTML=top('Reglas de negocio','Automatización','Empresa activa: '+co.name)+
      (error?notice(esc(error.message)):'')+'<div class="panel"><h3>Activar reglas</h3>'+keys.map(([k,label])=>'<label style="display:flex;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)"><input type="checkbox" id="auto_'+k+'" '+(saved.get(k)?.enabled===false?'':'checked')+' style="width:18px;height:18px"> <span>'+esc(label)+'</span></label>').join('')+'<button class="primary" style="margin-top:15px" onclick="saveNovaAutomation()">Guardar reglas</button><p class="sub" style="margin:12px 0 0">Esta pantalla guarda preferencias; para que una regla ejecute tareas de fondo se necesita desplegar el proceso servidor correspondiente.</p></div>';
  };
  window.saveNovaAutomation = async () => {
    const co=await activeCompany();if(!co)return;
    const keys=['low_stock','daily_reports','due_reminders','expiry_alerts','sync_offline','purchase_approval'];
    for(const k of keys){const enabled=$('auto_'+k).checked;const {error}=await sb.from('company_module_settings').upsert({company_id:co.id,module_key:k,enabled,settings:{}},{onConflict:'company_id,module_key'});if(error){alert('No se guardó '+k+': '+error.message);return;}}
    alert('Preferencias guardadas. Las reglas que requieren procesos de fondo deben implementarse en servidor.');
  };

  // Anexar accesos al menú existente sin reemplazar los módulos actuales.
  document.addEventListener('DOMContentLoaded',()=>{
    const navRoot=document.querySelector('.nav'); if(!navRoot)return;
    const items=[
      ['companies','▦ Empresas y sucursales','companiesPage'],
      ['products','▤ Productos reales','productsPage'],
      ['suppliers','♧ Proveedores','suppliersPage'],
      ['expenses','＄ Gastos','expensesPage'],
      ['quotes','▧ Cotizaciones','quotesPage'],
      ['cash','▣ Caja y arqueo','cashPage'],
      ['reports','▥ Reportes empresariales','generalReportsPage'],
      ['automation','⚡ Automatización','generalAutomationPage']
    ];
    for(const [id,label,fn] of items){if(navRoot.querySelector('[data-v="'+id+'"]'))continue;const b=document.createElement('button');b.dataset.v=id;b.textContent=label;b.addEventListener('click',()=>window[fn]());navRoot.appendChild(b);}
  });

  // Abrir el POS con el catálogo real de la empresa seleccionada cuando exista.
  window.openPOS = async function(id) {
    const base=R.find(r=>r.id===id); if(!base)return;
    active=base; cart=[]; window.novaPosProducts=new Map();
    const cachedId=companyId();
    let realProducts=[];
    if(sb&&currentUser&&cachedId){
      const {data,error}=await sb.from('products').select('id,name,category,price,cost,initial_stock,min_stock').eq('company_id',cachedId).eq('active',true).order('name').limit(1000);
      if(!error&&data){realProducts=data;localStorage.setItem('nova_cached_products_'+cachedId,JSON.stringify(data));}
    }
    if(!realProducts.length&&cachedId){try{realProducts=JSON.parse(localStorage.getItem('nova_cached_products_'+cachedId)||'[]');}catch{}}
    if(realProducts.length){
      window.novaPosProducts=new Map(realProducts.map(p=>[p.name,p]));
      active={...base,p:realProducts.map(p=>[p.name,p.category,Number(p.price)])};
    }
    view='pos';setAccent(active);nav('');renderPOS();
  };
  const originalAddCart=window.addCart;
  window.addCart=function(i){
    const search=$('psearch')?.value||'';
    const visible=active.p.filter(p=>(p[0]+' '+p[1]).toLowerCase().includes(search.toLowerCase()));
    const p=visible[i]; if(!p){if(originalAddCart)originalAddCart(i);return;}
    const real=window.novaPosProducts?.get(p[0]);
    const found=cart.find(x=>x.name===p[0]&&x.product_id===(real?.id||null));
    if(found)found.qty++;else cart.push({name:p[0],category:p[1],price:Number(p[2]),qty:1,...(real?{product_id:real.id}: {})});
    drawCart();
  };
  window.inventoryPage = async function() {
    const co=await activeCompany();if(!co)return;view='inventory';nav('inventory');setAccent(null);
    $('view').innerHTML=top('Control de existencias','Inventario y kardex','Empresa activa: '+co.name+'. El stock se calcula a partir del stock inicial y los movimientos registrados.')+
      '<div class="panel"><h3>Registrar movimiento manual</h3><form id="movementForm"><div class="field"><label>Producto</label><select id="mvProduct" required></select></div><div class="field"><label>Tipo de movimiento</label><select id="mvType"><option value="purchase">Entrada / compra</option><option value="adjustment">Ajuste positivo</option><option value="damage">Merma o daño</option><option value="return_in">Devolución recibida</option></select></div><div class="field"><label>Cantidad</label><input id="mvQty" type="number" min="0.001" step=".001" required></div><div class="field"><label>Nota / referencia</label><input id="mvNote"></div><button class="primary">Registrar movimiento</button></form><p class="sub" style="margin:10px 0 0">Las salidas por venta se registran transaccionalmente mediante la función de base de datos.</p></div><div id="inventoryRows"></div>';
    const {data:products,error:pe}=await sb.from('products').select('*').eq('company_id',co.id).eq('active',true).order('name');
    if(pe){$('inventoryRows').innerHTML=notice(esc(pe.message));return;}
    $('mvProduct').innerHTML=(products||[]).map(p=>'<option value="'+p.id+'">'+esc(p.name)+' · '+esc(p.sku||p.barcode||'sin código')+'</option>').join('');
    $('movementForm').onsubmit=async e=>{e.preventDefault();const quantity=Number($('mvQty').value);if(!quantity||quantity<=0)return alert('Cantidad inválida');const type=$('mvType').value;const {error}=await sb.from('inventory_movements').insert({company_id:co.id,product_id:$('mvProduct').value,movement_type:type,quantity:type==='damage'?-quantity:quantity,unit_cost:Number((products||[]).find(p=>p.id===$('mvProduct').value)?.cost||0),idempotency_key:uid(),created_by:currentUser.id,notes:$('mvNote').value.trim()||null});if(error){alert('No se registró el movimiento: '+error.message);return}await window.inventoryPage();};
    const {data:movements,error:me}=await sb.from('inventory_movements').select('product_id,quantity').eq('company_id',co.id);
    if(me){$('inventoryRows').innerHTML=notice(esc(me.message));return;}
    const stock=new Map((products||[]).map(p=>[p.id,Number(p.initial_stock||0)]));(movements||[]).forEach(m=>stock.set(m.product_id,(stock.get(m.product_id)||0)+Number(m.quantity||0)));
    $('inventoryRows').innerHTML=table(['Producto','SKU','Categoría','Stock actual','Stock mínimo','Precio','Estado'],(products||[]).map(p=>{const n=stock.get(p.id)||0;return '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.sku||p.barcode||'—')+'</td><td>'+esc(p.category)+'</td><td><b>'+n.toFixed(3)+'</b></td><td>'+esc(p.min_stock)+'</td><td>'+cash(p.price)+'</td><td>'+(n<=Number(p.min_stock)?'<span class="pill" style="background:#fee2e2;color:#991b1b">Stock bajo</span>':'Disponible')+'</td></tr>';}),'No hay productos. Registra productos en Productos reales.');
  };
  window.customersPage = async function() {
    const co=await activeCompany();if(!co)return;view='customers';nav('customers');setAccent(null);
    $('view').innerHTML=top('Relación comercial','Clientes','Empresa activa: '+co.name)+
      '<div class="panel"><h3>Nuevo cliente</h3><form id="customerForm"><div class="field"><label>Nombre o razón social</label><input id="cn" required></div><div class="field"><label>DNI/RUC</label><input id="cd"></div><div class="field"><label>Teléfono</label><input id="ct"></div><div class="field"><label>Correo</label><input id="ce" type="email"></div><button class="primary">Guardar cliente</button></form></div><div id="customerRows"></div>';
    $('customerForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.from('customers').insert({id:uid(),user_id:currentUser.id,company_id:co.id,name:$('cn').value.trim(),document_number:$('cd').value.trim()||null,phone:$('ct').value.trim()||null,email:$('ce').value.trim()||null});if(error){alert(error.message);return}await window.customersPage();};
    const {data,error}=await sb.from('customers').select('*').eq('company_id',co.id).order('created_at',{ascending:false}).limit(500);
    $('customerRows').innerHTML=error?notice(esc(error.message)):table(['Cliente','Documento','Teléfono','Fecha de registro'],(data||[]).map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.document_number||'—')+'</td><td>'+esc(c.phone||'—')+'</td><td>'+new Date(c.created_at).toLocaleDateString('es-PE')+'</td></tr>'));
  };

  // Cada venta nueva se vincula a la empresa activa; el ID idempotente se conserva en reintentos.
  window.completeSale = async function() {
    if(!cart.length){alert('Agrega al menos un producto.');return;}
    const all=getSales(),total=cart.reduce((s,p)=>s+p.price*p.qty,0);
    const sale={id:uid(),company_id:companyId(),created_at:new Date().toISOString(),rubric_id:active.id,rubric_name:active.n,customer_name:$('customer').value||'Público general',payment_method:$('payment').value,items:cart.map(p=>({...p})),total,status:'local'};
    all.unshift(sale);write('nova_sales',all);
    const q=read('nova_queue');if(!q.some(x=>x.id===sale.id))q.push(sale);write('nova_queue',q);
    cart=[];renderPOS();
    if(sb&&currentUser) await window.syncNovaQueue();
    alert('Venta guardada localmente. '+(sb&&currentUser?'Se intentó sincronizar con Supabase.':'Se sincronizará al configurar Supabase e iniciar sesión.'));
  };
  window.syncNovaQueue = async function() {
    if(!sb||!currentUser)return;
    const q=read('nova_queue'),left=[];
    for(const s of q){
      let error=null;
      if(s.company_id) { const {error:rpcError}=await sb.rpc('register_sale',{p_id:s.id,p_company_id:s.company_id,p_rubric_id:s.rubric_id,p_rubric_name:s.rubric_name,p_customer_name:s.customer_name,p_payment_method:s.payment_method,p_items:s.items,p_total:s.total,p_created_at:s.created_at}); error=rpcError; }
      else { const payload={id:s.id,user_id:currentUser.id,rubric_id:s.rubric_id,rubric_name:s.rubric_name,customer_name:s.customer_name,payment_method:s.payment_method,items:s.items,total:s.total,created_at:s.created_at}; const result=await sb.from('sales').upsert(payload,{onConflict:'id'}); error=result.error; }
      if(error)left.push(s);
      else {const all=getSales().map(x=>x.id===s.id?{...x,status:'synced'}:x);write('nova_sales',all);}
    }
    write('nova_queue',left);setStatus(left.length?'● Pendiente de sincronizar':'● Supabase sincronizado',left.length?'err':'ok');
  };
  // La versión original sigue disponible para el historial; reintentar la cola al volver la red.
  window.syncQueue = () => window.syncNovaQueue();
  window.addEventListener('online',()=>{if(sb&&currentUser)window.syncNovaQueue();});
})();
