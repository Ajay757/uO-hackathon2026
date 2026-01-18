/**
 * Parse route coordinates from string format like "49.64N/92.114W 47.50N/69.88W"
 * Returns array of {lat, lon} objects
 */
function parseRoute(routeString) {
  if (!routeString) return [];
  
  const points = routeString.trim().split(/\s+/);
  return points.map((point) => {
    const match = point.match(/(\d+\.?\d*)([NS])\/(\d+\.?\d*)([EW])/);
    if (!match) return null;
    
    let lat = parseFloat(match[1]);
    if (match[2] === "S") lat = -lat;
    
    let lon = parseFloat(match[3]);
    if (match[4] === "W") lon = -lon;
    
    return { lat, lon };
  }).filter(Boolean);
}

/**
 * Calculate distance between two points in nautical miles using Haversine formula
 */
function distanceNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Interpolate position along route at given time
 */
function getPositionAtTime(flight, timeSeconds) {
  const route = parseRoute(flight.route);
  if (route.length === 0) return null;
  if (route.length === 1) return { ...route[0], altitude: flight.altitude };
  
  const departureTime = flight["departure time"];
  if (!departureTime) return null;
  
  const elapsedSeconds = timeSeconds - departureTime;
  if (elapsedSeconds < 0) return null;
  
  // Calculate total distance and time
  let totalDistance = 0;
  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += distanceNM(
      route[i].lat,
      route[i].lon,
      route[i + 1].lat,
      route[i + 1].lon
    );
  }
  
  // If single point or zero distance, return that point
  if (totalDistance === 0 || route.length === 1) {
    return { ...route[0], altitude: flight.altitude };
  }
  
  // Speed in knots, convert to NM per second
  const speedNMps = (flight["aircraft speed"] || 400) / 3600;
  const totalTimeSeconds = totalDistance / speedNMps;
  
  if (elapsedSeconds > totalTimeSeconds || totalTimeSeconds === 0) {
    // Past end of route, return last point
    return { ...route[route.length - 1], altitude: flight.altitude };
  }
  
  // Find which segment we're in
  let distanceTraveled = elapsedSeconds * speedNMps;
  for (let i = 0; i < route.length - 1; i++) {
    const segmentDistance = distanceNM(
      route[i].lat,
      route[i].lon,
      route[i + 1].lat,
      route[i + 1].lon
    );
    
    if (distanceTraveled <= segmentDistance || segmentDistance === 0) {
      // Interpolate along this segment
      const ratio = segmentDistance === 0 ? 1 : distanceTraveled / segmentDistance;
      const lat = route[i].lat + (route[i + 1].lat - route[i].lat) * ratio;
      const lon = route[i].lon + (route[i + 1].lon - route[i].lon) * ratio;
      return { lat, lon, altitude: flight.altitude };
    }
    
    distanceTraveled -= segmentDistance;
  }
  
  return { ...route[route.length - 1], altitude: flight.altitude };
}

/**
 * Sample all flights at minute intervals and detect conflicts
 */
export function analyzeFlights(flights) {
  if (!flights || flights.length === 0) {
    return { conflicts: [], hotspots: [] };
  }
  
  // Find time range
  const departureTimes = flights
    .map((f) => f["departure time"])
    .filter(Boolean);
  if (departureTimes.length === 0) {
    return { conflicts: [], hotspots: [] };
  }
  
  const minTime = Math.min(...departureTimes);
  const maxTime = Math.max(...departureTimes);
  
  // Estimate max time (add 4 hours for flight duration)
  const analysisEndTime = maxTime + 4 * 3600;
  
  // Sample at 1-minute intervals
  const conflicts = [];
  const conflictSet = new Set(); // To avoid duplicates
  
  // Grid for hotspot clustering (0.5 degree bins)
  const gridSize = 0.5;
  const hotspotGrid = new Map();
  
  // Sample every minute
  for (let time = minTime; time <= analysisEndTime; time += 60) {
    const positions = [];
    
    // Get all flight positions at this time
    for (const flight of flights) {
      const pos = getPositionAtTime(flight, time);
      if (pos) {
        positions.push({
          flightId: flight.ACID,
          flight,
          ...pos,
        });
      }
    }
    
    // Check for conflicts (5NM horizontal, 2000ft vertical)
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i];
        const p2 = positions[j];
        
        const horizontalDist = distanceNM(p1.lat, p1.lon, p2.lat, p2.lon);
        const verticalDist = Math.abs(p1.altitude - p2.altitude);
        
        if (horizontalDist < 5 && verticalDist < 2000) {
          // Conflict detected
          const conflictKey = `${Math.min(p1.flightId, p2.flightId)}-${Math.max(p1.flightId, p2.flightId)}-${time}`;
          
          if (!conflictSet.has(conflictKey)) {
            conflictSet.add(conflictKey);
            conflicts.push({
              flight1: p1.flightId,
              flight2: p2.flightId,
              time: time,
              lat: (p1.lat + p2.lat) / 2,
              lon: (p1.lon + p2.lon) / 2,
              altitude: (p1.altitude + p2.altitude) / 2,
              horizontalDistance: horizontalDist,
              verticalDistance: verticalDist,
            });
            
            // Add to hotspot grid
            const gridLat = Math.floor(p1.lat / gridSize) * gridSize;
            const gridLon = Math.floor(p1.lon / gridSize) * gridSize;
            const gridKey = `${gridLat},${gridLon}`;
            
            if (!hotspotGrid.has(gridKey)) {
              hotspotGrid.set(gridKey, {
                lat: gridLat + gridSize / 2,
                lon: gridLon + gridSize / 2,
                count: 0,
                conflicts: [],
              });
            }
            
            const hotspot = hotspotGrid.get(gridKey);
            hotspot.count++;
            hotspot.conflicts.push({
              flight1: p1.flightId,
              flight2: p2.flightId,
              time: time,
            });
          }
        }
      }
    }
  }
  
  // Convert hotspot grid to array and sort by count
  const hotspots = Array.from(hotspotGrid.values())
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((h) => ({
      lat: h.lat,
      lon: h.lon,
      count: h.count,
      conflicts: h.conflicts.slice(0, 10), // Limit conflicts per hotspot
    }));
  
  return { conflicts, hotspots };
}

