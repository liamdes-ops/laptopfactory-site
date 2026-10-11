const { getConfig, isSameOrigin, sendJson } = require("../../lib/inventory-backend");

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!isSameOrigin(req)) return sendJson(res, 403, { error: "forbidden" });

  const config = getConfig();
  if (!config.url || !config.publishableKey) {
    return sendJson(res, 503, { error: "admin_backend_not_configured" });
  }

  let body;
  try { body = readBody(req); } catch { return sendJson(res, 400, { error: "invalid_request" }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(res, 400, { error: "enter_valid_email" });
  }

  try {
    const redirectTo = "https://laptopfactory-site.vercel.app/";
    const response = await fetch(`${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.status === 429) return sendJson(res, 429, { error: "recovery_rate_limited" });
    if (!response.ok) console.warn("LaptopFactory password recovery request was not accepted", response.status);
    // Keep the response generic so the endpoint does not reveal which addresses have accounts.
    return sendJson(res, 200, { ok: true });
  } catch {
    return sendJson(res, 503, { error: "auth_unavailable" });
  }
};

