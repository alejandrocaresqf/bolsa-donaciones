/**
 * Netlify Function: API gateway to Google Apps Script.
 * - GET  /.netlify/functions/api?action=list  -> public list
 * - GET  /.netlify/functions/api?action=stats -> public stats
 * - POST /.netlify/functions/api             -> publish/reserve (requires siteKey)
 *
 * Env vars (Netlify):
 *  - APPS_SCRIPT_URL  : Apps Script Web App URL
 *  - API_TOKEN        : secret token for Apps Script (server-to-server)
 *  - SITE_KEY         : shared key for publishers/reservers (typed by users)
 */
const fetch = global.fetch;

exports.handler = async (event) => {
  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
  const API_TOKEN = process.env.API_TOKEN;
  const SITE_KEY = process.env.SITE_KEY;

  if (!APPS_SCRIPT_URL || !API_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:"Missing env vars (APPS_SCRIPT_URL/API_TOKEN)" }) };
  }

  const method = event.httpMethod || "GET";

  // Helpers
  async function callAppsScript(payload){
    const resp = await fetch(APPS_SCRIPT_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ token: API_TOKEN, ...payload }),
    });
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return { ok:false, error:"AppsScript returned non-JSON", raw:text }; }
  }

  if (method === "GET") {
    const action = (event.queryStringParameters && event.queryStringParameters.action) || "list";
    if (action !== "list" && action !== "stats") {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:"Invalid action" }) };
    }
    const out = await callAppsScript({ action });
    return { statusCode: 200, body: JSON.stringify(out) };
  }

  if (method === "POST") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}
    const siteKey = String(body.siteKey || "").trim();

    // Require siteKey for any write action
    if (!SITE_KEY || siteKey !== SITE_KEY) {
      return { statusCode: 401, body: JSON.stringify({ ok:false, error:"Unauthorized (invalid siteKey)" }) };
    }

    const action = body.action;
    if (!action) return { statusCode: 400, body: JSON.stringify({ ok:false, error:"Missing action" }) };

    if (action === "upsertBatch") {
      const establecimiento = String(body.establecimiento || "").trim();
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const batchId = String(body.batchId || Date.now());
      if (!establecimiento) return { statusCode: 400, body: JSON.stringify({ ok:false, error:"Missing establecimiento" }) };
      if (!rows.length) return { statusCode: 400, body: JSON.stringify({ ok:false, error:"No rows" }) };

      const out = await callAppsScript({ action, establecimiento, batchId, rows });
      return { statusCode: 200, body: JSON.stringify(out) };
    }

    if (action === "reserve") {
      const id = String(body.id || "").trim();
      const reservadoPor = String(body.reservadoPor || "").trim();
      if (!id) return { statusCode: 400, body: JSON.stringify({ ok:false, error:"Missing id" }) };
      const out = await callAppsScript({ action, id, reservadoPor });
      return { statusCode: 200, body: JSON.stringify(out) };
    }

    if (action === "close") {
      const id = String(body.id || "").trim();
      if (!id) return { statusCode: 400, body: JSON.stringify({ ok:false, error:"Missing id" }) };
      const out = await callAppsScript({ action, id });
      return { statusCode: 200, body: JSON.stringify(out) };
    }

    return { statusCode: 400, body: JSON.stringify({ ok:false, error:"Unknown action" }) };
  }

  return { statusCode: 405, body: JSON.stringify({ ok:false, error:"Method not allowed" }) };
};
