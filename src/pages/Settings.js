import React, { useState, useEffect } from 'react';
import './Settings.css';

const { ipcRenderer } = window.require('electron');

const Settings = ({ settings, updateSettings }) => {
  const [formData, setFormData] = useState({
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    currency: 'KES',
    currency_symbol: 'KSh',
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    smtp_from_name: '',
    smtp_from_email: '',
    email_signature: '',
    reminder_schedule: '{"before_due": 3, "on_due": true, "after_due": 3}'
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState('');

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || '',
        business_address: settings.business_address || '',
        business_phone: settings.business_phone || '',
        business_email: settings.business_email || '',
        currency: settings.currency || 'KES',
        currency_symbol: settings.currency_symbol || 'KSh',
        smtp_host: settings.smtp_host || '',
        smtp_port: settings.smtp_port || '587',
        smtp_username: settings.smtp_username || '',
        smtp_password: settings.smtp_password || '',
        smtp_from_name: settings.smtp_from_name || '',
        smtp_from_email: settings.smtp_from_email || '',
        email_signature: settings.email_signature || '',
        reminder_schedule: settings.reminder_schedule || '{"before_due": 3, "on_due": true, "after_due": 3}'
      });
    }
  }, [settings]);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const list = await ipcRenderer.invoke('db:getAllBranches');
      setBranches(list || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const handleAddBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return;
    try {
      setLoading(true);
      await ipcRenderer.invoke('db:addBranch', name);
      setNewBranchName('');
      await loadBranches();
    } catch (error) {
      console.error('Error adding branch:', error);
      alert('Error adding branch');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranch = async (id, updates) => {
    try {
      setLoading(true);
      await ipcRenderer.invoke('db:updateBranch', id, updates);
      await loadBranches();
    } catch (error) {
      console.error('Error updating branch:', error);
      alert('Error updating branch');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await updateSettings(formData);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setLoading(true);
      // This would need to be implemented in the backend
      alert('Email test functionality will be implemented in the next version.');
    } catch (error) {
      console.error('Error testing email:', error);
      alert('Error testing email. Please check your settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setLoading(true);
      const backupPath = await ipcRenderer.invoke('db:backup');
      alert(`Backup created successfully at: ${backupPath}`);
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Error creating backup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const result = await ipcRenderer.invoke('dialog:openFile');
      if (!result.canceled && result.filePaths.length > 0) {
        await ipcRenderer.invoke('db:restore', result.filePaths[0]);
        alert('Backup restored successfully! Please restart the application.');
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('Error restoring backup. Please try again.');
    }
  };

  const handleExport = async (type) => {
    try {
      setLoading(true);
      const exportPath = await ipcRenderer.invoke('db:exportCSV', type);
      alert(`Data exported successfully to: ${exportPath}`);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'backup', label: 'Backup & Export', icon: '💾' },
    { id: 'branches', label: 'Branches', icon: '🏬' }
  ];

  return (
    <div className="settings">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your VinLedger application</p>
      </div>

      <div className="settings-container">
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-content">
          <form onSubmit={handleSubmit}>
            {activeTab === 'general' && (
              <div className="settings-section">
                <h3>Business Information</h3>
                <div className="form-group">
                  <label>Business Name *</label>
                  <input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Business Address</label>
                  <textarea
                    value={formData.business_address}
                    onChange={(e) => setFormData({...formData, business_address: e.target.value})}
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>Business Phone</label>
                  <input
                    type="tel"
                    value={formData.business_phone}
                    onChange={(e) => setFormData({...formData, business_phone: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Business Email</label>
                  <input
                    type="email"
                    value={formData.business_email}
                    onChange={(e) => setFormData({...formData, business_email: e.target.value})}
                  />
                </div>
                <h3>Currency Settings</h3>
                <div className="form-group">
                  <label>Currency Code</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    placeholder="e.g., KES, USD, EUR"
                  />
                </div>
                <div className="form-group">
                  <label>Currency Symbol</label>
                  <input
                    type="text"
                    value={formData.currency_symbol}
                    onChange={(e) => setFormData({...formData, currency_symbol: e.target.value})}
                    placeholder="e.g., KSh, $, €"
                  />
                </div>
              </div>
            )}

            {activeTab === 'branches' && (
              <div className="settings-section">
                <h3>Manage Branches</h3>
                <div className="form-group d-flex" style={{ gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="New branch name"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddBranch}
                    disabled={loading}
                  >
                    Add Branch
                  </button>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map(b => (
                        <tr key={b.id}>
                          <td>
                            <input
                              type="text"
                              value={b.name}
                              onChange={(e) => setBranches(prev => prev.map(x => x.id === b.id ? { ...x, name: e.target.value } : x))}
                            />
                          </td>
                          <td>
                            {b.active ? <span className="badge badge-success">Active</span> : <span className="badge badge-secondary">Inactive</span>}
                          </td>
                          <td className="d-flex" style={{ gap: '8px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleUpdateBranch(b.id, { name: branches.find(x => x.id === b.id).name })}
                              disabled={loading}
                            >
                              Save Name
                            </button>
                            <button
                              type="button"
                              className={b.active ? 'btn btn-warning' : 'btn btn-success'}
                              onClick={() => handleUpdateBranch(b.id, { active: b.active ? 0 : 1 })}
                              disabled={loading}
                            >
                              {b.active ? 'Disable' : 'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {branches.length === 0 && (
                        <tr>
                          <td colSpan="3">No branches yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'email' && (
              <div className="settings-section">
                <h3>SMTP Configuration</h3>
                <div className="form-group">
                  <label>SMTP Host</label>
                  <input
                    type="text"
                    value={formData.smtp_host}
                    onChange={(e) => setFormData({...formData, smtp_host: e.target.value})}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="form-group">
                  <label>SMTP Port</label>
                  <input
                    type="number"
                    value={formData.smtp_port}
                    onChange={(e) => setFormData({...formData, smtp_port: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>SMTP Username</label>
                  <input
                    type="text"
                    value={formData.smtp_username}
                    onChange={(e) => setFormData({...formData, smtp_username: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>SMTP Password</label>
                  <input
                    type="password"
                    value={formData.smtp_password}
                    onChange={(e) => setFormData({...formData, smtp_password: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>From Name</label>
                  <input
                    type="text"
                    value={formData.smtp_from_name}
                    onChange={(e) => setFormData({...formData, smtp_from_name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>From Email</label>
                  <input
                    type="email"
                    value={formData.smtp_from_email}
                    onChange={(e) => setFormData({...formData, smtp_from_email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Email Signature</label>
                  <textarea
                    value={formData.email_signature}
                    onChange={(e) => setFormData({...formData, email_signature: e.target.value})}
                    rows="4"
                    placeholder="Best regards,&#10;Your Name&#10;Your Business"
                  />
                </div>
                <div className="form-group">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleTestEmail}
                    disabled={loading}
                  >
                    Test Email Configuration
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="settings-section">
                <h3>Backup & Restore</h3>
                <div className="backup-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleBackup}
                    disabled={loading}
                  >
                    Create Backup
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={handleRestore}
                    disabled={loading}
                  >
                    Restore Backup
                  </button>
                </div>
                
                <h3>Export Data</h3>
                <div className="export-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleExport('customers')}
                    disabled={loading}
                  >
                    Export Customers
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleExport('debts')}
                    disabled={loading}
                  >
                    Export Debts
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleExport('payments')}
                    disabled={loading}
                  >
                    Export Payments
                  </button>
                </div>
              </div>
            )}

            <div className="settings-footer">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
