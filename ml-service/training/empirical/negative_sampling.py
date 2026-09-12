"""Negative-sample construction for empirical training (spec §10.2).

Negatives must NOT be random points. This module documents and implements
the accepted strategies as pure functions over candidate rows so the
strategy is auditable and reproducible.

Strategies (spec §10.2):
  1. nearby_non_event     — sampled within a ring around verified events,
                            excluding any location with a recorded event
  2. matched_terrain      — sampled from terrain zones matched to event
                            conditions (slope/elevation bands) on non-event days
  3. non_event_days       — same locations as events on days without triggers
  4. spatial_separation   — stable zones spatially separated from the inventory
  5. temporal_controls    — pre-event windows at event locations that did not fail
"""

from __future__ import annotations

from typing import Iterable, Protocol


class CandidatePoint(Protocol):
    event_id: str | None  # None for non-event candidates
    latitude: float
    longitude: float
    date: str
    slope: float | None
    elevation_m: float | None


def assert_no_label_leakage(positives: Iterable[CandidatePoint], negatives: Iterable[CandidatePoint]) -> None:
    """Reject negatives that duplicate a positive event location+date."""
    pos_keys = {(round(p.latitude, 4), round(p.longitude, 4), p.date) for p in positives}
    for n in negatives:
        key = (round(n.latitude, 4), round(n.longitude, 4), n.date)
        if key in pos_keys:
            raise ValueError(f"Negative sample duplicates positive event at {key} — label leakage")
