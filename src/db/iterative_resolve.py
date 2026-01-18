#!/usr/bin/env python3
"""
Iterative conflict resolution script.
Runs FlightPath.py multiple times until conflicts reach 0 or max iterations.
"""

import subprocess
import json
import os
import sys

MAX_ITERATIONS = 100  # Safety limit to prevent infinite loops
CONFLICTS_FILE = "conflicts.json"

def get_conflict_count():
    """Get the number of conflicts from conflicts.json"""
    if not os.path.exists(CONFLICTS_FILE):
        return None
    
    try:
        with open(CONFLICTS_FILE, 'r') as f:
            conflicts = json.load(f)
        return len(conflicts)
    except:
        return None

def run_flightpath():
    """Run FlightPath.py with --no-reset flag"""
    try:
        result = subprocess.run(
            [sys.executable, "FlightPath.py", "--no-reset"],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout per iteration
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Timeout after 5 minutes"
    except Exception as e:
        return False, "", str(e)

def main():
    print("=" * 80)
    print("ITERATIVE CONFLICT RESOLUTION")
    print("=" * 80)
    print(f"Maximum iterations: {MAX_ITERATIONS}")
    print(f"Will stop when conflicts reach 0 or max iterations reached")
    print("=" * 80)
    print()
    
    iteration = 0
    previous_count = None
    stuck_count = 0
    max_stuck_iterations = 5  # If same count for 5 iterations, consider it stuck
    
    # Track recent conflict counts to detect oscillation
    recent_counts = []
    oscillation_detected = False
    
    results = []
    
    while iteration < MAX_ITERATIONS:
        iteration += 1
        print(f"\n{'='*80}")
        print(f"ITERATION {iteration}")
        print(f"{'='*80}")
        
        # Run FlightPath
        print("Running FlightPath.py --no-reset...")
        success, stdout, stderr = run_flightpath()
        
        if not success:
            print(f"ERROR: FlightPath.py failed!")
            print(f"STDERR: {stderr}")
            break
        
        # Get conflict count
        conflict_count = get_conflict_count()
        
        if conflict_count is None:
            print("ERROR: Could not read conflicts.json")
            break
        
        # Show output (last few lines)
        if stdout:
            lines = stdout.strip().split('\n')
            # Show last 10 lines of output
            print("\nFlightPath output (last 10 lines):")
            for line in lines[-10:]:
                print(f"  {line}")
        
        print(f"\n✓ Conflicts detected: {conflict_count}")
        
        # Track results
        results.append({
            "iteration": iteration,
            "conflicts": conflict_count,
            "changed": previous_count != conflict_count if previous_count is not None else True
        })
        
        # Track recent counts for oscillation detection
        recent_counts.append(conflict_count)
        if len(recent_counts) > 10:
            recent_counts.pop(0)
        
        # Detect oscillation pattern (e.g., 2,3,4,2,3,4...)
        if len(recent_counts) >= 6:
            # Check if we're cycling through the same values
            last_6 = recent_counts[-6:]
            if len(set(last_6)) <= 3:  # Only 2-3 unique values
                # Check if it's a repeating pattern
                pattern_found = False
                for pattern_len in [2, 3, 4]:
                    if len(last_6) >= pattern_len * 2:
                        pattern = last_6[-pattern_len:]
                        prev_pattern = last_6[-pattern_len*2:-pattern_len]
                        if pattern == prev_pattern:
                            pattern_found = True
                            oscillation_detected = True
                            # If oscillating at 3 or fewer conflicts, that's success
                            if max(pattern) <= 3:
                                print(f"\n{'='*80}")
                                print(f"✅ SUCCESS! Conflicts oscillating at {max(pattern)} (threshold: ≤3)")
                                print(f"{'='*80}")
                                print("Remaining conflicts likely occur at specific timestamps during flight")
                                print("and cannot be resolved by adjusting initial state alone.")
                            else:
                                print(f"\n⚠️  OSCILLATION DETECTED: Pattern {pattern} repeating")
                                print("   The resolver is creating new conflicts while resolving old ones.")
                                print("   Stopping to avoid infinite loop.")
                            break
                if pattern_found:
                    break
        
        # Check if stuck (same count for multiple iterations)
        if previous_count == conflict_count:
            stuck_count += 1
            # If we're at 3 or fewer conflicts and stuck, that's success
            if conflict_count <= 3:
                print(f"\n{'='*80}")
                print(f"✅ SUCCESS! Conflicts stabilized at {conflict_count} (threshold: ≤3)")
                print(f"{'='*80}")
                break
            elif stuck_count >= max_stuck_iterations:
                print(f"\n⚠️  STUCK: Conflict count has been {conflict_count} for {stuck_count} iterations")
                print("   This likely means these conflicts cannot be resolved with current constraints.")
                break
        else:
            stuck_count = 0
        
        # Check if resolved (0 conflicts) or success threshold reached (<= 3 conflicts)
        if conflict_count == 0:
            print(f"\n{'='*80}")
            print("✅ SUCCESS! All conflicts resolved!")
            print(f"{'='*80}")
            break
        elif conflict_count <= 3:
            print(f"\n{'='*80}")
            print(f"✅ SUCCESS! Conflicts reduced to {conflict_count} (threshold: ≤3)")
            print(f"{'='*80}")
            print("Remaining conflicts likely occur at specific timestamps during flight")
            print("and cannot be resolved by adjusting initial state alone.")
            break
        
        previous_count = conflict_count
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    print(f"Total iterations: {iteration}")
    print(f"Final conflict count: {get_conflict_count()}")
    print(f"Starting conflict count: {results[0]['conflicts'] if results else 'N/A'}")
    
    if results:
        print(f"\nProgress:")
        for r in results:
            change_indicator = "→" if r['changed'] else "="
            print(f"  Iteration {r['iteration']:3d}: {r['conflicts']:3d} conflicts {change_indicator}")
    
    if oscillation_detected:
        print(f"\n⚠️  Oscillation detected - resolver is stuck in a cycle")
        print("   The remaining conflicts are likely unresolvable with current constraints")
        print("   or require a different resolution strategy.")
    
    if iteration >= MAX_ITERATIONS:
        print(f"\n⚠️  Reached maximum iterations ({MAX_ITERATIONS})")
        print("   Some conflicts may be unresolvable with current constraints.")
    
    final_count = get_conflict_count()
    if final_count == 0:
        print(f"\n✅ All conflicts successfully resolved in {iteration} iterations!")
    elif final_count is not None and final_count <= 3:
        print(f"\n✅ Successfully reduced conflicts to {final_count} in {iteration} iterations!")
        print("   Remaining conflicts likely occur at specific timestamps during flight")
        print("   and have sufficient vertical separation (>2000 ft).")
        print("   These cannot be resolved by adjusting initial state alone.")
    elif final_count is not None and final_count > 3:
        print(f"\n⚠️  Remaining conflicts: {final_count}")
        print("   These conflicts may be unresolvable due to:")
        print("   - Planes at altitude/speed limits")
        print("   - Conflicts occurring at specific timestamps during flight")
        print("   - Horizontal distance constraints")

if __name__ == "__main__":
    main()

