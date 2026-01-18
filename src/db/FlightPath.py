from datetime import datetime, timedelta, timezone
from ConflictFinder import detect_conflicts_by_waypoints
import json
import math

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

def estimate_arrival(flight: dict):
    dep_est = unix_to_est_24h(flight["departure time"])
    path, leg_distances, total_distance_nm = get_flight_path(flight)
    
    speed = flight["aircraft speed"]
    total_hours = total_distance_nm / speed
    hours_enroute = int(total_hours)
    minutes_enroute = int((total_hours - hours_enroute) * 60)
    
    arr_est = dep_est + timedelta(hours=hours_enroute, minutes=minutes_enroute)
    
    return {
        "departure_est": dep_est,
        "legs_nm": leg_distances,
        "total_distance_nm": total_distance_nm,
        "enroute_hm": (hours_enroute, minutes_enroute),
        "arrival_est": arr_est
    }

def get_position_at_time(flight: dict, minutes_since_dep: float):
    """Position minutes after departure (assumes already airborne)."""
    path, leg_distances, total_distance_nm = get_flight_path(flight)
    
    speed = flight["aircraft speed"]
    total_minutes = (total_distance_nm / speed) * 60
    
    if minutes_since_dep >= total_minutes:
        return None  # Arrived - no position to track
    
    distance_traveled_nm = (minutes_since_dep / 60) * speed
    
    cum_dist = 0.0
    for leg_idx, leg_dist in enumerate(leg_distances):
        if distance_traveled_nm <= (cum_dist + leg_dist):
            fraction = (distance_traveled_nm - cum_dist) / leg_dist
            start_pt = path[leg_idx]
            end_pt = path[leg_idx + 1]
            return great_circle_interpolate(*start_pt, *end_pt, fraction)
        cum_dist += leg_dist
    
    return None  # Shouldn't reach here

def load_flights(filename: str):
    """Load flights from JSON file."""
    with open(filename, 'r') as f:
        return json.load(f)

def simulate_all_flights(filename: str, ping_int: int = 60):
    """Simulate ONLY airborne flights until last arrival."""
    flights = load_flights(filename)

    snapshots = []
    
    if not flights:
        print("No flights found in JSON.")
        return
    
    # NEW: Compute max arrival time for sim_end
    max_arrival_unix = 0
    for flight in flights:
        path, _, total_nm = get_flight_path(flight)
        speed = flight["aircraft speed"]
        total_hours = total_nm / speed
        total_minutes = total_hours * 60
        dep_unix = flight["departure time"]
        arrival_unix = dep_unix + int(total_minutes * 60)  # seconds
        if arrival_unix > max_arrival_unix:
            max_arrival_unix = arrival_unix
    
    first_dep_unix = flights[0]["departure time"]
    sim_start = unix_to_est_24h(first_dep_unix)
    sim_end = unix_to_est_24h(max_arrival_unix)
    
    print(" ")
    print(f"=== AIRBORNE Flight Simulation ({len(flights)} flights) ===")
    print(f"Period: {sim_start.strftime('%Y-%m-%d %H:%M')} to {sim_end.strftime('%Y-%m-%d %H:%M')} EST")
    print(f"Ping: {ping_int}min | Ends when last flight lands")
    print("-" * 80)
    
    current_time = sim_start
    while current_time <= sim_end:
        minutes_since_start = int((current_time - sim_start).total_seconds() / 60)
        print(f"\n{current_time.strftime('%H:%M')} ({minutes_since_start}m):")
        
        planes = []
        airborne_count = 0
        for flight in flights:
            dep_time = unix_to_est_24h(flight["departure time"])
            minutes_since_dep = int((current_time - dep_time).total_seconds() / 60)
            
            if minutes_since_dep <= 0:
                continue
            
            path, _, total_nm = get_flight_path(flight)
            speed = flight["aircraft speed"]
            total_flight_min = (total_nm / speed) * 60
            
            if minutes_since_dep < total_flight_min:
                pos = get_position_at_time(flight, minutes_since_dep)
                if pos:
                    alt = flight.get("altitude", 35000)
                    planes.append({
                        "ACID": flight['ACID'],
                        "lat": pos[0],
                        "lon": pos[1],
                        "alt": alt
                    })
                    print(f"  {flight['ACID']:>6} {pos[0]:6.2f}N/{abs(pos[1]):7.3f}W "
                        f"{alt:>6}ft (dep+{minutes_since_dep}m)")
                    airborne_count += 1

        # NEW: Save snapshot and call your function
        timestamp = minutes_since_start
        snapshots.append({
            "timestamp": timestamp,
            "planes": planes
        })
        
        if airborne_count == 0:
            print("  No airborne flights")
        else:
            print(f"  ({airborne_count} airborne)")
        
        current_time += timedelta(minutes=ping_int)

    return snapshots  # NEW: Return for external use


if __name__ == "__main__":
    path = 'flights.json'

    snapshots = simulate_all_flights(path, 5)


    conflicts = []
    print('')

    for snapshot in snapshots:
        # print(snapshot)
        sp_conflicts = detect_conflicts_by_waypoints(snapshot["planes"], snapshot["timestamp"])

        conflicts.extend(sp_conflicts)
    
    print(conflicts)


