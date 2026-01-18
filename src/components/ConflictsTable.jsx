import "./ConflictsTable.css";

export default function ConflictsTable({ conflicts }) {
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
              <th>Time (UTC)</th>
              <th>Flight A</th>
              <th>Flight B</th>
              <th className="numeric">Horizontal Distance (NM)</th>
              <th className="numeric">Vertical Distance (ft)</th>
              <th className="numeric">Latitude</th>
              <th className="numeric">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((conflict, index) => (
              <tr key={`${conflict.flight1}-${conflict.flight2}-${conflict.time}-${index}`}>
                <td>{new Date(conflict.time * 1000).toLocaleTimeString()}</td>
                <td>{conflict.flight1}</td>
                <td>{conflict.flight2}</td>
                <td className="numeric">{conflict.horizontalDistance.toFixed(2)}</td>
                <td className="numeric">{conflict.verticalDistance.toFixed(0)}</td>
                <td className="numeric">{conflict.lat.toFixed(4)}</td>
                <td className="numeric">{conflict.lon.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
  