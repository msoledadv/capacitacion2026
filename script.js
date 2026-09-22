let datosAgrupados = [];

Papa.parse("./Libro2.csv", {
    download: true,
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    complete: function(results) {
        // limpia BOM del header si viene con \uFEFF
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
        document.getElementById('contador').innerText = "❌ No se encontró ./Libro2.csv";
    }
});

async function mostrarFechaActualizacionCSV(){
    const el = document.getElementById('ultimaActualizacion');
    if(!el) return;
    // Si estás en VS Code local, avisa
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
    let uSec="",uOfi="SIN OFICINA",uPago="SIN OFICINA PAGO",uLeg="",uNom="",uCar="";
    const num=v=>{ if(v==null||String(v).trim()==="") return null; let f=parseFloat(String(v).replace(',','.')); return isNaN(f)?null:f; };
    const parseFecha = (str) => {
        if(!str || str.toLowerCase()==='s/d') return null;
        let p = str.split('/'); 
        if(p.length!==3) return null;
        return new Date(p[2], p[1]-1, p[0]);
    };
    const corte = new Date(2024, 3, 1); // 01/04/2024

    filas.forEach(f=>{
        let vp=f["PAGOS"]; 
        Object.keys(f).forEach(k=>{ if(k.toUpperCase().includes("PAGO")) vp=f[k]; });
        
        // SOLO SECRETARIA
        if(f["SECRETARIA"]?.trim()) uSec=f["SECRETARIA"].trim();
        if(f["OFICINA"]?.trim()) uOfi=f["OFICINA"].trim();
        if(vp?.trim()&&vp.trim()!=="0") uPago=vp.trim();
        if(f["LEGAJO"]?.toString().trim()) uLeg=f["LEGAJO"].toString().trim();
        if(f["NOMBRE COMPLETO"]?.trim()) uNom=f["NOMBRE COMPLETO"].trim();
        if(f["CARGO ESCALAFON"]?.trim()) uCar=f["CARGO ESCALAFON"].trim();
        if(!uLeg||uLeg==="0") return;
        if(!mapa.has(uLeg)) mapa.set(uLeg,{LEGAJO:uLeg,NOMBRE:uNom,SECRETARIA:uSec,OFICINA:uOfi,OFICINA_PAGO:uPago,CARGO:uCar,CURSOS:[],CREDITOS:0,OBJETIVO:0,SALDO_RESTANTE:null});
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
            if(!p.CURSOS.some(c=>c.key===key)){
                p.CURSOS.push({key, nombre:cursoRaw, fecha:fechaRaw, historico: esHistorico});
            }
        }

        let obj=num(f["OBJETIVO"]), acum=num(f["Acumulado"]), saldo=num(f["Saldo_Restante"]);
        if(!esHistorico){
            if(obj!==null) p.OBJETIVO=Math.max(p.OBJETIVO,obj); 
            if(acum!==null) p.CREDITOS=Math.max(p.CREDITOS,acum); 
            if(saldo!==null) p.SALDO_RESTANTE=saldo;
        }
    });

    mapa.forEach(p=>{ 
        if(p.SALDO_RESTANTE===null) p.SALDO_RESTANTE=Math.max(0,p.OBJETIVO-p.CREDITOS); 
        if(p.CREDITOS>=p.OBJETIVO&&p.OBJETIVO>0) p.SALDO_RESTANTE=0; 
    });

    datosAgrupados=Array.from(mapa.values());
    poblar(); 
    renderTable(datosAgrupados);
    mostrarFechaActualizacionCSV();
}

function poblar(){
  const set=(id,arr)=>{ const s=document.getElementById(id); if(!s) return; s.innerHTML='<option value="">Todas</option>'; [...new Set(arr)].filter(Boolean).sort().forEach(v=>s.innerHTML+=`<option>${v}</option>`); };
  set('selectSecretaria',datosAgrupados.map(p=>p.SECRETARIA)); 
  set('selectOficina',datosAgrupados.map(p=>p.OFICINA)); 
  set('selectPago',datosAgrupados.map(p=>p.OFICINA_PAGO)); 
  set('selectCargo',datosAgrupados.map(p=>p.CARGO));
  ['selectSecretaria','selectOficina','selectPago','selectCargo','inputNombre','inputLegajo','selectEstado'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){
        el.addEventListener('change',filtrar);
    }
  });
  const inpNom = document.getElementById('inputNombre');
  const inpLeg = document.getElementById('inputLegajo');
  if(inpNom) inpNom.addEventListener('input',filtrar); 
  if(inpLeg) inpLeg.addEventListener('input',filtrar);
  const btn = document.getElementById('btnLimpiar');
  if(btn){
    btn.onclick=()=>{
        ['selectSecretaria','selectOficina','selectPago','selectCargo','inputNombre','inputLegajo','selectEstado'].forEach(id=>{
            const e = document.getElementById(id);
            if(e) e.value="";
        }); 
        renderTable(datosAgrupados);
    };
  }
}

function filtrar(){
  const sec=document.getElementById('selectSecretaria')?.value||"", ofi=document.getElementById('selectOficina')?.value||"", pago=document.getElementById('selectPago')?.value||"", car=document.getElementById('selectCargo')?.value||"", est=document.getElementById('selectEstado')?.value||"", nom=(document.getElementById('inputNombre')?.value||"").toLowerCase(), leg=(document.getElementById('inputLegajo')?.value||"").toLowerCase();
  const fil=datosAgrupados.filter(p=>{ let er="SIN INICIAR"; if(p.CREDITOS>=p.OBJETIVO&&p.OBJETIVO>0) er="COMPLETO"; else if(p.CREDITOS>0) er="EN PROCESO"; return (sec===""||p.SECRETARIA===sec)&&(ofi===""||p.OFICINA===ofi)&&(pago===""||p.OFICINA_PAGO===pago)&&(car===""||p.CARGO===car)&&(est===""||er===est)&&(nom===""||p.NOMBRE.toLowerCase().includes(nom))&&(leg===""||p.LEGAJO.toLowerCase().includes(leg)); });
  renderTable(fil);
}

function renderTable(data){
  const tbody=document.getElementById('tbody'); 
  if(!tbody) return;
  let html = "";
  data.forEach(p=>{
    const faltan=p.SALDO_RESTANTE<0?0:p.SALDO_RESTANTE; let clase="pendiente",texto="🚨 SIN INICIAR"; if(p.CREDITOS>=p.OBJETIVO&&p.OBJETIVO>0){clase="cumplido"; texto="✅ COMPLETO";} else if(p.CREDITOS>0){clase="proceso"; texto="⏳ EN PROCESO";}
    let lista = p.CURSOS.map(c=>{
        if(c.historico){
            return `<span style="color:#888;">• ${c.nombre} (${c.fecha}) HISTÓRICO</span>`;
        }else{
            return `• ${c.nombre} (${c.fecha})`;
        }
    }).join('<br>') || 'SIN CAPACITACIONES';
    html+=`<tr><td style="color:#0056b3;font-weight:bold;">${p.LEGAJO}</td><td><strong>${p.NOMBRE}</strong><br><small>${p.OFICINA}</small></td><td><small style="color:#0d47a1;font-weight:700;">${p.SECRETARIA}</small></td><td><small>${p.OFICINA_PAGO}</small></td><td><small>${p.CARGO}</small></td><td style="font-size:11px;">${lista}</td><td style="text-align:center;font-weight:bold;color:#0056b3;">${p.CREDITOS}</td><td style="text-align:center;">${p.OBJETIVO}</td><td style="text-align:center;font-weight:bold;color:${faltan>0?'#b45309':'green'}">${faltan}</td><td><span class="badge ${clase}">${texto}</span></td></tr>`;
  });
  tbody.innerHTML = html;
  const cont = document.getElementById('contador');
  if(cont) cont.innerText=`Personal total filtrado: ${data.length}`;
}
  if(cont) cont.innerText=`Personal total filtrado: ${data.length}`;
}
