import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ConflictResolver from './pages/ConflictResolver.jsx'
import { FlightsDataProvider } from './context/FlightsDataContext'
import "./firebase";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "conflicts/:conflictId",
        element: <ConflictResolver />,
      },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FlightsDataProvider>
      <RouterProvider router={router} />
    </FlightsDataProvider>
  </StrictMode>,
)
