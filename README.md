# WP Grid Builder — Viv Mobile Filters

A standalone plugin that adds a full-screen mobile filter drawer to WP Grid Builder grids.

## What It Does

On mobile viewports (below a configurable breakpoint), this plugin hides the standard WP Grid Builder sidebar and top-area facets, and replaces them with a "Filters" button bar. Tapping the button opens a full-screen drawer containing all the facets. A "Show Results" button and a result count keep the user oriented while filtering.

Works standalone or alongside `wp-grid-viv-addon` — when viv-addon is active, it defers to viv-addon's built-in mobile filter handling to avoid duplicate assets.

---

## How It Works

- `wp_grid_builder/controls/grid` — adds the **Enable Viv Mobile Filters** toggle and **Mobile Breakpoint** field to the grid's admin panel. If `wp-grid-viv-addon` is active, the fields are merged into the existing Viv fieldset; otherwise a standalone `viv_mobile` fieldset is created.

- `wp_grid_builder/layout/wrapper_tag` — during grid rendering, if `en_viv_mobile_filters` is enabled, injects the filter button bar (`parts/mobile-filters.php`) immediately before the grid wrapper, and registers the full-screen popup (`parts/mobile-filters-popup.php`) in `wp_footer`.

- `wp_enqueue_scripts` — on pages containing `[wpgb_grid id="X"]`, reads the grid settings from the DB, checks `en_viv_mobile_filters`, and enqueues `css/wp-grid-viv-mbf.css` and `js/wp-grid-viv-mbf.js`. Inline CSS hides the sidebar/top areas below the breakpoint. Inline JS sets `viv_mbf_breakpoint`, `vivgb_grid_id`, and `viv_first_load`.

**Deduplication guard:** both the layout hook and the enqueue hook bail early with `if ( defined( 'WPGB_VIV_URL' ) ) return;` when viv-addon is active.

### JS behaviour (`js/wp-grid-viv-mbf.js`)

- Listens for `wpgb.loaded` event to get a reference to the WPGB grid instance via `WP_Grid_Builder.instance(vivgb_grid_id)`.
- On `facets.loaded`: moves facet DOM elements into the drawer on first load (skips `load_more`, `result_count`, `reset`, `sort`, `viv_view_toggle`). The **sort** facet is handled separately — it gets rendered into `#mob-order-select`.
- On `facets.fetched`: updates the result count and filtered-state indicator on the button.
- On window resize: triggers a grid refresh when crossing the breakpoint boundary.

---

## Requirements

- WP Grid Builder 2.x
- PHP 7.2+
- WordPress 5.2+
- **Does not require** `wp-grid-viv-addon` (works standalone)

---

## Installation

1. Copy the plugin folder to `wp-content/plugins/wp-grid-viv-mobile-filters/`.
2. Activate the plugin in WP Admin → Plugins.
3. In the WPGB grid editor, find the **Viv** panel (or **Viv Mobile Filters** if viv-addon is not active).
4. Toggle **Enable Viv Mobile Filters** on.
5. Set **Mobile Breakpoint** (default: 992px).

---

## Configuration

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Enable Viv Mobile Filters | `en_viv_mobile_filters` | off | Show/hide the mobile filter drawer for this grid |
| Mobile Breakpoint (px) | `viv_mob_breakpoint` | 992 | Viewport width below which mobile filters activate |

---

## Sort Facet Support

The sort facet is intentionally **excluded** from the main facet drawer. Instead, it renders into a `<select>` (`#mob-order-select`) in the popup footer. This keeps the sort control accessible on mobile without cluttering the filter list.

To have sort available on mobile: add a **Sort** facet to your grid (any area). The JS will automatically pick it up on the `facets.render` event.

---

## Known Issues / Limitations

- Only supports one grid per page (uses `vivgb_grid_id` which is set from the first matched grid).
- The resize handler reloads the page when crossing from mobile → desktop to restore the full sidebar layout. This is intentional but can feel jarring.
- When used without viv-addon, the result count requires the grid to fire `facets.fetched` on initial load (WPGB v2.3+ does this).

---

## WPGB v2 Compatibility Notes (Lessons Learned)

These issues were discovered during development and are documented here for future agents/developers:

### `WP_Grid_Builder.instance()` returns object without `.init`

WPGB v2.3+ changed the grid instance API. The `.init` property no longer exists. The JS checks `wpgb.init` as a guard; without a shim this causes the entire drawer to break silently.

**Fix:** `demo-cpt.php` (mu-plugin) patches `WP_Grid_Builder.instance` to add `inst.init = true` when missing.

### `vivgb_grid_id` and `viv_first_load` must be defined by this plugin

When running without viv-addon, these globals are undefined. Added via `wp_add_inline_script(..., 'before')`.

### Facet `holder` property does not exist in WPGB v2

The original viv-addon JS used `f.holder` to get the facet DOM element. In WPGB v2, the `facets.loaded` callback passes a keyed object; use `f[key][0].holder` or the actual DOM element directly via `document.querySelector('[data-facet="' + id + '"]')`.

---

## Development Status

- `viv-logic`: 7/10 — standalone deduplication and grid-ID detection are solid; sort rendering is a notable design decision
- `grid-logic`: 7/10 — WPGB v2 breakpoint reload and `.init` shim work well; `holder` API change required adaptation
