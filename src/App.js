import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Debts from './pages/Debts';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import './styles/App.css';

const { ipcRenderer } = window.require('electron');

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsData = await ipcRenderer.invoke('db:getSettings');
      setSettings(settingsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      await ipcRenderer.invoke('db:updateSettings', newSettings);
      setSettings({ ...settings, ...newSettings });
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard settings={settings} />;
      case 'customers':
        return <Customers settings={settings} />;
      case 'debts':
        return <Debts settings={settings} />;
      case 'payments':
        return <Payments settings={settings} />;
      case 'settings':
        return <Settings settings={settings} updateSettings={updateSettings} />;
      default:
        return <Dashboard settings={settings} />;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading VinLedger...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="main-content">
        {renderPage()}
      </main>
      <Footer />
    </div>
  );
}

export default App;
