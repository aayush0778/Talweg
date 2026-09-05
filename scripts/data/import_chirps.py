import argparse
import csv
import json
import datetime
import sys
from collections import defaultdict

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Ingest local CHIRPS daily rainfall CSV")
    parser.add_argument("--input", required=True, help="Input CSV file path")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    return parser.parse_args()

def normalize_date(date_str):
    """Normalize date strings to ISO format."""
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def get_rolling_sum(history, target_date_str, window_days):
    """Calculate rolling sum of precipitation over a given window."""
    target_date = datetime.datetime.strptime(target_date_str, "%Y-%m-%d")
    total = 0.0
    for i in range(window_days):
        d = (target_date - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        total += history.get(d, 0.0)
    return round(total, 2)

def process_data(input_path, output_path):
    """Process CHIRPS data: validate, aggregate, and tag."""
    required_cols = {'date', 'latitude', 'longitude', 'precipitation_mm'}
    
    # Store daily precip per location: (lat, lon) -> { date_str: precip_val }
    precip_history = defaultdict(dict)
    
    with open(input_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = {h.lower(): h for h in reader.fieldnames} if reader.fieldnames else {}
        
        col_map = {}
        for req in required_cols:
            found = False
            for h in headers:
                if req in h or (req == 'latitude' and 'lat' in h) or (req == 'longitude' and 'lon' in h) or (req == 'precipitation_mm' and 'precip' in h):
                    col_map[req] = headers[h]
                    found = True
                    break
            if not found:
                print(f"ERROR: Missing required column related to '{req}'", file=sys.stderr)
                sys.exit(1)

        for row in reader:
            try:
                lat = float(row[col_map['latitude']])
                lon = float(row[col_map['longitude']])
                precip = float(row[col_map['precipitation_mm']])
            except (ValueError, TypeError):
                continue
                
            date_val = normalize_date(row[col_map['date']])
            if date_val:
                precip_history[(lat, lon)][date_val] = precip

    output_data = []
    
    for loc, history in precip_history.items():
        lat, lon = loc
        for date_str, daily_val in history.items():
            record = {
                'date': date_str,
                'latitude': lat,
                'longitude': lon,
                'rainfall_24h': daily_val,
                'rainfall_3d': get_rolling_sum(history, date_str, 3),
                'rainfall_7d': get_rolling_sum(history, date_str, 7),
                'provenance': {
                    'rainfall_24h': 'REAL',
                    'rainfall_3d': 'DERIVED',
                    'rainfall_7d': 'DERIVED'
                }
            }
            output_data.append(record)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Processed {len(output_data)} rainfall records with rolling aggregates.")

if __name__ == '__main__':
    args = parse_args()
    process_data(args.input, args.output)
