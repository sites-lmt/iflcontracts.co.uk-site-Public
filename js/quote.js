/* ============================================================
   IFL Contracts — landing page form handler

   Submits the enquiry form over AJAX so the visitor stays on the
   page, then fires the Google Ads conversion exactly once on a
   confirmed successful submission.

   Nothing fires until you set ENDPOINT below.
   ============================================================ */
"use strict";

(function () {

  /* ============================================================
     CONFIGURE THESE TWO VALUES
     ============================================================ */

  // Your form endpoint. Formspree example:
  //   "https://formspree.io/f/xxxxxxxx"
  // Leave empty and the form is replaced by a "call us" panel, so a
  // paid click is never stranded on a form that cannot send.
  var ENDPOINT = "";

  // The Google Ads conversion label, e.g. "AbC-D_efG123".
  // Found in Google Ads -> Goals -> Conversions -> your action -> Tag setup.
  // Leave empty and the tag fires without a conversion event.
  var CONVERSION_LABEL = "";

  var ADS_ID = "AW-18496074339";

  /* ============================================================ */

  var form = document.getElementById("enquiryForm");
  var card = document.getElementById("formCard");
  if (!form || !card) return;

  var submitBtn = document.getElementById("enqSubmit");
  var errorBox = document.getElementById("enqError");
  var successBox = document.getElementById("formSuccess");
  var fallbackBox = document.getElementById("formFallback");

  /* Conversion must never fire twice, whatever happens with retries. */
  var conversionFired = false;

  /* ---------- Not configured yet: swap the form for a call panel ---------- */
  if (!ENDPOINT) {
    form.classList.add("lp-hide");
    fallbackBox.classList.remove("lp-hide");
    return;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("lp-hide");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.add("lp-hide");
  }

  function fireConversion() {
    if (conversionFired) return;
    conversionFired = true;

    if (typeof window.gtag !== "function") return;   // blocked by an extension, etc.

    if (CONVERSION_LABEL) {
      window.gtag("event", "conversion", {
        send_to: ADS_ID + "/" + CONVERSION_LABEL
      });
    } else {
      // No label yet — still record that a lead happened, for debugging.
      window.gtag("event", "generate_lead", { value: 1 });
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearError();

    // Bots fill the honeypot. Accept silently, send nothing.
    if (form.elements["website"] && form.elements["website"].value) {
      form.classList.add("lp-hide");
      successBox.classList.remove("lp-hide");
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

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    fetch(ENDPOINT, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);

        // Confirmed success: swap in the success panel, then convert.
        form.classList.add("lp-hide");
        successBox.classList.remove("lp-hide");
        fireConversion();
        successBox.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function () {
        // Do not lose the lead: surface the phone number instead.
        submitBtn.disabled = false;
        submitBtn.textContent = "Get my umbrella quote";
        showError("We could not send that just now. Please call us on 01784 618027 or email info@iflcontracts.co.uk and we will sort it straight away.");
        fallbackBox.classList.remove("lp-hide");
      });
  });

})();
