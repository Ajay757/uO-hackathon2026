import { useMemo, useState, useEffect, useRef } from "react";
import { useFlightsData } from "../context/FlightsDataContext";
import ConflictsTable from "../components/ConflictsTable";
import HotspotsList from "../components/HotSpotsList";
import conflictsData from "../db/conflicts.json";
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

const HOTSPOT_FACTOR = 1.5;

function parseWaypointToken(token) {
  const [latRaw, lonRaw] = token.split("/");
  if (!latRaw || !lonRaw) return { lat: null, lon: null };

  const latDir = latRaw.slice(-1); // N/S
  const lonDir = lonRaw.slice(-1); // E/W
  const latVal = Number(latRaw.slice(0, -1));
  const lonVal = Number(lonRaw.slice(0, -1));

  const lat = (latDir === "S" ? -latVal : latVal);
  const lon = (lonDir === "W" ? -lonVal : lonVal);

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}

function buildHotspotRows(waypointToAcids, flights) {
  const entries = Object.entries(waypointToAcids || {});
  const F = (flights || []).length;
  const W = entries.length || 1;

  const avg = F / W;
  const threshold = Math.ceil(HOTSPOT_FACTOR * avg);

  const ranked = entries
    .map(([waypoint, acids]) => {
      const { lat, lon } = parseWaypointToken(waypoint);
      return {
        waypoint,
        lat,
        lon,
        airplanes: acids.length,
      };
    })
    .sort((a, b) => b.airplanes - a.airplanes);

  const hotspots = ranked
    .filter((r) => r.airplanes >= threshold)
    .map((r, idx) => ({
      hotspotId: idx + 1,
      ...r,
    }));

  return { hotspots, threshold, avg };
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
  const { flights, waypointToAcids } = useFlightsData();
  const stats = useMemo(() => computeDashboardStats(flights), [flights]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState(null);
  const [allConflicts, setAllConflicts] = useState(() => {
    // Load from localStorage on mount to persist across navigation
    try {
      const saved = localStorage.getItem("dashboard_all_conflicts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }); // Store all conflicts (resolved + unresolved)

  // Save allConflicts to localStorage whenever it changes
  useEffect(() => {
    if (allConflicts.length > 0) {
      localStorage.setItem("dashboard_all_conflicts", JSON.stringify(allConflicts));
    }
  }, [allConflicts]);

  // Restore analysis results from localStorage on mount (only if conflicts exist and no current results)
  // Don't auto-restore on mount - user must click "Run Analysis" to see conflicts
  // This prevents conflicts from appearing as resolved before analysis is run
  // Conflicts will be restored from localStorage when handleRunAnalysis runs

  // Compute waypoint-based hotspots
  const { hotspots: waypointHotspots, threshold, avg } = useMemo(
    () => buildHotspotRows(waypointToAcids, flights),
    [waypointToAcids, flights]
  );

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

    console.log("[WaypointMap] Flights loaded:", flights.length);
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
        // Load conflicts from conflicts.json (Python-generated)
        // Format: [["ACA248", "PAL169", 72], ["PAL789", "PAL169", 81], ...]
        // Last element is time offset in seconds, rest are ACIDs
        // IMPORTANT: Start with all conflicts as unresolved by default
        const newConflicts = conflictsData.map((conflictArray, idx) => {
          if (!Array.isArray(conflictArray) || conflictArray.length < 2) {
            return null;
          }
          
          // Last element is time offset, rest are ACIDs
          const tAfterDeparture = typeof conflictArray[conflictArray.length - 1] === 'number' 
            ? conflictArray[conflictArray.length - 1] 
            : null;
          const acids = typeof conflictArray[conflictArray.length - 1] === 'number'
            ? conflictArray.slice(0, -1)
            : conflictArray;
          
          return {
            id: `conflict-${idx + 1}`,
            conflictId: idx + 1,
            flight1: acids[0] || "N/A",
            flight2: acids[1] || "N/A",
            flightAId: acids[0],
            flightBId: acids[1],
            acids: acids,
            tAfterDeparture: tAfterDeparture,
            // Python conflicts don't have distance/location data
            time: null,
            horizontalDistance: null,
            verticalDistance: null,
            lat: null,
            lon: null,
            resolved: false, // Initially all conflicts are unresolved
          };
        }).filter(Boolean);

        // Preserve resolved status ONLY from conflicts that were resolved in the CURRENT session
        // We check allConflicts, but only if it matches the current analysis session
        // Create a map of resolved conflicts by their key
        const resolvedMap = new Map();
        
        // Only preserve resolved status if we have current analysisResults from this session
        // This prevents stale localStorage data from marking all conflicts as resolved
        if (analysisResults && analysisResults.conflicts && allConflicts.length > 0) {
          // Build a set of conflict keys from current analysis results
          const currentConflictKeys = new Set(analysisResults.conflicts.map(c => getConflictKey(c)));
          
          // Only preserve conflicts that were resolved AND exist in current analysis results
          // This ensures we're only preserving status from the same analysis session
          allConflicts.forEach(conflict => {
            if (conflict.resolved === true) {
              const key = getConflictKey(conflict);
              // Only add to resolvedMap if this conflict exists in current analysis results
              if (currentConflictKeys.has(key)) {
                resolvedMap.set(key, conflict);
              }
            }
          });
        }
        
        // Note: We don't check localStorage "conflict_resolutions" here because that's for
        // manual resolution from ConflictResolver page, which uses a different system

        // Merge: mark conflicts as resolved ONLY if they were explicitly resolved before
        // Default to unresolved for all new conflicts
        const conflicts = newConflicts.map(conflict => {
          const key = getConflictKey(conflict);
          const previouslyResolved = resolvedMap.get(key);
          if (previouslyResolved && previouslyResolved.resolved === true) {
            // Only preserve resolved status if it was explicitly resolved
            // Preserve resolved status and original conflictId
            return {
              ...conflict,
              resolved: true,
              conflictId: previouslyResolved.conflictId || conflict.conflictId,
              id: previouslyResolved.id || conflict.id,
            };
          }
          // Default: all conflicts start as unresolved
          return {
            ...conflict,
            resolved: false,
          };
        });

        // Add any resolved conflicts that are no longer in the new conflicts list
        const newConflictKeys = new Set(conflicts.map(c => getConflictKey(c)));
        const missingResolved = allConflicts.filter(c => {
          const key = getConflictKey(c);
          return c.resolved && !newConflictKeys.has(key);
        });

        // Combine: unresolved first, then resolved (including missing ones)
        const unresolvedConflicts = conflicts.filter(c => !c.resolved);
        const resolvedConflicts = [
          ...conflicts.filter(c => c.resolved),
          ...missingResolved,
        ].sort((a, b) => (a.conflictId || 0) - (b.conflictId || 0));

        const sortedConflicts = [...unresolvedConflicts, ...resolvedConflicts];
        
        // Store all conflicts (for tracking resolved status)
        setAllConflicts(sortedConflicts);
        setAnalysisResults({ conflicts: sortedConflicts, hotspots: [] });
      } catch (error) {
        console.error("Analysis error:", error);
        setAnalysisResults({ conflicts: [], hotspots: [] });
        setAllConflicts([]);
      } finally {
        setAnalyzing(false);
      }
    }, 0);
  }

  // Helper function to create a stable conflict key for comparison
  function getConflictKey(conflict) {
    const acids = conflict.acids || 
      (conflict.flight1 && conflict.flight2 ? [conflict.flight1, conflict.flight2] : 
      (conflict.flightAId && conflict.flightBId ? [conflict.flightAId, conflict.flightBId] : []));
    const timestamp = conflict.tAfterDeparture || conflict.time || '';
    // Sort ACIDs for consistent key (so ["A", "B"] == ["B", "A"])
    return `${acids.sort().join(',')}:${timestamp}`;
  }

  async function handleResolveConflicts() {
    if (!analysisResults || !analysisResults.conflicts || analysisResults.conflicts.length === 0) {
      alert("Please run analysis first to detect conflicts.");
      return;
    }

<<<<<<< Updated upstream
    // Count only unresolved conflicts
    const unresolvedCount = analysisResults.conflicts.filter(conflict => {
      try {
        const resolutions = JSON.parse(localStorage.getItem("conflict_resolutions") || "{}");
        const localStorageStatus = conflict.id ? resolutions[conflict.id] : null;
        return !(conflict.resolved === true || localStorageStatus);
      } catch {
        return !conflict.resolved;
      }
    }).length;

    setResolving(true);
    setResolveProgress({ iteration: 0, conflicts: unresolvedCount, status: "Starting..." });
=======
    setResolving(true);
    setResolveProgress({ iteration: 0, conflicts: analysisResults.conflicts.length, status: "Starting..." });
>>>>>>> Stashed changes

    try {
      const response = await fetch("/api/resolve-conflicts", {
        method: "POST",
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("Conflict resolution error:", data);
        alert(`Failed to resolve conflicts: ${data.error || "Unknown error"}`);
        setResolveProgress(null);
        return;
      }

      // Parse the conflicts from the response (these are the remaining unresolved conflicts)
      const remainingConflicts = data.conflicts.map((conflictArray, idx) => {
        if (!Array.isArray(conflictArray) || conflictArray.length < 2) {
          return null;
        }
        
        const tAfterDeparture = typeof conflictArray[conflictArray.length - 1] === 'number' 
          ? conflictArray[conflictArray.length - 1] 
          : null;
        const acids = typeof conflictArray[conflictArray.length - 1] === 'number'
          ? conflictArray.slice(0, -1)
          : conflictArray;
        
        return {
          id: `conflict-${idx + 1}`,
          conflictId: idx + 1,
          flight1: acids[0] || "N/A",
          flight2: acids[1] || "N/A",
          flightAId: acids[0],
          flightBId: acids[1],
          acids: acids,
          tAfterDeparture: tAfterDeparture,
          time: null,
          horizontalDistance: null,
          verticalDistance: null,
          lat: null,
          lon: null,
          resolved: false, // These are unresolved
        };
      }).filter(Boolean);

      // Create a set of remaining conflict keys for comparison
      const remainingKeys = new Set(remainingConflicts.map(c => getConflictKey(c)));

      // Fetch current simulation state to see what changes were made
      let planeStates = {};
      try {
        const stateResponse = await fetch("/api/get-simulation-state");
        if (stateResponse.ok) {
          const stateData = await stateResponse.json();
          if (stateData.ok && stateData.state) {
            // Create a map of ACID -> plane state
            stateData.state.forEach(plane => {
              if (plane.ACID) {
                planeStates[plane.ACID] = {
                  altitude: plane.altitude,
                  speed: plane["aircraft speed"],
                  changes: plane.changes || 0,
                };
              }
            });
          }
        }
      } catch (e) {
        console.warn("Could not fetch simulation state:", e);
      }

      // Mark all original conflicts: resolved if not in remaining, unresolved if in remaining
      const updatedAllConflicts = allConflicts.map(conflict => {
        const key = getConflictKey(conflict);
        const isResolved = !remainingKeys.has(key);
        
        // If resolved, generate resolution details
        let resolutionDetails = null;
        if (isResolved) {
          const acids = conflict.acids || 
            (conflict.flight1 && conflict.flight2 ? [conflict.flight1, conflict.flight2] : 
            (conflict.flightAId && conflict.flightBId ? [conflict.flightAId, conflict.flightBId] : []));
          
          const changes = acids
            .map(acid => {
              const plane = planeStates[acid];
              if (!plane || plane.changes === 0) return null;
              return {
                acid,
                changes: plane.changes,
                altitude: plane.altitude,
                speed: plane.speed,
              };
            })
            .filter(Boolean);
          
          if (changes.length > 0) {
            resolutionDetails = {
              method: "Automatic resolution via altitude/speed adjustments",
              timestamp: new Date().toISOString(),
              planesModified: changes.map(c => ({
                flight: c.acid,
                adjustments: c.changes > 0 ? `${c.changes} adjustment(s) made` : "No adjustments",
                finalAltitude: c.altitude ? `${c.altitude.toLocaleString()} ft` : null,
                finalSpeed: c.speed ? `${c.speed} knots` : null,
              })),
            };
          } else {
            resolutionDetails = {
              method: "Automatic resolution via conflict resolution algorithm",
              timestamp: new Date().toISOString(),
              planesModified: [],
            };
          }
        }
        
        return {
          ...conflict,
          resolved: isResolved,
          resolutionDetails: conflict.resolutionDetails || resolutionDetails, // Preserve existing or set new
        };
      });

      // Combine: unresolved conflicts first, then resolved conflicts
      // Unresolved conflicts should use the latest data from remainingConflicts
      const unresolvedConflicts = remainingConflicts.map(remaining => {
        // Find matching conflict in allConflicts to preserve original ID/index
        const original = allConflicts.find(c => getConflictKey(c) === getConflictKey(remaining));
        return {
          ...remaining,
          id: original?.id || remaining.id,
          conflictId: original?.conflictId || remaining.conflictId,
          resolved: false,
        };
      });

      const resolvedConflicts = updatedAllConflicts.filter(c => c.resolved);

      // Sort: unresolved first, then resolved (by original conflictId)
      const sortedConflicts = [
        ...unresolvedConflicts.sort((a, b) => (a.conflictId || 0) - (b.conflictId || 0)),
        ...resolvedConflicts.sort((a, b) => (a.conflictId || 0) - (b.conflictId || 0)),
      ];

      // Update all conflicts and analysis results
      setAllConflicts(sortedConflicts);
      setAnalysisResults({ conflicts: sortedConflicts, hotspots: analysisResults.hotspots || [] });
      
      const initialCount = allConflicts.length;
      const finalCount = unresolvedConflicts.length;
      // Calculate how many conflicts were actually resolved (total - remaining)
      const resolvedCount = initialCount - finalCount;

      setResolveProgress({
        iteration: "Complete",
        conflicts: finalCount,
        status: `Resolved ${resolvedCount} Conflicts`,
        success: true,
      });

      // Clear progress after 5 seconds
      setTimeout(() => {
        setResolveProgress(null);
      }, 5000);
    } catch (error) {
      console.error("Resolve conflicts failed:", error);
      alert(`Failed to resolve conflicts: ${error.message}`);
      setResolveProgress(null);
    } finally {
      setResolving(false);
    }
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
            <div className="analysis-buttons">
              <button
                onClick={handleRunAnalysis}
                disabled={analyzing || resolving}
                className="analysis-button"
              >
                {analyzing ? "Analyzing..." : "Run Analysis"}
              </button>
              {analysisResults && analysisResults.conflicts && (() => {
                // Count unresolved conflicts
                const unresolvedCount = analysisResults.conflicts.filter(conflict => {
                  // Check both conflict.resolved flag and localStorage
                  try {
                    const resolutions = JSON.parse(localStorage.getItem("conflict_resolutions") || "{}");
                    const localStorageStatus = conflict.id ? resolutions[conflict.id] : null;
                    return !(conflict.resolved === true || localStorageStatus);
                  } catch {
                    return !conflict.resolved;
                  }
                }).length;
                
                // Only show button if there are more than 3 unresolved conflicts
                return unresolvedCount > 3 ? (
                  <button
                    onClick={handleResolveConflicts}
                    disabled={analyzing || resolving}
                    className="resolve-button"
                  >
                    {resolving ? "Resolving..." : `Resolve Conflicts (${unresolvedCount})`}
                  </button>
                ) : null;
              })()}
            </div>
            {resolveProgress && (
              <div className="resolve-progress">
                <p className="resolve-status">
                  {resolveProgress.success ? "✅ " : "🔄 "}
                  {resolveProgress.status}
                </p>
                {resolveProgress.iteration !== "Complete" && (
                  <p className="resolve-details">
                    Iteration: {resolveProgress.iteration} | Conflicts: {resolveProgress.conflicts}
                  </p>
                )}
              </div>
            )}
            {analysisResults && (
              <div className="analysis-results">
                <ConflictsTable conflicts={analysisResults.conflicts || []} />
                <HotspotsList hotspots={waypointHotspots || []} threshold={threshold} avg={avg} />
              </div>
            )}
            {!analysisResults && !analyzing && (
              <div>
                <p className="analysis-hint">Click "Run Analysis" to detect conflicts</p>
                <HotspotsList hotspots={waypointHotspots || []} threshold={threshold} avg={avg} />
              </div>
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

