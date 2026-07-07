# AGENTS.md — WP Grid Builder ViV Mobile Filters

Guidance for AI agents and developers working on this plugin, or on themes/other
plugins that need to hook into it. Read this before editing — a few things are
non-obvious and were learned the hard way (see **Gotchas**).

## What this plugin is

A standalone add-on for **WP Grid Builder** (WPGB). Enabled per grid, it turns the
grid's facets into a full-screen **mobile drawer**: below a breakpoint it hides the
grid's sidebar/top areas, shows a **Filter** bar, and on tap moves the real facet DOM
into a fixed overlay (`#vivgb-mbf-popup`) with a live count and "Show Results" button.

**WPGB is the only hard dependency** (the main file bails with an admin notice
otherwise). It works with or without `wp-grid-viv-addon` / `wp-grid-viv-parent` and
carries **no runtime knowledge of them** — keep it that way. This plugin was extracted
from the addon's old mobile-filters code, which has since been removed; this is now the
single source of truth for mobile filtering.

## Execution flow (PHP)

- `wp_grid_builder/controls/grid` — registers the `viv` admin tab + fields. Merges into
  an existing `viv` fieldset if present, else creates its own. Text domain everywhere is
  `wp-grid-viv-mobile-filters` (single, unified).
- `wp_grid_builder/layout/wrapper_tag` — when `en_viv_mobile_filters` is set, `include`s
  the bar part **before** the grid wrapper and registers the popup part on `wp_footer`
  (once). `static` guards prevent duplicate bars/popups.
- `wp_grid_builder/grid/settings` — enqueues assets once per enabled grid via
  `vivmbf_enqueue_scripts()`: the static CSS/JS, per-grid **inline CSS** (a
  `@media(max-width:<bp>px)` block that hides `.wpgb-grid-<id> .wpgb-sidebar` + top areas
  and shows `.filter-mob-but-w[data-grid="<id>"]`), and **inline JS**
  `window.vivgb_mbf_grids[<id>] = { breakpoint }`.
- `wp_grid_builder/async/render_response` — injects `total` so JS has a result count on
  first load. Applies to every grid response by design; harmless.
- `wpgb_vmf_get_part_path($file)` — template resolution: theme `vivgb/parts/` (stylesheet
  then template) then plugin `parts/`. Direct `file_exists` checks (not
  `locate_template`) so it survives WPGB's SHORTINIT AJAX context.

## The markup contract (what the JS binds to)

The bar can be the plugin's own `parts/mobile-filters.php`, a theme override, or an
arbitrary element (e.g. a WPGB custom-HTML facet). It only needs these hooks:

| Hook | Purpose |
|------|---------|
| `.filter-mob-but-w` (wrapper) | Identifies a bar. Open handler = `.filter-mob-but-w > button`. |
| `data-grid="<id>"` | Which grid this bar controls. **Optional** — auto-stamped (see below). |
| `.mob-filter-count` | Gets the active-filter count; the button also gets `.filtered`. |
| `.vivgb-show-mob-filters` | Alternative open trigger (click opens the drawer). |
| `.mob-order-select` / `.mob-order` | Optional: sort facet is mirrored into this `<select>`. |
| `.reset-all` | Optional: resets the grid's facets. |

The popup (`#vivgb-mbf-popup`) expects `#vivgb-mbf-scroll` (facet container),
`#mbf-selection`, `#mob-show-res`, `#mob-filter-close`, `.search-count`.

### data-grid auto-stamping

`stampBars(gridId)` does `.wpgb-grid-<id> .filter-mob-but-w:not([data-grid])` → sets
`data-grid`. It runs at init **and on every `fetched`**, so a bar that renders *after*
`wpgb.loaded` (a custom-HTML facet does) still gets resolved. The open handler also
falls back to the nearest `.wpgb-grid-<id>` ancestor at click time. Net effect: a single
class-based bar works on any grid, whenever/wherever it renders, without a hardcoded id.

## Extension points

- **`window.viv_mbf_skip_facets`** (array of facet `type`s) — extra types to keep out of
  the drawer, merged with the built-in skip list (`load_more`, `result_count`, `reset`,
  `sort`, `viv_view_toggle`, `pagination`).
- **`vivgb.mbf.facetsMoved`** `(gridId, movedFacets)` / **`vivgb.mbf.facetsReturned`**
  `(gridId, savedParents)` — jQuery `document` events fired after facets move into / out
  of the drawer. Use these to re-init anything that depends on facet DOM position.
- **`window.vivgb_parent_setup_all()`** — if defined (by `wp-grid-viv-parent`), it is
  called after each move/return so parent accordions can reassemble their children.
- **`body.vivgb-noscroll`** — added while the drawer is open. The public "drawer open"
  signal; other code should watch this class (not a private flag). The plugin ships a
  scroll-lock rule + admin-bar hiding off it; add your own header hiding in the theme.
- **CSS variables** `--vivmbf-bg` / `--vivmbf-fg` / `--vivmbf-border` — re-skin without
  editing the stylesheet.

## Facet moving — how it works

`moveFacetsToMobile()` relocates each facet's `f.holder` element (not a clone) into
`#vivgb-mbf-scroll`, saving its original parent/next sibling in `savedFacetParents`.
`returnFacetsToGrid()` restores them in reverse DOM order. `selection` facets go to
`#mbf-selection`; `viv_parent` children are skipped as standalone items (they travel
inside the parent placeholder). Because holders are **moved**, directly-bound handlers
travel with them — but see the gotcha below about `.html()` re-injection.

## Gotchas

- **A theme override that is empty silently blanks the bar.** `wpgb_vmf_get_part_path`
  returns the theme file if it exists — even a 0-byte one. If a project keeps an empty
  `themes/<theme>/vivgb/parts/mobile-filters.php` (to supply the bar elsewhere, e.g. a
  custom-HTML facet), that is intentional; do not "fix" it by deleting.
- **A bar placed inside a hidden area won't show on mobile.** The inline CSS hides
  `.wpgb-sidebar` and top areas below the breakpoint. A custom bar/facet dropped into
  those areas disappears exactly when it's needed — put it outside them (the plugin's own
  bar renders before the wrapper, so it is never affected).
- **`.html()` re-injection wipes direct handlers.** `wp-grid-viv-parent` rebuilds its
  child facets with `.html(f.html)`, destroying any handler bound directly to a child's
  elements. Controls inside a `viv_parent` must use **event delegation** (this is why
  `wp-grid-viv-toggle-main` delegates on `document`). Keep that in mind for any facet UI
  meant to work inside the drawer.
- **This plugin owns `body.vivgb-noscroll`, not `noscroll`.** The addon's grid layout JS
  watches `vivgb-noscroll` too; renaming the class here would silently change that.

## Verifying changes

No automated tests. After edits: `php -l` changed PHP, `node --check` changed JS, then
exercise in the browser at ≤ breakpoint width on a grid with mobile filters enabled:

1. Filter bar shows; tapping it opens the drawer with all facets.
2. Filtering updates the result count and the bar's filter badge; "Show Results" closes it.
3. Facet controls inside the drawer work (checkboxes, toggles, sort select, reset).
4. Resizing across the breakpoint to desktop returns facets to the grid and closes the drawer.
5. Confirm it works **standalone** (addon deactivated) — no console errors, no missing globals.
