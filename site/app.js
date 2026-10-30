const config = window.APP_CONFIG ?? {};
const statusMessage = document.querySelector("#analytics-status");
const form = document.querySelector("#joy-form");
const activityError = document.querySelector("#activity-error");
const noteError = document.querySelector("#note-error");
const noteInput = document.querySelector("#joy-note");
const characterCount = document.querySelector("#character-count");
const checkoutDialog = document.querySelector("#checkout-dialog");

let supabase = null;
let selectedActivity = "";

try {
  if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    statusMessage.textContent = "익명 통계 연결 완료 · 기록 내용은 저장하지 않습니다.";
  } else {
    statusMessage.textContent = "Supabase 설정 전입니다. 참여 흐름은 체험할 수 있지만 통계는 저장되지 않습니다.";
  }
} catch {
  statusMessage.textContent = "통계 연결에 실패했습니다. Supabase 설정과 네트워크를 확인해주세요.";
}

function getSessionId() {
  try {
    let sessionId = sessionStorage.getItem("daily-joy-session");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("daily-joy-session", sessionId);
    }
    return sessionId;
  } catch {
    return crypto.randomUUID();
  }
}

const sessionId = getSessionId();
const query = new URLSearchParams(window.location.search);

async function trackEvent(eventName, { funnelStep = null, buttonId = null, properties = {} } = {}) {
  if (!supabase) return;

  const referrerHost = document.referrer ? new URL(document.referrer).hostname : null;
  const { error } = await supabase.from("growth_events").insert({
    event_name: eventName,
    event_id: crypto.randomUUID(),
    session_id: sessionId,
    funnel_step: funnelStep,
    button_id: buttonId,
    page_path: window.location.pathname,
    referrer_host: referrerHost,
    utm_source: query.get("utm_source"),
    utm_medium: query.get("utm_medium"),
    utm_campaign: query.get("utm_campaign"),
    properties
  });

  if (error) {
    statusMessage.textContent = "통계 저장에 실패했습니다. 테이블과 Supabase 키를 확인해주세요.";
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-track-button]");
  if (!button) return;
  void trackEvent("button_click", {
    buttonId: button.dataset.trackButton,
    funnelStep: button.closest("[data-step-panel]")?.dataset.stepPanel ?? null,
    properties: { label: button.dataset.label ?? button.textContent.trim().slice(0, 48) }
  });
});

function setCurrentStep(step) {
  document.querySelectorAll("[data-step-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.stepPanel !== step;
  });
  document.querySelectorAll("[data-step-indicator]").forEach((indicator) => {
    const isCurrent = indicator.dataset.stepIndicator === step;
    indicator.classList.toggle("is-current", isCurrent);
    indicator.classList.toggle("is-done", step === "reflection" && indicator.dataset.stepIndicator === "activity");
    if (isCurrent) indicator.setAttribute("aria-current", "step");
    else indicator.removeAttribute("aria-current");
  });
}

document.querySelectorAll("[data-activity]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedActivity = button.dataset.activity;
    document.querySelectorAll("[data-activity]").forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
    });
    document.querySelector("#next-step").disabled = false;
    activityError.textContent = "";
    void trackEvent("activity_selected", {
      funnelStep: "activity",
      buttonId: button.dataset.trackButton,
      properties: { activity: selectedActivity }
    });
  });
});

document.querySelector("#next-step").addEventListener("click", async () => {
  if (!selectedActivity) {
    activityError.textContent = "오늘의 순간을 하나 골라주세요.";
    return;
  }
  await trackEvent("funnel_step_completed", {
    funnelStep: "activity",
    properties: { activity: selectedActivity }
  });
  setCurrentStep("reflection");
  noteInput.focus();
  void trackEvent("funnel_step_view", { funnelStep: "reflection" });
});

document.querySelector("#back-step").addEventListener("click", () => {
  setCurrentStep("activity");
  void trackEvent("funnel_step_view", { funnelStep: "activity", properties: { returned: true } });
});

noteInput.addEventListener("input", () => {
  characterCount.textContent = `${noteInput.value.length} / 100`;
  noteError.textContent = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const note = noteInput.value.trim();
  if (note.length < 2) {
    noteError.textContent = "두 글자 이상으로 오늘의 장면을 남겨주세요.";
    noteInput.focus();
    return;
  }

  await trackEvent("funnel_step_completed", {
    funnelStep: "reflection",
    properties: { activity: selectedActivity, note_length: note.length }
  });
  await trackEvent("participation_completed", {
    funnelStep: "complete",
    properties: { activity: selectedActivity, note_length: note.length }
  });

  form.hidden = true;
  document.querySelector(".stepper").hidden = true;
  document.querySelector("#success-panel").hidden = false;
  document.querySelector("#saved-note").textContent = `“${note}”`;
  document.querySelector('[data-step-indicator="reflection"]').classList.add("is-done");
  const completeIndicator = document.querySelector('[data-step-indicator="complete"]');
  completeIndicator.classList.add("is-current");
  completeIndicator.setAttribute("aria-current", "step");
});

document.querySelector("#record-another").addEventListener("click", () => {
  form.reset();
  form.hidden = false;
  document.querySelector(".stepper").hidden = false;
  document.querySelector("#success-panel").hidden = true;
  document.querySelector("#next-step").disabled = true;
  document.querySelectorAll("[data-activity]").forEach((option) => option.setAttribute("aria-pressed", "false"));
  selectedActivity = "";
  characterCount.textContent = "0 / 100";
  setCurrentStep("activity");
  void trackEvent("funnel_step_view", { funnelStep: "activity", properties: { restarted: true } });
});

document.querySelector("#purchase-button").addEventListener("click", async () => {
  await trackEvent("purchase_cta_clicked", { buttonId: "joy_note_purchase", funnelStep: "purchase" });
  if (!config.CHECKOUT_URL) {
    checkoutDialog.showModal();
    return;
  }

  const checkoutUrl = new URL(config.CHECKOUT_URL, window.location.href);
  if (checkoutUrl.protocol !== "https:" && checkoutUrl.origin !== window.location.origin) {
    statusMessage.textContent = "체크아웃 주소는 HTTPS 링크여야 합니다.";
    return;
  }
  await trackEvent("checkout_started", {
    buttonId: "joy_note_purchase",
    funnelStep: "checkout",
    properties: { product_id: "daily_joy_note", currency: "KRW", value: 12000 }
  });
  window.location.assign(checkoutUrl.href);
});

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => checkoutDialog.close());
});
document.querySelector(".dialog-close").addEventListener("click", () => checkoutDialog.close());
checkoutDialog.addEventListener("click", (event) => {
  if (event.target === checkoutDialog) checkoutDialog.close();
});

void trackEvent("page_view", {
  funnelStep: "landing",
  properties: { title: document.title }
});
void trackEvent("funnel_step_view", { funnelStep: "activity" });