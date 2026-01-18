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
              <th>Flights in Conflict</th>
              <th className="numeric">Time since first departure (minutes)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((conflict, index) => {
              // Generate a stable ID for routing if not present
              const conflictId = conflict.id || conflict.conflictId || `conflict-${index + 1}`;
              const status = conflict.id ? getResolutionStatus(conflict.id) : null;
              
              // Get all ACIDs involved in the conflict
              const acids = conflict.acids || 
                (conflict.flight1 && conflict.flight2 ? [conflict.flight1, conflict.flight2] : 
                (conflict.flightAId && conflict.flightBId ? [conflict.flightAId, conflict.flightBId] : []));
              const flightsText = acids.length > 0 ? acids.join(", ") : "N/A";
              
              // Convert time from seconds to minutes
              const timeMinutes = conflict.tAfterDeparture != null 
                ? (conflict.tAfterDeparture) 
                : (conflict.time ? "N/A" : "N/A");
              
              return (
                <tr
                  key={conflictId}
                  onClick={() => navigate(`/conflicts/${encodeURIComponent(conflictId)}`, {
                    state: { conflict, acids }
                  })}
                  className="conflict-row-clickable"
                >
                  <td>{conflict.conflictId || conflict.id || index + 1}</td>
                  <td>{flightsText}</td>
                  <td className="numeric">{timeMinutes}</td>
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
  