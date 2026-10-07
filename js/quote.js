/* ============================================================
   IFL Contracts — landing page form handler

   Binds EVERY .enq-form on the page, so the form can be repeated
   further down without duplicate ids. Submits over AJAX so the
   visitor stays put, then fires the Google Ads conversion exactly
   once per page — not once per form.

   Nothing sends until ENDPOINT is set below.
   ============================================================ */
"use strict";

(function () {

  /* ============================================================
     CONFIGURE THESE TWO VALUES
     ============================================================ */

  // Your form endpoint. Formspree example:
  //   "https://formspree.io/f/xxxxxxxx"
  // While this is empty the form still renders, but submitting it
  // directs the visitor to the phone number instead of faking a send.
  var ENDPOINT = "";

  // The Google Ads conversion label, e.g. "AbC-D_efG123".
  // Google Ads -> Goals -> Conversions -> your action -> Tag setup.
  var CONVERSION_LABEL = "";

  var ADS_ID = "AW-18496074339";

  var SUBMIT_LABEL = "Get my umbrella quote";

  /* ============================================================ */

  /* Stamp every form with its mount time, for the too-fast-to-be-human
     check, and keep the hidden _t field in step. Done before binding so
     the value is set the moment the page is usable. */
  var mountedAt = Math.floor(Date.now() / 1000);
  document.querySelectorAll(".enq-form").forEach(function (f) {
    f.dataset.mounted = mountedAt;
    var hidden = f.querySelector('input[name="_t"]');
    if (hidden) hidden.value = mountedAt;
  });

  /* Footer year */
  var yearEl = document.getElementById("lpYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Conversion must never fire twice, whichever form is used. */
  var conversionFired = false;

  function fireConversion() {
    if (conversionFired) return;
    conversionFired = true;

    if (typeof window.gtag !== "function") return;   // blocked by an extension, etc.

    if (CONVERSION_LABEL) {
      window.gtag("event", "conversion", { send_to: ADS_ID + "/" + CONVERSION_LABEL });
    } else {
      // No label yet — still mark that a lead happened, for debugging.
      window.gtag("event", "generate_lead", { value: 1 });
    }
  }

  document.querySelectorAll(".enq-form").forEach(function (form) {

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

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearError();

      // Bots fill the honeypot. Accept silently, send nothing.
      if (form.elements["website"] && form.elements["website"].value) {
        showSuccess();
        return;
      }

      // Too fast to be human.
      var mounted = parseInt(form.dataset.mounted || "0", 10);
      if (mounted && Math.floor(Date.now() / 1000) - mounted < 3) {
        showError("That was a little quick — please check your details and try again.");
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Not connected to an endpoint yet — never fake a success.
      if (!ENDPOINT) {
        showError("Please call us on 01784 618027 — we can give you a quote in a couple of minutes.");
        if (fallbackBox) fallbackBox.classList.remove("lp-hide");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      fetch(ENDPOINT, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          showSuccess();
          fireConversion();
        })
        .catch(function () {
          // Do not lose the lead: surface the phone number instead.
          submitBtn.disabled = false;
          submitBtn.textContent = SUBMIT_LABEL;
          showError("We could not send that just now. Please call us on 01784 618027 or email info@iflcontracts.co.uk and we will sort it straight away.");
          if (fallbackBox) fallbackBox.classList.remove("lp-hide");
        });
    });

  });

})();
