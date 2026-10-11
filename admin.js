const loginPanel = document.querySelector("#admin-login-panel");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#admin-login-form");
const loginMessage = document.querySelector("#login-message");
const dashboardMessage = document.querySelector("#dashboard-message");
const inventoryForm = document.querySelector("#inventory-form");
const tableBody = document.querySelector("#inventory-table-body");
const formTitle = document.querySelector("#inventory-form-title");
const currency = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
let stockItems = [];

function showMessage(target, message, isError = false) {
  target.textContent = message;
  target.classList.toggle("is-error", isError);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages = {
      admin_backend_not_configured: "Backend setup is incomplete. Add the Supabase settings in Vercel first.",
      unauthorized: "Your sign-in has expired. Please sign in again.",
      invalid_login: "That email or password didn’t work.",
      inventory_temporarily_unavailable: "Couldn’t save the stock right now. Try again in a moment.",
      item_not_found: "That stock item was already removed.",
    };
    throw new Error(messages[result.error] || "Something went wrong. Please try again.");
  }
  return result;
}

function setSignedIn(email) {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  document.querySelector("#admin-signed-in").textContent = email;
}

function signedOut() {
  dashboard.hidden = true;
  loginPanel.hidden = false;
}

function appendCell(row, text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  row.append(cell);
  return cell;
}

function renderRows() {
  tableBody.replaceChildren();
  document.querySelector("#inventory-count").textContent = `${stockItems.length} ${stockItems.length === 1 ? "item" : "items"}`;

  if (!stockItems.length) {
    const row = document.createElement("tr");
    const cell = appendCell(row, "No stock items yet. Add one to show it on the public page.");
    cell.colSpan = 6;
    tableBody.append(row);
    return;
  }

  stockItems.forEach((item) => {
    const row = document.createElement("tr");
    const titleCell = document.createElement("td");
    titleCell.className = "admin-item-cell";
    const title = document.createElement("strong");
    title.textContent = item.name;
    const sub = document.createElement("small");
    sub.textContent = [item.brand, item.model].filter(Boolean).join(" · ") || item.category;
    titleCell.append(title, sub);
    row.append(titleCell);
    appendCell(row, item.condition || "Refurbished");
    appendCell(row, Number(item.price_inr) > 0 ? `₹${currency.format(Number(item.price_inr))}` : "Ask for price");
    appendCell(row, String(item.stock_quantity));
    const status = appendCell(row, item.is_active && Number(item.stock_quantity) > 0 ? "Shown" : "Hidden");
    status.classList.add(item.is_active && Number(item.stock_quantity) > 0 ? "status-visible" : "status-hidden");

    const actions = document.createElement("td");
    actions.className = "admin-row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "admin-text-button";
    edit.dataset.action = "edit";
    edit.dataset.id = item.id;
    edit.textContent = "Edit";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-text-button is-danger";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.textContent = "Delete";
    actions.append(edit, remove);
    row.append(actions);
    tableBody.append(row);
  });
}

async function loadStock() {
  showMessage(dashboardMessage, "");
  const result = await apiRequest("/api/inventory?admin=1");
  stockItems = Array.isArray(result.items) ? result.items : [];
  renderRows();
}

function resetInventoryForm() {
  inventoryForm.reset();
  inventoryForm.elements.id.value = "";
  inventoryForm.elements.condition.value = "Refurbished";
  inventoryForm.elements.price_inr.value = "0";
  inventoryForm.elements.stock_quantity.value = "1";
  inventoryForm.elements.is_active.checked = true;
  formTitle.textContent = "Add item";
}

function editItem(item) {
  inventoryForm.hidden = false;
  formTitle.textContent = "Edit item";
  for (const field of ["id", "name", "category", "condition", "brand", "model", "price_inr", "stock_quantity", "specifications", "image_url"]) {
    inventoryForm.elements[field].value = item[field] ?? "";
  }
  inventoryForm.elements.is_active.checked = Boolean(item.is_active);
  inventoryForm.scrollIntoView({ behavior: "smooth", block: "start" });
  inventoryForm.elements.name.focus({ preventScroll: true });
}

document.querySelector("#admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  showMessage(loginMessage, "Signing in…");
  const data = Object.fromEntries(new FormData(loginForm));
  try {
    const result = await apiRequest("/api/admin/auth", { method: "POST", body: JSON.stringify(data) });
    setSignedIn(result.admin.email);
    loginForm.reset();
    try {
      await loadStock();
    } catch (error) {
      showMessage(dashboardMessage, error.message, true);
    }
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#admin-logout").addEventListener("click", async () => {
  try { await apiRequest("/api/admin/auth", { method: "DELETE" }); } catch { /* The local session is cleared either way. */ }
  signedOut();
});

document.querySelector("#add-stock-item").addEventListener("click", () => {
  resetInventoryForm();
  inventoryForm.hidden = false;
  inventoryForm.scrollIntoView({ behavior: "smooth", block: "start" });
  inventoryForm.elements.name.focus({ preventScroll: true });
});

document.querySelectorAll("#cancel-stock-edit, #cancel-stock-form").forEach((button) => {
  button.addEventListener("click", () => {
    inventoryForm.hidden = true;
    resetInventoryForm();
    showMessage(dashboardMessage, "");
  });
});

inventoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = inventoryForm.querySelector("button[type=submit]");
  button.disabled = true;
  showMessage(dashboardMessage, "Saving stock…");
  const formData = new FormData(inventoryForm);
  const item = Object.fromEntries(formData);
  item.price_inr = Number(item.price_inr);
  item.stock_quantity = Number(item.stock_quantity);
  item.is_active = inventoryForm.elements.is_active.checked;
  const id = item.id;
  delete item.id;

  try {
    await apiRequest("/api/inventory", { method: id ? "PATCH" : "POST", body: JSON.stringify(id ? { ...item, id } : item) });
    inventoryForm.hidden = true;
    resetInventoryForm();
    await loadStock();
    showMessage(dashboardMessage, "Stock saved. The public list will update shortly.");
  } catch (error) {
    showMessage(dashboardMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
});

tableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = stockItems.find((entry) => entry.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "edit") {
    editItem(item);
    return;
  }

  if (!window.confirm(`Delete “${item.name}” from stock? This cannot be undone.`)) return;
  button.disabled = true;
  showMessage(dashboardMessage, "Deleting stock item…");
  try {
    await apiRequest("/api/inventory", { method: "DELETE", body: JSON.stringify({ id: item.id }) });
    await loadStock();
    showMessage(dashboardMessage, "Stock item deleted.");
  } catch (error) {
    showMessage(dashboardMessage, error.message, true);
    button.disabled = false;
  }
});

fetch("/api/admin/auth", { headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store" })
  .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
  .then(async ({ ok, data }) => {
    if (ok && data.admin?.email) {
      setSignedIn(data.admin.email);
      try { await loadStock(); } catch (error) { showMessage(dashboardMessage, error.message, true); }
    } else if (data.error === "admin_backend_not_configured") {
      showMessage(loginMessage, "Backend setup is incomplete. Add the Supabase settings in Vercel first.", true);
    }
  })
  .catch(() => showMessage(loginMessage, "Could not reach the stock service. Please try again.", true));

document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = new Date().getFullYear(); });
