import argparse
import json
import sys

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Build historical replay records by matching events and rainfall")
    parser.add_argument("--events", required=True, help="Cleaned events JSON from import_nasa_glc.py")
    parser.add_argument("--rainfall", required=True, help="Cleaned rainfall JSON from import_chirps.py")
    parser.add_argument("--output", required=True, help="Output SQL INSERT file")
    parser.add_argument("--json-output", required=True, help="Output JSON intermediate file")
    return parser.parse_args()

def build_replays(events_path, rainfall_path, output_sql, output_json):
    """Match events with rainfall data and construct historical replays."""
    with open(events_path, 'r', encoding='utf-8') as f:
        events = json.load(f)
    with open(rainfall_path, 'r', encoding='utf-8') as f:
        rainfall = json.load(f)
        
    # Organize rainfall by date for faster matching
    rainfall_by_date = {}
    for r in rainfall:
        date = r['date']
        if date not in rainfall_by_date:
            rainfall_by_date[date] = []
        rainfall_by_date[date].append(r)
        
    replays = []
    matched_count = 0
    
    for event in events:
        event_date = event['event_date']
        lat = event['latitude']
        lon = event['longitude']
        
        best_match = None
        min_dist = float('inf')
        
        # Match nearest rainfall on the same date within 0.5 degrees
        if event_date in rainfall_by_date:
            for r in rainfall_by_date[event_date]:
                dist = ((r['latitude'] - lat)**2 + (r['longitude'] - lon)**2)**0.5
                if dist < min_dist and dist <= 0.5:
                    min_dist = dist
                    best_match = r
        
        replay = {
            'event_date': event_date,
            'latitude': lat,
            'longitude': lon,
            'event_category': event['category'],
            'event_trigger': event['trigger'],
            'source': 'nasa_glc'
        }
        
        if best_match:
            matched_count += 1
            replay['rainfall_24h'] = best_match['rainfall_24h']
            replay['rainfall_3d'] = best_match['rainfall_3d']
            replay['rainfall_7d'] = best_match['rainfall_7d']
            replay['data_quality'] = 'real_replay'
            replay['provenance_tags'] = {
                'event': 'REAL',
                'rainfall_24h': 'REAL',
                'rainfall_3d': 'DERIVED',
                'rainfall_7d': 'DERIVED'
            }
        else:
            replay['rainfall_24h'] = None
            replay['rainfall_3d'] = None
            replay['rainfall_7d'] = None
            replay['data_quality'] = 'methodology_only'
            replay['provenance_tags'] = {
                'event': 'REAL'
            }
            
        replays.append(replay)
        
    # Write intermediate JSON
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(replays, f, indent=2)
        
    # Write SQL
    with open(output_sql, 'w', encoding='utf-8') as f:
        f.write("BEGIN;\n\n")
        for r in replays:
            prov_json = json.dumps(r['provenance_tags']).replace("'", "''")
            rf_24 = r['rainfall_24h'] if r['rainfall_24h'] is not None else 'NULL'
            rf_3 = r['rainfall_3d'] if r['rainfall_3d'] is not None else 'NULL'
            rf_7 = r['rainfall_7d'] if r['rainfall_7d'] is not None else 'NULL'
            
            # Escape strings
            category = r['event_category'].replace("'", "''") if r['event_category'] else ""
            trigger = r['event_trigger'].replace("'", "''") if r['event_trigger'] else ""
            
            sql = f"""INSERT INTO historical_event_replays 
(event_date, latitude, longitude, event_category, event_trigger, source, data_quality, rainfall_24h, rainfall_3d, rainfall_7d, provenance_tags) 
VALUES 
('{r['event_date']}', {r['latitude']}, {r['longitude']}, '{category}', '{trigger}', '{r['source']}', '{r['data_quality']}', {rf_24}, {rf_3}, {rf_7}, '{prov_json}'::jsonb);\n"""
            f.write(sql)
        f.write("\nCOMMIT;\n")
        
    print(f"Total events: {len(events)}")
    print(f"Events matched with actual rainfall data: {matched_count}")

if __name__ == '__main__':
    args = parse_args()
    build_replays(args.events, args.rainfall, args.output, args.json_output)
