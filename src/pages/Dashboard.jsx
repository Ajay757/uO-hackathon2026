import { useMemo, useState } from "react";
import flights250 from "../db/flights.json";
import { analyzeFlights } from "../utils/simpleAnalysis";
import { buildWaypointToAcidsMap } from "../utils/routeUtils";
import ConflictsTable from "../components/ConflictsTable";
import HotspotsList from "../components/HotSpotsList";
import "./Dashboard.css";

const TZ_NAME = "America/Montreal";

function getHourInTimeZone(unixSeconds, timeZone = TZ_NAME) {
  // returns hour 0..23 in the requested time zone
  const d = new Date(Number(unixSeconds) * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hourPart = parts.find((p) => p.type === "hour")?.value;
  return hourPart != null ? Number(hourPart) : null;
}

function timeBucketColabStyle(hour) {
  if (!Number.isFinite(hour)) return "Unknown";
  // Night: 21:00–04:59
  if (hour >= 21 || hour < 5) return "Night";
  // Morning: 05:00–11:59
  if (hour >= 5 && hour < 12) return "Morning";
  // Afternoon: 12:00–16:59
  if (hour >= 12 && hour < 17) return "Afternoon";
  // Evening: 17:00–20:59
  if (hour >= 17 && hour < 21) return "Evening";
  return "Unknown";
}


function computeDashboardStats(flights) {
  if (!flights || flights.length === 0) {
    return {
      totalFlights: 0,
      timeRange: { min: null, max: null },
      timeOfDayBuckets: { night: 0, morning: 0, afternoon: 0, evening: 0, unknown: 0 },
      passengerVsCargo: { passenger: 0, cargo: 0 },
      aircraftTypeCounts: {},
      altitudeHistogram: {},
      topRoutes: [],
    };
  }

  // Time range
  const departureTimes = flights.map((f) => f["departure time"]).filter(Boolean);
  const minTime = departureTimes.length > 0 ? Math.min(...departureTimes) : null;
  const maxTime = departureTimes.length > 0 ? Math.max(...departureTimes) : null;

  // Time of day buckets using America/Montreal timezone
  // Night: 21:00–04:59, Morning: 05:00–11:59, Afternoon: 12:00–16:59, Evening: 17:00–20:59
  const timeOfDayBuckets = {
    night: 0,
    morning: 0,
    afternoon: 0,
    evening: 0,
    unknown: 0,
  };
  
  flights.forEach((flight) => {
    const t = Number(flight["departure time"]);
    
    if (!Number.isFinite(t)) {
      timeOfDayBuckets.unknown++;
      return;
    }
    
    const hour = getHourInTimeZone(t, TZ_NAME);
    
    if (hour == null) {
      timeOfDayBuckets.unknown++;
      return;
    }
    
    const bucket = timeBucketColabStyle(hour);
    const bucketKey = bucket.toLowerCase();
    
    if (timeOfDayBuckets.hasOwnProperty(bucketKey)) {
      timeOfDayBuckets[bucketKey]++;
    } else {
      timeOfDayBuckets.unknown++;
    }
  });

  // Passenger vs Cargo
  const passengerVsCargo = {
    passenger: flights.filter((f) => !f.is_cargo).length,
    cargo: flights.filter((f) => f.is_cargo).length,
  };

  // Aircraft type counts
  const aircraftTypeCounts = {};
  flights.forEach((flight) => {
    const type = flight["Plane type"] || "Unknown";
    aircraftTypeCounts[type] = (aircraftTypeCounts[type] || 0) + 1;
  });

  // Altitude histogram (bins of 5000 ft)
  const altitudeHistogram = {};
  flights.forEach((flight) => {
    if (flight.altitude) {
      const bin = Math.floor(flight.altitude / 5000) * 5000;
      altitudeHistogram[bin] = (altitudeHistogram[bin] || 0) + 1;
    }
  });

  // Top routes (by frequency)
  const routeCounts = {};
  flights.forEach((flight) => {
    const dep = flight["departure airport"];
    const arr = flight["arrival airport"];
    if (dep && arr) {
      const route = `${dep} → ${arr}`;
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    }
  });

  const topRoutes = Object.entries(routeCounts)
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalFlights: flights.length,
    timeRange: { min: minTime, max: maxTime },
    timeOfDayBuckets,
    passengerVsCargo,
    aircraftTypeCounts,
    altitudeHistogram,
    topRoutes,
  };
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "N/A";
  return new Date(timestamp * 1000).toLocaleString();
}

export default function Dashboard() {
  const stats = useMemo(() => computeDashboardStats(flightsData), []);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Build waypoint→ACIDs map
  const waypointToAcids = buildWaypointToAcidsMap(flights250);

  // Waypoints to check explicitly
  const mustCheck = [
    "49.97N/110.935W",
    "49.64N/92.114W",
    "45.88N/78.031W",
    "50.18N/71.405W",
    "49.82N/86.449W",
    "52.45N/105.22W",
    "48.22N/118.55W",
    "46.15N/84.33W",
    "47.50N/69.88W",
    "51.33N/100.44W",
    "50.77N/115.66W",
    "44.55N/75.22W",
  ];

  // Helper to find similar keys (for debugging missing tokens)
  function findSimilarKeys(map, wp) {
    // Use the lat part as a quick "similarity" prefix, e.g. "49.97N"
    const prefix = wp.split("/")[0];
    return Object.keys(map)
      .filter((k) => k.startsWith(prefix))
      .slice(0, 10);
  }

  // Terminal-only logging (once per page load)
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;

    const entries = Object.entries(waypointToAcids);

    console.log("[WaypointMap] Flights loaded:", flights250.length);
    console.log("[WaypointMap] Unique waypoints:", entries.length);

    const top10 = entries
      .map(([wp, acids]) => ({ wp, n: acids.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    console.log("[WaypointMap] Top 10 busiest:", top10);
    console.log("[WaypointMap] Sample entries:", entries.slice(0, 5));

    // Manual waypoint checks
    console.log("[WaypointMap] Manual waypoint checks:");
    mustCheck.forEach((wp) => {
      const acids = waypointToAcids[wp];

      if (!acids) {
        console.log(`- ${wp}: NOT FOUND (possible token mismatch)`);
        console.log("  Similar keys:", findSimilarKeys(waypointToAcids, wp));
      } else {
        console.log(`- ${wp}: ${acids.length} flights`);
        console.log(`  ACIDs: ${acids.join(", ")}`);
      }
    });
  }, [waypointToAcids]);

  function handleRunAnalysis() {
    setAnalyzing(true);
    // Run analysis in a timeout to avoid blocking UI
    setTimeout(() => {
      try {
        const results = analyzeFlights(flightsData);
        setAnalysisResults(results);
      } catch (error) {
        console.error("Analysis error:", error);
        setAnalysisResults({ conflicts: [], hotspots: [] });
      } finally {
        setAnalyzing(false);
      }
    }, 0);
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Flight Analytics Dashboard</h1>

      <div className="dashboard-main-grid">
        {/* Summary Cards - Left Column */}
        <div className="dashboard-summary">
          <div className="summary-cards">
            <div className="dashboard-card">
              <h3>Total Flights</h3>
              <p className="stat-value">{stats.totalFlights.toLocaleString()}</p>
            </div>

            <div className="dashboard-card">
              <h3>Time Range</h3>
              <p className="stat-value-small">
                {stats.timeRange.min ? formatTimestamp(stats.timeRange.min) : "N/A"}
              </p>
              <p className="stat-value-small">
                {stats.timeRange.max ? formatTimestamp(stats.timeRange.max) : "N/A"}
              </p>
            </div>

            <div className="dashboard-card">
              <h3>Passenger Flights</h3>
              <p className="stat-value">{stats.passengerVsCargo.passenger.toLocaleString()}</p>
            </div>

            <div className="dashboard-card">
              <h3>Cargo Flights</h3>
              <p className="stat-value">{stats.passengerVsCargo.cargo.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Charts - Middle Column */}
        <div className="dashboard-charts">
          {/* Passenger vs Cargo Chart */}
          <div className="dashboard-card">
            <h3>Passenger vs Cargo Distribution</h3>
            <div className="distribution-chart">
              <div className="distribution-bar">
                <div
                  className="distribution-segment passenger"
                  style={{
                    width: `${(stats.passengerVsCargo.passenger / stats.totalFlights) * 100}%`,
                  }}
                >
                  <span>
                    Passenger: {stats.passengerVsCargo.passenger.toLocaleString()} (
                    {((stats.passengerVsCargo.passenger / stats.totalFlights) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div
                  className="distribution-segment cargo"
                  style={{
                    width: `${(stats.passengerVsCargo.cargo / stats.totalFlights) * 100}%`,
                  }}
                >
                  <span>
                    Cargo: {stats.passengerVsCargo.cargo.toLocaleString()} (
                    {((stats.passengerVsCargo.cargo / stats.totalFlights) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Time of Day Chart */}
          <div className="dashboard-card">
            <h3>Flights by Time of Day</h3>
            <div className="tod-grid">
              {[
                { key: "night", label: "Night", range: "0–6" },
                { key: "morning", label: "Morning", range: "6–12" },
                { key: "afternoon", label: "Afternoon", range: "12–18" },
                { key: "evening", label: "Evening", range: "18–24" },
              ].map(({ key, label, range }) => {
                const total = stats.totalFlights || 1;
                const count = Number.isFinite(stats.timeOfDayBuckets?.[key])
                  ? stats.timeOfDayBuckets[key]
                  : 0;
                const pct = (count / total) * 100;
                
                return (
                  <div key={key} className="tod-card">
                    <div className="tod-label">
                      {label} <span className="tod-range">({range})</span>
                    </div>
                    <div className="tod-count">{count.toLocaleString()}</div>
                    <div className="tod-percentage">{pct.toFixed(1)}%</div>
                    <div className="tod-bar">
                      <div
                        className="tod-barFill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Altitude Histogram */}
          <div className="dashboard-card">
            <h3>Altitude Distribution (ft)</h3>
            <div className="altitude-histogram">
              {Object.entries(stats.altitudeHistogram)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([bin, count]) => (
                  <div key={bin} className="altitude-bar-container">
                    <div
                      className="altitude-bar"
                      style={{
                        height: `${(count / stats.totalFlights) * 100}%`,
                      }}
                      title={`${bin}-${Number(bin) + 5000}ft: ${count} flights`}
                    />
                    <span className="altitude-label">{bin / 1000}k</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Analysis Panel - Right Column */}
        <div className="dashboard-analysis">
          <div className="dashboard-card">
            <h3>Conflict Analysis</h3>
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="analysis-button"
            >
              {analyzing ? "Analyzing..." : "Run Analysis"}
            </button>
            {analysisResults && (
              <div className="analysis-results">
                <ConflictsTable conflicts={analysisResults.conflicts || []} />
                <HotspotsList hotspots={analysisResults.hotspots || []} />
              </div>
            )}
            {!analysisResults && !analyzing && (
              <p className="analysis-hint">Click "Run Analysis" to detect conflicts and hotspots</p>
            )}
          </div>
        </div>

        {/* Fleet - Left Column */}
        <div className="dashboard-fleet">
          <div className="dashboard-card">
            <h3>Aircraft Type Distribution</h3>
            <div className="aircraft-types-list">
              {Object.entries(stats.aircraftTypeCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([type, count]) => (
                  <div key={type} className="aircraft-type-item">
                    <span className="aircraft-type-name">{type}</span>
                    <span className="aircraft-type-count">{count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Routes - Left Column */}
        <div className="dashboard-routes">
          <div className="dashboard-card">
            <h3>Top Routes</h3>
            <table className="routes-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Flights</th>
                </tr>
              </thead>
              <tbody>
                {stats.topRoutes.map(({ route, count }, index) => (
                  <tr key={route}>
                    <td>{route}</td>
                    <td className="routes-count">{count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

