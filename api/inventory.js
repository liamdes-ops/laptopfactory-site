const {
  getAdmin,
  getConfig,
  isSameOrigin,
  sendJson,
  supabaseRest,
} = require("../lib/inventory-backend");

const PUBLIC_FIELDS = "id,name,category,brand,model,specifications,condition,price_inr,stock_quantity,image_url";
const CATEGORIES = new Set(["laptop", "desktop", "cpu"]);

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return {};
}

function normalizeInventory(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().toLowerCase() : "";
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const specifications = typeof body.specifications === "string" ? body.specifications.trim() : "";
  const condition = typeof body.condition === "string" ? body.condition.trim() : "Refurbished";
  const price = Number(body.price_inr);
  const quantity = Number(body.stock_quantity);
  const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";

  if (!name || name.length > 120) throw new Error("invalid_name");
  if (!CATEGORIES.has(category)) throw new Error("invalid_category");
  if (brand.length > 80 || model.length > 120 || specifications.length > 700 || condition.length > 60) {
    throw new Error("text_too_long");
  }
  if (!Number.isInteger(price) || price < 0 || price > 100000000) throw new Error("invalid_price");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) throw new Error("invalid_quantity");
  if (imageUrl) {
    try {
      if (new URL(imageUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new Error("invalid_image_url");
    }
  }
  if (body.is_active !== undefined && typeof body.is_active !== "boolean") throw new Error("invalid_status");

  return {
    name,
    category,
    brand,
    model,
    specifications,
    condition: condition || "Refurbished",
    price_inr: price,
    stock_quantity: quantity,
    image_url: imageUrl || null,
    is_active: body.is_active !== false,
  };
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const config = getConfig();
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const adminMode = url.searchParams.get("admin") === "1";

  if (req.method === "GET") {
    if (adminMode) {
      let admin;
      try { admin = await getAdmin(req, res); } catch {
        return sendJson(res, 503, { error: "auth_unavailable", items: [] });
      }
      if (admin.error === "not_configured") return sendJson(res, 503, { error: "admin_backend_not_configured" });
      if (admin.error) return sendJson(res, 401, { error: "unauthorized" });
    } else if (!config.url || !config.publishableKey) {
      return sendJson(res, 503, { error: "inventory_not_configured", items: [] });
    }

    try {
      const fields = adminMode ? "*" : PUBLIC_FIELDS;
      let path = `inventory?select=${encodeURIComponent(fields)}&order=created_at.desc`;
      if (!adminMode) path += "&is_active=eq.true&stock_quantity=gt.0";
      const items = await supabaseRest(config, { admin: adminMode, path });
      return sendJson(res, 200, { items: Array.isArray(items) ? items : [] });
    } catch {
      return sendJson(res, 503, { error: "inventory_temporarily_unavailable", items: [] });
    }
  }

  if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (!isSameOrigin(req)) return sendJson(res, 403, { error: "forbidden" });
  let admin;
  try { admin = await getAdmin(req, res); } catch {
    return sendJson(res, 503, { error: "auth_unavailable" });
  }
  if (admin.error === "not_configured") return sendJson(res, 503, { error: "admin_backend_not_configured" });
  if (admin.error) return sendJson(res, 401, { error: "unauthorized" });

  let body;
  try { body = requestBody(req); } catch { return sendJson(res, 400, { error: "invalid_request" }); }

  try {
    if (req.method === "POST") {
      const item = normalizeInventory(body);
      const result = await supabaseRest(admin.config, {
        admin: true,
        path: "inventory?select=*",
        method: "POST",
        body: item,
        prefer: "return=representation",
      });
      return sendJson(res, 201, { item: result?.[0] || null });
    }

    if (!isUuid(body.id)) return sendJson(res, 400, { error: "invalid_item_id" });

    if (req.method === "PATCH") {
      const item = normalizeInventory(body);
      const result = await supabaseRest(admin.config, {
        admin: true,
        path: `inventory?id=eq.${encodeURIComponent(body.id)}&select=*`,
        method: "PATCH",
        body: item,
        prefer: "return=representation",
      });
      if (!Array.isArray(result) || !result.length) return sendJson(res, 404, { error: "item_not_found" });
      return sendJson(res, 200, { item: result[0] });
    }

    const deleted = await supabaseRest(admin.config, {
      admin: true,
      path: `inventory?id=eq.${encodeURIComponent(body.id)}&select=id`,
      method: "DELETE",
      prefer: "return=representation",
    });
    if (!Array.isArray(deleted) || !deleted.length) return sendJson(res, 404, { error: "item_not_found" });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    if (error.message?.startsWith("invalid_") || error.message === "text_too_long") {
      return sendJson(res, 400, { error: error.message });
    }
    return sendJson(res, 503, { error: "inventory_temporarily_unavailable" });
  }
};
