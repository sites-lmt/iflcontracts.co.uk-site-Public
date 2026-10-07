/* ============================================================
   IFL Contracts — landing page form handler

   Submits every .enq-form on the page. Two delivery channels:

     Cortoa      the destination. Creates a deal in the IFL
                 Contracts business. Turnstile-protected and
                 rate-limited server-side.
     Notify      interim email notification, so a lead is never
                 invisible while Cortoa notifications are built.

   If either channel succeeds the lead is preserved and the
   visitor sees a success state. If both fail they are given the
   phone number instead of a dead end.

   The Google Ads conversion fires once per page, not once per
   form, and only on a confirmed success.
   ============================================================ */
"use strict";

(function () {

  /* ============================================================
     CONFIGURE THESE
     ============================================================ */

  // Cortoa. Leave CORTOA_BASE empty until it is deployed, then set it to the
  // deployed origin, e.g. "https://cortoa-abc123.run.app".
  var CORTOA_BASE = "";
  var CORTOA_SLUG = "iflcontracts";

  // Interim email notification. Any endpoint that accepts a form POST and
  // returns JSON. Currently Formspree, delivering to lukemturner2020@gmail.com.
  // Leave empty to skip notification entirely.
  var NOTIFY_ENDPOINT = "https://formspree.io/f/mzederke";

  // Google Ads. Label from Goals -> Conversions -> your action -> Tag setup.
  var ADS_ID = "AW-18496074339";
  var CONVERSION_LABEL = "";

  /* ============================================================ */

  var SUBMIT_LABEL = "Get my umbrella quote";
  var PHONE = "01784 618027";
  var PHONE_HREF = "tel:+441784618027";

  var cortoaReady = !!(CORTOA_BASE && CORTOA_SLUG);
  var turnstileSiteKey = "";
  var forms = Array.prototype.slice.call(document.querySelectorAll(".enq-form"));

  /* Stamp every form with its mount time for the too-fast check, and keep the
     hidden _t field in step. Done first so it is set as early as possible. */
  var mountedAt = Math.floor(Date.now() / 1000);
  forms.forEach(function (f) {
    f.dataset.mounted = mountedAt;
    var hidden = f.querySelector('input[name="_t"]');
    if (hidden) hidden.value = mountedAt;
  });

  var yearEl = document.getElementById("lpYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     Conversion — once per page, whatever happens with retries
     ------------------------------------------------------------------ */
  var conversionFired = false;

  function fireConversion() {
    if (conversionFired) return;
    conversionFired = true;
    if (typeof window.gtag !== "function") return;
    if (CONVERSION_LABEL) {
      window.gtag("event", "conversion", { send_to: ADS_ID + "/" + CONVERSION_LABEL });
    } else {
      window.gtag("event", "generate_lead", { value: 1 });
    }
  }

  /* ------------------------------------------------------------------
     Turnstile — one widget per form, mounted only if the tenant has a
     site key. The inbound route refuses submissions without a token
     once a secret is configured, so this is not optional in production.
     ------------------------------------------------------------------ */
  var widgetIds = new WeakMap();

  function loadTurnstileScript(cb) {
    if (window.turnstile) { cb(); return; }
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = cb;
    s.onerror = function () { /* blocked — forms will fall back to the phone */ };
    document.head.appendChild(s);
  }

  function mountTurnstile(siteKey) {
    turnstileSiteKey = siteKey;
    loadTurnstileScript(function () {
      if (!window.turnstile) return;
      forms.forEach(function (form) {
        var host = form.querySelector("[data-turnstile]");
        if (!host) return;
        try {
          var id = window.turnstile.render(host, { sitekey: siteKey });
          widgetIds.set(form, id);
        } catch (e) { /* already rendered */ }
      });
    });
  }

  function tokenFor(form) {
    var id = widgetIds.get(form);
    if (id === undefined || !window.turnstile) return "";
    return window.turnstile.getResponse(id) || "";
  }

  function resetWidget(form) {
    var id = widgetIds.get(form);
    if (id !== undefined && window.turnstile) {
      try { window.turnstile.reset(id); } catch (e) { /* noop */ }
    }
  }

  /* Ask the tenant config for its Turnstile site key. */
  if (cortoaReady) {
    fetch(CORTOA_BASE + "/api/public/" + encodeURIComponent(CORTOA_SLUG) + "/config", {
      headers: { Accept: "application/json" }
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (cfg && cfg.turnstileSiteKey) mountTurnstile(cfg.turnstileSiteKey);
      })
      .catch(function () { /* leave the forms usable */ });
  }

  /* ------------------------------------------------------------------
     Payload building
     ------------------------------------------------------------------ */
  function value(form, name) {
    var el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }

  /* Deliberately omits `source`. The inbound route stamps "inbound_form",
     a value excluded from cold-outbound eligibility. Sending our own would
     risk dropping these leads into a cold sequence. */
  function cortoaPayload(form) {
    return {
      name: value(form, "name"),
      email: value(form, "email"),
      phone: value(form, "phone"),
      message: value(form, "message"),
      consent: true,
      _t: value(form, "_t"),
      website: value(form, "website"),          // honeypot — must be empty
      turnstileToken: tokenFor(form)
    };
  }

  function postCortoa(form) {
    return fetch(CORTOA_BASE + "/api/public/" + encodeURIComponent(CORTOA_SLUG) + "/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(cortoaPayload(form))
    }).then(function (r) {
      if (!r.ok) throw new Error("Cortoa HTTP " + r.status);
      return true;
    });
  }

  function postNotify(form) {
    var body = new FormData();
    ["name", "email", "phone", "message"].forEach(function (n) {
      body.append(n, value(form, n));
    });
    body.append("_subject", "New umbrella quote request — IFL Contracts");
    return fetch(NOTIFY_ENDPOINT, {
      method: "POST",
      body: body,
      headers: { Accept: "application/json" }
    }).then(function (r) {
      if (!r.ok) throw new Error("Notify HTTP " + r.status);
      return true;
    });
  }

  /* ------------------------------------------------------------------
     Bind every form
     ------------------------------------------------------------------ */
  forms.forEach(function (form) {

    var card = form.closest(".lp-form-card") || form.parentNode;
    var submitBtn = form.querySelector(".enq-submit");
    var errorBox = card.querySelector(".enq-error");
    var successBox = card.querySelector(".lp-success");
    var fallbackBox = card.querySelector(".lp-fallback");

    function showError(message) {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.classList.remove("lp-hide");
    }
    function clearError() {
      if (!errorBox) return;
      errorBox.textContent = "";
      errorBox.classList.add("lp-hide");
    }
    function showSuccess() {
      form.classList.add("lp-hide");
      if (fallbackBox) fallbackBox.classList.add("lp-hide");
      if (successBox) {
        successBox.classList.remove("lp-hide");
        successBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    function giveUp(callMessage) {
      showError(callMessage);
      if (fallbackBox) fallbackBox.classList.remove("lp-hide");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearError();

      // Honeypot filled — accept silently, send nothing.
      if (value(form, "website")) { showSuccess(); return; }

      // Faster than a human could read the form.
      var mounted = parseInt(form.dataset.mounted || "0", 10);
      if (mounted && Math.floor(Date.now() / 1000) - mounted < 3) {
        showError("That was a little quick — please check your details and try again.");
        return;
      }

      if (!form.checkValidity()) { form.reportValidity(); return; }

      if (!cortoaReady && !NOTIFY_ENDPOINT) {
        giveUp("Please call us on " + PHONE + " — we can give you a quote in a couple of minutes.");
        return;
      }

      // Turnstile is enforced server-side once a secret is configured, so if a
      // widget is present we must have a token before attempting to send.
      if (turnstileSiteKey && !tokenFor(form)) {
        showError("Please complete the verification just above, then try again.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      var attempts = [];
      if (cortoaReady) attempts.push(postCortoa(form));
      if (NOTIFY_ENDPOINT) attempts.push(postNotify(form));

      Promise.allSettled(attempts).then(function (results) {
        var anyOk = results.some(function (r) { return r.status === "fulfilled"; });

        if (anyOk) {
          showSuccess();
          fireConversion();
          return;
        }

        submitBtn.disabled = false;
        submitBtn.textContent = SUBMIT_LABEL;
        resetWidget(form);
        giveUp("We could not send that just now. Please call us on " + PHONE +
          " or email info@iflcontracts.co.uk and we will sort it straight away.");
      });
    });
  });

})();
