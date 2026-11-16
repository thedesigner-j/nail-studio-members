// Nail Studio – Trace Export
//
// Saves the nail sets in the open Figma file to one .json file, for the
// app's Admin > Trace > Import from Figma. It only reads this one file and
// changes nothing in it; it has no network access (see manifest.json).
//
// The file holds the same things the app would otherwise read through
// Figma's API, in the same shape:
//   - document: pages, their sections/frames, and the "Nail" variants
//   - frames:   each set's "Art Masters" and "Color Ref" frames
//   - geometry: outline and tip shapes of each nail shape
//   - svgs:     every art master as SVG (null when it has nothing drawn)
// Plain ES2017 so it runs in Figma's plugin sandbox as-is.

var SET_PAGE = /^sets?\s*[-–—·:|]\s*(.+)$/i;
var SET_SECTION = /^([A-Za-z]+\d+)\s*[·•|:\-–—]\s*(.+)$/;
var VARIANT = /Shape=([^,]+),\s*Size=([^,]+),\s*Finger=([^,]+),\s*Mode=([^,]+)/i;

function plainBox(n) {
  var b = n.absoluteBoundingBox;
  return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
}

function plainPaints(fills) {
  if (!Array.isArray(fills)) return [];
  return fills
    .filter(function (f) {
      return f.type === "SOLID";
    })
    .map(function (f) {
      return {
        type: "SOLID",
        visible: f.visible !== false,
        opacity: f.opacity === undefined ? 1 : f.opacity,
        color: { r: f.color.r, g: f.color.g, b: f.color.b, a: 1 },
      };
    });
}

function plainGeometry(list) {
  return (list || []).map(function (g) {
    return { path: g.data, windingRule: g.windingRule };
  });
}

// A node in the Figma REST API's shape, `depth` levels of children deep.
function plainNode(n, depth, withGeometry) {
  var out = { id: n.id, name: n.name, type: n.type === "PAGE" ? "CANVAS" : n.type };
  if (n.visible === false) out.visible = false;
  if ("absoluteBoundingBox" in n) out.absoluteBoundingBox = plainBox(n);
  if (n.type === "TEXT") out.characters = n.characters;
  if ("fills" in n && n.fills !== figma.mixed) {
    var paints = plainPaints(n.fills);
    if (paints.length) out.fills = paints;
  }
  if ("isMask" in n && n.isMask) out.isMask = true;
  if (withGeometry && (n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION")) {
    out.fillGeometry = plainGeometry(n.fillGeometry);
    out.strokeGeometry = plainGeometry(n.strokeGeometry);
  }
  if (depth > 0 && "children" in n) {
    out.children = n.children.map(function (c) {
      return plainNode(c, depth - 1, withGeometry);
    });
  }
  return out;
}

// Collects everything. `progress(text, done, total)` reports along the way.
// `options.limitSets` and `options.skipSvgs` are only for quick checks.
async function collectBundle(progress, options) {
  options = options || {};
  var pages = figma.root.children;
  for (var i = 0; i < pages.length; i++) {
    progress("Opening page " + (i + 1) + " of " + pages.length + "...", 0, 1);
    await pages[i].loadAsync();
  }

  var document = {
    id: figma.root.id,
    name: figma.root.name,
    type: "DOCUMENT",
    children: pages.map(function (p) {
      return plainNode(p, 2, false);
    }),
  };

  // Each set's two frames, and its art masters to export.
  var frames = {};
  var art = [];
  var setCount = 0;
  pages.forEach(function (page) {
    if (!SET_PAGE.test(page.name.trim())) return;
    page.children.forEach(function (section) {
      if (!SET_SECTION.test(section.name.trim()) || !("children" in section)) return;
      if (options.limitSets && setCount >= options.limitSets) return;
      var artFrame = null;
      section.children.forEach(function (f) {
        var name = f.name.trim();
        if (/^art masters$/i.test(name)) artFrame = f;
        if (/colou?r ref$/i.test(name)) frames[f.id] = plainNode(f, 2, false);
      });
      if (!artFrame) return;
      setCount++;
      frames[artFrame.id] = plainNode(artFrame, 1, false);
      artFrame.children.forEach(function (c) {
        if (c.type === "COMPONENT") art.push(c);
      });
    });
  });

  // Outline and tip geometry: each shape's M · Middle variant (or its first
  // variant), in both modes.
  var geometry = {};
  var reference = {};
  pages.forEach(function (page) {
    page.children.forEach(function (set) {
      if (set.type !== "COMPONENT_SET" || set.name.trim().toLowerCase() !== "nail") return;
      set.children.forEach(function (v) {
        var m = v.name.match(VARIANT);
        if (!m) return;
        var key = m[1].trim() + "|" + m[4].trim().toLowerCase();
        var preferred = m[2].trim().toUpperCase() === "M" && m[3].trim().toLowerCase() === "middle";
        if (preferred || !reference[key]) reference[key] = v;
      });
    });
  });
  Object.keys(reference).forEach(function (key) {
    geometry[reference[key].id] = plainNode(reference[key], 1, true);
  });

  var svgs = {};
  var blank = 0;
  if (!options.skipSvgs) {
    for (var j = 0; j < art.length; j++) {
      if (j % 10 === 0) progress("Saving designs: " + j + " of " + art.length + "...", j, art.length);
      try {
        svgs[art[j].id] = await art[j].exportAsync({ format: "SVG_STRING", svgIdAttribute: false });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- older sandboxes need the binding
      } catch (e) {
        // Nothing visible to export (e.g. a plain nail has no tracing lines).
        svgs[art[j].id] = null;
        blank++;
      }
    }
  }

  return {
    bundle: {
      format: "nail-studio-trace",
      version: 1,
      fileName: figma.root.name,
      exportedAt: new Date().toISOString(),
      document: document,
      frames: frames,
      geometry: geometry,
      svgs: svgs,
    },
    summary: { sets: setCount, designs: art.length - blank, blank: blank, shapes: Object.keys(geometry).length / 2 },
  };
}

if (typeof figma.showUI === "function" && typeof __html__ !== "undefined") {
  figma.showUI(__html__, { width: 340, height: 330, themeColors: true });

  figma.ui.onmessage = async function (msg) {
    if (!msg || msg.type !== "export") return;
    try {
      var result = await collectBundle(function (text, done, total) {
        figma.ui.postMessage({ type: "progress", text: text, done: done, total: total });
      });
      if (result.summary.sets === 0) {
        figma.ui.postMessage({
          type: "error",
          text: 'No nail sets found in this file. Open the file with the "Sets - …" pages and run this again.',
        });
        return;
      }
      figma.ui.postMessage({ type: "done", json: JSON.stringify(result.bundle), summary: result.summary });
    } catch (e) {
      figma.ui.postMessage({ type: "error", text: "Export stopped: " + (e && e.message ? e.message : String(e)) });
    }
  };
}
