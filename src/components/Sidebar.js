import React from 'react';
import './Sidebar.css';

const Sidebar = ({ currentPage, setCurrentPage }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'debts', label: 'Debts', icon: '📋' },
    { id: 'payments', label: 'Payments', icon: '💰' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">VinLedger</h1>
        <p className="sidebar-subtitle">Wine Debtors Manager</p>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <p className="version">v1.0.0</p>
      </div>
    </div>
  );
};

export default Sidebar;
