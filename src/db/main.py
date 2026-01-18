import json


def generate_simulation_state(planes_file, output_file):
    """
    Generates a simulation state JSON from the original planes JSON.
    Keeps all original fields, adds a 'changes' counter set to 0.
    """
    with open(planes_file, "r") as f:
        planes = json.load(f)

    sim_state = {}

    for plane in planes:
        acid = plane["ACID"]

        # Copy all original fields
        plane_state = plane.copy()

        # Add the simulation field
        plane_state["changes"] = 0

        # Use ACID as the key
        sim_state[acid] = plane_state

    with open(output_file, "w") as f:
        json.dump(sim_state, f, indent=2)
