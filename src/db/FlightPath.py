from datetime import datetime, timedelta, timezone
import math

flight = {
    "ACID": "ACA101",
    "Plane type": "Boeing 787-9",
    "route": "49.97N/110.935W 49.64N/92.114W",
    "altitude": 37000,
    "departure airport": "CYYZ",
    "arrival airport": "CYVR",
    "departure time": 1736244000,
    "aircraft speed": 485.0,  # knots
    "passengers": 280,
    "is_cargo": False
}

# Airport coordinates (deg)
airports = {
    "CYYZ": (43.68, -79.63),
    "CYVR": (49.19, -123.18),
    "CYUL": (45.47, -73.74),
    "CYYC": (51.11, -114.02),
    "CYOW": (45.32, -75.67),
    "CYWG": (49.91, -97.24),
    "CYHZ": (44.88, -63.51),
    "CYEG": (53.31, -113.58),
    "CYQB": (46.79, -71.39),
    "CYYJ": (48.65, -123.43),
    "CYYT": (47.62, -52.75),
    "CYXE": (52.17, -106.70)
}

def unix_to_est_24h(ts: int) -> datetime:
    utc_dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    est = timezone(timedelta(hours=-5))  # fixed EST (no DST)
    return utc_dt.astimezone(est)


def parse_point(point_str: str):
    lat_str, lon_str = point_str.split('/')

    if lat_str[-1].isalpha():
        lat_str = lat_str[:-1]
    if lon_str[-1].isalpha():
        lon_str = lon_str[:-1]

    lat_val = float(lat_str)   # North
    lon_val = float(lon_str)   # West

    lat = lat_val
    lon = -abs(lon_val)
    return lat, lon

# def parse_route(route_str: str):
#     parts = route_str.split()          # split on spaces
#     return [parse_point(p) for p in parts]

# Shortest path over the earths surface, between 2 points
def haversine_nm(lat1, lon1, lat2, lon2):
    R_nm = 3440.065  # Earth radius in nautical miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R_nm * c





def estimate_arrival(flight: dict):
    dep_est = unix_to_est_24h(flight["departure time"])

    # Parse all waypoints
    route_points = [parse_point(p) for p in flight["route"].split()]

    # Full path: dep_airport → wp1 → wp2 → ... → wpN → arr_airport
    path = [airports[flight["departure airport"]]] + route_points + [airports[flight["arrival airport"]]]

    # Sum distances for each consecutive leg
    total_distance_nm = 0.0
    legs = []

    for i in range(len(path) - 1):
        leg_dist = haversine_nm(*path[i], *path[i+1])
        total_distance_nm += leg_dist
        legs.append(leg_dist)

    # Constant speed from takeoff to landing
    speed = flight["aircraft speed"]  # knots
    total_hours = total_distance_nm / speed
    
    # Convert decimal hours → hours + minutes
    hours_enroute = int(total_hours)
    minutes_enroute = int((total_hours - hours_enroute) * 60)
    
    # Add enroute time to departure (stays in EST)
    arr_est = dep_est + timedelta(hours=hours_enroute, minutes=minutes_enroute)

    # Add enroute time to departure (stays in EST)
    arr_est = dep_est + timedelta(hours=hours_enroute)

    return {
        "departure_est": dep_est,
        "legs_nm": legs,
        "total_distance_nm": total_distance_nm,
        "enroute_hm": (hours_enroute, minutes_enroute),  # tuple: (hours, minutes)
        "arrival_est": arr_est
    }

result = estimate_arrival(flight)

result = estimate_arrival(flight)
print("Departure (EST):", result["departure_est"].strftime("%Y-%m-%d %H:%M:%S"))
print("Legs (nm):", [round(x, 1) for x in result["legs_nm"]])
print("Total distance (nm):", round(result["total_distance_nm"], 1))
hours, minutes = result["enroute_hm"]
print(f"Time enroute: {hours}h {minutes}m")
print("Arrival (EST):", result["arrival_est"].strftime("%Y-%m-%d %H:%M:%S"))
