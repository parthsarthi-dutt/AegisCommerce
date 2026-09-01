import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  CreditCard, 
  Server, 
  Settings, 
  Search, 
  Download, 
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Bot,
  Box
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState({ 
    metrics: {
      total_revenue_paise: 0,
      funds_reserved_paise: 0,
      policy_denials: 0,
      active_grants: 1
    }, 
    transactions: [] 
  });

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('http://localhost:8080/api/dashboard');
      const json = await res.json();
      if (json && json.metrics) {
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch on initial load
  useEffect(() => { 
    fetchData(); 
  }, []);

  const formatCurrency = (paise) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((paise || 0) / 100);
  };

  const filteredTxs = activeTab === 'All' 
    ? data.transactions 
    : data.transactions.filter(t => {
        if (activeTab === 'Pending') return t.status === 'pending' || t.status === 'payment_pending';
        return t.status === activeTab.toLowerCase();
    });

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <ShieldCheck size={24} color="var(--accent-blue)" />
          <span className="logo-text">Agentic Trust Layer</span>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-item active"><Activity size={18} /> Dashboard</div>
          <div className="nav-item"><CreditCard size={18} /> Transactions</div>
          <div className="nav-item"><Server size={18} /> Policy Engine</div>
          <div className="nav-item"><Bot size={18} /> AI Agents</div>
          <div className="nav-item" style={{ marginTop: 'auto' }}><Settings size={18} /> Settings</div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <h1 className="topbar-title">Overview</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Environment:</span>
            <span className="badge captured" style={{ background: 'transparent', border: '1px solid var(--border)' }}>Production</span>
          </div>
        </header>

        <div className="scroll-area">
          
          {/* KPIs */}
          <div className="dashboard-grid animate-slide-up">
            <div className="kpi-card">
              <div className="kpi-header">
                <span>Total Authorized</span>
                <TrendingUp size={16} color="var(--status-success-text)" />
              </div>
              <div className="kpi-value">{formatCurrency(data.metrics.total_revenue_paise)}</div>
              <div className="kpi-footer">
                <span style={{ color: 'var(--status-success-text)' }}>Live</span> from Database
              </div>
            </div>
            
            <div className="kpi-card delay-1">
              <div className="kpi-header">
                <span>Pending Commits</span>
                <RefreshCw size={16} color="var(--status-pending-text)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--status-pending-text)' }}>
                {formatCurrency(data.metrics.funds_reserved_paise)}
              </div>
              <div className="kpi-footer">
                Awaiting Razorpay webhooks
              </div>
            </div>

            <div className="kpi-card delay-2">
              <div className="kpi-header">
                <span>Policy Denials</span>
                <AlertTriangle size={16} color="var(--status-failed-text)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--status-failed-text)' }}>
                {data.metrics.policy_denials}
              </div>
              <div className="kpi-footer">
                Limits or Integrity checks failed
              </div>
            </div>

            <div className="kpi-card delay-3">
              <div className="kpi-header">
                <span>Active Grants</span>
                <Bot size={16} color="var(--text-secondary)" />
              </div>
              <div className="kpi-value">{data.metrics.active_grants}</div>
              <div className="kpi-footer">
                Across AI Agents
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="table-container animate-slide-up delay-2">
            <div className="table-header-actions">
              <div className="tabs">
                {['All', 'Captured', 'Pending', 'Failed'].map(tab => (
                  <div 
                    key={tab} 
                    className={`tab ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="search-bar">
                  <Search size={16} color="var(--text-tertiary)" />
                  <input type="text" placeholder="Search transaction ID..." />
                </div>
                <button className="btn btn-icon" onClick={fetchData} style={{ transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
                  <RefreshCw size={18} />
                </button>
                <button className="btn">
                  <Download size={16} /> Export
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>No transactions found.</td>
                  </tr>
                ) : (
                  filteredTxs.map((tx, idx) => (
                    <tr key={idx}>
                      <td className="tx-id">{tx.id}</td>
                      <td>
                        <div className="product-cell">
                          <Box size={16} color="var(--text-tertiary)" />
                          {tx.product}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatCurrency(tx.amount)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bot size={12} color="var(--text-secondary)" />
                          </div>
                          {tx.agent}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${tx.status === 'payment_pending' ? 'pending' : tx.status}`}>
                          {tx.status === 'payment_pending' ? 'Pending' : tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                        </span>
                      </td>
                      <td>{new Date(tx.date).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      </main>
    </div>
  );
}

export default App;
