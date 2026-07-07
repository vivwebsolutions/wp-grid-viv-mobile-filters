# WP Grid Builder — ViV Mobile Filters

Adds a full-screen **mobile filter drawer** to [WP Grid Builder](https://wpgridbuilder.com/) grids.
Enable it per grid; below a configurable breakpoint the plugin hides the grid's
sidebar/top facet areas and shows a **Filter** bar that opens a drawer containing
all the facets, with a live result count and a "Show Results" button.

- **Requires:** WordPress 5.2+, PHP 7.2+, WP Grid Builder (active)
- **Optional:** works alongside `wp-grid-viv-addon` / `wp-grid-viv-parent`, but has
  **no dependency** on them — fully standalone and portable.

---

## Install & enable

1. Copy this folder to `wp-content/plugins/wp-grid-viv-mobile-filters/`.
2. Activate it in **WP Admin → Plugins**.
3. Open a grid in the WPGB editor → **ViV** panel → turn on **Enable ViV Mobile Filters**.

## Settings (per grid, WPGB grid editor → ViV)

| Setting | Key | Default | Notes |
|---------|-----|---------|-------|
| Enable ViV Mobile Filters | `en_viv_mobile_filters` | off | Turns the drawer on for this grid |
| Mobile Breakpoint (px) | `viv_mob_breakpoint` | 992 | Drawer/bar activate at `max-width` ≤ this |
| Show Order Button | `viv_show_mbf_order` | off | Needs a **sort** facet in the grid layout |
| Show Reset Button | `viv_mob_mbf_reset` | off | Adds a "Reset All" control to the bar |

---

## How it works

- **Admin** (`wp_grid_builder/controls/grid`): registers the settings above. If a
  `viv` fieldset already exists (e.g. `wp-grid-viv-addon`), the fields merge into it;
  otherwise a standalone **ViV Mobile Filters** fieldset is created.
- **Front-end** (`wp_grid_builder/layout/wrapper_tag`): when enabled, includes the
  Filter bar (`parts/mobile-filters.php`) right before the grid wrapper and queues the
  drawer (`parts/mobile-filters-popup.php`) into `wp_footer`.
- **Assets** (`wp_grid_builder/grid/settings`): enqueues `css/` + `js/`, plus per-grid
  inline CSS that (below the breakpoint) hides `.wpgb-sidebar` / top areas and reveals
  the bar, and inline JS exposing `window.vivgb_mbf_grids[gridId] = { breakpoint }`.
- **JS** (`js/wp-grid-viv-mbf.js`): on `wpgb.loaded` it hooks each enabled grid, moves
  facet DOM into the drawer on open (and back to the grid on desktop resize), keeps the
  result count and filter badge in sync, and mirrors a **sort** facet into the bar's
  `<select>`.

## Template overrides (theme)

Drop a same-named file under your (child) theme to override a part:

```
wp-content/themes/<theme>/vivgb/parts/mobile-filters.php
wp-content/themes/<theme>/vivgb/parts/mobile-filters-popup.php
```

The theme copy wins over the plugin default. Lookup is a direct file check
(`get_stylesheet()` then `get_template()`), so it also works under WPGB's SHORTINIT
AJAX context where `locate_template()` is unavailable. `$viv_mbf_grid_id` and
`$settings` are in scope inside these files.

## Custom Filter button

You don't have to use the default bar. Any element works as the trigger as long as it
carries the plugin's hooks — see **[AGENTS.md](AGENTS.md)** for the full markup contract
(`.filter-mob-but-w`, `.mob-filter-count`, `.vivgb-show-mob-filters`, auto `data-grid`).

---

## Notes

- **Portable:** no hardcoded site/theme selectors or URLs. Colors are CSS variables
  (`--vivmbf-bg` / `--vivmbf-fg` / `--vivmbf-border`); the drawer locks scroll via the
  `body.vivgb-noscroll` class (style your own header hiding off that class if needed).
- One grid is shown in the drawer at a time; opening another grid's bar swaps its facets in.
- Crossing the breakpoint back to desktop returns facets to the grid and closes the drawer.

For the contract, extension points and developer notes, see **[AGENTS.md](AGENTS.md)**.
