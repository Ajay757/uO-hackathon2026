#!/usr/bin/env python3
"""Quick test to verify conflict_resolver is working"""

from ConflictResolver import conflict_resolver, load_state
import json

# Load conflicts
with open("conflicts.json", "r") as f:
    conflicts = json.load(f)

# Test with first conflict only
test_conflict = [conflicts[0]]
acids = test_conflict[0][:-1]

print(f"Testing conflict: {acids}")
print("\nBefore:")
state = load_state()
for acid in acids:
    for plane in state:
        if plane["ACID"] == acid:
            print(f"  {acid}: alt={plane['altitude']}, speed={plane['aircraft speed']:.1f}, changes={plane['changes']}")
            break

# Run resolver
conflict_resolver(test_conflict)

print("\nAfter:")
state = load_state()
for acid in acids:
    for plane in state:
        if plane["ACID"] == acid:
            print(f"  {acid}: alt={plane['altitude']}, speed={plane['aircraft speed']:.1f}, changes={plane['changes']}")
            break

print("\n✅ Test complete!")

