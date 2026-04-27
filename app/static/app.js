const user = JSON.parse(localStorage.getItem("azcon_user") || "null");

if (!user?.id) window.location.href = "/";

async function api(path, method = "GET", body = null) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "x-user-id": String(user.id) },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

function esc(x) {
  return String(x ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/* ── UI helpers ─────────────────────────────────── */

function emptyState(heading, subtext = "") {
  return `<div class="empty-state">
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="14" width="34" height="27" rx="3" stroke="currentColor" stroke-width="1.8"/>
      <path d="M17 22h18M17 29h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="39" cy="39" r="9" fill="var(--surface)" stroke="currentColor" stroke-width="1.8"/>
      <path d="M36 39h6M39 36v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
    <h4>${esc(heading)}</h4>
    ${subtext ? `<p>${esc(subtext)}</p>` : ""}
  </div>`;
}

function skeletonTable(cols, rows = 5) {
  const widths = [55, 80, 65, 75, 55, 70, 60];
  const headerCells = cols.map((c) => `<th>${esc(c)}</th>`).join("");
  const dataCells = cols
    .map((_, i) => `<td><span class="skeleton-cell" style="width:${widths[i % widths.length]}%"></span></td>`)
    .join("");
  const bodyRows = Array(rows).fill(`<tr>${dataCells}</tr>`).join("");
  return `<table class="skeleton-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add("btn-loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

/* ── Hamburger / sidebar drawer ─────────────────── */
(function () {
  const hamburger = document.getElementById("btnHamburger");
  const overlay = document.getElementById("sidebarOverlay");
  if (!hamburger) return;
  function openSidebar() { document.body.classList.add("sidebar-open"); }
  function closeSidebar() { document.body.classList.remove("sidebar-open"); }
  hamburger.addEventListener("click", openSidebar);
  if (overlay) overlay.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSidebar(); });
})();


function applyRoleView() {
  document.querySelectorAll(".role-view").forEach((el) => {
    const roles = (el.dataset.roles || "").split(",");
    el.classList.toggle("hidden", !roles.includes(user.role));
  });
}

let activeSectionId = null;

function setupSectionTabs() {
  const tabsHost = document.getElementById("sectionTabs");
  if (!tabsHost) return;
  const sections = [...document.querySelectorAll(".section-group")].filter((el) => !el.classList.contains("hidden"));
  tabsHost.innerHTML = sections
    .map((sec) => {
      const title = sec.querySelector(".section-head h3")?.textContent?.replace(/^\d+\)\s*/, "") || sec.id;
      return `<button class="header-tab" data-target="${sec.id}">${esc(title)}</button>`;
    })
    .join("");
  tabsHost.querySelectorAll(".header-tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveSection(btn.dataset.target));
  });
  if (!activeSectionId || !sections.some((s) => s.id === activeSectionId && !s.classList.contains("hidden"))) {
    activeSectionId = sections[0]?.id || null;
  }
  setActiveSection(activeSectionId);
}

function setActiveSection(sectionId) {
  if (!sectionId) return;
  activeSectionId = sectionId;
  document.querySelectorAll(".section-group").forEach((sec) => {
    const isActive = sec.id === sectionId;
    const isHiddenByRole = sec.classList.contains("hidden");
    sec.classList.toggle("inactive-section", !isActive || isHiddenByRole);
  });
  document.querySelectorAll(".header-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === sectionId);
  });
  // Close sidebar drawer on mobile when a section is selected
  document.body.classList.remove("sidebar-open");
}

function applyRoleHeader() {
  const titleByRole = {
    platform_admin: "Platform Admin Console",
    company_admin: "Company Admin Console",
    department_admin: "Department Admin Console",
    procurement_decider: "Procurement Decider Workspace",
    storage_holder: "Storage Holder Workspace",
  };
  const subtitleByRole = {
    platform_admin: "Platform-level approvals and governance.",
    company_admin: "Approves department admins and manages company controls.",
    department_admin: "Approves storage/procurement users in your department.",
    procurement_decider: "Request creation and AI-driven vendor recommendation.",
    storage_holder: "See inventory amounts and submit purchase requests.",
  };
  const titleEl = document.getElementById("topbarTitle");
  const subtitleEl = document.getElementById("topbarSubtitle");
  if (titleEl) titleEl.textContent = titleByRole[user.role] || "AZCON Workspace";
  if (subtitleEl) subtitleEl.textContent = subtitleByRole[user.role] || "Role-specific workspace.";
}

async function loadVendors() {
  const rows = await api("/vendors-marketplace");
  const vendorsOut = document.getElementById("vendorsOut");
  if (vendorsOut) {
    vendorsOut.innerHTML = `<table class="table"><thead><tr><th>Vendor</th><th>Success Rate</th><th></th></tr></thead><tbody>${rows
      .map((v) => `<tr><td>${esc(v.vendor_name)}</td><td>${esc(v.success_rate)}%</td><td><button class="btn btn-small" onclick="loadVendorProfile(${v.vendor_id})">Bax</button></td></tr>`)
      .join("")}</tbody></table>`;
  }
  const vendorSelect = document.getElementById("reqVendorId");
  if (vendorSelect) {
    vendorSelect.innerHTML = rows.map((v) => `<option value="${v.vendor_id}">${esc(v.vendor_name)}</option>`).join("");
  }
}

window.loadVendorProfile = async function (vendorId) {
  const p = await api(`/vendors/${vendorId}/profile`);
  const vendorProfileOut = document.getElementById("vendorProfileOut");
  if (!vendorProfileOut) return;
  vendorProfileOut.innerHTML = `
    <h4>${esc(p.vendor_name)}</h4>
    <p><strong>About:</strong> ${esc(p.about)}</p>
    <p><strong>Feedback:</strong> ${p.feedback.map((f) => `${esc(f.buyer)} (${f.rating}/5) - ${esc(f.comment)}`).join(" | ")}</p>
    <p><strong>Previous Sales:</strong> ${p.previous_sales.map((s) => `${esc(s.company)} → ${esc(s.what_sold)}`).join(" | ")}</p>
  `;
};

async function refreshRequestOptions() {
  const rows = await api("/requests");
  const sel = document.getElementById("recommendReqId");
  if (!sel) return;
  sel.innerHTML = rows.map((r) => `<option value="${r.request_id}">${esc(r.title)} - ${esc(r.company_name)}</option>`).join("");
}


const btnManualNeed = document.getElementById("btnManualNeed");
if (btnManualNeed) {
  btnManualNeed.onclick = async () => {
    const response = await api(`/catalog/expensive-items?company_name=${encodeURIComponent(user.company_name)}&department=${encodeURIComponent(user.department || "Satınalma")}`);
    document.getElementById("reqOut").innerHTML = `${response.items.map((x) => `• ${esc(x)}`).join("<br>")}<br><strong>${esc(response.manual_input_label)}</strong>`;
  };
}

const reqItemTypeEl = document.getElementById("reqItemType");
const reqProductFieldsEl = document.getElementById("reqProductFields");
const reqServiceFieldsEl = document.getElementById("reqServiceFields");
const reqMinReliabilityEl = document.getElementById("reqMinReliability");
const reqMinReliabilityValueEl = document.getElementById("reqMinReliabilityValue");
const reqCategoryEl = document.getElementById("reqCategory");
const reqDeadlineEl = document.getElementById("reqDeadline");
const reqStartDateEl = document.getElementById("reqStartDate");

function _isoDateInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function syncProductServiceFields() {
  if (!reqItemTypeEl) return;
  const isProduct = reqItemTypeEl.value === "product";
  if (reqProductFieldsEl) reqProductFieldsEl.classList.toggle("hidden", !isProduct);
  if (reqServiceFieldsEl) reqServiceFieldsEl.classList.toggle("hidden", isProduct);
}
if (reqItemTypeEl) reqItemTypeEl.addEventListener("change", syncProductServiceFields);
syncProductServiceFields();

if (reqMinReliabilityEl && reqMinReliabilityValueEl) {
  reqMinReliabilityEl.addEventListener("input", () => {
    reqMinReliabilityValueEl.textContent = Number(reqMinReliabilityEl.value).toFixed(1);
  });
}

if (reqDeadlineEl && !reqDeadlineEl.value) reqDeadlineEl.value = _isoDateInDays(7);
if (reqStartDateEl && !reqStartDateEl.value) reqStartDateEl.value = _isoDateInDays(3);

// Pre-fill the Category dropdown with the user's department (which now follows
// the AI agent's 5-category vocabulary).
if (reqCategoryEl && user && user.department) {
  const match = Array.from(reqCategoryEl.options).find((o) => o.value === user.department);
  if (match) reqCategoryEl.value = user.department;
}

const btnCreateRequest = document.getElementById("btnCreateRequest");
if (btnCreateRequest) {
  btnCreateRequest.onclick = async () => {
    const vendorSelectEl = document.getElementById("reqVendorId");
    const selectedVendor = vendorSelectEl?.value ? Number(vendorSelectEl.value) : null;
    const itemType = document.getElementById("reqItemType").value;
    const isProduct = itemType === "product";
    const category = reqCategoryEl?.value || user.department || "Others";
    const deadline = document.getElementById("reqDeadline")?.value || "";
    const startDate = document.getElementById("reqStartDate")?.value || "";
    const totalBudget = Number(document.getElementById("reqTotalBudget").value) || 0;
    const minReliability = Number(document.getElementById("reqMinReliability").value) || 4.0;
    const azconOnly = document.getElementById("reqAzconOnly").checked;

    const payload = {
      title: document.getElementById("reqTitle").value,
      description: document.getElementById("reqDescription").value,
      quantity: isProduct ? Number(document.getElementById("reqQty").value) || 1 : 1,
      required_by: isProduct ? deadline : startDate,
      budget_min: 0,
      budget_max: totalBudget,
      item_type: itemType,
      vendor_id: user.role === "storage_holder" ? null : selectedVendor,
      delivery_date: isProduct ? deadline : startDate,
      department: category,
      unit: isProduct ? document.getElementById("reqUnit").value : null,
      total_budget: totalBudget,
      min_reliability_score: minReliability,
      azcon_reference_required: azconOnly,
      service_duration: isProduct ? null : document.getElementById("reqServiceDuration").value.trim(),
      start_date: isProduct ? null : startDate,
      service_level: isProduct ? null : document.getElementById("reqServiceLevel").value,
    };
    setButtonLoading(btnCreateRequest, true);
    try {
      const out = await api("/requests", "POST", payload);
      document.getElementById("reqOut").innerHTML = `Request #${out.request_id} created. Shipping: ${esc(out.shipping_cost)} ${
        out.shared_logistics_badge ? `<span class="badge ok">${esc(out.shared_logistics_badge)}</span>` : ""
      }`;
      await refreshRequestOptions();
    } finally {
      setButtonLoading(btnCreateRequest, false);
    }
  };
}

const btnRecommend = document.getElementById("btnRecommend");
if (btnRecommend) {
  btnRecommend.onclick = async () => {
    const reqId = Number(document.getElementById("recommendReqId").value);
    const topN = Number(document.getElementById("topN").value);
    const out = await api(`/requests/${reqId}/recommend?top_n=${topN}`, "POST");
    document.getElementById("recommendOut").innerHTML = `<table class="table"><thead><tr><th>Vendor</th><th>Price</th><th>Lead Time</th><th>Score</th><th>Reason</th></tr></thead><tbody>${out.results
      .map((r) => `<tr><td>${esc(r.vendor_name)}</td><td>${esc(r.price)} ${esc(r.currency)}</td><td>${esc(r.lead_time_days)} days</td><td>${esc(r.scores.total)}</td><td>${esc(r.reasoning)}</td></tr>`)
      .join("")}</tbody></table>`;
  };
}

const btnLoadAnalytics = document.getElementById("btnLoadAnalytics");
if (btnLoadAnalytics) {
  btnLoadAnalytics.onclick = async () => {
    const c = user.company_name || "Azerbaijan Airlines";
    const out = await api(`/analytics/company-expenses?company_name=${encodeURIComponent(c)}`);
    renderAnalytics(out);
  };
}

function renderAnalytics(out) {
  const wrap = document.getElementById("analyticsOut");
  if (!wrap) return;
  const last = out.last_year || {};
  const curr = out.this_year || {};
  const keys = [...new Set([...Object.keys(last), ...Object.keys(curr)])];
  const totalLast = keys.reduce((acc, k) => acc + Number(last[k] || 0), 0);
  const totalCurr = keys.reduce((acc, k) => acc + Number(curr[k] || 0), 0);
  const delta = totalCurr - totalLast;
  const maxVal = Math.max(1, ...keys.map((k) => Number(curr[k] || 0)));
  wrap.innerHTML = `
    <div class="analytics-grid">
      <div class="analytics-stat"><div class="label">Company</div><div class="value">${esc(out.company_name || "-")}</div></div>
      <div class="analytics-stat"><div class="label">Total Last Year</div><div class="value">$${Math.round(totalLast).toLocaleString()}</div></div>
      <div class="analytics-stat"><div class="label">Total This Year</div><div class="value">$${Math.round(totalCurr).toLocaleString()}</div></div>
      <div class="analytics-stat"><div class="label">YoY Change</div><div class="value">${delta >= 0 ? "+" : ""}$${Math.round(delta).toLocaleString()}</div></div>
    </div>
    ${keys
      .map((k) => {
        const currVal = Number(curr[k] || 0);
        const pct = Math.max(3, Math.round((currVal / maxVal) * 100));
        return `<div class="analytics-bar-row">
          <div class="analytics-bar-meta"><span>${esc(k)}</span><span>$${Math.round(currVal).toLocaleString()}</span></div>
          <div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      })
      .join("")}
  `;
}

window.approveCompanyRequest = async function (requestId) {
  await api(`/company-admin/registration-requests/${requestId}/approve`, "POST");
  await loadCompanyApprovals();
};
window.rejectCompanyRequest = async function (requestId) {
  await api(`/company-admin/registration-requests/${requestId}/reject`, "POST");
  await loadCompanyApprovals();
};

async function loadCompanyApprovals() {
  const outEl = document.getElementById("companyApprovalsOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["Name", "Username", "Role", "Department", "Actions"]);
  const rows = await api("/company-admin/registration-requests");
  if (!rows.length) {
    outEl.innerHTML = emptyState("No pending approvals", "All department admin requests for your company have been handled.");
    return;
  }
  outEl.innerHTML = `<table class="table animated"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Department</th><th>Actions</th></tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr><td>${esc(r.full_name)}</td><td>${esc(r.username)}</td><td>${esc(r.requested_role)}</td><td>${esc(r.department)}</td><td><button class="btn btn-small" onclick="approveCompanyRequest(${r.request_id})">Approve</button> <button class="btn btn-small" onclick="rejectCompanyRequest(${r.request_id})">Reject</button></td></tr>`,
    )
    .join("")}</tbody></table>`;
}

window.approveDepartmentRequest = async function (requestId) {
  await api(`/department-admin/registration-requests/${requestId}/approve`, "POST");
  await loadDepartmentApprovals();
};
window.rejectDepartmentRequest = async function (requestId) {
  await api(`/department-admin/registration-requests/${requestId}/reject`, "POST");
  await loadDepartmentApprovals();
};

async function loadDepartmentApprovals() {
  const outEl = document.getElementById("departmentApprovalsOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["Name", "Username", "Role", "Department", "Actions"]);
  const rows = await api("/department-admin/registration-requests");
  if (!rows.length) {
    outEl.innerHTML = emptyState("No pending requests", "All user requests for your department have been reviewed.");
    return;
  }
  outEl.innerHTML = `<table class="table animated"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Department</th><th>Actions</th></tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr><td>${esc(r.full_name)}</td><td>${esc(r.username)}</td><td>${esc(r.requested_role)}</td><td>${esc(r.department)}</td><td><button class="btn btn-small" onclick="approveDepartmentRequest(${r.request_id})">Approve</button> <button class="btn btn-small" onclick="rejectDepartmentRequest(${r.request_id})">Reject</button></td></tr>`,
    )
    .join("")}</tbody></table>`;
}

window.approvePlatformRequest = async function (requestId) {
  await api(`/admin/registration-requests/${requestId}/approve`, "POST");
  await loadPlatformApprovals();
};
window.rejectPlatformRequest = async function (requestId) {
  await api(`/admin/registration-requests/${requestId}/reject`, "POST");
  await loadPlatformApprovals();
};

async function loadPlatformApprovals() {
  const outEl = document.getElementById("platformApprovalsOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["Name", "Username", "Company", "Role", "Actions"]);
  const rows = await api("/admin/registration-requests");
  if (!rows.length) {
    outEl.innerHTML = emptyState("No pending registrations", "There are no company admin registration requests awaiting review.");
    return;
  }
  outEl.innerHTML = `<table class="table animated"><thead><tr><th>Name</th><th>Username</th><th>Company</th><th>Role</th><th>Actions</th></tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr><td>${esc(r.full_name)}</td><td>${esc(r.username)}</td><td>${esc(r.company_name)}</td><td>${esc(r.requested_role)}</td><td><button class="btn btn-small" onclick="approvePlatformRequest(${r.request_id})">Approve</button> <button class="btn btn-small" onclick="rejectPlatformRequest(${r.request_id})">Reject</button></td></tr>`,
    )
    .join("")}</tbody></table>`;
}

window.deleteUserByAdmin = async function (userId) {
  await api(`/admin/users/${userId}`, "DELETE");
  await loadAdminUsers();
};

async function loadAdminUsers() {
  const outEl = document.getElementById("adminUsersOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["ID", "Name", "Username", "Role", "Active", "Action"]);
  const rows = await api("/admin/users");
  if (!rows.length) {
    outEl.innerHTML = emptyState("No users found", "The platform has no registered users yet.");
    return;
  }
  outEl.innerHTML = `<table class="table animated"><thead><tr><th>ID</th><th>Name</th><th>Username</th><th>Role</th><th>Active</th><th>Action</th></tr></thead><tbody>${rows
    .map((u) => {
      const canDelete = u.role !== "platform_admin";
      return `<tr><td>${u.id}</td><td>${esc(u.full_name)}</td><td>${esc(u.username || "-")}</td><td>${esc(u.role)}</td><td>${u.is_active ? "Yes" : "No"}</td><td>${canDelete ? `<button class="btn btn-small" onclick="deleteUserByAdmin(${u.id})">Delete</button>` : "-"}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

window.acceptStorageRequest = async function (requestId) {
  await api(`/procurement/requests/${requestId}/accept`, "POST");
  await loadStorageRequests();
};
let storageRequestRowsCache = [];
window.searchVendorForRequest = function (requestId) {
  const req = storageRequestRowsCache.find((r) => Number(r.request_id) === Number(requestId));
  if (!req) return;
  const totalBudget = Number(req.total_budget || req.budget_max || req.budget_min || 50000);
  const deadline = req.delivery_date || req.required_by || "";
  const startDate = req.start_date || deadline;
  const params = new URLSearchParams({
    request_id: String(req.request_id),
    query: req.title || "",
    procurement_type: req.item_type || "product",
    quantity: String(req.quantity || 1),
    total_budget: String(totalBudget),
    department: req.department || "Others",
    deadline: deadline,
    start_date: startDate,
    service_duration: req.service_duration || "3 months",
    service_level: req.service_level || "Standard",
    min_reliability_score: String(req.min_reliability_score ?? 4.0),
    azcon_reference_required: req.azcon_reference_required ? "true" : "false",
  });
  if (req.unit) params.set("unit", req.unit);
  window.location.href = `/ai-agent?${params.toString()}`;
};
window.declineStorageRequest = async function (requestId) {
  await api(`/procurement/requests/${requestId}/decline`, "POST");
  await loadStorageRequests();
};
window.doneStorageRequest = async function (requestId) {
  await api(`/procurement/requests/${requestId}/done`, "POST");
  await loadStorageRequests();
};

async function loadStorageRequests() {
  const outEl = document.getElementById("storageRequestsOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["Title", "Requester", "Role", "Department", "Vendor", "Status", "Actions"]);
  const rows = await api("/procurement/storage-requests");
  storageRequestRowsCache = rows || [];
  if (!rows.length) {
    outEl.innerHTML = emptyState("No requests to review", "There are no storage holder requests awaiting your decision.");
    return;
  }
  outEl.innerHTML = `<table class="table animated"><thead><tr><th>Title</th><th>Requester</th><th>Role</th><th>Department</th><th>Vendor</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows
    .map((r) => {
      let actions = "";
      if (r.status === "submitted") {
        actions = `<button class="btn btn-small" onclick="searchVendorForRequest(${r.request_id})">Search Vendor</button> <button class="btn btn-small" onclick="acceptStorageRequest(${r.request_id})">Accept</button> <button class="btn btn-small" onclick="declineStorageRequest(${r.request_id})">Decline</button>`;
      } else if (r.status === "approved") {
        actions = `<button class="btn btn-small" onclick="searchVendorForRequest(${r.request_id})">Search Vendor</button> <button class="btn btn-small" onclick="doneStorageRequest(${r.request_id})">Done</button> <button class="btn btn-small" onclick="declineStorageRequest(${r.request_id})">Decline</button>`;
      } else {
        actions = "-";
      }
      return `<tr><td>${esc(r.title)}</td><td>${esc(r.requested_by)}</td><td>${esc(r.requested_by_role || "-")}</td><td>${esc(r.department || "-")}</td><td>${esc(r.vendor_name || "-")}</td><td>${esc(r.status)}</td><td>${actions}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

async function loadStorageInventory() {
  const outEl = document.getElementById("storageInventoryOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["Item", "Quantity", "Unit", "Min Threshold"]);
  const rows = await api("/inventory");
  if (!rows.length) {
    outEl.innerHTML = emptyState("Inventory is empty", "No inventory items have been recorded for your department yet.");
    return;
  }
  outEl.innerHTML = `<table class="table animated"><thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Min Threshold</th></tr></thead><tbody>${rows
    .map((r) => `<tr><td>${esc(r.item_name)}</td><td>${esc(r.quantity)}</td><td>${esc(r.unit)}</td><td>${esc(r.min_threshold)}</td></tr>`)
    .join("")}</tbody></table>`;
}

async function loadCompanyVendors() {
  const outEl = document.getElementById("companyVendorsOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["Vendor", "Trusted", "Categories"]);
  const rows = await api("/company/vendors");
  if (!rows.length) {
    outEl.innerHTML = emptyState("No approved vendors", "Add your first trusted vendor using the form above.");
    return;
  }
  outEl.innerHTML = `<table class="table animated"><thead><tr><th>Vendor</th><th>Trusted</th><th>Categories</th></tr></thead><tbody>${rows
    .map((v) => `<tr><td>${esc(v.vendor_name)}</td><td>${v.is_trusted ? "Yes" : "No"}</td><td>${esc(v.provided_categories || "-")}</td></tr>`)
    .join("")}</tbody></table>`;
}

async function createApprovedVendor() {
  const outEl = document.getElementById("vendorAddOut");
  const payload = {
    company_name: document.getElementById("vendorName").value.trim(),
    provided_categories: document.getElementById("vendorCategories").value.trim(),
    is_trusted: document.getElementById("vendorTrusted").value === "true",
  };
  if (!payload.company_name) {
    outEl.textContent = "Vendor name is required.";
    return;
  }
  await api("/vendors", "POST", payload);
  outEl.textContent = "Vendor saved to approved vendor list.";
  await loadCompanyVendors();
}


document.getElementById("btnLogout").onclick = () => {
  localStorage.removeItem("azcon_user");
  window.location.href = "/";
};

document.getElementById("userName").textContent = user.full_name;
document.getElementById("userRole").textContent = user.role;
document.getElementById("userCompany").textContent = user.company_name || "-";
document.getElementById("userDepartment").textContent = user.department || "-";
applyRoleHeader();
applyRoleView();
setupSectionTabs();
refreshRequestOptions();

const reqVendorField = document.getElementById("reqVendorField");
if (user.role === "storage_holder" && reqVendorField) {
  reqVendorField.classList.add("hidden");
  const vendorSelect = document.getElementById("reqVendorId");
  if (vendorSelect) vendorSelect.value = "";
}

async function loadDepartmentProcurements() {
  const outEl = document.getElementById("deptProcurementsOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["#", "Title", "Status", "Type", "Qty", "Total Budget", "Vendor", "Date", "Requested By"]);
  const rows = await api("/department-admin/procurements");
  if (!rows.length) {
    outEl.innerHTML = emptyState("No procurement history", "Your department hasn't submitted any procurement requests yet.");
    return;
  }
  const statusBadge = (s) => {
    const cls = s === "DONE" ? "ok" : s === "REJECTED" ? "warn" : "";
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  };
  outEl.innerHTML = `<table class="table animated"><thead><tr>
      <th>#</th><th>Title</th><th>Status</th><th>Type</th><th>Qty</th>
      <th>Total Budget</th><th>Vendor</th><th>Decided/Required</th>
      <th>Requested By</th>
    </tr></thead><tbody>${rows
      .map(
        (r) =>
          `<tr>
            <td>${r.request_id}</td>
            <td>${esc(r.title)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${esc(r.item_type || "-")}</td>
            <td>${esc((r.quantity ?? "-") + (r.unit ? " " + r.unit : ""))}</td>
            <td>${r.total_budget != null ? Number(r.total_budget).toLocaleString() : "-"}</td>
            <td>${esc(r.vendor_name || "-")}</td>
            <td>${esc(r.delivery_date || r.required_by || "-")}</td>
            <td>${esc(r.requested_by)} <small class="muted">(${esc(r.requested_by_role)})</small></td>
          </tr>`,
      )
      .join("")}</tbody></table>`;
}

async function loadCompanyDepartmentsOverview() {
  const outEl = document.getElementById("companyOverviewOut");
  if (!outEl) return;
  outEl.innerHTML = skeletonTable(["Department", "Admin", "Requests", "Spend", "Status"]);
  const rows = await api("/company-admin/department-activity");
  if (!rows.length) {
    outEl.innerHTML = emptyState("No department activity yet", "Departments will appear here once they start submitting procurement requests.");
    return;
  }
  outEl.innerHTML = rows
    .map((d) => {
      const statusPills = Object.entries(d.status_counts || {})
        .map(([s, n]) => `<span class="badge">${esc(s)}: ${n}</span>`)
        .join(" ");
      const recentRows = (d.recent || [])
        .map(
          (r) =>
            `<tr>
              <td>${r.request_id}</td>
              <td>${esc(r.title)}</td>
              <td>${esc(r.status)}</td>
              <td>${esc(r.vendor_name || "-")}</td>
              <td>${r.total_budget != null ? Number(r.total_budget).toLocaleString() : "-"}</td>
              <td>${esc(r.delivery_date || "-")}</td>
            </tr>`,
        )
        .join("");
      return `
        <div class="section-group" style="margin-bottom:14px;">
          <div class="section-head">
            <h3>${esc(d.department)}</h3>
            <p>Department Admin: <strong>${esc(d.department_admin || "— vacant —")}</strong>
              ${d.department_admin_username ? `<small class="muted">(${esc(d.department_admin_username)})</small>` : ""}
            </p>
          </div>
          <div class="analytics-grid">
            <div class="analytics-stat"><div class="label">Total Requests</div><div class="value">${d.total_requests}</div></div>
            <div class="analytics-stat"><div class="label">Completed Spend</div><div class="value">${Number(d.total_spend_done || 0).toLocaleString()}</div></div>
            <div class="analytics-stat" style="grid-column:span 2;"><div class="label">Status Mix</div><div class="value">${statusPills || "-"}</div></div>
          </div>
          ${
            recentRows
              ? `<table class="table animated"><thead><tr><th>#</th><th>Title</th><th>Status</th><th>Vendor</th><th>Budget</th><th>Delivery</th></tr></thead><tbody>${recentRows}</tbody></table>`
              : emptyState("No recent requests", "")
          }
        </div>`;
    })
    .join("");
}

const loadCompanyApprovalsBtn = document.getElementById("btnLoadCompanyApprovals");
if (loadCompanyApprovalsBtn) {
  loadCompanyApprovalsBtn.onclick = async () => {
    setButtonLoading(loadCompanyApprovalsBtn, true);
    await loadCompanyApprovals();
    setButtonLoading(loadCompanyApprovalsBtn, false);
  };
}
const loadPlatformApprovalsBtn = document.getElementById("btnLoadPlatformApprovals");
if (loadPlatformApprovalsBtn) {
  loadPlatformApprovalsBtn.onclick = async () => {
    setButtonLoading(loadPlatformApprovalsBtn, true);
    await loadPlatformApprovals();
    setButtonLoading(loadPlatformApprovalsBtn, false);
  };
}
const loadStorageRequestsBtn = document.getElementById("btnLoadStorageRequests");
if (loadStorageRequestsBtn) {
  loadStorageRequestsBtn.onclick = async () => {
    setButtonLoading(loadStorageRequestsBtn, true);
    await loadStorageRequests();
    setButtonLoading(loadStorageRequestsBtn, false);
  };
}
const loadDepartmentApprovalsBtn = document.getElementById("btnLoadDepartmentApprovals");
if (loadDepartmentApprovalsBtn) {
  loadDepartmentApprovalsBtn.onclick = async () => {
    setButtonLoading(loadDepartmentApprovalsBtn, true);
    await loadDepartmentApprovals();
    setButtonLoading(loadDepartmentApprovalsBtn, false);
  };
}
const loadDeptProcurementsBtn = document.getElementById("btnLoadDeptProcurements");
if (loadDeptProcurementsBtn) {
  loadDeptProcurementsBtn.onclick = async () => {
    setButtonLoading(loadDeptProcurementsBtn, true);
    await loadDepartmentProcurements();
    setButtonLoading(loadDeptProcurementsBtn, false);
  };
}
const loadCompanyOverviewBtn = document.getElementById("btnLoadCompanyOverview");
if (loadCompanyOverviewBtn) {
  loadCompanyOverviewBtn.onclick = async () => {
    setButtonLoading(loadCompanyOverviewBtn, true);
    await loadCompanyDepartmentsOverview();
    setButtonLoading(loadCompanyOverviewBtn, false);
  };
}
const loadStorageInventoryBtn = document.getElementById("btnLoadStorageInventory");
if (loadStorageInventoryBtn) {
  loadStorageInventoryBtn.onclick = async () => {
    setButtonLoading(loadStorageInventoryBtn, true);
    await loadStorageInventory();
    setButtonLoading(loadStorageInventoryBtn, false);
  };
}
const loadAdminUsersBtn = document.getElementById("btnLoadAdminUsers");
if (loadAdminUsersBtn) {
  loadAdminUsersBtn.onclick = async () => {
    setButtonLoading(loadAdminUsersBtn, true);
    await loadAdminUsers();
    setButtonLoading(loadAdminUsersBtn, false);
  };
}
const addVendorBtn = document.getElementById("btnAddVendor");
if (addVendorBtn) {
  addVendorBtn.onclick = async () => {
    setButtonLoading(addVendorBtn, true);
    await createApprovedVendor();
    setButtonLoading(addVendorBtn, false);
  };
  loadCompanyVendors();
}

if (user.role === "platform_admin") {
  loadPlatformApprovals();
  loadAdminUsers();
}
if (user.role === "company_admin") {
  loadCompanyApprovals();
  loadCompanyDepartmentsOverview();
}
if (user.role === "department_admin") {
  loadDepartmentApprovals();
  loadDepartmentProcurements();
}
if (user.role === "procurement_decider") {
  loadStorageRequests();
}
if (user.role === "storage_holder") {
  loadStorageInventory();
}
