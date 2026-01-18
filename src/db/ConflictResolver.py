import json

STATE_FILE = "simulation_state.json"
PLANES_FILE = "flights.json"
AIRCRAFT_TYPES_FILE = "plane_info.json"

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
    state = load_state()  # list of dicts
    planes_info = load_planes_info()
    aircraft_types = load_aircraft_types()

    # Build ACID lookup for quick access
    state_by_acid = {plane["ACID"]: plane for plane in state}

    for conflict in conflicts:
        if not conflict:
            continue

        # Sort planes by minimal changes
        sorted_planes = sorted(conflict, key=lambda acid: state_by_acid[acid]["changes"])

        conflict_resolved = False

        # Altitudes and speeds lookup
        altitudes = {acid: state_by_acid[acid]["altitude"] for acid in sorted_planes}
        speeds = {acid: state_by_acid[acid]["aircraft speed"] for acid in sorted_planes}

        # Find highest and lowest planes
        altitudes_list = [(acid, altitudes[acid]) for acid in sorted_planes]
        highest = max(altitudes_list, key=lambda x: x[1])[0]
        lowest = min(altitudes_list, key=lambda x: x[1])[0]

        # Try to adjust altitude first
        for acid in sorted_planes:
            plane_type = planes_info[acid]
            constraints = aircraft_types[plane_type]
            min_alt = constraints["altitude"]["min"]
            max_alt = constraints["altitude"]["max"]
            current_alt = altitudes[acid]
            proposed_alt = None

            if acid == highest:
                if current_alt + 1000 <= max_alt:
                    proposed_alt = current_alt + 1000
            elif acid == lowest:
                if current_alt - 1000 >= min_alt:
                    proposed_alt = current_alt - 1000
            else:
                above = [altitudes[o] for o in sorted_planes if altitudes[o] > current_alt]
                below = [altitudes[o] for o in sorted_planes if altitudes[o] < current_alt]
                dist_above = min([a - current_alt for a in above], default=99999)
                dist_below = min([current_alt - b for b in below], default=99999)
                if dist_above < dist_below and current_alt - 1000 >= min_alt:
                    proposed_alt = current_alt - 1000
                elif current_alt + 1000 <= max_alt:
                    proposed_alt = current_alt + 1000

            if proposed_alt is not None:
                update_plane(acid, new_altitude=proposed_alt)
                conflict_resolved = True
                break

        # Speed adjustment if altitude move not possible
        if not conflict_resolved:
            for acid in sorted_planes:
                plane_type = planes_info[acid]
                constraints = aircraft_types[plane_type]
                min_speed = constraints["speed"]["min"]
                max_speed = constraints["speed"]["max"]
                current_speed = speeds[acid]

                if current_speed + 20 <= max_speed:
                    update_plane(acid, new_speed=current_speed + 20)
                    conflict_resolved = True
                    break
                elif current_speed - 20 >= min_speed:
                    update_plane(acid, new_speed=current_speed - 20)
                    conflict_resolved = True
                    break
