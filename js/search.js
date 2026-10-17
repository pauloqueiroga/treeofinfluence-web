// Site search, on the search page only. The index is built by Pagefind after every build
// (eleventy.config.js) and loaded from /pagefind/ the first time it is needed. Results are
// drawn with the site's own markup. Without JavaScript, the page says search needs it.
(function () {
  "use strict";
  var PAGE_SIZE = 10;
  var MAX_PARTS = 3;

  var form = document.querySelector(".search-form");
  if (!form) return;
  var input = form.querySelector("input");
  var status = document.querySelector(".search-status");
  var list = document.querySelector(".search-results");
  var more = document.querySelector(".search-more");

  var engine = null;
  var results = [];
  var shown = 0;
  var current = "";

  function load() {
    if (!engine) {
      engine = import("/pagefind/pagefind.js").then(function (pf) {
        return pf.options({ excerptLength: 24 }).then(function () { return pf; });
      });
    }
    return engine;
  }

  // Missing WebAssembly (Lockdown Mode, some managed browsers) or a missing index ends up here.
  function unavailable() {
    results = [];
    list.innerHTML = "";
    more.hidden = true;
    status.textContent = "Search does not work in this browser. Every page is listed in the menu of its section.";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function link(url, text) {
    var a = el("a", "", text);
    a.href = url;
    return a;
  }

  // Headings in the page that match, the ones with the most matches first.
  function parts(data) {
    return (data.sub_results || [])
      .filter(function (sub) { return sub.url.indexOf("#") !== -1; })
      .sort(function (a, b) { return b.locations.length - a.locations.length; })
      .slice(0, MAX_PARTS);
  }

  function render(data) {
    var item = el("li");
    if (data.meta.section) item.appendChild(el("p", "search-result-section", data.meta.section));
    var heading = el("h2");
    heading.appendChild(link(data.url, data.meta.title || data.url));
    item.appendChild(heading);
    // Pagefind escapes the page text and wraps matching words in <mark>.
    var excerpt = el("p", "search-result-excerpt");
    excerpt.innerHTML = data.excerpt;
    item.appendChild(excerpt);
    var subs = parts(data);
    if (subs.length) {
      var jump = el("p", "search-result-parts", "On this page: ");
      subs.forEach(function (sub, i) {
        if (i) jump.appendChild(document.createTextNode(", "));
        jump.appendChild(link(sub.url, sub.title));
      });
      item.appendChild(jump);
    }
    return item;
  }

  function showMore() {
    var query = current;
    var batch = results.slice(shown, shown + PAGE_SIZE);
    shown += batch.length;
    more.hidden = shown >= results.length;
    return Promise.all(batch.map(function (r) { return r.data(); })).then(function (pages) {
      if (query !== current) return null;
      var first = null;
      pages.forEach(function (data) {
        var item = render(data);
        list.appendChild(item);
        first = first || item;
      });
      return first;
    });
  }

  function remember(query) {
    var url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }

  function run(text) {
    var query = text.trim();
    if (query === current) return;
    current = query;
    remember(query);
    if (!query) {
      results = [];
      list.innerHTML = "";
      more.hidden = true;
      status.textContent = "";
      return;
    }
    load()
      .then(function (pf) { return pf.debouncedSearch(query, {}, 250); })
      .then(function (search) {
        // null, or a stale query: a newer search replaced this one while it ran.
        if (!search || query !== current) return;
        results = search.results;
        shown = 0;
        list.innerHTML = "";
        var n = results.length;
        status.textContent = n
          ? n + (n === 1 ? " page matches" : " pages match") + ' "' + query + '".'
          : 'No pages match "' + query + '".';
        if (n) return showMore();
        more.hidden = true;
      })
      .catch(unavailable);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    run(input.value);
  });
  input.addEventListener("input", function () { run(input.value); });
  input.addEventListener("focus", function () { load().catch(unavailable); }, { once: true });

  // Moves focus to the first new result, so keyboard readers continue where the list grew.
  more.addEventListener("click", function () {
    showMore().then(function (first) {
      var target = first && first.querySelector("a");
      if (target) target.focus();
    }).catch(unavailable);
  });

  var initial = new URLSearchParams(window.location.search).get("q") || "";
  input.value = initial;
  run(initial);
})();
