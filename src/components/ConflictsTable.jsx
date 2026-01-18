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
              <th>Time (UTC)</th>
              <th>Flight A</th>
              <th>Flight B</th>
              <th className="numeric">Horizontal Distance (NM)</th>
              <th className="numeric">Vertical Distance (ft)</th>
              <th className="numeric">Latitude</th>
              <th className="numeric">Longitude</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((conflict, index) => {
              const status = conflict.id ? getResolutionStatus(conflict.id) : null;
              return (
                <tr
                  key={conflict.id || `${conflict.flight1}-${conflict.flight2}-${conflict.time}-${index}`}
                  onClick={() => conflict.id && navigate(`/conflicts/${encodeURIComponent(conflict.id)}`)}
                  className={conflict.id ? "conflict-row-clickable" : ""}
                >
                  <td>{index + 1}</td>
                  <td>{new Date(conflict.time * 1000).toLocaleTimeString()}</td>
                  <td>{conflict.flight1}</td>
                  <td>{conflict.flight2}</td>
                  <td className="numeric">{conflict.horizontalDistance.toFixed(2)}</td>
                  <td className="numeric">{conflict.verticalDistance.toFixed(0)}</td>
                  <td className="numeric">{conflict.lat.toFixed(4)}</td>
                  <td className="numeric">{conflict.lon.toFixed(4)}</td>
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
  