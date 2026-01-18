#!/usr/bin/env python3
"""
Test script for conflict_resolver function.
Shows before/after state to verify conflicts are being resolved.
"""

import json
from ConflictResolver import conflict_resolver, load_state, load_aircraft_types

def print_plane_info(plane, aircraft_types):
    """Print formatted plane information"""
    plane_type = plane.get("Plane type", "Unknown")
    constraints = aircraft_types.get(plane_type, {})
    alt_constraints = constraints.get("altitude", {})
    speed_constraints = constraints.get("speed", {})
    
    print(f"  {plane['ACID']:10s} | Type: {plane_type:20s} | "
          f"Alt: {plane['altitude']:6d} ({alt_constraints.get('min', '?')}-{alt_constraints.get('max', '?')}) | "
          f"Speed: {plane['aircraft speed']:6.1f} ({speed_constraints.get('min', '?')}-{speed_constraints.get('max', '?')}) | "
          f"Changes: {plane['changes']}")

def test_conflict_resolver():
    """Test the conflict_resolver function"""
    
    print("=" * 80)
    print("CONFLICT RESOLVER TEST")
    print("=" * 80)
    
    # Load conflicts
    with open("conflicts.json", "r") as f:
        conflicts = json.load(f)
    
    print(f"\nTotal conflicts found: {len(conflicts)}")
    
    # Test with first 3 conflicts
    test_conflicts = conflicts[:3]
    print(f"Testing with first {len(test_conflicts)} conflicts:\n")
    
    for i, conflict in enumerate(test_conflicts):
        acids = conflict[:-1]  # Remove timestamp
        timestamp = conflict[-1]
        print(f"Conflict {i+1}: {acids} (timestamp: {timestamp})")
    
    # Load initial state
    print("\n" + "=" * 80)
    print("BEFORE RESOLUTION")
    print("=" * 80)
    
    state_before = load_state()
    aircraft_types = load_aircraft_types()
    
    # Show planes involved in conflicts
    all_conflict_acids = set()
    for conflict in test_conflicts:
        all_conflict_acids.update(conflict[:-1])
    
    print(f"\nPlanes involved in test conflicts ({len(all_conflict_acids)} planes):")
    print("-" * 80)
    print(f"{'ACID':10s} | {'Type':20s} | {'Altitude':30s} | {'Speed':30s} | Changes")
    print("-" * 80)
    
    planes_before = {}
    for acid in sorted(all_conflict_acids):
        for plane in state_before:
            if plane["ACID"] == acid:
                planes_before[acid] = plane.copy()
                print_plane_info(plane, aircraft_types)
                break
    
    # Run the resolver
    print("\n" + "=" * 80)
    print("RUNNING CONFLICT RESOLVER...")
    print("=" * 80)
    
    conflict_resolver(test_conflicts)
    
    # Load state after resolution
    print("\n" + "=" * 80)
    print("AFTER RESOLUTION")
    print("=" * 80)
    
    state_after = load_state()
    
    print(f"\nPlanes after resolution:")
    print("-" * 80)
    print(f"{'ACID':10s} | {'Type':20s} | {'Altitude':30s} | {'Speed':30s} | Changes")
    print("-" * 80)
    
    planes_after = {}
    for acid in sorted(all_conflict_acids):
        for plane in state_after:
            if plane["ACID"] == acid:
                planes_after[acid] = plane.copy()
                print_plane_info(plane, aircraft_types)
                break
    
    # Show what changed
    print("\n" + "=" * 80)
    print("CHANGES SUMMARY")
    print("=" * 80)
    
    changes_found = False
    for acid in sorted(all_conflict_acids):
        before = planes_before.get(acid)
        after = planes_after.get(acid)
        
        if before and after:
            alt_changed = before["altitude"] != after["altitude"]
            speed_changed = before["aircraft speed"] != after["aircraft speed"]
            changes_incremented = after["changes"] > before["changes"]
            
            if alt_changed or speed_changed or changes_incremented:
                changes_found = True
                print(f"\n{acid}:")
                if alt_changed:
                    print(f"  Altitude: {before['altitude']} → {after['altitude']} "
                          f"({after['altitude'] - before['altitude']:+d} ft)")
                if speed_changed:
                    print(f"  Speed: {before['aircraft speed']:.1f} → {after['aircraft speed']:.1f} "
                          f"({after['aircraft speed'] - before['aircraft speed']:+.1f} knots)")
                if changes_incremented:
                    print(f"  Changes counter: {before['changes']} → {after['changes']}")
    
    if not changes_found:
        print("\n⚠️  No changes detected. This could mean:")
        print("   - All planes are already at their altitude/speed limits")
        print("   - Conflicts couldn't be resolved with available adjustments")
        print("   - Check the constraints and current state above")
    else:
        print("\n✅ Changes detected! Conflict resolver is working.")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    test_conflict_resolver()

