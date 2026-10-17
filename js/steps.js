// Step-through diagrams (style guide, Section 6.6). Without this script, every step of a
// step-through diagram shows as its own static diagram. With it, each figure becomes a stepper:
// one stage, Previous and Next buttons, and nodes that slide between steps.
(function () {
  "use strict";
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var MOVE = 450;

  function parse(markup) {
    var doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    return document.importNode(doc.documentElement, true);
  }
  function layer(svg, name) {
    return svg.querySelector("." + name);
  }
  // Reads "translate(x y)" from the attribute the renderer writes, for a CSS transition.
  function toCss(attr) {
    var m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(attr || "");
    return m ? "translate(" + m[1] + "px, " + m[2] + "px)" : "";
  }
  // The counter already says which step this is, so the stepper drops the caption's own count.
  function captionText(el) {
    var copy = el.cloneNode(true);
    var count = copy.querySelector(".steps-count");
    if (count) copy.removeChild(count);
    return copy.innerHTML.trim();
  }
  function pinNodes(svg) {
    var nodes = svg.querySelectorAll(".dg-node");
    for (var i = 0; i < nodes.length; i++) nodes[i].style.transform = toCss(nodes[i].getAttribute("transform"));
  }

  function init(fig) {
    var frameEls = fig.querySelectorAll(".steps-frame");
    if (frameEls.length < 2) return;
    var firstTitle = frameEls[0].querySelector("svg title");
    if (!firstTitle) return;
    var base = firstTitle.id.replace(/-f1-title$/, "");
    var stageId = base + "-stage";
    // Each step as markup, with its ids pointed at the stage, so moved pieces keep their markers.
    var frames = [];
    for (var i = 0; i < frameEls.length; i++) {
      frames.push({
        caption: captionText(frameEls[i].querySelector(".steps-caption")),
        svg: frameEls[i].querySelector("svg").outerHTML.split(base + "-f" + (i + 1)).join(stageId),
      });
    }

    var controls = document.createElement("div");
    controls.className = "steps-controls";
    controls.innerHTML =
      '<button type="button" class="steps-prev">Previous</button>' +
      '<span class="steps-status"></span>' +
      '<button type="button" class="steps-next">Next</button>';
    var caption = document.createElement("p");
    caption.className = "steps-caption";
    caption.setAttribute("aria-live", "polite");
    var stage = document.createElement("div");
    stage.className = "steps-stage";
    var svg = parse(frames[0].svg);
    pinNodes(svg);
    stage.appendChild(svg);

    var list = fig.querySelector(".steps-frames");
    list.parentNode.insertBefore(controls, list);
    list.parentNode.insertBefore(caption, list);
    list.parentNode.replaceChild(stage, list);
    fig.classList.add("is-stepper");

    var prev = controls.querySelector(".steps-prev");
    var next = controls.querySelector(".steps-next");
    var status = controls.querySelector(".steps-status");
    var current = 0;
    var generation = 0;

    function render(k) {
      status.textContent = "Step " + (k + 1) + " of " + frames.length;
      caption.innerHTML = frames[k].caption;
      prev.disabled = k === 0;
      next.disabled = k === frames.length - 1;
    }

    function go(k) {
      if (k < 0 || k >= frames.length || k === current) return;
      var target = parse(frames[k].svg);
      generation++;
      if (reduce.matches || Math.abs(k - current) > 1) {
        pinNodes(target);
        stage.replaceChild(target, svg);
        svg = target;
      } else {
        morph(svg, target, generation);
      }
      current = k;
      render(k);
    }

    function morph(from, to, gen) {
      // Title and description follow the step, for screen readers.
      from.querySelector("title").textContent = to.querySelector("title").textContent;
      from.querySelector("desc").textContent = to.querySelector("desc").textContent;
      from.setAttribute("viewBox", to.getAttribute("viewBox"));
      // Zones, frames, and the legend fade from one step to the next.
      ["dg-zones", "dg-frames", "dg-legend"].forEach(function (name) {
        var a = layer(from, name);
        var b = layer(to, name);
        if (!a || !b || a.innerHTML === b.innerHTML) return;
        b.classList.add("dg-enter");
        a.parentNode.replaceChild(b, a);
      });
      // Nodes that stay slide to their new place; new nodes fade in; gone nodes fade out.
      var nodesA = layer(from, "dg-nodes");
      var nodesB = layer(to, "dg-nodes");
      var existing = {};
      Array.prototype.forEach.call(nodesA.children, function (g) { existing[g.getAttribute("data-node")] = g; });
      var staying = {};
      Array.prototype.forEach.call(nodesB.children, function (g) {
        var k2 = g.getAttribute("data-node");
        if (existing[k2]) staying[k2] = existing[k2];
      });
      Array.prototype.slice.call(nodesB.children).forEach(function (g) {
        var key = g.getAttribute("data-node");
        var old = existing[key];
        if (old) {
          delete existing[key];
          old.classList.remove("dg-leave");
          old.setAttribute("transform", g.getAttribute("transform"));
          old.style.transform = toCss(g.getAttribute("transform"));
          if (old.innerHTML !== g.innerHTML) old.innerHTML = g.innerHTML;
        } else {
          g.style.transform = toCss(g.getAttribute("transform"));
          g.classList.add("dg-enter");
          var before = null;
          for (var n = g.nextElementSibling; n && !before; n = n.nextElementSibling) {
            before = staying[n.getAttribute("data-node")] || null;
          }
          // New nodes go in the step's drawing order, so a stacked duplicate stays behind its original.
          nodesA.insertBefore(g, before);
        }
      });
      Object.keys(existing).forEach(function (key) {
        var g = existing[key];
        g.classList.add("dg-leave");
        setTimeout(function () { if (g.parentNode && g.classList.contains("dg-leave")) g.parentNode.removeChild(g); }, MOVE);
      });
      // Arrows that do not change stay. The others leave now and are drawn again once nodes arrive.
      var edgesA = layer(from, "dg-edges");
      var edgesB = layer(to, "dg-edges");
      var keep = {};
      Array.prototype.forEach.call(edgesB.children, function (p) { keep[p.getAttribute("data-edge") + "|" + p.getAttribute("d")] = true; });
      Array.prototype.slice.call(edgesA.children).forEach(function (p) {
        if (!keep[p.getAttribute("data-edge") + "|" + p.getAttribute("d")]) edgesA.removeChild(p);
      });
      var have = {};
      Array.prototype.forEach.call(edgesA.children, function (p) { have[p.getAttribute("data-edge") + "|" + p.getAttribute("d")] = true; });
      var incoming = Array.prototype.slice.call(edgesB.children).filter(function (p) {
        return !have[p.getAttribute("data-edge") + "|" + p.getAttribute("d")];
      });
      setTimeout(function () {
        if (gen !== generation) return;
        incoming.forEach(function (p) {
          if (p.hasAttribute("stroke-dasharray")) {
            p.classList.add("dg-enter");
          } else {
            p.setAttribute("pathLength", "1");
            p.setAttribute("stroke-dasharray", "1");
            p.classList.add("dg-draw");
          }
          edgesA.appendChild(p);
        });
      }, MOVE);
    }

    prev.addEventListener("click", function () { go(current - 1); });
    next.addEventListener("click", function () { go(current + 1); });
    fig.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { go(current - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { go(current + 1); e.preventDefault(); }
    });
    render(0);
  }

  var figs = document.querySelectorAll("figure.steps");
  for (var i = 0; i < figs.length; i++) init(figs[i]);
})();
