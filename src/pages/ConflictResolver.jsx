import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
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
  const location = useLocation();
  const { flights } = useFlightsData();
  const [resolution, setResolution] = useState(null);

  // Get conflict data from router state (passed from ConflictsTable)
  const conflictFromState = location.state?.conflict;
  const acidsFromState = location.state?.acids;

  // Load conflicts and find the matching one
  const { conflict, flightsInConflict, conflictPoint } = useMemo(() => {
    // Use conflict data from router state if available
    if (conflictFromState) {
      const conflict = conflictFromState;
      
      // Get ACIDs from state or from conflict object
      const flightIds = acidsFromState || conflict.acids || 
        (conflict.flight1 && conflict.flight2 ? [conflict.flight1, conflict.flight2] : 
        (conflict.flightAId && conflict.flightBId ? [conflict.flightAId, conflict.flightBId] : []));
      
      if (flightIds.length === 0) {
        return { conflict: null, flightsInConflict: [], conflictPoint: null };
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

      // Compute conflict point (Python conflicts don't have lat/lon)
      let conflictPoint = null;
      if (conflict.lat != null && conflict.lon != null) {
        conflictPoint = [conflict.lat, conflict.lon];
      } else if (conflict.latitude != null && conflict.longitude != null) {
        conflictPoint = [conflict.latitude, conflict.longitude];
      }

      return { conflict, flightsInConflict, conflictPoint };
    }

    // No conflict data from state - return empty
    return { conflict: null, flightsInConflict: [], conflictPoint: null };
  }, [conflictId, flights, conflictFromState, acidsFromState]);

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

  // Python conflicts don't have distance data, so default to Medium severity
  const severity = (conflict.horizontalDistance != null && conflict.verticalDistance != null && 
                    conflict.horizontalDistance < 2 && conflict.verticalDistance < 1000) 
                    ? "High" : "Medium";

  // Get all ACIDs involved in the conflict
  const allAcids = conflict.acids || 
    (conflict.flight1 && conflict.flight2 ? [conflict.flight1, conflict.flight2] : 
    (conflict.flightAId && conflict.flightBId ? [conflict.flightAId, conflict.flightBId] : []));

  // Route colors matching ConflictRouteMap
  const routeColors = ["#646cff", "#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf"];

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
          </div>
        </div>

        {/* Resolution Details Section - Only show if conflict is resolved */}
        {conflict.resolved && conflict.resolutionDetails && (
          <div className="resolution-details-card">
            <h2>Resolution Details</h2>
            <div className="resolution-details-content">
              <p className="resolution-method">
                <strong>Method:</strong> {conflict.resolutionDetails.method}
              </p>
              {conflict.resolutionDetails.planesModified && conflict.resolutionDetails.planesModified.length > 0 && (
                <div className="planes-modified">
                  <strong>Planes Modified:</strong>
                  <ul>
                    {conflict.resolutionDetails.planesModified.map((plane, idx) => (
                      <li key={idx}>
                        <strong>{plane.flight}:</strong> {plane.adjustments}
                        {plane.finalAltitude && ` - Final altitude: ${plane.finalAltitude}`}
                        {plane.finalSpeed && ` - Final speed: ${plane.finalSpeed}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {conflict.resolutionDetails.timestamp && (
                <p className="resolution-timestamp">
                  <strong>Resolved at:</strong> {new Date(conflict.resolutionDetails.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flight-cards">
          {flightsInConflict.map((flight, index) => {
            const acid = allAcids[index] || flight.ACID || `Flight ${index + 1}`;
            const flightLabel = flightsInConflict.length > 2 
              ? `Flight ${String.fromCharCode(65 + index)}: ${acid}` 
              : index === 0 ? `Flight A: ${acid}` : `Flight B: ${acid}`;
            const routeColor = routeColors[index % routeColors.length];
            
            return (
              <div 
                key={acid || index} 
                className="flight-card"
                style={{ borderLeft: `4px solid ${routeColor}` }}
              >
                <h3>
                  {flightLabel}
                  <span 
                    className="route-color-indicator"
                    style={{ 
                      backgroundColor: routeColor,
                      display: "inline-block",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      marginLeft: "8px",
                      verticalAlign: "middle"
                    }}
                    title={`Route color: ${routeColor}`}
                  />
                </h3>
                {flight ? (
                  <div className="flight-info">
                    <p><strong>Type:</strong> {flight["Plane type"] || "N/A"}</p>
                    <p><strong>Route:</strong> {flight.route || "N/A"}</p>
                    <p><strong>Departure:</strong> {flight["departure airport"] || "N/A"}</p>
                    <p><strong>Arrival:</strong> {flight["arrival airport"] || "N/A"}</p>
                    <p><strong>Altitude:</strong> {flight.altitude ? `${flight.altitude.toLocaleString()} ft` : "N/A"}</p>
                    <p style={{ marginTop: "8px", fontSize: "0.9em", color: routeColor }}>
                      <strong>Route Color:</strong> <span style={{ color: routeColor, fontWeight: "bold" }}>●</span> {routeColor}
                    </p>
                  </div>
                ) : (
                  <p className="flight-not-found">Flight data not found</p>
                )}
              </div>
            );
          })}
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

