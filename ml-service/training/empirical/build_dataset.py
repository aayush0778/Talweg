"""Event-aligned dataset builder (spec §10.1) — scaffolding.

Target structure (spec §10):
  event + rainfall time series + DEM/terrain + soil + moisture
  + land cover/vegetation + historical susceptibility + negative samples

Positive samples (§10.1): for each verified landslide —
  - spatially match environmental features;
  - construct event-centered rainfall windows;
  - retain event timestamp;
  - preserve source precision.

This module defines the row contract and window construction; the actual
extraction requires real aligned observations (CHIRPS/IMD + DEM + soil) and
is intentionally not runnable without them.
"""

from __future__ import annotations

from typing import List, Optional


def event_centered_windows(
    daily_rainfall: List[float],
    event_index: int,
) -> dict[str, Optional[float]]:
    """Construct event-centered rainfall windows from a daily series.

    `daily_rainfall` is ordered oldest→newest with the event day AT
    `event_index`. Windows never read beyond the event day (no future leak).
    """
    if event_index < 0 or event_index >= len(daily_rainfall):
        raise IndexError("event_index out of range")

    def window(days: int) -> Optional[float]:
        start = max(0, event_index - days + 1)
        vals = daily_rainfall[start : event_index + 1]
        # Only return a value when the full window has coverage (no silent
        # partial windows pretending to be complete sums).
        if len(vals) < days:
            return None
        return round(sum(vals), 3)

    return {
        "rainfall_24h": window(1),
        "rainfall_3d": window(3),
        "rainfall_5d": window(5),
        "rainfall_7d": window(7),
    }


def positive_row(event: dict, rainfall_windows: dict, terrain: dict, soil: dict) -> dict:
    """Assemble one positive training row; retains timestamp + precision."""
    return {
        "event_id": event["event_id"],
        "label": 1,
        "date": event["date"],
        "location_precision": event.get("location_precision", "unknown"),
        "source": event.get("source", "unknown"),
        "zone_id": event.get("zone_id"),
        **rainfall_windows,
        **terrain,
        **soil,
    }
