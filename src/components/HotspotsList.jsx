import "./HotSpotsList.css";

function calculateTimeWindow(conflicts) {
  if (!conflicts || conflicts.length === 0) return "N/A";
  
  const times = conflicts.map(c => c.time).filter(Boolean);
  if (times.length === 0) return "N/A";
  
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  if (minTime === maxTime) {
    return new Date(minTime * 1000).toLocaleTimeString();
  }
  
  return `${new Date(minTime * 1000).toLocaleTimeString()} - ${new Date(maxTime * 1000).toLocaleTimeString()}`;
}

export default function HotspotsList({ hotspots }) {
  if (!hotspots || hotspots.length === 0) {
    return (
      <div className="hotspots-list-container">
        <h2>Hotspots (0)</h2>
        <p className="empty-message">No hotspots detected</p>
      </div>
    );
  }

  // Sort by conflict count descending (should already be sorted, but ensure it)
  const sortedHotspots = [...hotspots].sort((a, b) => b.count - a.count);

  return (
    <div className="hotspots-list-container">
      <h2>Hotspots ({hotspots.length})</h2>
      <div className="table-wrapper">
        <table className="hotspots-table">
          <thead>
            <tr>
              <th>Hotspot ID</th>
              <th className="numeric">Center Lat</th>
              <th className="numeric">Center Lon</th>
              <th className="numeric">Conflict Count</th>
              <th>Time Window</th>
            </tr>
          </thead>
          <tbody>
            {sortedHotspots.map((hotspot, index) => (
              <tr key={`hotspot-${index}`}>
                <td>HS-{index + 1}</td>
                <td className="numeric">{hotspot.lat.toFixed(4)}</td>
                <td className="numeric">{hotspot.lon.toFixed(4)}</td>
                <td className="numeric">{hotspot.count}</td>
                <td>{calculateTimeWindow(hotspot.conflicts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
  