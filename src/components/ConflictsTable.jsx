import { useNavigate } from "react-router-dom";
import "./ConflictsTable.css";

function getResolutionStatus(conflictId) {
  try {
    const resolutions = JSON.parse(localStorage.getItem("conflict_resolutions") || "{}");
    return resolutions[conflictId] ? "Resolved" : null;
  } catch {
    return null;
  }
}

export default function ConflictsTable({ conflicts }) {
  const navigate = useNavigate();

  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="conflicts-table-container">
        <h2>Conflicts (0)</h2>
        <p className="empty-message">No conflicts detected</p>
      </div>
    );
  }

  return (
    <div className="conflicts-table-container">
      <h2>Conflicts ({conflicts.length})</h2>
      <div className="table-wrapper">
        <table className="conflicts-table">
          <thead>
            <tr>
              <th>Conflict ID</th>
              <th>Planes Involved</th>
              <th className="numeric">Time After Departure (seconds)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((conflict, index) => {
              // Support both old format (flight1, flight2) and new format (acids array)
              const acids = conflict.acids || (conflict.flight1 && conflict.flight2 ? [conflict.flight1, conflict.flight2] : []);
              const planesText = acids.length > 0 ? acids.join(", ") : "N/A";
              const timeAfterDeparture = conflict.tAfterDeparture != null ? conflict.tAfterDeparture : (conflict.time ? "N/A" : null);
              const conflictId = conflict.conflictId || conflict.id || index + 1;
              const status = conflict.id ? getResolutionStatus(conflict.id) : null;
              
              // Create a stable ID for routing
              const routeId = conflict.id || `conflict-${conflictId}-${acids.join("-")}`;
              
              return (
                <tr
                  key={routeId}
                  onClick={() => navigate(`/conflicts/${encodeURIComponent(routeId)}`, { 
                    state: { conflict, acids, tAfterDeparture: conflict.tAfterDeparture } 
                  })}
                  className="conflict-row-clickable"
                >
                  <td>{conflictId}</td>
                  <td>{planesText}</td>
                  <td className="numeric">{timeAfterDeparture != null ? timeAfterDeparture : "N/A"}</td>
                  <td>{status && <span className="resolved-badge">{status}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
  