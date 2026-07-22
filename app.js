(() => {
  "use strict";

  const config = window.PATIENT_APP_CONFIG || {};
  const apiBase = String(config.API_BASE_URL || "").replace(/\/$/, "");
  const refreshMs = Number(config.STATUS_REFRESH_MS) || 10000;
  const storageKey = "hospital_patient_access_token";
  const views = ["registrationView", "loginView", "statusView", "accountView"]
    .map((id) => document.getElementById(id));
  const registrationView = document.getElementById("registrationView");
  const loginView = document.getElementById("loginView");
  const statusView = document.getElementById("statusView");
  const accountView = document.getElementById("accountView");
  const form = document.getElementById("patientForm");
  const loginForm = document.getElementById("loginForm");
  const submitButton = document.getElementById("submitButton");
  const loginSubmitButton = document.getElementById("loginSubmitButton");
  const savedAccountButton = document.getElementById("openSavedQueue");
  let refreshTimer = null;

  const normalizeValue = (value) => typeof value === "string" ? value.trim() : value;
  const currentToken = () => localStorage.getItem(storageKey);

  function showView(view) {
    views.forEach((item) => { item.hidden = item !== view; });
    if (view !== statusView) clearInterval(refreshTimer);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setAlert(id, message = "") {
    const alertBox = document.getElementById(id);
    alertBox.textContent = message;
    alertBox.hidden = !message;
    if (message) alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setButtonLoading(button, loading, loadingText, normalText) {
    button.disabled = loading;
    button.classList.toggle("loading", loading);
    button.querySelector("span").textContent = loading ? loadingText : normalText;
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("เว็บหลักตอบกลับในรูปแบบที่ไม่ถูกต้อง กรุณาตรวจสอบ API URL");
    }
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const error = new Error(result.error || "ไม่สามารถดำเนินการได้");
      error.status = response.status;
      error.errors = result.errors;
      throw error;
    }
    return result;
  }

  async function apiRequest(path, options = {}, authenticated = false) {
    if (!apiBase) throw new Error("ยังไม่ได้ตั้งค่า URL ของเว็บหลัก");
    const headers = { ...(options.headers || {}) };
    if (authenticated) {
      const token = currentToken();
      if (!token) throw new Error("กรุณาเข้าสู่ระบบก่อน");
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    return parseResponse(response);
  }

  function collectPayload() {
    const data = new FormData(form);
    const payload = {};
    for (const [key, rawValue] of data.entries()) {
      const value = normalizeValue(rawValue);
      payload[key] = value === "" ? null : value;
    }
    payload.consent = data.has("consent");
    for (const key of ["age", "height_cm", "weight_kg"]) {
      payload[key] = payload[key] === null ? null : Number(payload[key]);
    }
    return payload;
  }

  function focusFirstError(errors) {
    const entry = Object.entries(errors || {})[0];
    if (!entry) return "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบอีกครั้ง";
    const [field, messages] = entry;
    const input = form.elements[field];
    if (input) {
      input.classList.add("invalid");
      input.focus();
    }
    return Array.isArray(messages) ? messages[0] : String(messages);
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setAlert("formAlert");
    form.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
    if (!form.reportValidity()) return;

    setButtonLoading(submitButton, true, "กำลังบันทึกข้อมูล...", "ยืนยันการลงทะเบียน");
    try {
      const result = await apiRequest("/api/patient/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectPayload()),
      });
      if (!result.access_token) throw new Error("เว็บหลักไม่ได้ส่ง access token กลับมา");
      localStorage.setItem(storageKey, result.access_token);
      savedAccountButton.hidden = false;
      showStatus(result.access_token, result);
    } catch (error) {
      const message = error.errors ? focusFirstError(error.errors) : error.message;
      setAlert("formAlert", message === "Failed to fetch"
        ? "เชื่อมต่อเว็บหลักไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือติดต่อเจ้าหน้าที่"
        : message);
    } finally {
      setButtonLoading(submitButton, false, "กำลังบันทึกข้อมูล...", "ยืนยันการลงทะเบียน");
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    setAlert("loginAlert");
    if (!loginForm.reportValidity()) return;
    const data = new FormData(loginForm);
    setButtonLoading(loginSubmitButton, true, "กำลังเข้าสู่ระบบ...", "เข้าสู่ระบบ");
    try {
      const result = await apiRequest("/api/patient/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          national_id: normalizeValue(data.get("national_id")),
        }),
      });
      localStorage.setItem(storageKey, result.access_token);
      savedAccountButton.hidden = false;
      await loadAccount();
    } catch (error) {
      setAlert("loginAlert", error.message === "Failed to fetch"
        ? "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง"
        : error.message);
    } finally {
      setButtonLoading(loginSubmitButton, false, "กำลังเข้าสู่ระบบ...", "เข้าสู่ระบบ");
    }
  }

  function showStatus(token, initial = null) {
    showView(statusView);
    if (initial?.queue_number) document.getElementById("queueNumber").textContent = initial.queue_number;
    updateStatus(token);
    refreshTimer = window.setInterval(() => updateStatus(token, true), refreshMs);
  }

  async function updateStatus(token, silent = false) {
    const refreshButton = document.getElementById("refreshStatus");
    if (!silent) refreshButton.classList.add("loading");
    try {
      const result = await apiRequest("/api/patient/queue/", { cache: "no-store" }, true);
      document.getElementById("queueNumber").textContent = result.queue_number;
      document.getElementById("statusLabel").textContent = result.status_label;
      document.getElementById("instruction").textContent = result.instruction;
      document.getElementById("peopleAhead").textContent = ["WAITING_QUEUE", "WAITING"].includes(result.status)
        ? `${result.people_ahead} คิว`
        : "–";
      document.getElementById("room").textContent = result.room || "ยังไม่ระบุ";
      document.getElementById("lastUpdated").textContent = `อัปเดตล่าสุด ${new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).format(new Date(result.updated_at))} น.`;
    } catch (error) {
      document.getElementById("lastUpdated").textContent = error.message;
    } finally {
      refreshButton.classList.remove("loading");
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function displayValue(value) {
    return value === null || value === undefined || value === "" ? "–" : String(value);
  }

  function renderProfile(profile) {
    document.getElementById("accountName").textContent = `${profile.first_name} ${profile.last_name}`;
    document.getElementById("accountHn").textContent = `HN ${profile.hn || "–"}`;
    const fields = [
      ["ชื่อ-นามสกุล", `${profile.first_name} ${profile.last_name}`],
      ["เลขบัตรประชาชน", profile.national_id],
      ["HN", profile.hn],
      ["เบอร์โทรศัพท์", profile.phone],
      ["เพศ", profile.gender],
      ["อายุ", profile.age ? `${profile.age} ปี` : null],
      ["หมู่เลือด", profile.blood_type],
      ["ส่วนสูง / น้ำหนัก", [profile.height_cm && `${profile.height_cm} ซม.`, profile.weight_kg && `${profile.weight_kg} กก.`].filter(Boolean).join(" / ")],
      ["ที่อยู่", profile.address, true],
      ["โรคประจำตัว", profile.chronic_diseases, true],
      ["ประวัติแพ้ยา / อาหาร", profile.allergies, true],
      ["ยาที่ใช้ประจำ", profile.medications, true],
      ["ผู้ติดต่อฉุกเฉิน", [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(" · "), true],
    ];
    const list = document.getElementById("profileDetails");
    list.replaceChildren(...fields.map(([label, value, wide]) => {
      const item = createElement("div", `detail-item${wide ? " wide" : ""}`);
      item.append(createElement("dt", "", label), createElement("dd", "", displayValue(value)));
      return item;
    }));
  }

  function renderQueue(queue) {
    const content = document.getElementById("accountQueueContent");
    const openButton = document.getElementById("openQueueStatus");
    if (!queue) {
      content.className = "empty-state";
      content.textContent = "ขณะนี้ไม่มีคิวที่กำลังดำเนินการ";
      openButton.hidden = true;
      return;
    }
    content.className = "queue-overview";
    const number = createElement("strong", "", queue.queue_number);
    const detail = createElement("div");
    detail.append(createElement("b", "", queue.status_label));
    detail.append(createElement("p", "", `${queue.instruction}${queue.room ? ` · ${queue.room}` : ""}`));
    content.replaceChildren(number, detail);
    openButton.hidden = false;
  }

  function formatDate(value, includeTime = true) {
    if (!value) return "–";
    const options = includeTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" };
    return new Intl.DateTimeFormat("th-TH", options).format(new Date(value));
  }

  function renderVisits(visits) {
    const list = document.getElementById("visitHistory");
    if (!visits.length) {
      list.replaceChildren(createElement("div", "empty-state", "ยังไม่มีประวัติการรับบริการ"));
      return;
    }
    list.replaceChildren(...visits.map((visit) => {
      const item = createElement("article", "timeline-item");
      const header = createElement("div", "timeline-item-header");
      header.append(createElement("strong", "", `${visit.queue_number} · ${visit.status_label}`));
      header.append(createElement("time", "", formatDate(visit.registered_at)));
      item.append(header);
      if (visit.note) item.append(createElement("p", "", `อาการ: ${visit.note}`));
      if (visit.diagnosis) item.append(createElement("p", "", `ผลวินิจฉัย: ${visit.diagnosis}`));
      if (visit.treatment) item.append(createElement("p", "", `การรักษา: ${visit.treatment}`));
      if (visit.vitals) {
        const vitals = [
          visit.vitals.sys_bp && visit.vitals.dia_bp ? `BP ${visit.vitals.sys_bp}/${visit.vitals.dia_bp}` : null,
          visit.vitals.pr ? `ชีพจร ${visit.vitals.pr}` : null,
          visit.vitals.bt ? `อุณหภูมิ ${visit.vitals.bt}°C` : null,
          visit.vitals.o2sat ? `SpO₂ ${visit.vitals.o2sat}%` : null,
        ].filter(Boolean).join(" · ");
        if (vitals) item.append(createElement("p", "", vitals));
      }
      return item;
    }));
  }

  function renderAppointments(appointments) {
    const list = document.getElementById("appointmentHistory");
    if (!appointments.length) {
      list.replaceChildren(createElement("div", "empty-state", "ยังไม่มีรายการนัดหมาย"));
      return;
    }
    const statusLabels = { SCHEDULED: "นัดหมายแล้ว", ATTENDED: "มาตามนัด", MISSED: "ขาดนัด", CANCELLED: "ยกเลิก" };
    list.replaceChildren(...appointments.map((appointment) => {
      const item = createElement("article", "timeline-item");
      const header = createElement("div", "timeline-item-header");
      header.append(createElement("strong", "", statusLabels[appointment.status] || appointment.status_label));
      header.append(createElement("time", "", `${formatDate(`${appointment.date}T00:00:00`, false)}${appointment.time ? ` เวลา ${appointment.time} น.` : ""}`));
      item.append(header);
      if (appointment.note) item.append(createElement("p", "", appointment.note));
      return item;
    }));
  }

  async function loadAccount() {
    setAlert("accountAlert");
    showView(accountView);
    try {
      const result = await apiRequest("/api/patient/me/", { cache: "no-store" }, true);
      renderProfile(result.profile);
      renderQueue(result.active_queue);
      renderVisits(result.visits || []);
      renderAppointments(result.appointments || []);
    } catch (error) {
      if (error.status === 401 || !currentToken()) {
        localStorage.removeItem(storageKey);
        savedAccountButton.hidden = true;
        showView(loginView);
        setAlert("loginAlert", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      } else {
        setAlert("accountAlert", error.message);
      }
    }
  }

  function logout() {
    clearInterval(refreshTimer);
    localStorage.removeItem(storageKey);
    savedAccountButton.hidden = true;
    loginForm.reset();
    showView(loginView);
  }

  form.addEventListener("submit", submitRegistration);
  loginForm.addEventListener("submit", submitLogin);
  [form.elements.national_id, loginForm.elements.national_id].forEach((input) => {
    input.addEventListener("input", (event) => {
      event.target.value = event.target.value.replace(/\D/g, "").slice(0, 13);
    });
  });
  document.getElementById("loginButton").addEventListener("click", () => showView(loginView));
  document.getElementById("backToRegistration").addEventListener("click", () => showView(registrationView));
  document.getElementById("refreshStatus").addEventListener("click", () => {
    const token = currentToken();
    if (token) updateStatus(token);
  });
  document.getElementById("statusAccountButton").addEventListener("click", loadAccount);
  document.getElementById("openQueueStatus").addEventListener("click", () => {
    const token = currentToken();
    if (token) showStatus(token);
  });
  document.getElementById("logoutButton").addEventListener("click", logout);
  savedAccountButton.addEventListener("click", loadAccount);

  savedAccountButton.hidden = !currentToken();
})();
