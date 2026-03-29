# HIZ Zone System

The Home Ignition Zone (HIZ) framework divides the area around a structure into 5 concentric layers. Each layer has different fire risk characteristics and required actions.

## Zone Layers

| Layer | Name | Distance | Action Count | Map Color |
|---|---|---|---|---|
| 0 | The House Itself | Structure | 5 | Red |
| 1 | Noncombustible Zone | 0–5 ft | 5 | Orange-red |
| 2 | Lean, Clean, Green | 5–30 ft | 3 | Orange |
| 3 | Reduced Fuel Zone | 30–100 ft | 2 | Yellow |
| 4 | Access & Community | 100+ ft | 2 | Green |

**Total: 17 zone actions** — all seeded from `003_seed_zone_actions.sql`.

## Zone Engine (`app/zone/engine.py`)

### `get_zone_actions(jurisdiction_code, season)`

Returns all 17 actions organized by layer with seasonal boosting applied. Zone actions are universal — they are not filtered by jurisdiction.

**Seasonal boost logic** (applied per action):

```python
boost = 0.0

# +0.15 if the action's seasonal_peak list includes the current month
if current_month in seasonal_peak:
    boost += 0.15

# +0.10 if it's fire season AND the action is Layer 0 or 1
if current_month in {"june","july","august","september"} and action["layer"] in (0, 1):
    boost += 0.10

# Capped at 1.0
effective_priority = min(1.0, priority_score + boost)
```

Actions within each layer are sorted by `effective_priority` descending before returning.

### Season Override

Passing `season="summer"` overrides the auto-detected season from the current month. This is used by:
- Admin UI to preview "what would users see in summer"
- Tests to verify seasonal behavior without waiting for the right month

### `get_top_actions(n)`

Returns the top N actions across all layers by `effective_priority`. Used by the property overview page for the priority action summary.

## Priority Scores (Base, Before Boost)

| Action | Base Score |
|---|---|
| Screen all vents | 0.98 |
| Clear under-deck debris | 0.97 |
| Clean gutters and roof debris | 0.95 |
| Remove combustibles 0–5ft | 0.94 |
| Seal gaps and weatherstripping | 0.88 |
| Replace organic mulch with gravel | 0.88 |
| Eliminate ladder fuels | 0.85 |
| Create evacuation plan | 0.85 |
| Go-bag | 0.82 |
| Noncombustible fence at structure | 0.82 |
| Horizontal canopy spacing | 0.78 |
| Enclose deck underside | 0.78 |
| Remove dead vegetation (5–30ft) | 0.72 |
| Clear outbuildings and propane | 0.68 |
| Thin trees (30–100ft) | 0.65 |
| Driveway access (12ft/13.5ft) | 0.60 |
| Reflective address signage | 0.58 |

## Seasonal Peak Months

Actions with seasonal peaks get +0.15 in-peak months:

- **Gutter/roof debris** → April, May, June, September, October (pre/post season + fall cleanup)
- **Vent screening** → April, May, June, October, November (shoulder seasons for installation)
- **Gap sealing** → March, April, May, October, November
- **Go-bag** → May–September (peak evacuation risk period)
- **Evacuation plan** → March, June, September (review checkpoints)
- **Ladder fuels** → March–April, October–February (dormant season tree work)
- **Under-deck debris** → April–October (peak leaf fall + fire season)
