/* ============================================================
   The quote form: Cortoa's own.

   Both form cards on this page are Cortoa slots, not hand-written forms. The
   enquiry now lands in **Find Umbrella** — the business that runs the IFL
   sales — rather than in a separate IFL Contracts tenant nobody was working.
   The questions are still this page's: three details, one step.

   The base is chosen from the hostname, so a localhost URL can never be shipped
   to the live site by accident: served from this machine the form comes from the
   local Cortoa, anywhere else from the deployed one.

   One loader for every slot on the page, because there are two. The Find
   Umbrella quote page carries the same code for its single slot; when it is next
   touched it should take this one instead.

   What this file owns is the *wait*, which is the part that matters when Cortoa
   is starting a container from cold: a spinner covers each slot from the first
   paint, the phone number is offered if it is taking a while, and if embed.js
   itself fails to arrive it is asked for again.
   ============================================================ */
(function () {
  "use strict";

  var IS_LOCAL = ["localhost", "127.0.0.1"].indexOf(location.hostname) !== -1;

  var LOCAL_BASE = "http://localhost:3010";
  var DEPLOYED_BASE = "https://frontend-237211824257.europe-west1.run.app";
  var CORTOA_BASE = IS_LOCAL ? LOCAL_BASE : DEPLOYED_BASE;

  // The number the page already carries in its header, its footer and its call
  // panel — written once here so it cannot go stale in one of them.
  var PHONE = "01784 618027";
  var PHONE_HREF = "tel:+441784618027";

  /* Two thresholds, because "nothing yet" and "nothing ever" are different
     facts. At the first we add the phone number and carry on waiting. Only at
     the second — where the form is genuinely not coming — do we stop the
     spinner, because a spinner that never stops is a lie. */
  var STILL_LOADING_MS = 25000;
  var GIVE_UP_MS = 90000;

  var slots = document.querySelectorAll("[data-cortoa-form]");
  if (!slots.length) return;

  /* The spinner's animation, injected rather than assumed: this element is built
     here, so a cached stylesheet older than the page cannot leave it dead. */
  (function addSpin() {
    if (document.getElementById("enqEmbedSpin")) return;
    var style = document.createElement("style");
    style.id = "enqEmbedSpin";
    style.textContent =
      "@keyframes enqEmbedSpin{to{transform:rotate(360deg)}}" +
      ".enq-embed-wait{display:flex;flex-direction:column;align-items:center;" +
      "justify-content:center;gap:14px;text-align:center;padding:44px 20px;" +
      "color:#5b6472;font-size:.95rem;line-height:1.5}" +
      ".enq-embed-wait a{color:#0f7b4f;font-weight:600}";
    document.head.appendChild(style);
  })();

  var waiting = [];
  var settledCount = 0;

  for (var i = 0; i < slots.length; i++) {
    (function (slot) {
      var placeholder = document.createElement("div");
      placeholder.className = "enq-embed-wait";
      placeholder.setAttribute("role", "status");
      placeholder.setAttribute("aria-live", "polite");

      var spinner = document.createElement("div");
      spinner.style.cssText =
        "width:26px;height:26px;border:2px solid #d7dce3;border-top-color:#0f7b4f;" +
        "border-radius:50%;animation:enqEmbedSpin .9s linear infinite";
      placeholder.appendChild(spinner);

      var text = document.createElement("p");
      text.style.margin = "0";
      text.textContent = "Loading the quote form…";
      placeholder.appendChild(text);

      // Anchored over the slot: taking it away must not move the page.
      slot.style.position = "relative";
      placeholder.style.cssText =
        "position:absolute;inset:0;z-index:1;background:#fff;border-radius:12px";
      slot.appendChild(placeholder);

      var settled = false;
      var entry = { slot: slot, settle: settle };
      waiting.push(entry);

      function settle() {
        if (settled) return;
        settled = true;
        settledCount += 1;
        placeholder.style.transition = "opacity .3s ease";
        placeholder.style.opacity = "0";
        setTimeout(function () {
          if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
          slot.style.minHeight = "0";
        }, 320);
      }

      function say(html) {
        if (settled) return;
        text.innerHTML = html;
      }

      // A loaded document is not a rendered form — the frame's first height
      // message is the moment there is something to look at. It can report a
      // height before it has laid anything out, though, and settling on that
      // would take the spinner away and leave an empty card for a second.
      window.addEventListener("message", function (event) {
        if (event.origin !== CORTOA_BASE) return;
        var data = event.data;
        if (!data || data.type !== "cortoa:form:height") return;
        if (data.slug !== slot.getAttribute("data-cortoa-form")) return;
        if (!data.height || data.height < 200) return;
        settle();
      });

      setTimeout(function () {
        say(
          "Still loading — this takes longer the first time. Call us on " +
            '<a href="' + PHONE_HREF + '">' + PHONE + "</a> if you would rather not wait."
        );
      }, STILL_LOADING_MS);

      setTimeout(function () {
        if (settled) return;
        spinner.style.display = "none";
        say(
          "We could not load the quote form. Call us on " +
            '<a href="' + PHONE_HREF + '">' + PHONE + "</a> and we will sort your quote over the phone."
        );
      }, GIVE_UP_MS);
    })(slots[i]);
  }

  /* A cold start can fail this request outright — a 502 or 503 while the
     container starts — which is a different failure from a slow form: no frame
     is ever created, so there is nothing to wait for. Retrying is cheap and the
     next request usually meets a container that is already up. Nothing is said
     while we retry: a message that resolves itself is worse than a spinner. */
  var attempts = 0;

  function loadEmbed() {
    var script = document.createElement("script");
    script.async = true;
    script.src = CORTOA_BASE + "/embed.js";
    script.onerror = function () {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (settledCount >= slots.length) return;
      attempts += 1;
      if (attempts > 3) return; // the timers above take it from here
      setTimeout(loadEmbed, attempts * 1500);
    };
    document.body.appendChild(script);
  }

  loadEmbed();
})();
