import React, { useState, useEffect } from 'react';
import './Debts.css';

const { ipcRenderer } = window.require('electron');

const Debts = ({ settings }) => {
  const [debts, setDebts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    date_of_purchase: new Date().toISOString().split('T')[0],
    items: '',
    total_amount: '',
    due_date: '',
    reference: '',
    notes: '',
    branch_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [debtsData, customersData, branchList] = await Promise.all([
        ipcRenderer.invoke('db:getDebts', selectedBranch || null),
        ipcRenderer.invoke('db:getCustomers'),
        ipcRenderer.invoke('db:getBranches')
      ]);
      setDebts(debtsData);
      setCustomers(customersData);
      setBranches(branchList || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReminders = async () => {
    try {
      const input = window.prompt('Rate limit (emails per minute)?', '30');
      const rpm = input ? parseInt(input, 10) : 30;
      setLoading(true);
      const res = await ipcRenderer.invoke('mail:queueReminders', {
        branchId: selectedBranch || null,
        ratePerMinute: isNaN(rpm) ? 30 : rpm
      });
      alert((res && res.message) || 'Bulk reminder queue finished.');
    } catch (e) {
      console.error('Bulk reminders error:', e);
      alert('Failed to queue reminders.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDebt) {
        await ipcRenderer.invoke('db:updateDebt', editingDebt.id, formData);
      } else {
        await ipcRenderer.invoke('db:addDebt', formData);
      }
      await loadData();
      setShowModal(false);
      setEditingDebt(null);
      setFormData({
        customer_id: '',
        date_of_purchase: new Date().toISOString().split('T')[0],
        items: '',
        total_amount: '',
        due_date: '',
        reference: '',
        notes: '',
        branch_id: ''
      });
    } catch (error) {
      console.error('Error saving debt:', error);
      alert('Error saving debt. Please try again.');
    }
  };

  const handleEdit = (debt) => {
    setEditingDebt(debt);
    setFormData({
      customer_id: debt.customer_id,
      date_of_purchase: debt.date_of_purchase,
      items: debt.items,
      total_amount: debt.total_amount,
      due_date: debt.due_date,
      reference: debt.reference || '',
      notes: debt.notes || '',
      branch_id: debt.branch_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (debtId) => {
    if (window.confirm('Are you sure you want to delete this debt? This will also delete all associated payments.')) {
      try {
        await ipcRenderer.invoke('db:deleteDebt', debtId);
        await loadData();
      } catch (error) {
        console.error('Error deleting debt:', error);
        alert('Error deleting debt. Please try again.');
      }
    }
  };

  const formatCurrency = (amount) => {
    const symbol = settings.currency_symbol || 'KSh';
    return `${symbol} ${Number(amount).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleCustomerChange = (customerId) => {
    // When customer changes, default branch to customer's branch if available
    const cust = customers.find(c => c.id === parseInt(customerId));
    setFormData({
      ...formData,
      customer_id: customerId,
      branch_id: cust && cust.branch_id ? cust.branch_id : formData.branch_id
    });
  };

  const getStatusBadge = (debt) => {
    if (debt.status === 'Cleared') {
      return <span className="badge badge-success">Cleared</span>;
    } else if (debt.status === 'Overdue') {
      return <span className="badge badge-danger">Overdue</span>;
    } else {
      return <span className="badge badge-info">Active</span>;
    }
  };

  const handleSendReminder = async (debt) => {
    try {
      setLoading(true);
      const res = await ipcRenderer.invoke('mail:sendReminder', { debtId: debt.id });
      if (res && res.success) {
        alert(res.message || 'Reminder sent successfully.');
      } else {
        alert((res && res.message) || 'Failed to send reminder.');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Error sending reminder.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading debts...</p>
      </div>
    );
  }

  return (
    <div className="debts">
      <div className="page-header">
        <h1 className="page-title">Debts</h1>
        <p className="page-subtitle">Manage customer debts and credit purchases</p>
        <div className="d-flex" style={{ gap: '8px', marginTop: '8px' }}>
          <label>Branch:</label>
          <select
            value={selectedBranch}
            onChange={async (e) => { setSelectedBranch(e.target.value); await loadData(); }}
          >
            <option value="">All branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          Add New Debt
        </button>
        <button
          className="btn btn-secondary"
          style={{ marginLeft: '8px' }}
          onClick={handleBulkReminders}
          disabled={loading}
        >
          Send Overdue Reminders
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Debts</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Items</th>
                <th>Branch</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {debts.map(debt => (
                <tr key={debt.id}>
                  <td>
                    <div>
                      <strong>{debt.customer_name}</strong>
                      <br />
                      <small className="text-muted">{debt.phone || debt.email || 'No contact'}</small>
                    </div>
                  </td>
                  <td>{debt.items}</td>
                  <td>{debt.branch_name || '-'}</td>
                  <td className="text-right">{formatCurrency(debt.total_amount)}</td>
                  <td className="text-right">{formatCurrency(debt.amount_paid)}</td>
                  <td className="text-right">
                    <strong className={debt.total_amount - debt.amount_paid > 0 ? 'text-danger' : 'text-success'}>
                      {formatCurrency(debt.total_amount - debt.amount_paid)}
                    </strong>
                  </td>
                  <td>{formatDate(debt.due_date)}</td>
                  <td>{getStatusBadge(debt)}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEdit(debt)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(debt.id)}
                      >
                        Delete
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleSendReminder(debt)}
                        disabled={!debt.email || loading}
                        title={!debt.email ? 'No customer email on file' : ''}
                      >
                        Send Reminder
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Debt Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingDebt ? 'Edit Debt' : 'Add New Debt'}
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Customer *</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Branch</label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                >
                  <option value="">Select a branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Items Description *</label>
                <textarea
                  value={formData.items}
                  onChange={(e) => setFormData({...formData, items: e.target.value})}
                  required
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Total Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({...formData, total_amount: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date of Purchase *</label>
                <input
                  type="date"
                  value={formData.date_of_purchase}
                  onChange={(e) => setFormData({...formData, date_of_purchase: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Due Date *</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Reference</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({...formData, reference: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDebt ? 'Update' : 'Add'} Debt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Debts;
