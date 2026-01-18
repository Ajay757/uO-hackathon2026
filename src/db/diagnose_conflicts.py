#!/usr/bin/env python3
"""
Diagnostic script to understand why conflict counts fluctuate.
Shows what happens when running FlightPath.py multiple times.
"""

import json
from ConflictResolver import load_state, conflict_resolver
from main import generate_simulation_state

def analyze_conflicts():
    """Analyze conflict patterns across multiple runs"""
    
    print("=" * 80)
    print("CONFLICT COUNT DIAGNOSTIC")
    print("=" * 80)
    
    # Step 1: Reset to fresh state
    print("\n1. Resetting to fresh state from flights.json...")
    generate_simulation_state(
        planes_file="flights.json",
        output_file="simulation_state.json"
    )
    
    # Step 2: Load conflicts
    print("2. Loading conflicts from conflicts.json...")
    with open("conflicts.json", "r") as f:
        conflicts = json.load(f)
    
    print(f"   Found {len(conflicts)} conflicts")
    
    # Step 3: Show sample conflicts
    print("\n3. Sample conflicts (first 3):")
    for i, conflict in enumerate(conflicts[:3]):
        acids = conflict[:-1]
        timestamp = conflict[-1]
        print(f"   Conflict {i+1}: {acids} (at time {timestamp})")
    
    # Step 4: Check current state
    print("\n4. Current simulation state:")
    state = load_state()
    print(f"   Total planes: {len(state)}")
    
    # Count planes with changes
    planes_with_changes = [p for p in state if p.get("changes", 0) > 0]
    print(f"   Planes with changes > 0: {len(planes_with_changes)}")
    
    if planes_with_changes:
        print(f"   Sample planes with changes:")
        for p in planes_with_changes[:5]:
            print(f"     {p['ACID']}: changes={p['changes']}, alt={p['altitude']}")
    
    # Step 5: Analyze what resolver will do
    print("\n5. Analyzing what conflict_resolver will do...")
    
    # Get all unique ACIDs in conflicts
    all_acids_in_conflicts = set()
    for conflict in conflicts:
        all_acids_in_conflicts.update(conflict[:-1])
    
    print(f"   Unique planes in conflicts: {len(all_acids_in_conflicts)}")
    
    # Check which planes can be adjusted
    aircraft_types = json.load(open("plane_info.json"))
    state_by_acid = {p["ACID"]: p for p in state}
    
    adjustable_planes = []
    for acid in all_acids_in_conflicts:
        if acid not in state_by_acid:
            continue
        plane = state_by_acid[acid]
        plane_type = plane.get("Plane type")
        if plane_type not in aircraft_types:
            continue
        
        constraints = aircraft_types[plane_type]
        min_alt = constraints["altitude"]["min"]
        max_alt = constraints["altitude"]["max"]
        current_alt = plane["altitude"]
        
        can_go_up = current_alt + 1000 <= max_alt
        can_go_down = current_alt - 1000 >= min_alt
        
        if can_go_up or can_go_down:
            adjustable_planes.append({
                "acid": acid,
                "current_alt": current_alt,
                "can_go_up": can_go_up,
                "can_go_down": can_go_down,
                "changes": plane.get("changes", 0)
            })
    
    print(f"   Planes that can be adjusted: {len(adjustable_planes)}")
    print(f"   Sample adjustable planes:")
    for p in sorted(adjustable_planes, key=lambda x: x["changes"])[:5]:
        print(f"     {p['acid']}: alt={p['current_alt']}, changes={p['changes']}, "
              f"up={p['can_go_up']}, down={p['can_go_down']}")
    
    # Step 6: Run resolver and see what changes
    print("\n6. Running conflict_resolver...")
    conflict_resolver(conflicts)
    
    # Step 7: Check what changed
    print("\n7. After resolution:")
    state_after = load_state()
    planes_with_changes_after = [p for p in state_after if p.get("changes", 0) > 0]
    print(f"   Planes with changes > 0: {len(planes_with_changes_after)}")
    
    # Find what actually changed
    changes_made = []
    for p_after in state_after:
        acid = p_after["ACID"]
        if acid in all_acids_in_conflicts:
            p_before = state_by_acid.get(acid)
            if p_before:
                if (p_after["altitude"] != p_before["altitude"] or 
                    p_after["aircraft speed"] != p_before["aircraft speed"] or
                    p_after["changes"] > p_before["changes"]):
                    changes_made.append({
                        "acid": acid,
                        "alt_before": p_before["altitude"],
                        "alt_after": p_after["altitude"],
                        "speed_before": p_before["aircraft speed"],
                        "speed_after": p_after["aircraft speed"],
                        "changes_before": p_before.get("changes", 0),
                        "changes_after": p_after.get("changes", 0)
                    })
    
    print(f"   Planes actually modified: {len(changes_made)}")
    for change in changes_made[:5]:
        alt_change = change["alt_after"] - change["alt_before"]
        speed_change = change["speed_after"] - change["speed_before"]
        print(f"     {change['acid']}: "
              f"alt {change['alt_before']}→{change['alt_after']} ({alt_change:+d}), "
              f"speed {change['speed_before']:.1f}→{change['speed_after']:.1f} ({speed_change:+.1f}), "
              f"changes {change['changes_before']}→{change['changes_after']}")
    
    print("\n" + "=" * 80)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 80)
    print("\nNOTE: The conflict count fluctuation might be because:")
    print("  1. Resolver moves planes, which can create NEW conflicts with other planes")
    print("  2. Each run uses the modified state from previous runs")
    print("  3. The order of conflict processing matters")
    print("\nTo get consistent results, reset state before each run (already fixed in FlightPath.py)")

if __name__ == "__main__":
    analyze_conflicts()

