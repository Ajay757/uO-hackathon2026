import json


def parse_lat_lon(route_str):
    """
    Extracts latitude and longitude from a string like:
    '49.64N/92.114W'
    Returns: (lat, lon) as floats
    """
    lat_str, lon_str = route_str.split("/")

    lat = float(lat_str[:-1])
    if lat_str[-1] == "S":
        lat = -lat

    lon = float(lon_str[:-1])
    if lon_str[-1] == "W":
        lon = -lon

    return lat, lon


def generate_simulation_state(planes_file, output_file):
    with open(planes_file, "r") as f:
        planes = json.load(f)

    sim_state = {}

    for plane in planes:
        acid = plane["ACID"]

        lat, lon = parse_lat_lon(plane["route"])

        sim_state[acid] = {
            "latitude": lat,
            "longitude": lon,
            "changes": 0,
            "altitude": plane["altitude"],
            "speed": plane["aircraft speed"]
        }

    with open(output_file, "w") as f:
        json.dump(sim_state, f, indent=2)


if __name__ == "__main__":
    generate_simulation_state(
        planes_file="canadian_flights_250.json",
        output_file="simulation_state.json"
    )
    multi_flight_simulation(simulation_state)

