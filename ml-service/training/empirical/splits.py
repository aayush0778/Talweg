"""Leakage-safe dataset splits (spec §10.3).

Never allow:
  - the same event in train and test;
  - adjacent duplicate points across splits;
  - future rainfall information leaking into past prediction;
  - post-event observations used as pre-event predictors.

Split strategies (choose per dataset):
  temporal_split      — train on earlier periods, test on later (default)
  spatial_group_split — hold out spatial blocks (zone/grid tiles)
  event_group_split   — group by event_id so all samples of an event stay together
"""

from __future__ import annotations

from typing import Dict, List, Sequence, Tuple


def temporal_split(rows: Sequence[dict], date_key: str = "date", train_frac: float = 0.8) -> Tuple[List[dict], List[dict]]:
    if not 0.0 < train_frac < 1.0:
        raise ValueError("train_frac must be in (0, 1)")
    ordered = sorted(rows, key=lambda r: r[date_key])
    cut = int(len(ordered) * train_frac)
    if cut == 0 or cut == len(ordered):
        raise ValueError("Temporal split produced an empty partition — dataset too small")
    return ordered[:cut], ordered[cut:]


def event_group_split(rows: Sequence[dict], event_key: str = "event_id", train_frac: float = 0.8) -> Tuple[List[dict], List[dict]]:
    """Group split by event: every sample of an event lands in the same side."""
    groups: Dict[str, List[dict]] = {}
    for r in rows:
        groups.setdefault(str(r[event_key]), []).append(r)
    ids = sorted(groups.keys())
    cut = int(len(ids) * train_frac)
    if cut == 0 or cut == len(ids):
        raise ValueError("Event-group split produced an empty partition — too few events")
    train: List[dict] = []
    test: List[dict] = []
    for i, eid in enumerate(ids):
        (train if i < cut else test).extend(groups[eid])
    return train, test


def spatial_group_split(rows: Sequence[dict], zone_key: str = "zone_id", train_frac: float = 0.8) -> Tuple[List[dict], List[dict]]:
    groups: Dict[str, List[dict]] = {}
    for r in rows:
        groups.setdefault(str(r[zone_key]), []).append(r)
    ids = sorted(groups.keys())
    cut = int(len(ids) * train_frac)
    if cut == 0 or cut == len(ids):
        raise ValueError("Spatial-group split produced an empty partition — too few zones")
    train: List[dict] = []
    test: List[dict] = []
    for i, zid in enumerate(ids):
        (train if i < cut else test).extend(groups[zid])
    return train, test


def assert_no_event_overlap(train: Sequence[dict], test: Sequence[dict], event_key: str = "event_id") -> None:
    train_events = {str(r[event_key]) for r in train if r.get(event_key) is not None}
    for r in test:
        eid = r.get(event_key)
        if eid is not None and str(eid) in train_events:
            raise ValueError(f"Event {eid} appears in both train and test — leakage")
