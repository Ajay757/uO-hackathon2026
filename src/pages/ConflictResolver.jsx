import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { analyzeFlights } from "../utils/simpleAnalysis";
import { useFlightsData } from "../context/FlightsDataContext";
import ConflictRouteMap from "../components/ConflictRouteMap";
import "./ConflictResolver.css";

const RESOLUTION_ACTIONS = [
  { id: "delay-a-10", label: "Delay Flight A +10 min", patch: { flight: "A", delay: 600 } },
  { id: "delay-b-10", label: "Delay Flight B +10 min", patch: { flight: "B", delay: 600 } },
  { id: "raise-a-2000", label: "Raise Flight A altitude +2000 ft", patch: { flight: "A", altitude: 2000 } },
  { id: "lower-a-2000", label: "Lower Flight A altitude -2000 ft", patch: { flight: "A", altitude: -2000 } },
];

function getResolutions() {
  try {
    return JSON.parse(localStorage.getItem("conflict_resolutions") || "{}");
  } catch {
    return {};
  }
}

function saveResolution(conflictId, resolution) {
  const resolutions = getResolutions();
  resolutions[conflictId] = resolution;
  localStorage.setItem("conflict_resolutions", JSON.stringify(resolutions));
}

function clearResolution(conflictId) {
  const resolutions = getResolutions();
  delete resolutions[conflictId];
  localStorage.setItem("conflict_resolutions", JSON.stringify(resolutions));
}

export default function ConflictResolver() {
  const { conflictId } = useParams();
  const navigate = useNavigate();
  const { flights } = useFlightsData();
  const [resolution, setResolution] = useState(null);

  // Load conflicts and find the matching one
  const { conflict, flightsInConflict, conflictPoint } = useMemo(() => {
    const results = analyzeFlights(flights);
    const conflict = results.conflicts.find((c) => c.id === conflictId);
    
    if (!conflict) {
      return { conflict: null, flightsInConflict: [], conflictPoint: null };
    }

    // Build flights list robustly - support multiple schemas
    let flightIds = [];
    if (conflict.flightIds && Array.isArray(conflict.flightIds)) {
      flightIds = conflict.flightIds;
    } else if (conflict.flights && Array.isArray(conflict.flights)) {
      flightIds = conflict.flights.map(f => f.ACID || f.id || f);
    } else {
      // Fallback to flightAId/flightBId or flight1/flight2
      const ids = [
        conflict.flightAId,
        conflict.flightBId,
        conflict.flight1,
        conflict.flight2,
      ].filter(Boolean);
      flightIds = [...new Set(ids)]; // Remove duplicates
    }

    // Create flightsById map for quick lookup
          const flightsById = new Map();
          flights.forEach((flight) => {
      if (flight.ACID) {
        flightsById.set(flight.ACID, flight);
      }
    });

    // Get flight objects
    const flightsInConflict = flightIds
      .map((id) => flightsById.get(id))
      .filter(Boolean);

    // Compute conflict point
    let conflictPoint = null;
    if (conflict.lat != null && conflict.lon != null) {
      conflictPoint = [conflict.lat, conflict.lon];
    } else if (conflict.latitude != null && conflict.longitude != null) {
      conflictPoint = [conflict.latitude, conflict.longitude];
    }

    return { conflict, flightsInConflict, conflictPoint };
  }, [conflictId, flights]);

  // Load resolution from localStorage
  useEffect(() => {
    if (conflictId) {
      const resolutions = getResolutions();
      setResolution(resolutions[conflictId] || null);
    }
  }, [conflictId]);

  if (!conflict) {
    return (
      <div className="conflict-resolver">
        <div className="conflict-resolver-wrapper">
          <h1>Conflict Not Found</h1>
          <p>Could not find conflict with ID: {conflictId}</p>
          <button onClick={() => navigate("/")} className="back-button">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  function handleApplyResolution(action) {
    const newResolution = {
      appliedAt: new Date().toISOString(),
      optionId: action.id,
      label: action.label,
      patch: action.patch,
    };
    saveResolution(conflictId, newResolution);
    setResolution(newResolution);
  }

  function handleClearResolution() {
    clearResolution(conflictId);
    setResolution(null);
  }

  const severity = conflict.horizontalDistance < 2 && conflict.verticalDistance < 1000 ? "High" : "Medium";

  const flightA = flightsInConflict[0] || null;
  const flightB = flightsInConflict[1] || null;

  return (
    <div className="conflict-resolver">
      <div className="conflict-header">
        <h1>Conflict Resolver</h1>
        <button onClick={() => navigate("/")} className="back-button">
          ← Back to Dashboard
        </button>
      </div>
      
      <div className="conflict-resolver-wrapper">
        <div className="conflict-resolver-left">
          <div className="conflict-details-card">
          <h2>Conflict Details</h2>
          <div className="conflict-details-grid">
            <div>
              <span className="detail-label">Type:</span>
              <span className="detail-value">{conflict.type || "conflict"}</span>
            </div>
            <div>
              <span className="detail-label">Severity:</span>
              <span className={`detail-value severity-${severity.toLowerCase()}`}>{severity}</span>
            </div>
            <div>
              <span className="detail-label">Time:</span>
              <span className="detail-value">{new Date(conflict.time * 1000).toLocaleString()}</span>
            </div>
            <div>
              <span className="detail-label">Horizontal Distance:</span>
              <span className="detail-value">{conflict.horizontalDistance.toFixed(2)} NM</span>
            </div>
            <div>
              <span className="detail-label">Vertical Distance:</span>
              <span className="detail-value">{conflict.verticalDistance.toFixed(0)} ft</span>
            </div>
            <div>
              <span className="detail-label">Location:</span>
              <span className="detail-value">
                {conflict.lat.toFixed(4)}, {conflict.lon.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        <div className="flight-cards">
          <div className="flight-card">
            <h3>Flight A: {conflict.flightAId || conflict.flight1}</h3>
            {flightA ? (
              <div className="flight-info">
                <p><strong>Type:</strong> {flightA["Plane type"] || "N/A"}</p>
                <p><strong>Route:</strong> {flightA.route || "N/A"}</p>
                <p><strong>Departure:</strong> {flightA["departure airport"] || "N/A"}</p>
                <p><strong>Arrival:</strong> {flightA["arrival airport"] || "N/A"}</p>
                <p><strong>Altitude:</strong> {flightA.altitude ? `${flightA.altitude.toLocaleString()} ft` : "N/A"}</p>
              </div>
            ) : (
              <p className="flight-not-found">Flight data not found</p>
            )}
          </div>

          <div className="flight-card">
            <h3>Flight B: {conflict.flightBId || conflict.flight2}</h3>
            {flightB ? (
              <div className="flight-info">
                <p><strong>Type:</strong> {flightB["Plane type"] || "N/A"}</p>
                <p><strong>Route:</strong> {flightB.route || "N/A"}</p>
                <p><strong>Departure:</strong> {flightB["departure airport"] || "N/A"}</p>
                <p><strong>Arrival:</strong> {flightB["arrival airport"] || "N/A"}</p>
                <p><strong>Altitude:</strong> {flightB.altitude ? `${flightB.altitude.toLocaleString()} ft` : "N/A"}</p>
              </div>
            ) : (
              <p className="flight-not-found">Flight data not found</p>
            )}
          </div>
        </div>

        <div className="resolution-card">
          <div className="resolution-status">
            <h2>Resolution Status</h2>
            <div className={`status-badge ${resolution ? "resolved" : "unresolved"}`}>
              {resolution ? "Resolved" : "Unresolved"}
            </div>
          </div>

          {resolution && (
            <div className="current-resolution">
              <p><strong>Applied:</strong> {new Date(resolution.appliedAt).toLocaleString()}</p>
              <p><strong>Action:</strong> {resolution.label}</p>
              <button onClick={handleClearResolution} className="clear-button">
                Clear Resolution
              </button>
            </div>
          )}

          {!resolution && (
            <div className="resolution-actions">
              <h3>Resolution Actions</h3>
              <div className="actions-grid">
                {RESOLUTION_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleApplyResolution(action)}
                    className="action-button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
        
        <ConflictRouteMap
          flightsInConflict={flightsInConflict}
          conflictPoint={conflictPoint}
        />
      </div>
    </div>
  );
}

