#!/usr/bin/env python3
"""
deploy_smoke_test.py — TALGWG Deployment Smoke Test
Automated verification script to validate end-to-end deployment health
on Railway or localhost in accordance with Handbook Pages 11 and 12.
"""

import sys
import json
import argparse
import time
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

def check_endpoint(name: str, url: str, expected_status=200, validator=None):
    start = time.time()
    req = Request(url, headers={'User-Agent': 'TALWEG-SmokeTest/1.0'})
    try:
        with urlopen(req, timeout=12) as response:
            status = response.getcode()
            duration_ms = int((time.time() - start) * 1000)
            if status != expected_status:
                return False, f'DTTP {status} (expected {expected_status})', duration_ms
            
            if validator:
                body = response.read().decode('utf-8', errors='replace')
                ok, msg = validator(body)
                if not ok:
                    return False, f"Validation failed: {msg}", duration_ms
            return True, "OK", duration_ms
    except HTTPError as e:
        duration_ms = int((time.time() - start) * 1000)
        return False, f'DTTP {e.code}: {e.reason}', duration_ms
    except URLError as e:
        duration_ms = int((time.time() - start) * 1000)
        return False, f'Connection error: {e.reason}', duration_ms
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        return False, f'Error: {str(e)}', duration_ms

def validate_health(body: str):
    data = json.loads(body)
    if data.get('status') == 'ok':
        return True, f"status: {data.get('status')}, db: {data.get('database')}"
    return False, f"Unexpected health response: {data}"

def validate_regions(body: str):
    data = json.loads(body)
    if isinstance(data, list) and len(data) > 0 and 'bounds' in data[0]:
        return True, f"{len(data)} region(s) with spatial bounds"
    return False, "Invalid regions list format"

def validate_zones(body: str):
    data = json.loads(body)
    if isinstance(data, list) and len(data) >= 4:
        return True, f'{len(data)} risk zones available'
    return False, 'Missing risk zones'

def validate_replays_list(body: str):
    data = json.loads(body)
    if not isinstance(data, list) or len(data) == 0:
        return False, 'Replay list is empty'
    has_real = any(item.get('data_quality') == 'real_replay' for item in data)
    if has_real:
        return True, f"{len(data)} replays (includes verified REAL GLC event)"
    return False, 'No verified real_replay record found in list'

def validate_real_replay(body: str):
    data = json.loads(body)
    val = data.get('validation', {})
    tal = data.get('talweg', {})
    inp = data.get('inputs', {})
    
    if val.get('status') != 'real_replay':
        return False, f"validation.status was {val.get('status')}, expected real_replay"
    if not tal.get('flagged'):
        return False, 'Real event was not flagged'
    rf24_prov = inp.get('rainfall_24h', {}).get('provenance', {}).get('type')
    if rf24_prov != 'REAL':
        return False, f"rainfall_24h provenance was {rf24_prov}, expected REAL"
    return True, f"Flagged: {tal.get('flagged')} (Score: {tal.get('risk_score')}, Provenance: REAL)"

def validate_summary(body: str):
    data = json.loads(body)
    if data.get('status') == 'methodology_only' and data.get('metrics') is None:
        return True, f'Empirical counts (Real: {data.get("real_replay_count")}, Synth: {data.get("synthetic_replay_count")})'
    return False, 'Validation summary fabricated premature metrics'

def validate_zone_runout(body: str):
    data = json.loads(body)
    if data.get('simulation_mode') != 'predictive_runout':
        return False, f"simulation_mode was {data.get('simulation_mode')}"
    if data.get('provenance_type') != 'SIMULATED':
        return False, f"provenance_type was {data.get('provenance_type')}"
    timeline = data.get('timeline', [])
    if len(timeline) != 5:
        return False, f"Expected 5 timeline steps, got {len(timeline)}"
    if timeline[0].get('flow_progress') != 0:
        return False, f"T-72h flow_progress must be 0, got {timeline[0].get('flow_progress')}"
    if timeline[-1].get('flow_progress') != 1:
        return False, f"EVENT flow_progress must be 1, got {timeline[-1].get('flow_progress')}"
    return True, f"5 steps, T-72h: 0% -> EVENT: 100% ({data.get('zone_id')})"

def validate_weather_forecast(body: str):
    data = json.loads(body)
    days = data.get('forecast_days', [])
    prov = data.get('provenance', {})
    if len(days) != 5:
        return False, f"Expected 5 forecast days, got {len(days)}"
    if prov.get('type') not in ('REAL', 'SYNTHETIC'):
        return False, f"Unexpected provenance type {prov.get('type')}"
    return True, f"5 days, Type: {prov.get('type')} ({prov.get('source', '')[:25]}...)"

def main():
    parser = argparse.ArgumentParser(description='TALWEG Deployment Smoke Test')
    parser.add_argument('--server', default='http://localhost:3001', help='API server base URL')
    parser.add_argument('--client', default='http://localhost:5173', help='Web client base URL')
    parser.add_argument('--dem-url', default='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/0/0/0.png', help='DEM tile endpoint')
    args = parser.parse_args()

    server = args.server.rstrip('/')
    client = args.client.rstrip('/')
    dem_tile = args.dem_url

    print('=' * 70)
    print('  TALWEG DEPLOYMENT SMOKE TEST (Handbook P1 Verification)')
    print(f'  Server Target: {server}')
    print(f'  Client Target: {client}')
    print('=' * 70)

    tests = [
        ('Client App Bundle', f'{client}/', 200, lambda b: (True, 'Loaded') if ('html' in b.lower() or '<!doctype' in b.lower()) else (False, 'Missing HTML doctype')),
        ('API Health Status', f'{server}/api/health', 200, validate_health),
        ('Regions (Spatial Bounds)', f'{server}/api/regions', 200, validate_regions),
        ('Risk Zones Inventory', f'{server}/api/risk-zones', 200, validate_zones),
        ('Historical Replays List', f'{server}/api/historical-replays', 200, validate_replays_list),
        ('Verified Real Event Replay', f'{server}/api/historical-replays/replay-real-glc-2023-10-04/replay', 200, validate_real_replay),
        ('Truthful Validation Summary', f'{server}/api/model-validation/summary', 200, validate_summary),
        ('Zone Predictive Runout', f'{server}/api/risk-zones/gangtok/hazard-progression', 200, validate_zone_runout),
        ('Zone Weather Forecast', f'{server}/api/forecast/gangtok', 200, validate_weather_forecast),
        ('3D Terrain Raster DEM Tile', dem_tile, 200, None),
    ]

    all_passed = True
    for name, url, status, val_fn in tests:
        passed, msg, ms = check_endpoint(name, url, expected_status=status, validator=val_fn)
        status_sym = '[PASS]' if passed else '[FAIL]'
        if not passed:
            all_passed = False
        print(f'  {status_sym:<7} {name:<28} {msg:<30} ({ms}ms)')

    print('-' * 70)
    if all_passed:
        print(f'  ALL {len(tests)} SMOKE TESTS PASSED! System is deployment-verified.')
        print('=' * 70)
        sys.exit(0)
    else:
        print('  SOME TESTS FAILED. See details above.')
        print('=' * 70)
        sys.exit(1)

if __name__ == '__main__':
    main()
