import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/NavigationNew';
import TrafficSimulation from './pages/TrafficSimulationNew';
import AdminDashboard from './pages/AdminDashboard';
import ComparisonPage from './pages/ComparisonPage';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Navigation />
        <main className="main-content" style={{ marginLeft: '240px', minHeight: '100vh', padding: 0 }}>
          <Routes>
            <Route path="/"      element={<TrafficSimulation />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/mode"  element={<ComparisonPage />} />
            <Route path="*"      element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
