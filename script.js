// MENU RESPONSIVE
document.addEventListener('DOMContentLoaded',()=>{
  const btnMenu=document.getElementById('btnMenu');
  const btnClose=document.getElementById('btnCloseMenu');
  const sidebar=document.getElementById('sidebar');
  const overlay=document.getElementById('overlay');
  const open=()=>{sidebar?.classList.add('open');overlay?.classList.add('show');document.body.style.overflow='hidden';};
  const close=()=>{sidebar?.classList.remove('open');overlay?.classList.remove('show');document.body.style.overflow='';};
  btnMenu?.addEventListener('click',open);
  btnClose?.addEventListener('click',close);
  overlay?.addEventListener('click',close);
});

let datosAgrupados = [];

Papa.parse("./Libro2.csv", {
    download: true,
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    complete: function(results) {
        const cleanData = results.data.map(row=>{
            const newRow={};
            Object.keys(row).forEach(k=>{
                const cleanKey = k.trim().replace(/^\uFEFF/, '');
                newRow[cleanKey]=row[k];
            });
            return newRow;
        });
        procesarDatos(cleanData);
    },
    error: function(){
        const el = document.getElementById('contador');
        if(el) el.innerText = "❌ No se encontró ./Libro2.csv";
    }
});

async function mostrarFechaActualizacionCSV(){
    const el = document.getElementById('ultimaActualizacion');
    if(!el) return;
    if(window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"){
        el.innerText = "👀 Modo local en VS - la fecha real se ve al subir a GitHub";
        return;
    }
    try{
        const resp = await fetch('https://api.github.com/repos/msoledadv/capacitacion2026/commits?path=Libro2.csv&page=1&per_page=1');
        const commits = await resp.json();
        if(commits && commits[0]){
            const fecha = new Date(commits[0].commit.committer.date);
            el.innerText = `📅 Última actualización del CSV: ${fecha.toLocaleDateString('es-AR')} ${fecha.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}`;
        }
    }catch(e){
        el.innerText = "📅 CSV cargado";
    }
}

function procesarDatos(filas){
    const mapa=new Map();
    const num=v=>{ if(v==null||String(v).trim()==="") return null; let f=parseFloat(String(v).replace(',','.')); return isNaN(f)?null:f; };
    const parseFecha = (str) => {
        if(!str || str.toLowerCase()==='s/d') return null;
        let p = str.split('/');
        if(p.length!==3) return null;
        return new Date(p[2], p[1]-1, p[0]);
    };
    const corte = new Date(2024, 3, 1);

    filas.forEach(f=>{
        let vp=f["PAGOS"];
        Object.keys(f).forEach(k=>{ if(k.toUpperCase().includes("PAGO")) vp=f[k]; });

        const uSec = (f["SECRETARIA"]||"").trim();
        const uOfi = (f["OFICINA"]||"").trim() || "SIN OFICINA";
        const uPago = (vp||"").trim() || "SIN OFICINA PAGO";
        const uLeg = (f["LEGAJO"]||"").toString().trim();
        const uNom = (f["NOMBRE COMPLETO"]||"").trim();
        const uCar = (f["CARGO ESCALAFON"]||"").trim();
        if(!uLeg||uLeg==="0") return;

        if(!mapa.has(uLeg)){
            mapa.set(uLeg,{LEGAJO:uLeg,NOMBRE:uNom,SECRETARIA:uSec,OFICINA:uOfi,OFICINA_PAGO:uPago,CARGO:uCar,CURSOS:[],_set:new Set(),CREDITOS:0,OBJETIVO:0,SALDO_RESTANTE:null});
        }
        const p=mapa.get(uLeg);
        if(uSec) p.SECRETARIA=uSec;
        if(uOfi) p.OFICINA=uOfi;
        if(uPago) p.OFICINA_PAGO=uPago;
        if(uNom) p.NOMBRE=uNom;
        if(uCar) p.CARGO=uCar;

        let cursoRaw = (f["IDBENEFICIO"]||"").trim();
        let fechaRaw = (f["FECHA_APROBACION"]||"s/d").trim();
        let fechaObj = parseFecha(fechaRaw);
        let esHistorico = fechaObj && fechaObj < corte;

        if(cursoRaw && cursoRaw!=="0" && cursoRaw.toLowerCase()!=="s/d"){
            let key=cursoRaw+"|"+fechaRaw;
            if(!p._set.has(key)){
                p._set.add(key);
                p.CURSOS.push({key, nombre:cursoRaw, fecha:fechaRaw, historico: esHistorico});
            }
        }

        if(!esHistorico){
            let obj=num(f["OBJETIVO"]), acum=num(f["Acumulado"]), saldo=num(f["Saldo_Restante"]);
            if(obj!==null) p.OBJETIVO=Math.max(p.OBJETIVO,obj);
            if(acum!==null) p.CREDITOS=Math.max(p.CREDITOS,acum);
            if(saldo!==null) p.SALDO_RESTANTE=saldo;
        }
    });

    datosAgrupados=Array.from(mapa.values()).map(p=>{
        delete p._set;
        if(p.SALDO_RESTANTE===null) p.SALDO_RESTANTE=Math.max(0,p.OBJETIVO-p.CREDITOS);
        if(p.CREDITOS>=p.OBJETIVO&&p.OBJETIVO>0) p.SALDO_RESTANTE=0;
        return p;
    });

    poblar();
    renderTable(datosAgrupados);
    mostrarFechaActualizacionCSV();
}

function poblar(){
  const set=(id,arr)=>{
    const s=document.getElementById(id);
    if(!s) return;
    s.innerHTML='<option value="">Todas</option>';
    [...new Set(arr)].filter(Boolean).sort().forEach(v=>s.innerHTML+=`<option>${v}</option>`);
  };
  set('selectSecretaria',datosAgrupados.map(p=>p.SECRETARIA));
  set('selectOficina',datosAgrupados.map(p=>p.OFICINA));
  set('selectPago',datosAgrupados.map(p=>p.OFICINA_PAGO));
  set('selectCargo',datosAgrupados.map(p=>p.CARGO));

  ['selectSecretaria','selectOficina','selectPago','selectCargo','inputNombre','inputLegajo','selectEstado'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('change',filtrar);
  });
  const inpNom = document.getElementById('inputNombre');
  const inpLeg = document.getElementById('inputLegajo');
  if(inpNom) inpNom.addEventListener('input',filtrar);
  if(inpLeg) inpLeg.addEventListener('input',filtrar);
  const btn = document.getElementById('btnLimpiar');
  if(btn){
    btn.onclick=()=>{
        ['selectSecretaria','selectOficina','selectPago','selectCargo','inputNombre','inputLegajo','selectEstado'].forEach(id=>{
            const e=document.getElementById(id);
            if(e) e.value="";
        });
        renderTable(datosAgrupados);
    };
  }
}

function filtrar(){
  const sec=document.getElementById('selectSecretaria')?.value||"";
  const ofi=document.getElementById('selectOficina')?.value||"";
  const pago=document.getElementById('selectPago')?.value||"";
  const car=document.getElementById('selectCargo')?.value||"";
  const est=document.getElementById('selectEstado')?.value||"";
  const nom=(document.getElementById('inputNombre')?.value||"").toLowerCase();
  const leg=(document.getElementById('inputLegajo')?.value||"").toLowerCase();

  const fil=datosAgrupados.filter(p=>{
    let er="SIN INICIAR";
    if(p.CREDITOS>=p.OBJETIVO&&p.OBJETIVO>0) er="COMPLETO";
    else if(p.CREDITOS>0) er="EN PROCESO";
    return (sec===""||p.SECRETARIA===sec)
        &&(ofi===""||p.OFICINA===ofi)
        &&(pago===""||p.OFICINA_PAGO===pago)
        &&(car===""||p.CARGO===car)
        &&(est===""||er===est)
        &&(nom===""||p.NOMBRE.toLowerCase().includes(nom))
        &&(leg===""||p.LEGAJO.toLowerCase().includes(leg));
  });
  renderTable(fil);
}

function renderTable(data){
  const tbody=document.getElementById('tbody');
  if(!tbody) return;
  let html="";
  data.forEach(p=>{
    const faltan=p.SALDO_RESTANTE<0?0:p.SALDO_RESTANTE;
    let clase="pendiente",texto="🚨 SIN INICIAR";
    if(p.CREDITOS>=p.OBJETIVO&&p.OBJETIVO>0){clase="cumplido"; texto="✅ COMPLETO";}
    else if(p.CREDITOS>0){clase="proceso"; texto="⏳ EN PROCESO";}
    let lista = p.CURSOS.map(c=>{
        if(c.historico){
            return `<span style="color:#888;">• ${c.nombre} (${c.fecha}) HISTÓRICO</span>`;
        }else{
            return `• ${c.nombre} (${c.fecha})`;
        }
    }).join('<br>') || 'SIN CAPACITACIONES';
    html+=`<tr><td data-label="Legajo" style="color:#0056b3;font-weight:bold;">${p.LEGAJO}</td><td data-label="Agente / Oficina"><strong>${p.NOMBRE}</strong><br><small>${p.OFICINA}</small></td><td data-label="Secretaría"><small style="color:#0d47a1;font-weight:700;">${p.SECRETARIA}</small></td><td data-label="Oficina de Pago"><small>${p.OFICINA_PAGO}</small></td><td data-label="Cargo"><small>${p.CARGO}</small></td><td data-label="Capacitaciones" style="font-size:11px;">${lista}</td><td data-label="Créditos" style="text-align:center;font-weight:bold;color:#0056b3;">${p.CREDITOS}</td><td data-label="Objetivo" style="text-align:center;">${p.OBJETIVO}</td><td data-label="Faltan" style="text-align:center;font-weight:bold;color:${faltan>0?'#b45309':'green'}">${faltan}</td><td data-label="Estado"><span class="badge ${clase}">${texto}</span></td></tr>`;
  });
  tbody.innerHTML=html;
  const cont=document.getElementById('contador');
  if(cont) cont.innerText=`Personal total filtrado: ${data.length}`;
}
