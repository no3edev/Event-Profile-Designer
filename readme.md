# Event Profile Designer

A browser-based tool for designing and comparing No3e sensor event signatures. Build physically plausible response curves, overlay multiple profiles, and export them as JSON or SVG.

[RUN DEMO](https://no3edev.github.io/Event-Profile-Designer/)

---

## Getting started

Open `event-profile-designer.html` in any modern browser. No installation, build step, or server required.

---

## Concepts

An **event profile** represents how a sensor responds over time to a physical event — a person walking past, a gas stove igniting, traffic idling nearby. The shape is governed by five parameters:

| Parameter | What it controls |
|-----------|-----------------|
| Rise | How quickly the sensor reacts (attack speed) |
| Decay | How long the tail lingers after the peak |
| Amplitude | Peak response magnitude (0–1) |
| Delay | Offset before the event begins |
| Duration | Time-stretch factor applied to the whole curve |

The underlying model is:

```
y = (amplitude / peak_value) × (1 − e^(−τ/rise)) × e^(−τ/decay)

where τ = (t − delay) / duration
```

This produces a physically plausible one-sided response with a smooth attack and an exponential tail.

---

## Interface

### Left panel

- **Profile name** — rename the active profile.
- **Parameter sliders** — adjust Rise, Decay, Amplitude, Delay, and Duration. Values update the graph in real time.
- **Profiles list** — all open profiles. Click to make one active. Use the buttons to toggle visibility (●/○), duplicate (⧉), or delete (✕). Double-click a name to rename inline.
- **Load preset** — populate the active profile from a built-in preset.

### Graph

The main canvas shows all visible profiles overlaid. Scroll or pinch to zoom; drag the background to pan.

Three **draggable handles** appear on the active profile:

| Handle | Location | What dragging does |
|--------|----------|--------------------|
| Delay (filled circle on x-axis) | Event start | Horizontal → shifts Delay |
| Peak (double-ring circle) | Curve maximum | Horizontal → adjusts Rise + Duration · Vertical → adjusts Amplitude |
| Tail (open circle) | Decay section | Horizontal → adjusts Decay |

All handle movements immediately sync back to the sliders.

---

## Display modes

Switch between modes using the segmented control in the top bar. Changing mode resets the zoom.

### Normalized shape

Each curve is independently scaled so its peak reaches y = 1.0. The time axis runs 0 → 1τ, normalised to each curve's own peak time. Amplitude and duration differences are stripped away — useful for comparing pure rise/decay character between profiles regardless of intensity.

> Draggable handles are hidden in this mode because the coordinate transform makes drag behaviour ambiguous.

### Real-time scale *(default)*

Shared time axis in seconds. Amplitudes at their true values. The x-axis auto-fits to the longest visible profile. Best for general editing.

### Absolute scale

Both axes are fixed: x is pinned 0–1200 s, y is 0–1. Nothing rescales when you edit or add profiles. Spatial relationships between profiles stay truthful and stable — the strongest, widest, or latest-starting profile always appears that way.

---

## Presets

| Preset | Characteristics |
|--------|----------------|
| cooking | Fast rise, medium decay, high amplitude — rapid VOC burst from heat |
| traffic | Slow rise, long decay, moderate amplitude — sustained background exposure |
| occupant | Medium rise, very long decay, mid amplitude — persistent presence signal |
| pedestrian | Very fast rise, short decay, high amplitude — brief transient |
| fragrance | Very fast rise, long decay, near-peak amplitude — intense lingering event |

---

## Export

### Export JSON

Exports the currently active profile. Format:

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

`peakRange` is derived from amplitude as `[amplitude × 0.85, amplitude × 1.15]`. The channel key (`voc`) reflects the profile's sensor channel — the architecture supports `co2` and `pm` for future channels. The `meta` block preserves all parameters needed to reconstruct the full curve.

### Export SVG

Generates a clean vector file containing axes and all visible curves, labelled with profile names. The output is Illustrator-compatible — no embedded bitmaps, no clipping masks, explicit stroke widths and colours.

### Import JSON

Loads a previously exported profile (or any compatible JSON) and creates a new profile entry. Sliders and the graph update immediately. Reads `voc`, `co2`, or `pm` channel blocks; falls back to defaults for missing fields.

---

## Multiple profiles

- **+ New** adds a blank profile.
- **⧉** duplicates the selected profile with a "copy" suffix.
- Profiles are automatically assigned distinct colours.
- Any number of profiles can be overlaid simultaneously; toggle individual visibility with the ●/○ button.

---

## Status bar

The bar at the bottom of the window shows live statistics for the active profile:

| Stat | Meaning |
|------|---------|
| Peak | Amplitude at the curve maximum |
| Time to peak | Seconds from t = 0 to the maximum |
| Decay to 10% | Seconds until the response falls to 10% of its peak |

A mode badge on the left shows the current display mode.

---

## Architecture notes

The codebase is organised into logical modules kept within a single HTML file for portability:

| Module | Responsibility |
|--------|---------------|
| `CurveModel` | Pure functions — `evaluate`, `sample`, `peakTime`, `peakValue`, `naturalEnd` |
| Profile manager | CRUD for profile objects, preset loading, colour assignment |
| Slider UI | Builds and synchronises parameter controls |
| Graph renderer | D3-based SVG rendering, zoom/pan, display mode transforms |
| Handle system | Draggable control points with inverse-scale drag math |
| Exporters | JSON serialisation, SVG string generation, file download |

### Extending to new sensor channels

Each profile carries a `channel` field (`'voc'` by default). To add CO₂ or particulate matter channels, set `profile.channel = 'co2'` before export — the JSON exporter will use it as the top-level key automatically.

### Future integration points

The tool is designed to slot into a larger No3e system:

- **Event library** — profiles are plain serialisable objects; a library is a JSON array of them.
- **WebSocket streams** — `CurveModel.evaluate(t, params)` can be called per-tick against a live timestamp to overlay a real sensor trace on the designed curve.
- **Timeline editor** — the x-axis already operates in absolute seconds; sequencing multiple events is a matter of rendering them at their respective `delay` offsets.
- **ML classification** — the JSON export format is the natural feature descriptor; `peakRange`, `rise`, and `decay` map directly to classifier inputs.
- **Multi-channel view** — each profile can carry per-channel params (`voc`, `co2`, `pm`) and the graph renderer can be extended to show stacked subplots.

---

## Browser compatibility

Tested in Chrome 120+, Firefox 121+, Safari 17+. Requires SVG and ES2020. No network requests are made at runtime — D3 is loaded from cdnjs at page load only.