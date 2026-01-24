#!/bin/bash

# Extract timing results from console events in JSONL file
# Usage: ./extract-timing.sh timing-results.jsonl

JSONL_FILE=${1:-timing-results.jsonl}

echo "=== Extracting Timing Results from $JSONL_FILE ==="
echo ""

# Find the TIMING_RESULTS console log
cat "$JSONL_FILE" | \
  jq -r 'select(.type == "console" and (.message | contains("TIMING_RESULTS"))) | .message' | \
  while read -r line; do
    echo "$line"

    # Extract the JSON object from the console message
    # Format: "TIMING_RESULTS {json...}"
    json_part=$(echo "$line" | sed 's/^TIMING_RESULTS //')

    echo ""
    echo "=== Statistics ==="
    echo "$json_part" | jq '{min, max, median, mean, p95, p99}'

    echo ""
    echo "=== Threshold Analysis ==="
    echo "$json_part" | jq '{over5ms, over10ms, over20ms}'

    echo ""
    echo "=== Detection Rates ==="
    total_samples=$(echo "$json_part" | jq '.samples | length')
    over5=$(echo "$json_part" | jq '.over5ms')
    over10=$(echo "$json_part" | jq '.over10ms')
    over20=$(echo "$json_part" | jq '.over20ms')

    echo "Total samples: $total_samples"
    echo "Detectable at >5ms:  $over5 ($(awk "BEGIN {printf \"%.1f\", ($over5/$total_samples)*100}")%)"
    echo "Detectable at >10ms: $over10 ($(awk "BEGIN {printf \"%.1f\", ($over10/$total_samples)*100}")%)"
    echo "Detectable at >20ms: $over20 ($(awk "BEGIN {printf \"%.1f\", ($over20/$total_samples)*100}")%)"

    echo ""
    echo "=== First 10 Samples ==="
    echo "$json_part" | jq '.samples[0:10]'
  done
