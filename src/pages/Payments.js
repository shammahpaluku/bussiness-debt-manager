import React, { useState, useEffect } from 'react';
import './Payments.css';

const { ipcRenderer } = window.require('electron');

const Payments = ({ settings }) => {
  const [payments, setPayments] = useState([]);
  const [debts, setDebts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    debt_id: '',
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'Cash',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    try {
      setLoading(true);
      const [paymentsData, debtsData, branchList] = await Promise.all([
        ipcRenderer.invoke('db:getPayments', selectedBranch || null),
        ipcRenderer.invoke('db:getDebts', selectedBranch || null),
        ipcRenderer.invoke('db:getBranches')
      ]);
      setPayments(paymentsData);
      setDebts(debtsData.filter(debt => debt.status !== 'Cleared'));
      setBranches(branchList || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const reload = async () => {
      try {
        setLoading(true);
        const [paymentsData, debtsData] = await Promise.all([
          ipcRenderer.invoke('db:getPayments', selectedBranch || null),
          ipcRenderer.invoke('db:getDebts', selectedBranch || null)
        ]);
        setPayments(paymentsData);
        setDebts(debtsData.filter(debt => debt.status !== 'Cleared'));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    reload();
  }, [selectedBranch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await ipcRenderer.invoke('db:addPayment', formData);
      const [paymentsData, debtsData] = await Promise.all([
        ipcRenderer.invoke('db:getPayments', selectedBranch || null),
        ipcRenderer.invoke('db:getDebts', selectedBranch || null)
      ]);
      setPayments(paymentsData);
      setDebts(debtsData.filter(debt => debt.status !== 'Cleared'));
      setShowModal(false);
      setFormData({
        debt_id: '',
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        method: 'Cash',
        reference: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment. Please try again.');
    }
  };

  const handleDebtChange = (debtId) => {
    const debt = debts.find(d => d.id === parseInt(debtId));
    if (debt) {
      setFormData({
        ...formData,
        debt_id: debtId,
        customer_id: debt.customer_id
      });
    }
  };

  const formatCurrency = (amount) => {
    const symbol = settings.currency_symbol || 'KSh';
    return `${symbol} ${Number(amount).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getMethodBadge = (method) => {
    const colors = {
      'Cash': 'badge-success',
      'Bank': 'badge-info',
      'M-Pesa': 'badge-warning',
      'Other': 'badge-secondary'
    };
    return <span className={`badge ${colors[method] || 'badge-secondary'}`}>{method}</span>;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading payments...</p>
      </div>
    );
  }

  return (
    <div className="payments">
      <div className="page-header">
        <h1 className="page-title">Payments</h1>
        <p className="page-subtitle">Record and track customer payments</p>
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

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          Record Payment
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Payment History</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Branch</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.date)}</td>
                  <td>
                    <div>
                      <strong>{payment.customer_name}</strong>
                    </div>
                  </td>
                  <td>{payment.items}</td>
                  <td>{payment.branch_name || '-'}</td>
                  <td className="text-right">
                    <strong className="text-success">
                      {formatCurrency(payment.amount)}
                    </strong>
                  </td>
                  <td>{getMethodBadge(payment.method)}</td>
                  <td>{payment.reference || '-'}</td>
                  <td>{payment.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Payment</h3>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Debt *</label>
                <select
                  value={formData.debt_id}
                  onChange={(e) => handleDebtChange(e.target.value)}
                  required
                >
                  <option value="">Select a debt</option>
                  {debts.map(debt => (
                    <option key={debt.id} value={debt.id}>
                      {debt.customer_name} - {debt.items} (Balance: {formatCurrency(debt.total_amount - debt.amount_paid)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Payment Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Payment Method *</label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({...formData, method: e.target.value})}
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Other">Other</option>
                </select>
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
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
