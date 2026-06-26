# Changelog

All notable changes to Event Profile Designer are documented here.

---

## [Unreleased]

### Added
- **Multi-channel support** — profiles now carry one of five channel types: VOC, CO₂, PM1, PM2.5, or PM10. Each channel has its own physical amplitude range and units (VOC: 0–1; CO₂: ppm; PM: µg/m³), reflected in the amplitude slider range, value display, and JSON output.
- **Channel selector** — a dropdown in the left panel sets the channel for the active profile. Switching channel rescales amplitude proportionally into the new channel's physical range and adjusts the decay slider ceiling.
- **`CHANNELS` registry** — all channel-specific knowledge (label, unit, amplitude bounds, decay ceiling, JSON serialise/deserialise logic) lives in a single `CHANNELS` object in `app.js`. Adding a new channel requires one new entry there and no changes elsewhere.
- **Groups (events)** — profiles can be collected into named groups representing a single physical event (e.g. cooking, vacuum). A group is a flat `{ id, name }` object; profiles point to it via `groupId`.
- **Group management UI** — a Group (event) dropdown and `+ Group` button in the panel let you create groups and assign any profile to one. Groups appear as labelled sections in the profile list, each with an Export JSON button and a delete button.
- **Group JSON export** — the `↓ JSON` button on a group header exports all member profiles as one nested event object matching the format used by the No3e event library. PM channels (PM1, PM2.5, PM10) are merged into a single `pm` block. A `_meta` block preserves delay, duration, and amplitude for round-trip import.
- **Group JSON import** — the importer detects whether a file contains a single profile or a group event object. Group files are recognised by their top-level event key, which becomes the group name; the compound `pm` block is expanded into individual PM1/PM2.5/PM10 profiles automatically.
- **Channel tag in profile list** — each row in the profile list shows a small coloured channel badge (VOC, CO₂, PM1, etc.) so channel membership is visible at a glance without opening the panel.
- **Six group presets** — cooking (VOC + CO₂ + PM1 + PM2.5 + PM10), traffic (VOC + CO₂ + PM2.5 + PM10), occupant (VOC + CO₂), pedestrian (VOC + PM1 + PM2.5), fragrance (VOC only), vacuum (VOC + PM1 + PM2.5 + PM10). Loading a multi-channel preset creates a group and populates it with one profile per channel.
- **Cross-channel graph display** — in Real-time and Absolute modes, curves from different channels are amplitude-normalised to [0, 1] so all channels can coexist on the shared Y axis. Normalised shape mode is unchanged. Curve labels carry the channel tag in parentheses.
- **Status bar channel units** — the Peak value in the status bar now formats in the active channel's physical units (e.g. `150 ppm` for CO₂, `25.0 µg/m³` for PM2.5).
- **`.pselect` CSS class** — shared select element style used by channel, group, display mode, and preset dropdowns.
- **`.pch-tag` CSS class** — channel badge style in the profile list.
- **`.pgroup-header`, `.pgroup-label`, `.pgroup-empty`, `.pibtn-sm` CSS classes** — group section styles in the profile list.

### Changed
- **`mkProfile`** — now accepts `channel` and `groupId` arguments; defaults amplitude to 70% of the channel's physical maximum.
- **`addProfile`** — propagates `channel` and `groupId` through to `mkProfile`.
- **`dupProfile`** — copies both `channel` and `groupId` from the source profile.
- **`syncSliders`** — overrides the amplitude slider's `min`/`max`/`step` and the decay slider's `max` based on the active channel before setting values.
- **`loadPreset`** — now reads from `GROUP_PRESETS`. Single-channel presets load into the active profile as before; multi-channel presets create a new group.
- **`renderProfileList`** — reorganised into group sections (with headers) followed by an "Individual" section for ungrouped profiles. Uses a new `makeProfileItem` helper.
- **`exportJSON`** — routes through `serializeProfile`, which calls `CHANNELS[channel].serialize` to produce the correct range key (`peakRange`, `pm1Range`, `pm25Range`, or `pm10Range`).
- **`handleImport` / `importData`** — split into `importSingleProfile` and `importGroupData` to handle both file formats.
- **`exportSVG`** — curve Y values are amplitude-normalised before plotting; labels include the channel tag.
- **Preset list** — extended to include vacuum; all presets annotated with `(group)` where applicable.
- **`transformPoints`** — renamed `transformPointsForRow` in the graph module to reflect that it operates in the context of a subplot row.

### Removed
- **`PRESETS` as the sole preset source** — single-channel presets are now derived from `GROUP_PRESETS[key][channelKey]` rather than maintained as a separate table.

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