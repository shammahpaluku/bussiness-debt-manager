import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const { ipcRenderer } = window.require('electron');

const Dashboard = ({ settings }) => {
  const [dashboardData, setDashboardData] = useState({
    totalOutstanding: 0,
    totalOverdue: 0,
    thisMonthCollected: 0,
    topDebtors: [],
    overdueDebts: []
  });
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedBranch]);

  const loadInitial = async () => {
    try {
      const list = await ipcRenderer.invoke('db:getBranches');
      setBranches(list || []);
    } catch (e) {
      // ignore
    }
    await loadDashboardData();
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await ipcRenderer.invoke('db:getDashboardData', selectedBranch || null);
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const symbol = settings.currency_symbol || 'KSh';
    return `${symbol} ${Number(amount).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your wine debtors management</p>
        <div className="d-flex" style={{ gap: '8px', marginTop: '8px' }}>
          <label>Branch:</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="">All branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3 className="stat-value">{formatCurrency(dashboardData.totalOutstanding)}</h3>
          <p className="stat-label">Total Outstanding</p>
        </div>
        <div className="stat-card danger">
          <h3 className="stat-value">{formatCurrency(dashboardData.totalOverdue)}</h3>
          <p className="stat-label">Total Overdue</p>
        </div>
        <div className="stat-card success">
          <h3 className="stat-value">{formatCurrency(dashboardData.thisMonthCollected)}</h3>
          <p className="stat-label">Collected This Month</p>
        </div>
        <div className="stat-card">
          <h3 className="stat-value">{dashboardData.topDebtors.length}</h3>
          <p className="stat-label">Active Debtors</p>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Top Debtors */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Debtors</h3>
          </div>
          <div className="top-debtors">
            {dashboardData.topDebtors.length > 0 ? (
              dashboardData.topDebtors.map((debtor, index) => (
                <div key={index} className="debtor-item">
                  <div className="debtor-info">
                    <h4>{debtor.name}</h4>
                    <p>{debtor.phone || 'No phone'}</p>
                  </div>
                  <div className="debtor-amount">
                    {formatCurrency(debtor.outstanding)}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h3>No active debtors</h3>
                <p>All accounts are up to date</p>
              </div>
            )}
          </div>
        </div>

        {/* Overdue Debts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Overdue Debts</h3>
          </div>
          <div className="overdue-list">
            {dashboardData.overdueDebts.length > 0 ? (
              dashboardData.overdueDebts.map((debt) => (
                <div key={debt.id} className="overdue-item">
                  <div className="overdue-info">
                    <h4>{debt.customer_name}</h4>
                    <p>{debt.items} • Due: {formatDate(debt.due_date)}</p>
                    <p className="text-muted">{debt.phone || debt.email || 'No contact'}</p>
                  </div>
                  <div className="overdue-amount">
                    {formatCurrency(debt.total_amount - debt.amount_paid)}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h3>No overdue debts</h3>
                <p>All payments are up to date</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div className="quick-actions">
          <button className="btn btn-primary">
            Add New Customer
          </button>
          <button className="btn btn-success">
            Record Payment
          </button>
          <button className="btn btn-warning">
            Send Reminders
          </button>
          <button className="btn btn-secondary">
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
