import React, { useState, useEffect } from 'react';
import './Customers.css';

const { ipcRenderer } = window.require('electron');

const Customers = ({ settings }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    credit_limit: 0,
    is_blacklisted: false,
    branch_id: ''
  });

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const [data, branchList] = await Promise.all([
        ipcRenderer.invoke('db:getCustomers'),
        ipcRenderer.invoke('db:getBranches')
      ]);
      setCustomers(data);
      setBranches(branchList || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await ipcRenderer.invoke('db:updateCustomer', editingCustomer.id, formData);
      } else {
        await ipcRenderer.invoke('db:addCustomer', formData);
      }
      await loadInitial();
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        notes: '',
        credit_limit: 0,
        is_blacklisted: false,
        branch_id: ''
      });
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error saving customer. Please try again.');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
      credit_limit: customer.credit_limit || 0,
      is_blacklisted: customer.is_blacklisted || false,
      branch_id: customer.branch_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (customerId) => {
    if (window.confirm('Are you sure you want to delete this customer? This will also delete all associated debts and payments.')) {
      try {
        await ipcRenderer.invoke('db:deleteCustomer', customerId);
        await loadInitial();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Error deleting customer. Please try again.');
      }
    }
  };

  const formatCurrency = (amount) => {
    const symbol = settings.currency_symbol || 'KSh';
    return `${symbol} ${Number(amount).toLocaleString()}`;
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.phone && customer.phone.includes(searchTerm)) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="customers">
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <p className="page-subtitle">Manage your customer database</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search customers by name, phone, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          Add Customer
        </button>
      </div>

      <div className="customers-grid">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map(customer => (
            <div key={customer.id} className="customer-card">
              <div className="customer-header">
                <h3 className="customer-name">{customer.name}</h3>
                <div className="customer-balance">
                  {formatCurrency(customer.outstanding_balance)}
                </div>
              </div>
              <div className="customer-details">
                <div>
                  <strong>Phone:</strong> {customer.phone || 'Not provided'}
                </div>
                <div>
                  <strong>Email:</strong> {customer.email || 'Not provided'}
                </div>
                <div>
                  <strong>Credit Limit:</strong> {formatCurrency(customer.credit_limit)}
                </div>
                <div>
                  <strong>Branch:</strong> {customer.branch_name || '—'}
                </div>
                {customer.is_blacklisted && (
                  <div className="text-danger">
                    <strong>⚠️ Blacklisted</strong>
                  </div>
                )}
              </div>
              {customer.notes && (
                <div className="customer-notes">
                  <strong>Notes:</strong> {customer.notes}
                </div>
              )}
              <div className="customer-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleEdit(customer)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(customer.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <h3>No customers found</h3>
            <p>Start by adding your first customer</p>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
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
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Credit Limit</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({...formData, credit_limit: parseFloat(e.target.value) || 0})}
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
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_blacklisted}
                    onChange={(e) => setFormData({...formData, is_blacklisted: e.target.checked})}
                  />
                  Blacklisted
                </label>
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
                  {editingCustomer ? 'Update' : 'Add'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
