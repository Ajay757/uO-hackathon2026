from datetime import datetime, timedelta, timezone
import json
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
    est = timezone(timedelta(hours=-5))
    return utc_dt.astimezone(est)

def parse_point(point_str: str):
    lat_str, lon_str = point_str.split('/')
    if lat_str[-1].isalpha(): lat_str = lat_str[:-1]
    if lon_str[-1].isalpha(): lon_str = lon_str[:-1]
    lat = float(lat_str)
    lon = -abs(float(lon_str))
    return lat, lon

def haversine_nm(lat1, lon1, lat2, lon2):
    R_nm = 3440.065
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R_nm * c

def great_circle_interpolate(lat1, lon1, lat2, lon2, fraction):
    """Precise great-circle interpolation between two points."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    d = 2 * math.asin(math.sqrt(math.sin((lat2 - lat1)/2)**2 + 
                                math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1)/2)**2))
    a = math.sin((1 - fraction) * d) / math.sin(d)
    b = math.sin(fraction * d) / math.sin(d)
    x = a * math.cos(lat1) * math.cos(lon1) + b * math.cos(lat2) * math.cos(lon2)
    y = a * math.cos(lat1) * math.sin(lon1) + b * math.cos(lat2) * math.sin(lon2)
    z = a * math.sin(lat1) + b * math.sin(lat2)
    lat = math.atan2(z, math.sqrt(x*x + y*y))
    lon = math.atan2(y, x)
    return math.degrees(lat), math.degrees(lon)

def get_flight_path(flight: dict):
    """SHARED: Returns path points + leg distances for any flight."""
    route_points = [parse_point(p) for p in flight["route"].split()]
    path = [airports[flight["departure airport"]]] + route_points + [airports[flight["arrival airport"]]]
    
    leg_distances = []
    total_distance_nm = 0.0
    for i in range(len(path) - 1):
        leg_dist = haversine_nm(*path[i], *path[i+1])
        leg_distances.append(leg_dist)
        total_distance_nm += leg_dist
    
    return path, leg_distances, total_distance_nm

# # NOW simplified - use shared path computation: maybe not needed
# def estimate_arrival(flight: dict):
#     dep_est = unix_to_est_24h(flight["departure time"])
#     path, leg_distances, total_distance_nm = get_flight_path(flight)
    
#     speed = flight["aircraft speed"]
#     total_hours = total_distance_nm / speed
#     hours_enroute = int(total_hours)
#     minutes_enroute = int((total_hours - hours_enroute) * 60)
    
#     arr_est = dep_est + timedelta(hours=hours_enroute, minutes=minutes_enroute)
    
#     return {
#         "departure_est": dep_est,
#         "legs_nm": leg_distances,
#         "total_distance_nm": total_distance_nm,
#         "enroute_hm": (hours_enroute, minutes_enroute),
#         "arrival_est": arr_est
#     }

def get_position_at_time(flight: dict, target_minutes: float):
    path, leg_distances, total_distance_nm = get_flight_path(flight)
    
    speed = flight["aircraft speed"]
    total_minutes = (total_distance_nm / speed) * 60
    
    if target_minutes > total_minutes:
        return airports[flight["arrival airport"]]
    
    distance_traveled_nm = (target_minutes / 60) * speed
    
    cum_dist = 0.0
    for leg_idx, leg_dist in enumerate(leg_distances):
        if distance_traveled_nm <= (cum_dist + leg_dist):
            fraction = (distance_traveled_nm - cum_dist) / leg_dist
            start_pt = path[leg_idx]
            end_pt = path[leg_idx + 1]
            return great_circle_interpolate(*start_pt, *end_pt, fraction)
        cum_dist += leg_dist
    
    return airports[flight["arrival airport"]]

# def simulate_flight(flight: dict, ping_int: int):
#     path, leg_distances, total_distance_nm = get_flight_path(flight)
#     speed = flight["aircraft speed"]
#     total_minutes = (total_distance_nm / speed) * 60
#     print(f"\n=== {flight['ACID']} Flight Simulation ===")
#     print(f"Route: {flight['departure airport']} → {flight['arrival airport']}")
#     print(f"Total distance: {total_distance_nm:.0f} NM, time: {int(total_minutes//60)}h {int(total_minutes%60)}m")
#     print("-" * 50)
#     dep_est = unix_to_est_24h(flight["departure time"])
#     total_int = int(total_minutes)
#     for minutes_elapsed in range(0, total_int + 1, ping_int):
#         if minutes_elapsed > total_int:
#             arr_est = dep_est + timedelta(minutes=total_int)
#             arr_pos = airports[flight['arrival airport']]
#             print(f"Arrival at {arr_est.strftime('%H:%M')} ({total_int}m): "
#                   f"{arr_pos[0]:.2f}N/{abs(arr_pos[1]):.3f}W")
#             break
#         pos = get_position_at_time(flight, minutes_elapsed)
#         est_time = dep_est + timedelta(minutes=minutes_elapsed)
#         print(f"{est_time.strftime('%H:%M')} ({minutes_elapsed}m): "
#               f"{pos[0]:.2f}N/{abs(pos[1]):.3f}W")
# # Run for uOttawa Hack 2026 NAV Canada challenge
# simulate_flight(flight, 60)

def load_flights(filename: str):
    """Load flights from JSON file."""
    with open(filename, 'r') as f:
        return json.load(f)


def simulate_all_flights(filename: str, ping_int: int = 60):
    """Simulate all flights from JSON over full period."""
    flights = load_flights(filename)
    
    if not flights:
        print("No flights found in JSON.")
        return
    
    # Determine sim bounds
    first_dep_unix = flights[0]["departure time"]
    last_dep_unix = flights[-1]["departure time"]
    sim_start = unix_to_est_24h(first_dep_unix)
    sim_end = unix_to_est_24h(last_dep_unix + 3 * 3600)  # +3hr
    
    print(f"=== Multi-Flight Simulation ({len(flights)} flights) ===")
    print(f"Period: {sim_start.strftime('%Y-%m-%d %H:%M')} to {sim_end.strftime('%Y-%m-%d %H:%M')} EST")
    print(f"Ping: {ping_int}min | Active = departed but not arrived")
    print("-" * 80)
    
    current_time = sim_start
    while current_time <= sim_end:
        minutes_since_start = int((current_time - sim_start).total_seconds() / 60)
        print(f"\n{current_time.strftime('%H:%M')} ({minutes_since_start}m):")
        
        any_active = False
        for flight in flights:
            dep_time = unix_to_est_24h(flight["departure time"])
            minutes_since_dep = int((current_time - dep_time).total_seconds() / 60)
            
            if minutes_since_dep < 0:
                continue  # Not departed - skip
            elif minutes_since_dep == 0:
                pos = airports[flight["departure airport"]]
                status = "Just departed"
            else:
                path, _, total_nm = get_flight_path(flight)
                speed = flight["aircraft speed"]
                total_flight_min = (total_nm / speed) * 60
                if minutes_since_dep >= total_flight_min:
                    pos = airports[flight["arrival airport"]]
                    status = "Arrived"
                else:
                    pos = get_position_at_time(flight, minutes_since_dep)
                    status = "Flying"
            
            print(f"  {flight['ACID']:>6} {pos[0]:6.2f}N/{abs(pos[1]):7.3f}W {status:<10} "
                  f"(dep+{minutes_since_dep}m)")
            any_active = True
        
        if not any_active:
            print("  No active flights")
        
        current_time += timedelta(minutes=ping_int)

if __name__ == "__main__":
    path = 'flights.json'
    simulate_all_flights(path, 60)

