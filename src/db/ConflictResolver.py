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
    with open(PLANES_FILE, "r") as f:
        planes = json.load(f)
    return {plane["ACID"]: plane["Plane type"] for plane in planes}

def load_aircraft_types():
    with open(AIRCRAFT_TYPES_FILE, "r") as f:
        return json.load(f)

# -----------------------------
# SEPARATION CHECKERS
# -----------------------------
def vertical_separation_ok(alt1, alt2):
    """Returns True if planes are at least 2000 ft apart vertically"""
    return abs(alt1 - alt2) >= 2000

# Horizontal separation is handled externally by conflictDetector
def horizontal_separation_ok(pos1, pos2):
    return False

# -----------------------------
# STATE UPDATE
# -----------------------------
def update_plane(acid, new_altitude=None, new_speed=None):
    state = load_state()
    if new_altitude is not None:
        state[acid]["altitude"] = new_altitude
    if new_speed is not None:
        state[acid]["speed"] = new_speed
    state[acid]["changes"] += 1
    save_state(state)

# -----------------------------
# CONFLICT RESOLVER
# -----------------------------
def conflict_resolver(conflicts):
    """
    conflicts: list of lists of ACIDs involved in each conflict
    """
    state = load_state()
    planes_info = load_planes_info()
    aircraft_types = load_aircraft_types()

    for conflict in conflicts:
        # Sort planes by minimal previous changes
        sorted_planes = sorted(conflict, key=lambda x: state[x]["changes"])
        conflict_resolved = False

        # Gather current altitudes and speeds
        altitudes = {acid: state[acid]["altitude"] for acid in sorted_planes}
        speeds = {acid: state[acid]["speed"] for acid in sorted_planes}

        # -----------------------------
        # ALTITUDE ADJUSTMENT (direction-aware)
        # -----------------------------
        for acid in sorted_planes:
            plane_type = planes_info[acid]
            constraints = aircraft_types[plane_type]
            min_alt = constraints["altitude"]["min"]
            max_alt = constraints["altitude"]["max"]
            current_alt = altitudes[acid]

            # Check if moving up or down makes sense
            move_up_ok = all(current_alt < altitudes[other] - 2000 for other in sorted_planes if other != acid)
            move_down_ok = all(current_alt > altitudes[other] + 2000 for other in sorted_planes if other != acid)

            # Try moving up first
            if move_up_ok and current_alt + 1000 <= max_alt:
                proposed_alt = current_alt + 1000
                update_plane(acid, new_altitude=proposed_alt)
                conflict_resolved = True
                break

            # Try moving down if up not possible
            elif move_down_ok and current_alt - 1000 >= min_alt:
                proposed_alt = current_alt - 1000
                update_plane(acid, new_altitude=proposed_alt)
                conflict_resolved = True
                break

        # -----------------------------
        # SPEED ADJUSTMENT (only if no altitude change possible)
        # -----------------------------
        if not conflict_resolved:
            for acid in sorted_planes:
                plane_type = planes_info[acid]
                constraints = aircraft_types[plane_type]
                min_speed = constraints["speed"]["min"]
                max_speed = constraints["speed"]["max"]
                current_speed = speeds[acid]

                # Try speed up first
                if current_speed + 20 <= max_speed:
                    proposed_speed = current_speed + 20
                    update_plane(acid, new_speed=proposed_speed)
                    conflict_resolved = True
                    break
                # Try speed down
                elif current_speed - 20 >= min_speed:
                    proposed_speed = current_speed - 20
                    update_plane(acid, new_speed=proposed_speed)
                    conflict_resolved = True
                    break

        # If neither altitude nor speed adjustment was possible, do nothing this pass
