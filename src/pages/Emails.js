import React, { useEffect, useState } from 'react';
import './Emails.css';

const { ipcRenderer } = window.require('electron');

const Emails = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | sent | failed

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await ipcRenderer.invoke('db:getEmailLog');
      setLogs(data || []);
    } catch (e) {
      console.error('Failed to load email log', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'sent') return l.status === 'Sent';
    if (filter === 'failed') return l.status === 'Failed';
    return true;
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading email history...</p>
      </div>
    );
  }

  return (
    <div className="emails">
      <div className="page-header">
        <h1 className="page-title">Email History</h1>
        <p className="page-subtitle">View outbound email logs</p>
      </div>

      <div className="action-buttons" style={{ display: 'flex', gap: 8 }}>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <button className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Logs</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Sent At</th>
                <th>Status</th>
                <th>To</th>
                <th>Customer</th>
                <th>Subject</th>
                <th>Snippet</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td>{new Date(l.sent_at).toLocaleString()}</td>
                  <td>
                    {l.status === 'Sent' ? (
                      <span className="badge badge-success">Sent</span>
                    ) : (
                      <span className="badge badge-danger">Failed</span>
                    )}
                  </td>
                  <td>{l.to_email}</td>
                  <td>{l.customer_name || '-'}</td>
                  <td>{l.subject}</td>
                  <td className="text-muted">{l.body_snippet || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6">No email logs.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Emails;
