/* ============================================================
   IFL Contracts — the page's own half of the quote form.

   The form itself is no longer on this page. Both cards mount **Cortoa's** form
   (js/cortoa-quote-embed.js → /f/ifl-contracts-quote), which means one place
   answers an enquiry: Find Umbrella, the business that runs the IFL sales. The
   questions are unchanged — three details, one step — because the landing page
   is still the landing page.

   What is left here is the only part a hosted form cannot do for us: telling
   Google an enquiry happened. The frame says so with a DOM event
   (`cortoa:form:submitted`), and this page turns that into the Ads conversion,
   once, with the same value and currency as before.

   The old handler — a direct POST to Cortoa, a Turnstile widget, a Formspree
   copy and a fallback panel — is gone rather than left dormant. Two channels for
   one enquiry was already a compromise; with the form itself hosted, the second
   channel would have emailed a lead Cortoa had already recorded, and the
   fallback panel would have covered a form that is no longer there. The embed's
   own loader offers the phone number while it waits, which is the fallback that
   still means something.
   ============================================================ */
"use strict";

(function () {

  // Google Ads. Label from Goals -> Conversions -> your action -> Tag setup.
  // ADS_ID matches the gtag config in the page head; CONVERSION_LABEL is the
  // half after the slash in the snippet's send_to.
  var ADS_ID = "AW-18496074339";
  var CONVERSION_LABEL = "nIjmCJW3j5gdEOPkzvNE";

  // Flat value recorded against each confirmed lead, so Ads can report cost per
  // lead in money rather than clicks. The Ads account is denominated in BRL, so
  // this is R$140 (~£20) and the currency here MUST match that account.
  var LEAD_VALUE = 140;
  var LEAD_CURRENCY = "BRL";

  var yearEl = document.getElementById("lpYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Once per page, whatever happens with retries: a submission that is
     re-rendered must not become two conversions. */
  var conversionFired = false;

  function fireConversion() {
    if (conversionFired) return;
    conversionFired = true;
    if (typeof window.gtag !== "function") return;
    if (CONVERSION_LABEL) {
      window.gtag("event", "conversion", {
        send_to: ADS_ID + "/" + CONVERSION_LABEL,
        value: LEAD_VALUE,
        currency: LEAD_CURRENCY
      });
    } else {
      window.gtag("event", "generate_lead", {
        value: LEAD_VALUE,
        currency: LEAD_CURRENCY
      });
    }
  }

  // Two slots, one submission: the event bubbles from whichever card it came
  // from, so this listens once on the document rather than once per card.
  document.addEventListener("cortoa:form:submitted", fireConversion);
})();
