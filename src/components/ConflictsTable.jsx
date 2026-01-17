export default function ConflictsTable({ conflicts }) {
    return (
      <div>
        <h2>Conflicts ({conflicts.length})</h2>
        <pre style={{ maxHeight: 250, overflow: "auto", background: "#111", color: "#ddd", padding: 12, borderRadius: 8 }}>
          {JSON.stringify(conflicts, null, 2)}
        </pre>
      </div>
    );
  }
  