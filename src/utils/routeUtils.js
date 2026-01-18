export function parseRouteTokens(routeStr) {
  if (!routeStr || typeof routeStr !== "string") return [];
  return routeStr.trim().split(/\s+/).filter(Boolean);
}

// Returns: { "<waypoint>": ["ACID1", "ACID2", ...], ... }
export function buildWaypointToAcidsMap(flights) {
  const map = Object.create(null);

  for (const f of flights || []) {
    const acid = f?.ACID;
    const route = f?.route;
    if (!acid || !route) continue;

    const tokens = parseRouteTokens(route);

    // ensure no duplicate ACIDs for the same waypoint
    const unique = new Set(tokens);

    for (const wp of unique) {
      if (!map[wp]) map[wp] = [];
      map[wp].push(acid);
    }
  }

  return map;
}
