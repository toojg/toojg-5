# Jeremy Garcia — Portfolio

A standalone, static portfolio site. Plain HTML / CSS / vanilla JS — **no build step,
no CMS**. Deployed to Netlify by serving this folder as-is.

## Run it locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works. It must be served over HTTP — opening `index.html` via
`file://` will break the ES-module experiments and font loading.)

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Homepage — hero, project cards, logos, and the bento grid of work. |
| `design-system.html` | Color tokens, type scale, and components. Source of truth. |
| `experiments.html` | Private preview of interactive experiments. **Not linked from the site** and marked `noindex`. |

## Structure

```
css/
  fonts.css      @font-face for Roobert (Light / Regular / Medium)
  tokens.css     :root design tokens — colors, type scale, radius, spacing
  base.css       reset + the .inset-border utility (the 1px white-11% inset stroke)
  site.css       homepage layout + responsive breakpoints
  design-system.css / experiments.css   page-specific styles
js/
  experiments-registry.js   the list the preview page renders from
  experiments/*.js          one module per experiment (core code only)
assets/
  fonts/  logos/  hero/  photogrammetry/  scratch/
```

## ⚠️ Font licensing — read before going public

The design uses **Roobert Light (300)**, but only **Regular (400)** and **Medium (500)**
are licensed for the web (Displaay web license, `DP_order_167248`). The Light cut currently
shipped — `assets/fonts/Roobert-TRIAL-Light.woff2` — is a **trial file and is not licensed
for a public site.**

Before launch: license Roobert Light for web, drop the licensed `.woff2`/`.woff` into
`assets/fonts/`, and update the single `font-weight: 300` `@font-face` rule in
`css/fonts.css`. Everything else flows through that one declaration.

## Adding a project page

Create a new HTML file (copy the `<head>` links from `index.html` so it inherits the fonts,
tokens, base, and `site.css`). Build with the existing tokens and the `.inset-border`
utility. Link to it from a bento box in `index.html` — wrap the target `.box` in an `<a>`,
or drop content directly inside the box.

## Adding / editing an experiment

1. Write `js/experiments/<name>.js` exporting `mount(container)` that renders into the
   passed element and returns `{ destroy() }` (cancel timers/rAF, remove listeners, close
   audio/WebGL, remove DOM). Follow any existing module as a template.
2. Add an entry to `js/experiments-registry.js` (`name`, `tech`, `note`, `aspect`, `load`).
   That's all the preview page needs — it lazy-mounts each experiment on scroll and
   unmounts it when it leaves the viewport.

The same `mount(container)` shape is how you later drop an experiment into a homepage bento
box: call `mount(theBox)` on it.

WebGL experiments (photogrammetry, connect4) `import * as THREE from 'three'`, resolved by
the import map in `experiments.html`. If you embed one elsewhere, copy that import map.

## Credits

Type: Roobert by Displaay Type Foundry. Design reproduced from Paper.
