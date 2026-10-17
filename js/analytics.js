// Google Analytics, only with the reader's consent (privacy policy: /about/privacy/).
// Nothing is loaded from Google until the reader accepts. The choice is kept in localStorage
// for 13 months; analyticsChoice(), defined inline in base.njk, reads it. Buttons marked
// data-consent="granted" or "denied", in the banner or on the privacy page, change it.
// If the policy changes to collect more, rename KEY here and in base.njk: everyone is asked again.
(function () {
  "use strict";
  var KEY = "analytics-consent";
  var LIFETIME_DAYS = 395;
  var id = document.currentScript && document.currentScript.dataset.id;
  if (!id || typeof window.analyticsChoice !== "function") return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  var loaded = false;

  function load() {
    if (loaded) {
      gtag("consent", "update", { analytics_storage: "granted" });
      return;
    }
    loaded = true;
    // Advertising stays off whatever the property's settings are.
    gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    gtag("js", new Date());
    gtag("config", id, {
      cookie_expires: LIFETIME_DAYS * 86400,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  // Google Analytics sets its cookies on the widest domain it can, so try every level of the host.
  function removeCookies() {
    var parts = window.location.hostname.split(".");
    document.cookie.split(";").forEach(function (cookie) {
      var name = cookie.split("=")[0].trim();
      if (name.indexOf("_ga") !== 0) return;
      document.cookie = name + "=; Max-Age=0; path=/";
      for (var i = 0; i < parts.length - 1; i++) {
        document.cookie = name + "=; Max-Age=0; path=/; domain=." + parts.slice(i).join(".");
      }
    });
  }

  function show(choice) {
    var banner = document.querySelector(".consent");
    if (banner) banner.hidden = Boolean(choice);
    document.querySelectorAll("[data-consent-status]").forEach(function (status) {
      status.textContent =
        choice === "granted" ? "You accepted analytics cookies." :
        choice === "denied" ? "You declined analytics cookies." :
        "You have not chosen yet, so no analytics cookies are set.";
    });
    document.querySelectorAll("[data-consent]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.consent === choice));
    });
  }

  function choose(choice) {
    try { localStorage.setItem(KEY, choice + " " + Date.now()); } catch (e) { /* Applies to this page only. */ }
    if (choice === "granted") {
      load();
    } else {
      if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
      removeCookies();
    }
    show(choice);
  }

  document.querySelectorAll("[data-consent]").forEach(function (button) {
    button.addEventListener("click", function () { choose(button.dataset.consent); });
  });
  document.querySelectorAll(".consent-choice").forEach(function (el) { el.hidden = false; });

  var choice = window.analyticsChoice();
  if (choice === "granted") load();
  show(choice);
})();
