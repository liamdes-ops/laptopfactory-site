const {
  getConfig,
  isAllowedAdmin,
  isSameOrigin,
  sendJson,
  setSessionCookie,
} = require("../../lib/inventory-backend");

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
  if (!config.url || !config.publishableKey || !config.adminEmails.length) {
    return sendJson(res, 503, { error: "admin_backend_not_configured" });
  }

  let body;
  try { body = readBody(req); } catch { return sendJson(res, 400, { error: "invalid_request" }); }
  const accessToken = typeof body.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!accessToken || accessToken.length > 4096 || refreshToken.length > 4096 || password.length < 8 || password.length > 1024) {
    return sendJson(res, 400, { error: password.length < 8 ? "password_too_short" : "invalid_invitation" });
  }

  const authHeaders = {
    apikey: config.publishableKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const currentUserResponse = await fetch(`${config.url}/auth/v1/user`, {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!currentUserResponse.ok) return sendJson(res, 401, { error: "invalid_invitation" });
    const currentUser = await currentUserResponse.json();
    if (!isAllowedAdmin(currentUser.email, config)) return sendJson(res, 403, { error: "admin_not_allowed" });

    const updateResponse = await fetch(`${config.url}/auth/v1/user`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ password }),
    });
    if (!updateResponse.ok) {
      if (updateResponse.status === 401 || updateResponse.status === 403) return sendJson(res, 401, { error: "invalid_invitation" });
      return sendJson(res, 400, { error: "password_update_failed" });
    }

    setSessionCookie(res, { access_token: accessToken, refresh_token: refreshToken });
    return sendJson(res, 200, { admin: { email: currentUser.email } });
  } catch {
    return sendJson(res, 503, { error: "auth_unavailable" });
  }
};

