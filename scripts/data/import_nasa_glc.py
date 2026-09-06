import argparse
import csv
import datetime
import json
import os
import sys

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Ingest local NASA GLC CSV data")
    parser.add_argument("--input", required=True, help="Input CSV file path")
    parser.add_argument("--output", required=True, help="Output JSON or SQL file path")
    return parser.parse_args()

def normalize_date(date_str):
    """Normalize date strings to ISO format YYYY-MM-DD."""
    if not date_str:
        return None
    date_str = date_str.strip()
    formats = (
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y",
        "%m-%d-%Y %H:%M",
        "%m-%d-%Y",
        "%d-%m-%Y %H:%M",
        "%d-%m-%Y",
    )
    for fmt in formats:
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

    with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        headers = {h.lower(): h for h in reader.fieldnames} if reader.fieldnames else {}
        
        # Column mapping logic
        col_map = {
            'latitude': next((headers[h] for h in headers if h in ('latitude', 'lat') or h.endswith('latitude')), None),
            'longitude': next((headers[h] for h in headers if h in ('longitude', 'lon', 'lng') or h.endswith('longitude')), None),
            'event_date': next((headers[h] for h in headers if h in ('event_date', 'date') or h.endswith('event_date') or h.endswith('date')), None),
            'trigger': next((headers[h] for h in headers if 'trigger' in h), None),
            'category': next((headers[h] for h in headers if 'category' in h), None),
            'country': next((headers[h] for h in headers if 'country' in h), None),
            'admin_region': next((headers[h] for h in headers if any(k in h for k in ('admin', 'division', 'state', 'region'))), None),
        }

        for req in required_cols:
            if not col_map.get(req):
                print(f"ERROR: Missing required column related to '{req}'", file=sys.stderr)
                sys.exit(1)

        # Optional extra columns
        id_col = next((headers[h] for h in headers if 'event_id' in h or h == 'id'), None)
        fat_col = next((headers[h] for h in headers if 'fatality' in h or 'fatalities' in h), None)
        desc_col = next((headers[h] for h in headers if 'location_description' in h or 'description' in h), None)

        for row in reader:
            total_rows += 1
            try:
                lat = float(row[col_map['latitude']])
                lon = float(row[col_map['longitude']])
            except (ValueError, TypeError):
                skipped_rows += 1
                continue

            # Sikkim bounding box filter (lat 27.0-28.2, lon 88.0-88.9)
            if not (27.0 <= lat <= 28.2 and 88.0 <= lon <= 88.9):
                filtered_rows += 1
                continue

            date_val = normalize_date(row[col_map['event_date']])
            if not date_val:
                skipped_rows += 1
                continue

            raw_id = row[id_col].strip() if id_col and row.get(id_col) else str(valid_rows + 1)
            event_id = f"glc-{raw_id}" if not raw_id.startswith("glc-") else raw_id

            fatalities = 0
            if fat_col and row.get(fat_col):
                try:
                    fatalities = int(float(row[fat_col]))
                except (ValueError, TypeError):
                    fatalities = 0

            desc = ""
            if desc_col and row.get(desc_col):
                desc = row[desc_col].strip()
            
            clean_row = {
                'id': event_id,
                'event_date': date_val,
                'latitude': lat,
                'longitude': lon,
                'trigger': row[col_map['trigger']] or 'unknown',
                'category': row[col_map['category']] or 'landslide',
                'fatalities': fatalities,
                'description': desc,
                'country': row[col_map['country']],
                'admin_region': row[col_map['admin_region']],
                'provenance': 'REAL',
                'source': 'NASA GLC bulk import'
            }
            output_data.append(clean_row)
            valid_rows += 1

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    if output_path.endswith('.sql'):
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("-- ============================================================\n")
            f.write("-- Real NASA Global Landslide Catalog (GLC) Events for Sikkim\n")
            f.write("-- Bounding Box: lat 27.0-28.2, lon 88.0-88.9\n")
            f.write("-- Provenance: REAL | Source: NASA GLC bulk import\n")
            f.write("-- Additive import: existing seed fixtures and 2025 events preserved\n")
            f.write("-- ============================================================\n\n")
            f.write("INSERT INTO landslide_events (id, date, latitude, longitude, geometry, trigger, category, fatalities, description, source) VALUES\n")
            lines = []
            for r in output_data:
                esc_desc = r['description'].replace("'", "''")
                esc_trig = r['trigger'].replace("'", "''")
                esc_cat = r['category'].replace("'", "''")
                esc_src = r['source'].replace("'", "''")
                line = f"  ('{r['id']}', '{r['event_date']}', {r['latitude']}, {r['longitude']}, ST_SetSRID(ST_MakePoint({r['longitude']}, {r['latitude']}), 4326), '{esc_trig}', '{esc_cat}', {r['fatalities']}, '{esc_desc}', '{esc_src}')"
                lines.append(line)
            f.write(",\n".join(lines))
            f.write("\nON CONFLICT (id) DO NOTHING;\n")
    else:
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
