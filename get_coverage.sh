#!/bin/bash
echo "Running tests with coverage..."
bun test --coverage > test_output.log 2>&1
echo "Coverage output saved to test_output.log"
echo "=== COVERAGE SUMMARY ==="
tail -20 test_output.log
