# Changelog

All notable changes to Event Profile Designer are documented here.

---

## [Unreleased]

### Added
- **Mobile layout** — responsive breakpoint at 700 px. Below this width the left panel is hidden by default and opens as a slide-in drawer triggered by a ☰ hamburger button in the top bar.
- **Panel backdrop** — a semi-transparent overlay appears behind the open panel on mobile; tapping it closes the panel.
- **Panel close button** — a ✕ button inside the panel header dismisses the drawer on mobile.
- **Display mode selector in panel** — a `<select>` element mirrors the top-bar radio group inside the panel on mobile, so display mode is reachable without closing the drawer.
- **Action buttons in panel** — Import JSON, Export JSON, and Export SVG buttons are duplicated inside the panel on mobile for easy one-handed access.
- **`--panel-w` CSS variable** — panel width is now controlled by a single token, capped at `min(264px, 88vw)` on narrow viewports to prevent overflow.
- **`changelog.md`** — this file.

### Changed
- **Graph is now read-only** — all curve editing is done through the parameter sliders. The graph renders the current slider state and supports zoom/pan only.
- **Architecture table in readme** — updated to reflect the three-file split (`index.html`, `style.css`, `app.js`) and the removal of the handle system module.
- **readme: Interface section** — rewritten to document the mobile panel, the duplicate action controls, and the read-only graph behaviour.
- **readme: Display modes section** — removed the note about handles being hidden in Normalized mode (handles no longer exist).
- **Status bar** — stat items are now wrapped in `<span class="stat-item">` for reliable overflow handling on narrow screens.
- **Top bar structure** — mode group and export buttons are wrapped in `#mode-wrap` and `#topbar-right` divs to allow clean CSS hiding on mobile without touching individual elements.

### Removed
- **Draggable graph handles** — the Delay, Peak, and Tail control points that previously appeared on the active curve have been removed. Curve shape is now determined exclusively by the five parameter sliders.
- **`drawHandles()` function** — deleted from `app.js`.
- **`attachDrag()` function** — deleted from `app.js`.
- **`gHandles` SVG layer** — the dedicated SVG group and its clip-path for handle rendering have been removed.
- **`.handle-ring` CSS class** — no longer referenced; removed from `style.css`.

---

## [1.0.0] — initial release

- `CurveModel` with `evaluate`, `sample`, `peakTime`, `peakValue`, and `naturalEnd`.
- Five-parameter curve model: Rise, Decay, Amplitude, Delay, Duration.
- D3-based graph with zoom and pan.
- Three display modes: Normalized shape, Real-time scale, Absolute scale.
- Draggable Delay, Peak, and Tail handles on the active profile (subsequently removed in next release).
- Multiple profile management: add, duplicate, delete, rename, toggle visibility.
- Five built-in presets: cooking, traffic, occupant, pedestrian, fragrance.
- JSON export and import with `voc`/`co2`/`pm` channel support.
- SVG export — Illustrator-compatible, no embedded bitmaps.
- Live status bar: Peak, Time to peak, Decay to 10%.
- D3 7.8.5 loaded from cdnjs; no other runtime dependencies.