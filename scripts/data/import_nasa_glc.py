import argparse
import csv
import json
import datetime
import sys

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Ingest local NASA GLC CSV data")
    parser.add_argument("--input", required=True, help="Input CSV file path")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    return parser.parse_args()

def normalize_date(date_str):
    """Normalize date strings to ISO format YYYY-MM-DD."""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def process_data(input_path, output_path):
    """Process NASA GLC data: validate, filter, normalize, and tag."""
    required_cols = {'event_date', 'latitude', 'longitude', 'trigger', 'category', 'country', 'admin_region'}
    
    total_rows = 0
    filtered_rows = 0
    valid_rows = 0
    skipped_rows = 0
    
    output_data = []

    with open(input_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = {h.lower(): h for h in reader.fieldnames} if reader.fieldnames else {}
        
        # Column mapping logic
        col_map = {}
        for req in required_cols:
            found = False
            for h in headers:
                if req in h or (req == 'latitude' and 'lat' in h) or (req == 'longitude' and 'lon' in h) or (req == 'event_date' and 'date' in h):
                    col_map[req] = headers[h]
                    found = True
                    break
            if not found:
                print(f"ERROR: Missing required column related to '{req}'", file=sys.stderr)
                sys.exit(1)

        for row in reader:
            total_rows += 1
            try:
                lat = float(row[col_map['latitude']])
                lon = float(row[col_map['longitude']])
            except (ValueError, TypeError):
                skipped_rows += 1
                continue

            # Sikkim bounding box filter
            if not (27.0 <= lat <= 28.2 and 88.0 <= lon <= 89.0):
                filtered_rows += 1
                continue

            date_val = normalize_date(row[col_map['event_date']])
            if not date_val:
                skipped_rows += 1
                continue
            
            clean_row = {
                'event_date': date_val,
                'latitude': lat,
                'longitude': lon,
                'trigger': row[col_map['trigger']],
                'category': row[col_map['category']],
                'country': row[col_map['country']],
                'admin_region': row[col_map['admin_region']],
                'provenance': 'REAL',
                'source': 'nasa_glc'
            }
            output_data.append(clean_row)
            valid_rows += 1

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

    print("Processing complete.")
    print(f"Total rows: {total_rows}")
    print(f"Filtered rows (out of bounds): {filtered_rows}")
    print(f"Skipped rows (invalid data): {skipped_rows}")
    print(f"Valid rows exported: {valid_rows}")

if __name__ == '__main__':
    args = parse_args()
    process_data(args.input, args.output)
