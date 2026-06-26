# Event Profile Designer

A browser-based tool for designing and comparing No3e sensor event signatures. Build physically plausible response curves across multiple sensor channels, organise them into event groups, and export them as JSON or SVG.

---

## Getting started

[RUN DEMO](https://no3edev.github.io/Event-Profile-Designer/)

---

## Concepts

### Profile

An **event profile** represents how a single sensor channel responds over time to a physical event — a person walking past, a gas stove igniting, traffic idling nearby. The shape is governed by five parameters:

| Parameter | What it controls |
|-----------|-----------------|
| Rise | How quickly the sensor reacts (attack speed) |
| Decay | How long the tail lingers after the peak |
| Amplitude | Peak response magnitude in the channel's physical units |
| Delay | Offset before the event begins |
| Duration | Time-stretch factor applied to the whole curve |

The underlying model is:

```
y = (amplitude / peak_value) × (1 − e^(−τ/rise)) × e^(−τ/decay)

where τ = (t − delay) / duration
```

This produces a physically plausible one-sided response with a smooth attack and an exponential tail.

### Channel

Each profile belongs to one sensor **channel**, which defines the physical units and amplitude range of its response:

| Channel | Units | Amplitude range |
|---------|-------|----------------|
| VOC | — | 0 – 1 |
| CO₂ | ppm | 1 – 2000 |
| PM1 | µg/m³ | 0.1 – 500 |
| PM2.5 | µg/m³ | 0.1 – 500 |
| PM10 | µg/m³ | 0.1 – 500 |

### Group

A **group** is a named collection of profiles representing the full multi-channel signature of a single physical event. For example, a cooking event might include a VOC profile, a CO₂ profile, and PM1/PM2.5/PM10 profiles. Groups export as a single nested JSON object and import back as a complete set.

Individual profiles that do not belong to a group can still be exported and imported on their own.

---

## Interface

### Left panel

The panel contains all editing controls. On desktop it is always visible on the left side of the window. On mobile, tap the **☰** button in the top bar to open it as a slide-in drawer; tap the backdrop or the **✕** button to dismiss it.

- **Profile name** — rename the active profile.
- **Channel** — set the sensor channel for the active profile (VOC, CO₂, PM1, PM2.5, PM10). The amplitude slider range and value display update to match the channel's physical units.
- **Group (event)** — assign the active profile to a named group, or leave it ungrouped. Click **+ Group** to create a new group.
- **Parameter sliders** — adjust Rise, Decay, Amplitude, Delay, and Duration. The graph updates in real time as you drag.
- **Display mode** *(mobile only, in panel)* — switch between Normalized, Real-time, and Absolute scale without closing the drawer.
- **Actions** *(mobile only, in panel)* — Import JSON, Export JSON, and Export SVG buttons are duplicated here for easy thumb reach.
- **Profiles list** — all open profiles, organised under their group headers. Ungrouped profiles appear below an "Individual" separator when groups are present. Click a row to make a profile active. Inline buttons: toggle visibility (●/○), duplicate (⧉), delete (✕). Click a name to rename it inline. Each row shows a channel badge (VOC, CO₂, PM1, etc.) in the profile's colour.
- **Group headers** — each group has an **↓ JSON** button to export the whole group and a **✕** button to delete the group (profiles are unassigned, not deleted).
- **Load preset** — load a built-in single or multi-channel event preset into the active profile or as a new group.

### Graph

The main canvas shows all visible profiles overlaid on a shared axis. Scroll or pinch to zoom; drag the background to pan. Profile names and channel tags are rendered near each curve's peak.

In Real-time and Absolute modes, curves from different channels are amplitude-normalised to a [0, 1] Y axis so all channels can coexist on the same plot — the shape and timing are preserved, only the physical scale is stripped. Use Normalized shape mode for pure shape comparison, or read the physical values directly from the slider and status bar.

All curve editing is done through the sliders — the graph is a read-only view of the current parameter state.

---

## Display modes

Switch between modes using the segmented control in the top bar (desktop) or the Display mode selector in the panel (mobile). Changing mode resets the zoom.

### Normalized shape

Each curve is independently scaled so its peak reaches y = 1.0. The time axis runs 0 → 1τ, normalised to each curve's own peak time. Amplitude, duration, and channel differences are stripped away — useful for comparing pure rise/decay character between profiles.

### Real-time scale *(default)*

Shared time axis in seconds. All curves are amplitude-normalised to [0, 1] so channels with different physical units can be compared on one axis. The x-axis auto-fits to the longest visible profile.

### Absolute scale

Both axes are fixed: x is pinned 0–1200 s, y is 0–1 (amplitude-normalised). Nothing rescales when you edit or add profiles. Spatial relationships between profiles stay stable — the widest or latest-starting profile always appears that way.

---

## Presets

Presets marked **(group)** create a named group and populate it with one profile per channel. Single-channel presets load directly into the active profile.

| Preset | Channels | Characteristics |
|--------|----------|----------------|
| cooking (group) | VOC, CO₂, PM1, PM2.5, PM10 | Fast VOC/PM burst with slower CO₂ build-up |
| traffic (group) | VOC, CO₂, PM2.5, PM10 | Slow rise, long sustained decay across all channels |
| occupant (group) | VOC, CO₂ | Persistent presence — very long CO₂ decay |
| pedestrian (group) | VOC, PM1, PM2.5 | Brief transient — fast rise, short decay |
| fragrance | VOC | Very fast rise, long decay, near-peak amplitude |
| vacuum (group) | VOC, PM1, PM2.5, PM10 | Low VOC, elevated PM across all particulate sizes |

---

## Export

### Export JSON (single profile)

Exports the currently active profile. The channel key and range field name are determined by the profile's channel:

```json
{
  "name": "traffic",
  "voc": {
    "rise": 90,
    "decay": 600,
    "peakRange": [0.298, 0.403]
  },
  "meta": {
    "delay": 20,
    "duration": 2,
    "amplitude": 0.35
  }
}
```

Range field names by channel: `peakRange` for VOC and CO₂; `pm1Range`, `pm25Range`, `pm10Range` for the respective PM channels. All ranges are `[amplitude × 0.85, amplitude × 1.15]`. The `meta` block preserves all parameters needed to reconstruct the full curve.

### Export JSON (group)

Click **↓ JSON** on a group header to export all member profiles as one nested event object. PM channels are merged into a single `pm` block:

```json
{
  "cooking": {
    "voc": { "rise": 15, "decay": 120, "peakRange": [0.723, 0.978] },
    "co2": { "rise": 300, "decay": 2400, "peakRange": [127.5, 172.5] },
    "pm": {
      "rise": 45,
      "decay": 1200,
      "pm1Range": [42.5, 57.5],
      "pm25Range": [80.75, 109.25],
      "pm10Range": [97.75, 132.25]
    },
    "_meta": { ... }
  }
}
```

### Export SVG

Generates a clean vector file containing axes and all visible curves, labelled with profile names and channel tags. The output is Illustrator-compatible — no embedded bitmaps, no clipping masks, explicit stroke widths and colours.

### Import JSON

Loads a single-profile or group JSON file. The format is detected automatically:

- **Single profile** — a file with a top-level channel key (`voc`, `co2`, `pm1`, `pm25`, `pm10`, or the legacy `pm`) creates one profile. A `meta` block restores delay, duration, and amplitude exactly.
- **Group file** — a file whose top-level key is an event name (e.g. `cooking`) creates a new group and populates it with one profile per channel. A compound `pm` block is expanded into separate PM1, PM2.5, and PM10 profiles automatically.

---

## Multiple profiles and groups

- **+ New** adds a blank ungrouped VOC profile.
- **⧉** duplicates the selected profile, including its channel and group assignment.
- **+ Group** creates a new named group.
- Profiles are automatically assigned distinct colours.
- Any number of profiles can be overlaid simultaneously; toggle individual visibility with the ●/○ button.
- Deleting a group unassigns its profiles — they move to the Individual section and are not deleted.

---

## Status bar

The bar at the bottom of the window shows live statistics for the active profile:

| Stat | Meaning |
|------|---------|
| Peak | Amplitude at the curve maximum, in the channel's physical units |
| Time to peak | Seconds from t = 0 to the maximum |
| Decay to 10% | Seconds until the response falls to 10% of its peak |

A mode badge on the left shows the current display mode.

---

## Architecture notes

The codebase is split across three files:

| File | Responsibility |
|------|---------------|
| `index.html` | Structure and layout; desktop and mobile markup |
| `style.css` | Design tokens, component styles, responsive breakpoints |
| `app.js` | All application logic, organised into modules (see below) |

### JS module breakdown

| Module | Responsibility |
|--------|---------------|
| `CurveModel` | Pure functions — `evaluate`, `sample`, `peakTime`, `peakValue`, `naturalEnd` |
| `CHANNELS` registry | Per-channel label, units, amplitude bounds, decay ceiling, JSON serialise/deserialise |
| Profile & group manager | CRUD for profile and group objects, preset loading, colour assignment |
| Slider UI | Builds and synchronises parameter controls; overrides ranges per channel |
| Graph renderer | D3-based SVG rendering, zoom/pan, display mode transforms, cross-channel normalisation |
| Exporters | Single-profile JSON, group JSON, SVG string generation, file download |
| Importers | Format detection, single-profile and group-event parsing, PM block expansion |
| Mobile panel | Slide-in drawer open/close, responsive show/hide logic |

### Extending to new sensor channels

Add one entry to the `CHANNELS` object in `app.js`:

```js
myChannel: {
  label: 'Label',
  unit: 'unit',
  ampMin: 0.1, ampMax: 999, ampStep: 0.1, ampFmt: v => v.toFixed(1) + ' unit',
  decayMax: 3600,
  serialize:   (rise, decay, amplitude) => ({ rise, decay, myRange: [...] }),
  deserialize: ch => ch.myRange ? (ch.myRange[0] + ch.myRange[1]) / 2 : defaultAmp,
},
```

Then add `<option value="myChannel">Label</option>` to the channel `<select>` in `index.html`. No other changes are needed.

### Future integration points

- **Event library** — groups and their profiles are plain serialisable objects; a library is a JSON array of group exports.
- **WebSocket streams** — `CurveModel.evaluate(t, params)` can be called per-tick against a live timestamp to overlay a real sensor trace on the designed curve.
- **Timeline editor** — the x-axis already operates in absolute seconds; sequencing multiple events is a matter of rendering them at their respective `delay` offsets.
- **ML classification** — the group JSON export format maps directly to classifier inputs; `peakRange`, `rise`, and `decay` are the natural feature descriptors.
- **Per-channel subplots** — the graph renderer currently amplitude-normalises all channels to a shared axis; a future mode could stack independent Y axes per channel type for reading physical values directly.