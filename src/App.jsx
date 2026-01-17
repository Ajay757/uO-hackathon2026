import Analyze from "./pages/Analyze";
import "./App.css";

export default function App() {
  return (
    <div className="app-shell">
      <div style={{ padding: "10px", backgroundColor: "red", color: "white", fontWeight: "bold", fontSize: "20px" }}>
        DEBUG: App.jsx is rendering
      </div>
      <Analyze />
    </div>
  );
}
