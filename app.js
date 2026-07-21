(() => {
  "use strict";

  const config = window.PATIENT_APP_CONFIG || {};
  const apiBase = String(config.API_BASE_URL || "").replace(/\/$/, "");
  const refreshMs = Number(config.STATUS_REFRESH_MS) || 10000;
  const storageKey = "hospital_patient_tracking_token";
  const registrationView = document.getElementById("registrationView");
  const statusView = document.getElementById("statusView");
  const form = document.getElementById("patientForm");
  const alertBox = document.getElementById("formAlert");
  const submitButton = document.getElementById("submitButton");
  const savedQueueButton = document.getElementById("openSavedQueue");
  let refreshTimer = null;

  const normalizeValue = (value) => typeof value === "string" ? value.trim() : value;

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearAlert() {
    alertBox.hidden = true;
    alertBox.textContent = "";
    form.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
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

  function firstError(errors) {
    const entries = Object.entries(errors || {});
    if (!entries.length) return "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบอีกครั้ง";
    const [field, messages] = entries[0];
    const input = form.elements[field];
    if (input) {
      input.classList.add("invalid");
      input.focus();
    }
    return Array.isArray(messages) ? messages[0] : String(messages);
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("เว็บหลักตอบกลับในรูปแบบที่ไม่ถูกต้อง กรุณาตรวจสอบ API URL");
    }
    return response.json();
  }

  async function submitRegistration(event) {
    event.preventDefault();
    clearAlert();
    if (!form.reportValidity()) return;
    if (!apiBase) {
      showAlert("ยังไม่ได้ตั้งค่า URL ของเว็บหลัก");
      return;
    }

    submitButton.disabled = true;
    submitButton.classList.add("loading");
    submitButton.querySelector("span").textContent = "กำลังบันทึกข้อมูล...";
    try {
      const response = await fetch(`${apiBase}/api/patient/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectPayload()),
      });
      const result = await parseResponse(response);
      if (!response.ok || !result.ok) {
        throw new Error(result.error || firstError(result.errors));
      }
      localStorage.setItem(storageKey, result.tracking_token);
      savedQueueButton.hidden = false;
      showStatus(result.tracking_token, result);
    } catch (error) {
      showAlert(error.message === "Failed to fetch" ? "เชื่อมต่อเว็บหลักไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือติดต่อเจ้าหน้าที่" : error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove("loading");
      submitButton.querySelector("span").textContent = "ยืนยันการลงทะเบียน";
    }
  }

  function showStatus(token, initial = null) {
    registrationView.hidden = true;
    statusView.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (initial?.queue_number) document.getElementById("queueNumber").textContent = initial.queue_number;
    updateStatus(token);
    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => updateStatus(token, true), refreshMs);
  }

  async function updateStatus(token, silent = false) {
    const refreshButton = document.getElementById("refreshStatus");
    if (!silent) refreshButton.classList.add("loading");
    try {
      const response = await fetch(`${apiBase}/api/patient/queue/${encodeURIComponent(token)}/`, { cache: "no-store" });
      const result = await parseResponse(response);
      if (!response.ok || !result.ok) throw new Error(result.error || "ไม่สามารถอ่านสถานะคิวได้");
      document.getElementById("queueNumber").textContent = result.queue_number;
      document.getElementById("statusLabel").textContent = result.status_label;
      document.getElementById("instruction").textContent = result.instruction;
      document.getElementById("peopleAhead").textContent = result.status === "WAITING_QUEUE" ? `${result.people_ahead} คิว` : "–";
      document.getElementById("room").textContent = result.room || "ยังไม่ระบุ";
      document.getElementById("lastUpdated").textContent = `อัปเดตล่าสุด ${new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(result.updated_at))} น.`;
    } catch (error) {
      document.getElementById("lastUpdated").textContent = error.message;
    } finally {
      refreshButton.classList.remove("loading");
    }
  }

  function resetRegistration() {
    clearInterval(refreshTimer);
    localStorage.removeItem(storageKey);
    statusView.hidden = true;
    registrationView.hidden = false;
    savedQueueButton.hidden = true;
    form.reset();
    clearAlert();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  form.addEventListener("submit", submitRegistration);
  form.elements.national_id.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 13);
  });
  document.getElementById("refreshStatus").addEventListener("click", () => {
    const token = localStorage.getItem(storageKey);
    if (token) updateStatus(token);
  });
  document.getElementById("newRegistration").addEventListener("click", resetRegistration);
  savedQueueButton.addEventListener("click", () => {
    const token = localStorage.getItem(storageKey);
    if (token) showStatus(token);
  });

  const savedToken = localStorage.getItem(storageKey);
  if (savedToken) savedQueueButton.hidden = false;
})();
