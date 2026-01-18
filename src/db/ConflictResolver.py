import json
import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

STATE_FILE = os.path.join(SCRIPT_DIR, "simulation_state.json")
PLANES_FILE = os.path.join(SCRIPT_DIR, "flights.json")
AIRCRAFT_TYPES_FILE = os.path.join(SCRIPT_DIR, "plane_info.json")

# -----------------------------
# JSON LOAD / SAVE HELPERS
# -----------------------------
def load_state():
    with open(STATE_FILE, "r") as f:
        return json.load(f)

def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def load_planes_info():
    """Return dict of ACID -> plane type"""
    with open(PLANES_FILE, "r") as f:
        planes = json.load(f)
    return {plane["ACID"]: plane["Plane type"] for plane in planes}

def load_aircraft_types():
    """Return dict of plane type -> constraints"""
    with open(AIRCRAFT_TYPES_FILE, "r") as f:
        return json.load(f)

# -----------------------------
# SEPARATION CHECKERS
# -----------------------------
def vertical_separation_ok(alt1, alt2):
    """True if planes >= 2000 ft apart vertically"""
    return abs(alt1 - alt2) >= 2000

# Horizontal separation handled elsewhere
def horizontal_separation_ok(pos1, pos2):
    return False

# -----------------------------
# STATE UPDATE
# -----------------------------
def update_plane(acid, new_altitude=None, new_speed=None):
    """
    Updates altitude/speed in the list-of-dicts format and increments changes
    """
    state = load_state()
    for plane in state:
        if plane["ACID"] == acid:
            if new_altitude is not None:
                plane["altitude"] = new_altitude
            if new_speed is not None:
                plane["aircraft speed"] = new_speed
            plane["changes"] += 1
            break
    save_state(state)

# -----------------------------
# CONFLICT RESOLVER
# -----------------------------
def conflict_resolver(conflicts):
    """
    Resolves altitude and speed conflicts between planes.
    
    Args:
        conflicts: a list of lists, where each inner list represents a group of planes
                  in conflict. The last item in each sublist is a timestamp and is discarded.
    """
    # Load aircraft constraints
    aircraft_types = load_aircraft_types()
    
    # Sort conflicts by the total "changes" count of involved planes (prioritize conflicts with less-modified planes)
    # This helps resolve simpler conflicts first and avoid oscillation
    state = load_state()
    state_by_acid = {plane["ACID"]: plane for plane in state}
    
    def conflict_priority(conflict_group):
        acids = conflict_group[:-1] if len(conflict_group) > 1 else conflict_group
        total_changes = sum(state_by_acid.get(acid, {}).get("changes", 0) for acid in acids if acid in state_by_acid)
        return total_changes
    
    sorted_conflicts = sorted(conflicts, key=conflict_priority)
    
    # Process each conflict group
    for conflict_group in sorted_conflicts:
        # Skip empty lists
        if not conflict_group:
            continue
        
        # Discard the last item (timestamp) - create a copy to avoid modifying input
        acids = conflict_group[:-1] if len(conflict_group) > 1 else conflict_group
        
        # Skip if no ACIDs after removing timestamp
        if not acids:
            continue
        
        # Load current state (reload for each conflict to get latest changes)
        state = load_state()  # list of dicts
        
        # Build ACID lookup dictionary for fast access
        state_by_acid = {plane["ACID"]: plane for plane in state}
        
        # Filter out ACIDs that don't exist in state
        valid_acids = [acid for acid in acids if acid in state_by_acid]
        if not valid_acids:
            continue
        
        # Sort planes by least number of previous changes (lowest "changes" first)
        # But also consider: if a plane has been adjusted too many times (>50), deprioritize it
        # to avoid oscillation
        def sort_key(acid):
            changes = state_by_acid[acid].get("changes", 0)
            # Penalize planes with very high change counts to break oscillation
            penalty = 1000 if changes > 50 else 0
            return penalty + changes
        
        sorted_planes = sorted(valid_acids, key=sort_key)
        
        # Get current altitudes for the conflict group
        altitudes = {acid: state_by_acid[acid]["altitude"] for acid in sorted_planes}
        
        # Determine highest and lowest planes in altitude
        altitudes_list = [(acid, altitudes[acid]) for acid in sorted_planes]
        highest_acid = max(altitudes_list, key=lambda x: x[1])[0]
        lowest_acid = min(altitudes_list, key=lambda x: x[1])[0]
        highest_alt = altitudes[highest_acid]
        lowest_alt = altitudes[lowest_acid]
        
        conflict_resolved = False
        
        # Special case: if all planes are at the same altitude, try to separate them
        if highest_alt == lowest_alt:
            # All planes at same altitude - try to move one down
            for acid in sorted_planes:
                plane = state_by_acid[acid]
                plane_type = plane.get("Plane type")
                
                if plane_type not in aircraft_types:
                    continue
                
                constraints = aircraft_types[plane_type]
                min_alt = constraints["altitude"]["min"]
                current_alt = plane["altitude"]
                
                # Try moving down (since all are at same altitude, moving one down will help)
                if current_alt - 1000 >= min_alt:
                    update_plane(acid, new_altitude=current_alt - 1000)
                    conflict_resolved = True
                    break
        
        # Attempt to resolve by altitude change first (normal case: different altitudes)
        if not conflict_resolved:
            # Check current separation
            current_separation = highest_alt - lowest_alt
            
            # Skip if separation is already sufficient (> 2000 ft)
            # Conflicts with > 2000 ft separation are likely detected at different timestamps
            # during flight, and adjusting initial state won't help
            if current_separation > 2000:
                continue  # Skip this conflict - it has sufficient separation
            
            # Only adjust if separation is insufficient (<= 2000 ft)
            # Conflict detection uses < 2000, so exactly 2000 is still a conflict
            # We need > 2000 to fully resolve (e.g., 3000 ft)
            if current_separation <= 2000:
                # Try to adjust both highest and lowest if possible to create more separation
                adjustments_made = []
                
                for acid in sorted_planes:
                    plane = state_by_acid[acid]
                    plane_type = plane.get("Plane type")
                    
                    # Skip if plane type not found in constraints
                    if plane_type not in aircraft_types:
                        continue
                    
                    constraints = aircraft_types[plane_type]
                    min_alt = constraints["altitude"]["min"]
                    max_alt = constraints["altitude"]["max"]
                    current_alt = plane["altitude"]
                    proposed_alt = None
                    
                    # Move highest plane up by 1000 ft if within constraints
                    if acid == highest_acid and acid != lowest_acid:  # Only if not the same plane
                        if current_alt + 1000 <= max_alt:
                            proposed_alt = current_alt + 1000
                        # If highest can't go up but is above max (invalid state), move it down
                        elif current_alt > max_alt and current_alt - 1000 >= min_alt:
                            proposed_alt = current_alt - 1000
                    
                    # Move lowest plane down by 1000 ft if within constraints
                    elif acid == lowest_acid and acid != highest_acid:  # Only if not the same plane
                        if current_alt - 1000 >= min_alt:
                            proposed_alt = current_alt - 1000
                        # If lowest can't go down but highest can't go up, try moving lowest up
                        elif current_separation <= 2000 and current_alt + 1000 <= max_alt:
                            proposed_alt = current_alt + 1000
                    
                    # For middle planes, move away from nearest neighbor
                    elif acid != highest_acid and acid != lowest_acid:
                        # Calculate distance to nearest planes above and below
                        above_alts = [altitudes[other] for other in sorted_planes 
                                     if altitudes[other] > current_alt]
                        below_alts = [altitudes[other] for other in sorted_planes 
                                     if altitudes[other] < current_alt]
                        
                        dist_above = min([alt - current_alt for alt in above_alts], default=99999)
                        dist_below = min([current_alt - alt for alt in below_alts], default=99999)
                        
                        # Move away from nearest neighbor
                        if dist_above < dist_below:
                            # Nearest is above, move down
                            if current_alt - 1000 >= min_alt:
                                proposed_alt = current_alt - 1000
                        else:
                            # Nearest is below, move up
                            if current_alt + 1000 <= max_alt:
                                proposed_alt = current_alt + 1000
                    
                    # Apply altitude change if valid
                    if proposed_alt is not None:
                        update_plane(acid, new_altitude=proposed_alt)
                        adjustments_made.append(acid)
                        conflict_resolved = True
                        
                        # If we've adjusted both highest and lowest, we have good separation
                        # Otherwise, try to adjust the other one too for better separation
                        if len(adjustments_made) == 1 and len(sorted_planes) == 2:
                            # For 2-plane conflicts, try to adjust both if possible
                            other_acid = sorted_planes[1] if sorted_planes[0] == acid else sorted_planes[0]
                            other_plane = state_by_acid.get(other_acid)
                            if other_plane:
                                other_plane_type = other_plane.get("Plane type")
                                if other_plane_type in aircraft_types:
                                    other_constraints = aircraft_types[other_plane_type]
                                    other_min_alt = other_constraints["altitude"]["min"]
                                    other_max_alt = other_constraints["altitude"]["max"]
                                    other_current_alt = other_plane["altitude"]
                                    
                                    # If we moved highest up, try moving lowest down
                                    if acid == highest_acid:
                                        if other_current_alt - 1000 >= other_min_alt:
                                            update_plane(other_acid, new_altitude=other_current_alt - 1000)
                                            adjustments_made.append(other_acid)
                                    # If we moved lowest down, try moving highest up
                                    elif acid == lowest_acid:
                                        if other_current_alt + 1000 <= other_max_alt:
                                            update_plane(other_acid, new_altitude=other_current_alt + 1000)
                                            adjustments_made.append(other_acid)
                        
                        # Break after making adjustments (we've resolved this conflict)
                        break
        
        # If no altitude adjustment was possible, attempt speed adjustments
        if not conflict_resolved:
            # Reload state to get latest data
            state = load_state()
            state_by_acid = {plane["ACID"]: plane for plane in state}
            
            for acid in sorted_planes:
                plane = state_by_acid[acid]
                plane_type = plane.get("Plane type")
                
                # Skip if plane type not found in constraints
                if plane_type not in aircraft_types:
                    continue
                
                constraints = aircraft_types[plane_type]
                min_speed = constraints["speed"]["min"]
                max_speed = constraints["speed"]["max"]
                current_speed = plane["aircraft speed"]
                
                # Try increasing speed by 20 knots if within max
                if current_speed + 20 <= max_speed:
                    update_plane(acid, new_speed=current_speed + 20)
                    conflict_resolved = True
                    break
                
                # Otherwise, try decreasing speed by 20 knots if within min
                elif current_speed - 20 >= min_speed:
                    update_plane(acid, new_speed=current_speed - 20)
                    conflict_resolved = True
                    break
