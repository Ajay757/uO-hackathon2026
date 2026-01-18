import json


def parse_lat_lon(point_str: str):
    lat_str, lon_str = point_str.split('/')
    if lat_str[-1].isalpha(): lat_str = lat_str[:-1]
    if lon_str[-1].isalpha(): lon_str = lon_str[:-1]
    lat = float(lat_str)
    lon = -abs(float(lon_str))
    return lat, lon


def generate_simulation_state(planes_file, output_file):
    with open(planes_file, "r") as f:
        planes = json.load(f)

    sim_state = {}

    for plane in planes:
        acid = plane["ACID"]

        # lat, lon = parse_lat_lon(plane["route"])

        sim_state[acid] = {
            # "latitude": lat,
            # "longitude": lon,
            "changes": 0,
            "altitude": plane["altitude"],
            "speed": plane["aircraft speed"]
        }

    with open(output_file, "w") as f:
        json.dump(sim_state, f, indent=2)


    #multi_flight_simulation(simulation_state)

