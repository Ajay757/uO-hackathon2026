import math

# -------------------- Basic geometry -------------------- #

def haversine_distance(lat1, lon1, lat2, lon2):
    """Great-circle distance in nautical miles."""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (math.sin(delta_lat / 2) ** 2
         + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return 3440.065 * c  # nautical miles


def check_hitbox_collision(plane1, plane2):
    """Return True if planes violate separation minima."""
    horizontal_distance = haversine_distance(
        plane1["lat"], plane1["lon"], plane2["lat"], plane2["lon"]
    )
    vertical_separation = abs(plane1["alt"] - plane2["alt"])
    return horizontal_distance < 5 and vertical_separation < 2000


# -------------------- Conflict detection -------------------- #

def find_conflict_clusters(planes):
    """
    Detect all clusters of conflicts among planes.

    planes: list of dicts with 'ACID', 'lat', 'lon', 'alt'
    Returns: list of clusters (list of plane dicts)
    """
    conflicts = []
    unvisited = set(range(len(planes)))

    while unvisited:
        cluster_indices = set()
        to_visit = {unvisited.pop()}

        while to_visit:
            idx = to_visit.pop()
            cluster_indices.add(idx)
            for other_idx in list(unvisited):
                if check_hitbox_collision(planes[idx], planes[other_idx]):
                    to_visit.add(other_idx)
                    unvisited.remove(other_idx)

        if len(cluster_indices) > 1:
            conflicts.append([planes[i] for i in cluster_indices])

    return conflicts


# -------------------- Waypoint-based optimized detection -------------------- #

def detect_conflicts_by_waypoints(planes_list, waypoint_dict, timestamp):
    """
    Detect conflicts using waypoint filtering and merge overlapping clusters.

    planes_list: list of dicts with 'ACID', 'lat', 'lon', 'alt'
    waypoint_dict: dict mapping waypoint -> list of ACIDs
    timestamp: snapshot time

    Returns:
        conflicts: list of clusters [ACID1, ACID2, ..., timestamp]
    """
    # Map ACID -> plane dict for quick lookup
    plane_map = {plane['ACID']: plane for plane in planes_list}

    # Step 1: Build candidate lists per waypoint
    waypoint_groups = []
    for wp, acids in waypoint_dict.items():
        planes_in_air = [plane_map[acid] for acid in acids if acid in plane_map]
        if len(planes_in_air) > 1:
            waypoint_groups.append(planes_in_air)

    # Step 2: Flatten all planes into a single list for cluster detection
    all_planes = []
    for group in waypoint_groups:
        all_planes.extend(group)

    # Remove duplicates (same plane in multiple waypoints)
    all_planes = list({plane['ACID']: plane for plane in all_planes}.values())

    # Step 3: Find conflict clusters
    clusters = find_conflict_clusters(all_planes)

    # Step 4: Convert to output format: [ACID1, ACID2, ..., timestamp]
    conflicts_output = []
    for cluster in clusters:
        conflict_ids = [plane['ACID'] for plane in cluster]
        conflict_ids.append(timestamp)
        conflicts_output.append(conflict_ids)

    return conflicts_output
