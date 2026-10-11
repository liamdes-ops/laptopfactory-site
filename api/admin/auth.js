const {
  clearSessionCookie,
  getAdmin,
  getConfig,
  isAllowedAdmin,
  isSameOrigin,
  sendJson,
  setSessionCookie,
} = require("../../lib/inventory-backend");

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const config = getConfig();

  if (req.method === "GET") {
    let result;
    try { result = await getAdmin(req, res); } catch {
      return sendJson(res, 503, { error: "auth_unavailable" });
    }
    if (result.error === "not_configured") {
      return sendJson(res, 503, { error: "admin_backend_not_configured" });
    }
    if (result.error) return sendJson(res, 401, { error: "unauthorized" });
    return sendJson(res, 200, { admin: { email: result.user.email } });
  }

  if (req.method === "POST") {
    if (!isSameOrigin(req)) return sendJson(res, 403, { error: "forbidden" });
    if (!config.url || !config.publishableKey || !config.secretKey || !config.adminEmails.length) {
      return sendJson(res, 503, { error: "admin_backend_not_configured" });
    }

    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: "invalid_request" }); }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || email.length > 254 || !password || password.length > 1024) {
      return sendJson(res, 400, { error: "enter_email_and_password" });
    }
    if (!isAllowedAdmin(email, config)) return sendJson(res, 401, { error: "invalid_login" });

    let authResponse;
    try {
      authResponse = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      return sendJson(res, 503, { error: "auth_unavailable" });
    }

    if (!authResponse.ok) return sendJson(res, 401, { error: "invalid_login" });
    const session = await authResponse.json();
    if (!session.access_token || !session.refresh_token || !isAllowedAdmin(session.user?.email, config)) {
      return sendJson(res, 401, { error: "invalid_login" });
    }

    setSessionCookie(res, session);
    return sendJson(res, 200, { admin: { email: session.user.email } });
  }

  if (req.method === "DELETE") {
    if (!isSameOrigin(req)) return sendJson(res, 403, { error: "forbidden" });
    const session = req.headers.cookie?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("lf_admin_session="));

    if (session && config.url && config.publishableKey) {
      try {
        const encoded = session.slice("lf_admin_session=".length);
        const current = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (current.access_token) {
          await fetch(`${config.url}/auth/v1/logout?scope=local`, {
            method: "POST",
            headers: {
              apikey: config.publishableKey,
              Authorization: `Bearer ${current.access_token}`,
            },
          });
        }
      } catch {
        // Clearing the browser session still succeeds if Supabase is unreachable.
      }
    }

    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return sendJson(res, 405, { error: "method_not_allowed" });
};
