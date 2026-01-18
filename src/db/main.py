import json

def generate_simulation_state(planes_file, output_file):
    """
    Generates simulation_state.json from flights.json.
    Keeps the EXACT same list-of-objects structure.
    Adds a 'changes' field initialized to 0 for each plane.
    """
    with open(planes_file, "r") as f:
        planes = json.load(f)

    simulation_planes = []

    for plane in planes:
        plane_state = plane.copy()   # do not mutate original
        plane_state["changes"] = 0   # add simulation-only field
        simulation_planes.append(plane_state)

    with open(output_file, "w") as f:
        json.dump(simulation_planes, f, indent=2)