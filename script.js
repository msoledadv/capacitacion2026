let datosAgrupados = [];
let nombreSecretariaDetectada = "";

const urlParams = new URLSearchParams(window.location.search);
// Si no pones?csv=, ahora carga Libro2.csv directo para Github
const archivoCSV = urlParams.get('csv')? `${urlParams.get('csv')}.csv` : 'Libro2.csv';

Papa.parse(archivoCSV, {
    download: true,
    header: true,
    skipEmptyLines: true,
    delimiter: "", // detecta coma o tab automaticamente
    transformHeader: h => h.trim(),
    complete: function(results) {
        console.log("CSV Cargado:", archivoCSV, results.meta.fields);
        procesarDatos(results.data);
    },
    error: function(err) {
        console.error(`Error ${archivoCSV}:`, err);
        document.getElementById('contador').innerText = `Error: no se encontró ${archivoCSV}`;
    }
});

function formatearFecha(val) {
    if (val === undefined || val === null || String(val).trim() === "" || String(val).toLowerCase() === "s/d") return 's/d';
    let num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        try {
            const utc_days = Math.floor(num - 25569);
            const utc_value = utc_days * 86400;
            const date_info = new Date(utc_value * 1000);
            const dia = String(date_info.getUTCDate()).padStart(2, '0');
            const mes = String(date_info.getUTCMonth() + 1).padStart(2, '0');
            const anio = date_info.getUTCFullYear();
            return `${dia}/${mes}/${anio}`;
        } catch(e) {}
    }
    const stringFecha = String(val).trim();
    if (stringFecha.includes('T')) {
        const partes = stringFecha.split('T')[0].split('-');
        if(partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return stringFecha || 's/d';
}

function procesarDatos(filas) {
    const mapa = new Map();
    let uSec = "", uOfi = "SIN OFICINA", uPago = "SIN OFICINA PAGO", uLeg = "", uNom = "", uCar = "";

    const num = (v) => {
        if (v === undefined || v === null || String(v).trim() === "") return null;
        let n = String(v).replace(',', '.').trim();
        const f = parseFloat(n);
        return isNaN(f)? null : f;
    };

    filas.forEach(fila => {
        let valorPagoFila = null;
        Object.keys(fila).forEach(clave => {
            if (clave.toUpperCase().includes("PAGO")) valorPagoFila = fila[clave];
        });

        if (fila["SECRETARIA"] && String(fila["SECRETARIA"]).trim()!== "") uSec = String(fila["SECRETARIA"]).trim();
        if (fila["Particion_Descripcion"] && String(fila["Particion_Descripcion"]).trim()!== "") uSec = String(fila["Particion_Descripcion"]).trim();
        if (fila["OFICINA"] && String(fila["OFICINA"]).trim()!== "") uOfi = String(fila["OFICINA"]).trim();
        if (valorPagoFila && String(valorPagoFila).trim()!== "" && String(valorPagoFila).trim()!== "0") uPago = String(valorPagoFila).trim();
        if (fila["LEGAJO"]) uLeg = String(fila["LEGAJO"]).trim();
        if (fila["NOMBRE COMPLETO"] && String(fila["NOMBRE COMPLETO"]).trim()!== "") uNom = String(fila["NOMBRE COMPLETO"]).trim();
        if (fila["CARGO ESCALAFON"] && String(fila["CARGO ESCALAFON"]).trim()!== "") uCar = String(fila["CARGO ESCALAFON"]).trim();
        if (!uLeg || uLeg === "0") return;

        if (!mapa.has(uLeg)) {
            mapa.set(uLeg, {
                LEGAJO: uLeg,
                NOMBRE: uNom || 'Sin Nombre',
                SECRETARIA: uSec || 'General',
                OFICINA: uOfi,
                OFICINA_PAGO: uPago,
                CARGO: uCar || 's/d',
                CURSOS: [],
                CREDITOS: 0,
                OBJETIVO: 0,
                SALDO_RESTANTE: null
            });
        }

        const p = mapa.get(uLeg);
        if (p.OFICINA_PAGO === "SIN OFICINA PAGO" && uPago!== "SIN OFICINA PAGO") p.OFICINA_PAGO = uPago;
        if (uSec) p.SECRETARIA = uSec;
        if (uOfi) p.OFICINA = uOfi;

        // LEE COLUMNAS NUEVAS DE Libro2.csv
        const cursoVal = fila["IDBENEFICIO"] || fila["CAPACITACION"] || "";
        if (cursoVal && String(cursoVal).trim()!== "0" && String(cursoVal).trim()!== "") {
            const fechaVal = formatearFecha(fila["FECHA_APROBACION"] || fila["Fecha Aprobación"]);
            const yaExiste = p.CURSOS.some(c => c.nombre === String(cursoVal).trim() && c.fecha === fechaVal);
            if (!yaExiste) p.CURSOS.push({ nombre: String(cursoVal).trim(), fecha: fechaVal });
        }

        // NUEVAS COLUMNAS -> VIEJAS VARIABLES
        let objetivoFila = num(fila["OBJETIVO"]?? fila["Suma de OBJETIVO"]);
        let acumuladoFila = num(fila["Acumulado"]?? fila["Suma de CREDITOS"]);
        let saldoFila = num(fila["Saldo_Restante"]?? fila["Suma de SALDO RESTANTE"]);

        if (objetivoFila!== null) p.OBJETIVO = Math.max(p.OBJETIVO, objetivoFila);
        if (acumuladoFila!== null) p.CREDITOS = Math.max(p.CREDITOS, acumuladoFila);
        // FIX PRINCIPAL: Saldo_Restante puede ser 0 cuando está completo, no lo ignores
        if (saldoFila!== null) p.SALDO_RESTANTE = saldoFila;
    });

    // Si no vino saldo, lo calculamos
    mapa.forEach(p=>{
        if(p.SALDO_RESTANTE === null){
            p.SALDO_RESTANTE = Math.max(0, p.OBJETIVO - p.CREDITOS);
        }
        if(p.CREDITOS >= p.OBJETIVO && p.OBJETIVO>0) p.SALDO_RESTANTE = 0;
    });

    datosAgrupados = Array.from(mapa.values());

    if (datosAgrupados.length > 0) {
        nombreSecretariaDetectada = datosAgrupados[0].SECRETARIA;
        const txtSec = document.getElementById('nombreSecretariaHeader');
        if (txtSec) txtSec.innerText = nombreSecretariaDetectada;
    }

    poblarCargos();
    poblarOficinas();
    poblarOficinasPago();
    renderTable(datosAgrupados);
    inicializarEventos();
}

function inicializarEventos() {
    const ids = ['selectOficina', 'selectPago', 'selectCargo', 'inputNombre', 'inputLegajo', 'selectEstado'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(id.includes('input')? 'input' : 'change', () => filtrar());
    });
    document.getElementById('btnLimpiar').addEventListener('click', () => {
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        renderTable(datosAgrupados);
    });
}

function filtrar() {
    const ofi = document.getElementById('selectOficina').value;
    const pago = document.getElementById('selectPago').value;
    const car = document.getElementById('selectCargo').value;
    const est = document.getElementById('selectEstado').value;
    const nom = document.getElementById('inputNombre').value.toLowerCase().trim();
    const leg = document.getElementById('inputLegajo').value.toLowerCase().trim();

    const filtrados = datosAgrupados.filter(p => {
        let estadoReal = "SIN INICIAR";
        if (p.CREDITOS >= p.OBJETIVO && p.OBJETIVO>0) estadoReal = "COMPLETO";
        else if (p.CREDITOS > 0) estadoReal = "EN PROCESO";

        const matchOfi = (ofi === "" || p.OFICINA === ofi);
        const matchPago = (pago === "" || p.OFICINA_PAGO === pago);
        const matchCar = (car === "" || p.CARGO === car);
        const matchEst = (est === "" || estadoReal === est);
        const matchNom = (nom === "" || p.NOMBRE.toLowerCase().includes(nom));
        const matchLeg = (leg === "" || p.LEGAJO.toString().toLowerCase().includes(leg));
        return matchOfi && matchPago && matchCar && matchEst && matchNom && matchLeg;
    });
    renderTable(filtrados);
}

function renderTable(data) {
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#777; padding: 25px;">No se encontró personal.</td></tr>`;
        document.getElementById('contador').innerText = `Personal total filtrado: 0`;
        return;
    }
    data.forEach(p => {
        const faltanVisual = p.SALDO_RESTANTE < 0? 0 : p.SALDO_RESTANTE;
        let clase = "pendiente", texto = "🚨 SIN INICIAR";
        if (p.CREDITOS >= p.OBJETIVO && p.OBJETIVO>0) { clase = "cumplido"; texto = "✅ COMPLETO"; }
        else if (p.CREDITOS > 0) { clase = "proceso"; texto = "⏳ EN PROCESO"; }

        let listaCursosVisual = "";
        if (p.CURSOS && p.CURSOS.length > 0) {
            listaCursosVisual = `<ul style="margin:0; padding-left:12px; list-style-type:disc;">`;
            p.CURSOS.forEach(c => {
                const esHistorico = c.fecha.includes('/2022') || c.fecha.includes('/2023');
                const colorTexto = esHistorico? '#9ca3af' : '#1f2937';
                const colorFecha = esHistorico? '#cbd5e1' : '#666';
                const etiquetaHistorico = esHistorico? ' <span style="font-size:10px; font-style:italic; color:#cbd5e1;">(Histórico)</span>' : '';
                listaCursosVisual += `<li style="color: ${colorTexto};"><strong style="font-weight: ${esHistorico? 'normal' : 'bold'};">${c.nombre}</strong> <span style="color:${colorFecha}; font-size:11px;">(${c.fecha})</span>${etiquetaHistorico}</li>`;
            });
            listaCursosVisual += `</ul>`;
        } else {
            listaCursosVisual = '<span style="color:#aaa; font-style:italic;">Sin capacitaciones</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><mark style="background:none; font-weight:bold; color:#0056b3; font-family:monospace;">${p.LEGAJO}</mark></td>
            <td><strong>${p.NOMBRE}</strong><br><small style="color:#555;">${p.OFICINA}</small></td>
            <td><small>${p.OFICINA_PAGO}</small></td>
            <td><small>${p.CARGO}</small></td>
            <td class="col-capa">${listaCursosVisual}</td>
            <td style="text-align:center; font-weight:bold; color:#0056b3;">${p.CREDITOS}</td>
            <td style="text-align:center; color:#444;">${p.OBJETIVO}</td>
            <td style="text-align:center; font-weight:bold; color:${faltanVisual > 0? '#b45309' : '#10b981'}">${faltanVisual}</td>
            <td><span class="badge ${clase}">${texto}</span></td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('contador').innerText = `Personal total filtrado: ${data.length}`;
}

function poblarOficinas() {
    const sOfi = document.getElementById('selectOficina');
    if (!sOfi) return;
    sOfi.innerHTML = '<option value="">Todas las Oficinas</option>';
    const oficinas = [...new Set(datosAgrupados.map(p => p.OFICINA))].filter(Boolean).sort();
    oficinas.forEach(o => sOfi.innerHTML += `<option value="${o}">${o}</option>`);
}
function poblarOficinasPago() {
    const sPago = document.getElementById('selectPago');
    if (!sPago) return;
    sPago.innerHTML = '<option value="">Todas las Oficinas de Pago</option>';
    const oficinasPago = [...new Set(datosAgrupados.map(p => p.OFICINA_PAGO))].filter(Boolean).sort();
    oficinasPago.forEach(o => sPago.innerHTML += `<option value="${o}">${o}</option>`);
}
function poblarCargos() {
    const sCar = document.getElementById('selectCargo');
    if (!sCar) return;
    sCar.innerHTML = '<option value="">Todos los Cargos</option>';
    const cargos = [...new Set(datosAgrupados.map(p => p.CARGO))].filter(Boolean).sort();
    cargos.forEach(c => sCar.innerHTML += `<option value="${c}">${c}</option>`);
}