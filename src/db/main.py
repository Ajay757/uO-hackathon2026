import json

PLANES_FILE = "flights.json"
SIMULATION_FILE = "simulation_state.json"

def generate_simulation_state(planes_file=PLANES_FILE, output_file=SIMULATION_FILE):
    """
    Generate simulation_state.json from flights.json.
    Keeps the same list-of-objects format.
    Adds 'changes' field initialized to 0 for each plane.
    """
    with open(planes_file, "r") as f:
        planes = json.load(f)

    simulation_planes = []
    for plane in planes:
        plane_state = plane.copy()   # don't modify original
        plane_state["changes"] = 0   # simulation-only field
        simulation_planes.append(plane_state)

    with open(output_file, "w") as f:
        json.dump(simulation_planes, f, indent=2)