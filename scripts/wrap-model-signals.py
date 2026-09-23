"""Wrap an event-level GA4 BigQuery JSON export for CRM import. No network calls."""
import argparse
import json
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('input');parser.add_argument('output')
parser.add_argument('--office-filter-verified',action='store_true',required=True)
parser.add_argument('--staff-exclusion-verified',action='store_true',required=True)
args=parser.parse_args()
raw=Path(args.input).read_text()
try: rows=json.loads(raw)
except json.JSONDecodeError: rows=[json.loads(line) for line in raw.splitlines() if line.strip()]
if not isinstance(rows,list): raise SystemExit('Input must be a JSON array or newline-delimited event rows.')
if Path(args.output).exists(): raise SystemExit('Output already exists; choose a new filename.')
Path(args.output).write_text(json.dumps({'schema':'clm-model-signals-v1','office_filter_active':True,'staff_exclusion_verified':True,'events':rows},indent=2))
print(f'Wrapped {len(rows)} events. Import this file in the CRM; do not publish it to GitHub.')
