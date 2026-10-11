const SESSION_COOKIE = "lf_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getConfig() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const adminEmails = (process.env.LAPTOPFACTORY_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return { url, publishableKey, secretKey, adminEmails };
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

function setSessionCookie(res, session) {
  const value = Buffer.from(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })).toString("base64url");

  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function readSession(req) {
  const cookieHeader = req.headers.cookie || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;

  try {
    return JSON.parse(Buffer.from(cookie.slice(SESSION_COOKIE.length + 1), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function isAllowedAdmin(email, config = getConfig()) {
  return typeof email === "string" && config.adminEmails.includes(email.trim().toLowerCase());
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

async function authFetch(config, path, options = {}) {
  return fetch(`${config.url}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function getAdmin(req, res) {
  const config = getConfig();
  if (!config.url || !config.publishableKey || !config.secretKey || !config.adminEmails.length) {
    return { error: "not_configured" };
  }

  const session = readSession(req);
  if (!session?.access_token) return { error: "unauthorized" };

  let currentSession = session;
  let userResponse = await authFetch(config, "user", {
    headers: { Authorization: `Bearer ${currentSession.access_token}` },
  });

  if (!userResponse.ok && currentSession.refresh_token) {
    const refreshResponse = await authFetch(config, "token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
    });

    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json();
      if (refreshed.access_token && refreshed.refresh_token) {
        currentSession = refreshed;
        setSessionCookie(res, currentSession);
        userResponse = await authFetch(config, "user", {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
      }
    }
  }

  if (!userResponse.ok) {
    clearSessionCookie(res);
    return { error: "unauthorized" };
  }

  const user = await userResponse.json();
  if (!isAllowedAdmin(user.email, config)) {
    clearSessionCookie(res);
    return { error: "unauthorized" };
  }

  return { user, config };
}

async function supabaseRest(config, { admin = false, path, method = "GET", body, prefer }) {
  const key = admin ? config.secretKey : config.publishableKey;
  const headers = { apikey: key, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let result = null;
  if (text) {
    try { result = JSON.parse(text); } catch { result = null; }
  }

  if (!response.ok) {
    console.error("LaptopFactory inventory request failed", response.status);
    throw new Error("database_unavailable");
  }

  return result;
}

module.exports = {
  clearSessionCookie,
  getAdmin,
  getConfig,
  isAllowedAdmin,
  isSameOrigin,
  sendJson,
  setSessionCookie,
  supabaseRest,
};
