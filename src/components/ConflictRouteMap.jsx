import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Common waypoints in Canada
const COMMON_WAYPOINTS = [
  { name: "Alberta/Saskatchewan border", coords: [49.97, -110.935] },
  { name: "Manitoba", coords: [49.64, -92.114] },
  { name: "Eastern Ontario", coords: [45.88, -78.031] },
  { name: "Quebec", coords: [50.18, -71.405] },
  { name: "Northern Ontario", coords: [49.82, -86.449] },
  { name: "Central Saskatchewan", coords: [52.45, -105.22] },
  { name: "British Columbia", coords: [48.22, -118.55] },
  { name: "Northern Ontario", coords: [46.15, -84.33] },
  { name: "Eastern Quebec", coords: [47.50, -69.88] },
  { name: "Central Manitoba", coords: [51.33, -100.44] },
  { name: "Alberta Rockies", coords: [50.77, -115.66] },
  { name: "Eastern Ontario", coords: [44.55, -75.22] },
];

// Major Canadian airports
const CANADIAN_AIRPORTS = [
  { code: "CYYZ", name: "Toronto Pearson", city: "Toronto, ON", coords: [43.68, -79.63] },
  { code: "CYVR", name: "Vancouver International", city: "Vancouver, BC", coords: [49.19, -123.18] },
  { code: "CYUL", name: "Montreal-Trudeau", city: "Montreal, QC", coords: [45.47, -73.74] },
  { code: "CYYC", name: "Calgary International", city: "Calgary, AB", coords: [51.11, -114.02] },
  { code: "CYOW", name: "Ottawa Macdonald-Cartier", city: "Ottawa, ON", coords: [45.32, -75.67] },
  { code: "CYWG", name: "Winnipeg Richardson", city: "Winnipeg, MB", coords: [49.91, -97.24] },
  { code: "CYHZ", name: "Halifax Stanfield", city: "Halifax, NS", coords: [44.88, -63.51] },
  { code: "CYEG", name: "Edmonton International", city: "Edmonton, AB", coords: [53.31, -113.58] },
  { code: "CYQB", name: "Quebec City Jean Lesage", city: "Quebec City, QC", coords: [46.79, -71.39] },
  { code: "CYYJ", name: "Victoria International", city: "Victoria, BC", coords: [48.65, -123.43] },
  { code: "CYYT", name: "St. John's International", city: "St. John's, NL", coords: [47.62, -52.75] },
  { code: "CYXE", name: "Saskatoon International", city: "Saskatoon, SK", coords: [52.17, -106.70] },
];

// Lookup map for airports by ICAO code
const AIRPORTS_BY_CODE = new Map(CANADIAN_AIRPORTS.map(a => [a.code, a]));

// Create DivIcons for waypoints and airports (no PNG assets)
const waypointDivIcon = L.divIcon({
  className: "leaflet-divicon-waypoint",
  html: `
    <div style="
      font-size: 22px;
      line-height: 22px;
      transform: translate(-50%, -100%);
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.7));
      user-select: none;
    ">📍</div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

const airportDivIcon = L.divIcon({
  className: "leaflet-divicon-airport",
  html: `
    <div style="
      font-size: 20px;
      line-height: 20px;
      transform: translate(-50%, -100%);
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.7));
      user-select: none;
    ">✈️</div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
});

/**
 * Parse route coordinates from string format like "49.64N/92.114W 47.50N/69.88W"
 * Returns array of [lat, lon] tuples
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
    
    return [lat, lon];
  }).filter(Boolean);
}

/**
 * Get airport coordinates from ICAO code
 * Returns [lat, lon] or null if not found
 */
function getAirportCoord(code) {
  if (!code) return null;
  const ap = AIRPORTS_BY_CODE.get(String(code).trim());
  return ap ? ap.coords : null;
}

/**
 * Get full flight path points from flight object
 * Returns array of [lat, lon] tuples: [departure, ...routeWaypoints, arrival]
 */
function getFlightPathPoints(flight) {
  if (!flight) return [];

  const depCode = flight["departure airport"];
  const arrCode = flight["arrival airport"];

  const dep = getAirportCoord(depCode);
  const arr = getAirportCoord(arrCode);

  const routePoints = parseRoute(flight.route); // already returns [lat, lon][] in order

  // Build path: dep -> routePoints -> arr
  const path = [];
  if (dep) path.push(dep);
  if (routePoints.length) path.push(...routePoints);
  if (arr) path.push(arr);

  // Dedupe consecutive identical points (optional safety)
  return path.filter((p, i) => i === 0 || p[0] !== path[i-1][0] || p[1] !== path[i-1][1]);
}

/**
 * Component to fix Leaflet map size after mount and on resize
 */
function MapSizeFix() {
  const map = useMap();
  
  useEffect(() => {
    // Let layout settle, then invalidate
    const t1 = setTimeout(() => {
      map.invalidateSize();
    }, 50);
    
    // Also invalidate after a longer delay to catch any async layout changes
    const t2 = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    
    const onResize = () => {
      map.invalidateSize();
    };
    
    window.addEventListener("resize", onResize);
    
    // Use ResizeObserver to detect container size changes
    const container = map.getContainer();
    let resizeObserver;
    if (container && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", onResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [map]);
  
  return null;
}

/**
 * Component to fit map bounds
 */
function FitBounds({ bounds }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        // Invalidate size first, then fit bounds
        map.invalidateSize();
        setTimeout(() => {
          map.fitBounds(bounds, { padding: [50, 50] });
        }, 100);
      } catch (e) {
        console.warn("Failed to fit bounds:", e);
      }
    }
  }, [map, bounds]);
  
  return null;
}

export default function ConflictRouteMap({ flightsInConflict = [], conflictPoint = null }) {
  
  // Collect all points for bounds calculation
  const allPoints = [];
  
  // Add waypoints
  COMMON_WAYPOINTS.forEach((wp) => {
    allPoints.push(wp.coords);
  });
  
  // Add airports
  CANADIAN_AIRPORTS.forEach((ap) => {
    allPoints.push(ap.coords);
  });
  
  // Add conflict point
  if (conflictPoint && Array.isArray(conflictPoint) && conflictPoint.length === 2) {
    allPoints.push(conflictPoint);
  }
  
  // Add all flight path points
  flightsInConflict.forEach((flight) => {
    const path = getFlightPathPoints(flight);
    path.forEach(pt => allPoints.push(pt));
  });
  
  // Calculate bounds
  const bounds = allPoints.length > 0 ? allPoints : [[50, -100], [50, -100]];
  
  // Generate colors for flight routes
  const routeColors = ["#646cff", "#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf"];
  
  return (
    <div className="conflict-map-card">
      <h3>Route Map</h3>
      <div className="conflict-map-container">
        <MapContainer
          center={[50, -100]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <MapSizeFix />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Common waypoints */}
          {COMMON_WAYPOINTS.map((wp, idx) => (
            <Marker key={`waypoint-${idx}`} position={wp.coords} icon={waypointDivIcon}>
              <Popup>{wp.name}</Popup>
            </Marker>
          ))}
          
          {/* Canadian airports */}
          {CANADIAN_AIRPORTS.map((ap) => (
            <Marker key={ap.code} position={ap.coords} icon={airportDivIcon}>
              <Popup>
                <strong>{ap.code}</strong> — {ap.name}<br />
                {ap.city}
              </Popup>
            </Marker>
          ))}
          
          {/* Conflict point marker */}
          {conflictPoint && Array.isArray(conflictPoint) && conflictPoint.length === 2 && (
            <Marker position={conflictPoint} icon={waypointDivIcon}>
              <Popup>Conflict Location</Popup>
            </Marker>
          )}
          
          {/* Flight routes */}
          {flightsInConflict.map((flight, idx) => {
            const path = getFlightPathPoints(flight);
            if (!path || path.length < 2) return null;
            
            const color = routeColors[idx % routeColors.length];
            const flightId = flight.ACID || flight.id || `Flight ${idx + 1}`;
            
            return (
              <Polyline
                key={`route-${flightId}-${idx}`}
                positions={path}
                pathOptions={{ color, weight: 4, opacity: 0.85 }}
              >
                <Popup>{flightId}</Popup>
              </Polyline>
            );
          })}
          
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
    </div>
  );
}

