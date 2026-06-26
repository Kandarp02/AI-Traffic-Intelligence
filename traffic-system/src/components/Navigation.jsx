import React from 'react';
import { NavLink } from 'react-router-dom';

const Navigation = () => {
  return (
    <nav className="nav-sidebar">
      <div className="nav-header">
        <h2>Smart Traffic AI</h2>
      </div>
      <div className="nav-links">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Traffic Simulation
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Admin Dashboard
        </NavLink>
        <NavLink to="/pollution" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Pollution Control
        </NavLink>
        <NavLink to="/comparison" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          AI vs Static Stats
        </NavLink>
      </div>
    </nav>
  );
};

export default Navigation;
