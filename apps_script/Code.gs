/**
 * Google Apps Script (Web App)
 * Acts as the data layer (Google Sheet).
 *
 * Deploy: Deploy > New deployment > Web app
 * - Execute as: Me
 * - Who has access: Anyone (or Anyone in your org)   <-- protected by API token anyway
 *
 * IMPORTANT: Keep API_TOKEN secret. Calls should come only from Netlify Function.
 */
const SHEET_NAME = "ofertas";
const HEADERS = [
  "id","medicamento","presentacion","lote","vencimiento","cantidad","establecimiento",
  "contactoEmail","estado","fechaPublicacion","reservadoPor","fechaReserva","fechaCierre",
  "batchId","tipo","observaciones"
];

function doPost(e) {
  try{
    const body = JSON.parse(e.postData.contents || "{}");
    const token = body.token || "";
    const API_TOKEN = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
    if (!API_TOKEN || token !== API_TOKEN) return json({ ok:false, error:"unauthorized" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if(!sh){
      sh = ss.insertSheet(SHEET_NAME);
      sh.appendRow(HEADERS);
    } else {
      // Ensure headers exist (optional safety)
      const h = sh.getRange(1,1,1,HEADERS.length).getValues()[0];
      if (h.join("|") !== HEADERS.join("|")){
        // do nothing; assume already configured
      }
    }

    const action = body.action;

    if (action === "upsertBatch") {
      const establecimiento = String(body.establecimiento || "").trim();
      const rows = body.rows || [];
      const batchId = String(body.batchId || Date.now());

      if (!establecimiento) return json({ ok:false, error:"missing_establecimiento" });
      if (!Array.isArray(rows) || rows.length === 0) return json({ ok:false, error:"no_rows" });

      // Delete old "Disponible" rows for this establecimiento (keeps Reservado/Cerrado)
      const data = sh.getDataRange().getValues();
      // find column indexes
      const idxEst = HEADERS.indexOf("establecimiento");
      const idxEstado = HEADERS.indexOf("estado");
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][idxEst] === establecimiento && data[i][idxEstado] === "Disponible") {
          sh.deleteRow(i + 1);
        }
      }

      const now = new Date();
      const out = rows.map(r => ([
        Utilities.getUuid(),
        String(r.medicamento || "").trim(),
        String(r.presentacion || "").trim(),
        String(r.lote || "").trim(),
        String(r.vencimiento || "").trim(),
        Number(r.cantidad || 0),
        String(r.establecimiento || establecimiento).trim(),
        String(r.contactoEmail || "").trim(),
        "Disponible",
        now,
        "",
        "",
        "",
        batchId,
        String(r.tipo || "Normal").trim() || "Normal",
        String(r.observaciones || "").trim()
      ]));

      sh.getRange(sh.getLastRow()+1, 1, out.length, out[0].length).setValues(out);
      return json({ ok:true, inserted: out.length });
    }

    if (action === "reserve") {
      const id = String(body.id || "").trim();
      const reservadoPor = String(body.reservadoPor || "").trim();
      if (!id) return json({ ok:false, error:"missing_id" });

      const data = sh.getDataRange().getValues();
      const idxId = HEADERS.indexOf("id");
      const idxEstado = HEADERS.indexOf("estado");
      const idxReservadoPor = HEADERS.indexOf("reservadoPor");
      const idxFechaReserva = HEADERS.indexOf("fechaReserva");

      for (let i = 1; i < data.length; i++) {
        if (data[i][idxId] === id) {
          if (data[i][idxEstado] !== "Disponible") return json({ ok:false, error:"not_available" });
          sh.getRange(i+1, idxEstado+1).setValue("Reservado");
          sh.getRange(i+1, idxReservadoPor+1).setValue(reservadoPor);
          sh.getRange(i+1, idxFechaReserva+1).setValue(new Date());
          return json({ ok:true });
        }
      }
      return json({ ok:false, error:"not_found" });
    }

    if (action === "close") {
      const id = String(body.id || "").trim();
      if (!id) return json({ ok:false, error:"missing_id" });

      const data = sh.getDataRange().getValues();
      const idxId = HEADERS.indexOf("id");
      const idxEstado = HEADERS.indexOf("estado");
      const idxFechaCierre = HEADERS.indexOf("fechaCierre");

      for (let i = 1; i < data.length; i++) {
        if (data[i][idxId] === id) {
          sh.getRange(i+1, idxEstado+1).setValue("Cerrado");
          sh.getRange(i+1, idxFechaCierre+1).setValue(new Date());
          return json({ ok:true });
        }
      }
      return json({ ok:false, error:"not_found" });
    }

    if (action === "list") {
      const items = listItems_(sh);
      return json({ ok:true, items });
    }

    if (action === "stats") {
      const items = listItems_(sh);
      const stats = buildStats_(items);
      return json({ ok:true, stats });
    }

    return json({ ok:false, error:"unknown_action" });

  } catch(err){
    return json({ ok:false, error:String(err) });
  }
}

function listItems_(sh){
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const items = [];
  for (let i = 1; i < values.length; i++){
    const row = values[i];
    const obj = {};
    for (let c = 0; c < HEADERS.length; c++){
      obj[HEADERS[c]] = row[c];
    }
    // normalize date fields to ISO (best effort)
    ["vencimiento","fechaPublicacion","fechaReserva","fechaCierre"].forEach(k=>{
      const v = obj[k];
      if (v instanceof Date) obj[k] = Utilities.formatDate(v, "Etc/GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'");
      else obj[k] = String(v || "");
    });
    items.push(obj);
  }
  // Sort: Disponible first, then by vencimiento asc
  items.sort((a,b)=>{
    const pa = a.estado === "Disponible" ? 0 : (a.estado === "Reservado" ? 1 : 2);
    const pb = b.estado === "Disponible" ? 0 : (b.estado === "Reservado" ? 1 : 2);
    if (pa !== pb) return pa - pb;
    return String(a.vencimiento).localeCompare(String(b.vencimiento));
  });

  // map to front-end expected keys (lowercase)
  return items.map(x=>({
    id: x.id,
    medicamento: x.medicamento,
    presentacion: x.presentacion,
    lote: x.lote,
    vencimiento: String(x.vencimiento).slice(0,10) || x.vencimiento,
    cantidad: x.cantidad,
    establecimiento: x.establecimiento,
    contactoEmail: x.contactoEmail,
    estado: x.estado,
    reservadoPor: x.reservadoPor,
    tipo: x.tipo || "Normal",
    observaciones: x.observaciones || ""
  }));
}

function buildStats_(items){
  const countBy = (arr, keyFn)=>{
    const m = new Map();
    for(const x of arr){
      const k = keyFn(x);
      m.set(k, (m.get(k)||0)+1);
    }
    return m;
  };

  const disponibles = items.filter(x=>x.estado==="Disponible");
  const reservados = items.filter(x=>x.estado==="Reservado");
  const cerrados = items.filter(x=>x.estado==="Cerrado");

  const byEst = countBy(disponibles, x=>x.establecimiento || "—");
  const topOferentes = Array.from(byEst.entries())
    .sort((a,b)=>b[1]-a[1])
    .slice(0,10)
    .map(([establecimiento,count])=>({establecimiento,count}));

  return {
    disponibles: disponibles.length,
    reservados: reservados.length,
    cerrados: cerrados.length,
    topOferentes
  };
}

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
