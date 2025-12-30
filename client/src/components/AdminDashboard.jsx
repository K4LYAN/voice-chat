import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AdminDashboard.css';

const API_BASE = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return window.location.origin.includes('voice-chat')
        ? 'https://voice-chat-0dnh.onrender.com'
        : process.env.SERVER_URL || 'http://localhost:5000';
})();

function AdminDashboard() {
    // ===== STATE =====
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState(localStorage.getItem('admin_password') || '');
    const [inputPassword, setInputPassword] = useState('');
    const [activeView, setActiveView] = useState('dashboard'); // dashboard, connections, queue, ip-blocking, device-blocking, attempts, match-history
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Data
    const [stats, setStats] = useState(null);
    const [health, setHealth] = useState(null);
    const [connections, setConnections] = useState([]);
    const [queueStats, setQueueStats] = useState({ total: 0, byGender: {}, users: [] });
    const [blocked, setBlocked] = useState({ blocked: [], total: 0 });
    const [blockedAttempts, setBlockedAttempts] = useState([]);
    const [matchLogs, setMatchLogs] = useState([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [newBlockIp, setNewBlockIp] = useState('');
    const [newBlockDevice, setNewBlockDevice] = useState('');

    const isInitialLoad = useRef(true);

    // ===== MOBILE SIDEBAR HANDLER =====
    useEffect(() => {
        // Lock body scroll when sidebar is open on mobile
        if (sidebarOpen && window.innerWidth <= 1024) {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }

        return () => {
            document.body.classList.remove('sidebar-open');
        };
    }, [sidebarOpen]);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const closeSidebar = () => {
        if (window.innerWidth <= 1024) {
            setSidebarOpen(false);
        }
    };

    // ===== AUTH =====
    const handleLogin = (e) => {
        e.preventDefault();
        setPassword(inputPassword);
        localStorage.setItem('admin_password', inputPassword);
        setLoading(true);
    };

    const handleLogout = () => {
        setPassword('');
        setInputPassword('');
        localStorage.removeItem('admin_password');
        setIsAuthenticated(false);
        setStats(null);
    };

    // ===== DATA FETCHING =====
    const fetchData = useCallback(async () => {
        if (!password) return;

        try {
            const headers = { 'x-admin-password': password };
            const statsRes = await fetch(`${API_BASE}/admin/stats`, { headers });

            if (statsRes.status === 403) {
                setIsAuthenticated(false);
                setError("Invalid admin password");
                setLoading(false);
                return;
            }

            if (!statsRes.ok) throw new Error('Failed to fetch stats');

            setIsAuthenticated(true);
            setError(null);

            const [healthRes, blockedRes, attemptsRes, connectionsRes, queueRes] = await Promise.all([
                fetch(`${API_BASE}/health`),
                fetch(`${API_BASE}/admin/blocked`, { headers }),
                fetch(`${API_BASE}/admin/blocked/attempts`, { headers }),
                fetch(`${API_BASE}/admin/connections`, { headers }),
                fetch(`${API_BASE}/admin/queue`, { headers })
            ]);

            let matchesData = [];
            if (activeView === 'match-history') {
                const logsRes = await fetch(`${API_BASE}/admin/logs/matches`, { headers });
                if (logsRes.ok) {
                    const data = await logsRes.json();
                    matchesData = data.matches || [];
                }
            }

            const [statsData, healthData, blockedData, attemptsData, connectionsData, queueData] = await Promise.all([
                statsRes.json(),
                healthRes.json(),
                blockedRes.json(),
                attemptsRes.ok ? attemptsRes.json() : { attempts: [] },
                connectionsRes.ok ? connectionsRes.json() : { connections: [] },
                queueRes.ok ? queueRes.json() : { total: 0, byGender: {}, users: [] }
            ]);

            setStats(statsData);
            setHealth(healthData);
            setBlocked(blockedData);
            setBlockedAttempts(attemptsData.attempts || []);
            setConnections(connectionsData.connections || []);
            setQueueStats(queueData);
            setMatchLogs(matchesData);

        } catch (err) {
            console.error(err);
            if (isInitialLoad.current) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
            isInitialLoad.current = false;
        }
    }, [password, activeView]);

    useEffect(() => {
        if (password) {
            fetchData();
            const interval = setInterval(fetchData, 3000);
            return () => clearInterval(interval);
        } else {
            setLoading(false);
        }
    }, [fetchData, password]);

    // ===== ACTIONS =====
    const exportLogs = async (type) => {
        try {
            const res = await fetch(`${API_BASE}/admin/export/${type}`, {
                headers: { 'x-admin-password': password }
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_${Date.now()}.csv`;
            a.click();
        } catch (err) {
            alert(`Export failed: ${err.message}`);
        }
    };

    const fetchReports = async () => {
        try {
            const res = await fetch(`${API_BASE}/admin/reports`, { headers: { 'x-admin-password': password } });
            const data = await res.json();
            setReports(data.reports || []);
        } catch (err) {
            console.error(err);
        }
    };

    const dismissReport = async (hash) => {
        if (!confirm('Are you sure you want to dismiss all reports for this user?')) return;
        try {
            await fetch(`${API_BASE}/admin/reports/${hash}`, {
                method: 'DELETE',
                headers: { 'x-admin-password': password }
            });
            fetchReports(); // Refresh list
        } catch (err) {
            console.error(err);
        }
    };

    // Auto-fetch view specific data
    useEffect(() => {
        if (!isAuthenticated) return;
        if (activeView === 'reports') fetchReports();
    }, [activeView, isAuthenticated, password]);

    const blockIp = async () => {
        if (!newBlockIp.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/admin/block/ip/${encodeURIComponent(newBlockIp)}`, {
                method: 'POST',
                headers: { 'x-admin-password': password }
            });
            if (res.ok) {
                alert(`✅ Blocked IP: ${newBlockIp}`);
                setNewBlockIp('');
                fetchData();
            }
        } catch (err) {
            alert(`❌ Failed: ${err.message}`);
        }
    };

    const unblockIp = async (ip) => {
        try {
            await fetch(`${API_BASE}/admin/block/ip/${encodeURIComponent(ip)}`, {
                method: 'DELETE',
                headers: { 'x-admin-password': password }
            });
            alert(`✅ Unblocked IP: ${ip}`);
            fetchData();
        } catch (err) {
            alert(`❌ Failed: ${err.message}`);
        }
    };

    const blockDevice = async () => {
        if (!newBlockDevice.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(newBlockDevice)}`, {
                method: 'POST',
                headers: { 'x-admin-password': password }
            });
            if (res.ok) {
                alert(`✅ Blocked Device: ${newBlockDevice}`);
                setNewBlockDevice('');
                fetchData();
            }
        } catch (err) {
            alert(`❌ Failed: ${err.message}`);
        }
    };

    const unblockDevice = async (hash) => {
        try {
            await fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(hash)}`, {
                method: 'DELETE',
                headers: { 'x-admin-password': password }
            });
            alert(`✅ Unblocked Device`);
            fetchData();
        } catch (err) {
            alert(`❌ Failed: ${err.message}`);
        }
    };

    const forceDisconnect = async (socketId) => {
        if (!confirm('Disconnect this user?')) return;
        try {
            const res = await fetch(`${API_BASE}/admin/disconnect/${encodeURIComponent(socketId)}`, {
                method: 'POST',
                headers: { 'x-admin-password': password }
            });
            if (res.ok) {
                alert('✅ User disconnected');
                fetchData();
            }
        } catch (err) {
            alert(`❌ Failed: ${err.message}`);
        }
    };

    const blockIpFromConnection = async (ip) => {
        if (!confirm(`Block IP address: ${ip}?`)) return;
        try {
            const res = await fetch(`${API_BASE}/admin/block/ip/${encodeURIComponent(ip)}`, {
                method: 'POST',
                headers: { 'x-admin-password': password }
            });
            if (res.ok) {
                alert(`✅ Blocked IP: ${ip}`);
                fetchData();
            }
        } catch (err) {
            alert(`❌ Failed: ${err.message}`);
        }
    };

    const blockDeviceFromConnection = async (deviceHash) => {
        if (!confirm('Block this device?')) return;
        try {
            const res = await fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(deviceHash)}`, {
                method: 'POST',
                headers: { 'x-admin-password': password }
            });
            if (res.ok) {
                alert(`✅ Blocked Device`);
                fetchData();
            }
        } catch (err) {
            alert(`❌ Failed: ${err.message}`);
        }
    };

    // ===== UI HELPERS =====
    const getPageTitle = () => {
        const titles = {
            'dashboard': 'Dashboard Overview',
            'connections': 'Active Connections',
            'queue': 'Queue Status',
            'ip-blocking': 'IP Blocking',
            'device-blocking': 'Device Blocking',
            'attempts': 'Blocked Attempts',
            'match-history': 'Match History'
        };
        return titles[activeView] || 'Dashboard';
    };

    const filteredConnections = connections.filter(c =>
        !searchFilter ||
        c.ip?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        c.socketId?.toLowerCase().includes(searchFilter.toLowerCase())
    );

    // ===== RENDER: LOGIN =====
    if (!password || (!isAuthenticated && !loading)) {
        return (
            <div className="admin-login-container">
                <motion.div
                    className="admin-login-card"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <div className="login-icon">🔐</div>
                    <h1>Admin Dashboard</h1>
                    <p className="login-subtitle">Secure access to system administration</p>
                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            placeholder="Enter admin password"
                            value={inputPassword}
                            onChange={(e) => setInputPassword(e.target.value)}
                            className="login-input"
                            autoFocus
                        />
                        <button type="submit" className="login-btn">Sign In</button>
                    </form>
                    {error && <p className="login-error">{error}</p>}
                </motion.div>
            </div>
        );
    }

    // ===== RENDER: LOADING =====
    if (loading) {
        return (
            <div className="admin-loading">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    // ===== RENDER: MAIN DASHBOARD =====
    return (
        <div className="admin-layout">
            {/* Sidebar Overlay for Mobile */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
                onClick={closeSidebar}
            ></div>

            {/* SIDEBAR */}
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>📊 Admin Panel</h2>
                </div>
                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <div className="nav-section-title">Overview</div>
                        <button
                            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                            onClick={() => { setActiveView('dashboard'); closeSidebar(); }}
                        >
                            <span className="nav-icon">📈</span>
                            <span>Dashboard</span>
                        </button>
                    </div>

                    <div className="nav-section">
                        <div className="nav-section-title">Monitoring</div>
                        <button
                            className={`nav-item ${activeView === 'connections' ? 'active' : ''}`}
                            onClick={() => { setActiveView('connections'); closeSidebar(); }}
                        >
                            <span className="nav-icon">🌐</span>
                            <span>Active Connections</span>
                            {connections.length > 0 && <span className="nav-badge">{connections.length}</span>}
                        </button>
                        <button
                            className={`nav-item ${activeView === 'queue' ? 'active' : ''}`}
                            onClick={() => { setActiveView('queue'); closeSidebar(); }}
                        >
                            <span className="nav-icon">⏳</span>
                            <span>Queue Status</span>
                            {queueStats.total > 0 && <span className="nav-badge">{queueStats.total}</span>}
                        </button>
                    </div>

                    <div className="nav-section">
                        <div className="nav-section-title">Security</div>
                        <button
                            className={`nav-item ${activeView === 'ip-blocking' ? 'active' : ''}`}
                            onClick={() => { setActiveView('ip-blocking'); closeSidebar(); }}
                        >
                            <span className="nav-icon">🚫</span>
                            <span>IP Blocking</span>
                        </button>
                        <button
                            className={`nav-item ${activeView === 'device-blocking' ? 'active' : ''}`}
                            onClick={() => { setActiveView('device-blocking'); closeSidebar(); }}
                        >
                            <span className="nav-icon">📱</span>
                            <span>Device Blocking</span>
                        </button>
                        <button
                            className={`nav-item ${activeView === 'attempts' ? 'active' : ''}`}
                            onClick={() => { setActiveView('attempts'); closeSidebar(); }}
                        >
                            <span className="nav-icon">⚠️</span>
                            <span>Block Attempts</span>
                        </button>
                    </div>

                    <div className="nav-section">
                        <div className="nav-section-title">Logs & History</div>
                        <button
                            className={`nav-item ${activeView === 'match-history' ? 'active' : ''}`}
                            onClick={() => { setActiveView('match-history'); closeSidebar(); }}
                        >
                            <span className="nav-icon">📜</span>
                            <span>Match History</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* MAIN CONTENT */}
            <main className="admin-main">
                {/* HEADER */}
                <header className="admin-header">
                    <div className="header-left">
                        <button className="sidebar-toggle" onClick={toggleSidebar}>
                            ☰
                        </button>
                        <div className="search-container">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                className="header-search"
                                placeholder="Search..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="header-right">
                        <button className="header-icon-btn">
                            🔔
                            {blockedAttempts.length > 0 && <span className="notification-badge"></span>}
                        </button>
                        <button className="user-menu" onClick={handleLogout}>
                            <div className="user-avatar">A</div>
                            <span className="user-name">Admin</span>
                        </button>
                    </div>
                </header>

                {/* BREADCRUMB */}
                <div className="breadcrumb-container">
                    <nav className="breadcrumb">
                        <span className="breadcrumb-item">Admin</span>
                        <span className="breadcrumb-separator">/</span>
                        <span className="breadcrumb-item active">{getPageTitle()}</span>
                    </nav>
                </div>

                {/* PAGE HEADER */}
                <div className="page-header">
                    <div className="page-title-row">
                        <h1 className="page-title">{getPageTitle()}</h1>
                        <div className="card-actions">
                            <span className={`badge ${health?.status === 'ok' ? 'badge-success' : 'badge-danger'}`}>
                                <span className="status-dot"></span>
                                {health?.status === 'ok' ? 'System Online' : 'System Offline'}
                            </span>
                        </div>
                    </div>
                    <p className="page-subtitle">
                        {activeView === 'dashboard' && 'Real-time system metrics and statistics'}
                        {activeView === 'connections' && `Monitoring ${connections.length} active connection(s)`}
                        {activeView === 'queue' && `${queueStats.total} user(s) waiting in queue`}
                        {activeView === 'ip-blocking' && 'Manage blocked IP addresses'}
                        {activeView === 'device-blocking' && 'Manage blocked device identifiers'}
                        {activeView === 'attempts' && 'Review blocked connection attempts'}
                        {activeView === 'match-history' && 'Historical match records and analytics'}
                    </p>
                </div>

                {/* CONTENT */}
                <div className="admin-content">
                    <AnimatePresence mode="wait">
                        {/* DASHBOARD */}
                        {activeView === 'dashboard' && (
                            <motion.div
                                key="dashboard"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="stats-grid">
                                    <div className="stat-card stat-primary">
                                        <div className="stat-header">
                                            <div className="stat-title">Active Users</div>
                                            <div className="stat-icon">👥</div>
                                        </div>
                                        <div className="stat-value">{stats?.currentUsers || 0}</div>
                                        <div className="stat-footer">
                                            <span className="stat-change positive">Peak: {stats?.peakUsers || 0}</span>
                                        </div>
                                    </div>

                                    <div className="stat-card stat-success">
                                        <div className="stat-header">
                                            <div className="stat-title">Connections</div>
                                            <div className="stat-icon">🔗</div>
                                        </div>
                                        <div className="stat-value">{stats?.totalConnections || 0}</div>
                                        <div className="stat-footer">Total lifetime connections</div>
                                    </div>

                                    <div className="stat-card stat-warning">
                                        <div className="stat-header">
                                            <div className="stat-title">Matches</div>
                                            <div className="stat-icon">💬</div>
                                        </div>
                                        <div className="stat-value">{stats?.totalMatches || 0}</div>
                                        <div className="stat-footer">Successful pairings</div>
                                    </div>

                                    <div className="stat-card stat-info">
                                        <div className="stat-header">
                                            <div className="stat-title">Queue</div>
                                            <div className="stat-icon">⏳</div>
                                        </div>
                                        <div className="stat-value">{queueStats?.total || 0}</div>
                                        <div className="stat-footer">
                                            ♂ {queueStats?.byGender?.male || 0} | ♀ {queueStats?.byGender?.female || 0}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid-2">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">
                                                <span className="card-title-icon">🌐</span>
                                                Recent Connections
                                            </h3>
                                        </div>
                                        <div className="card-body">
                                            {connections.slice(0, 5).map((conn, i) => (
                                                <div key={i} className="blocked-item">
                                                    <div>
                                                        <div className="mono">{conn.ip}</div>
                                                        <div className="table-cell-secondary">{conn.duration}s</div>
                                                    </div>
                                                    <span className="badge badge-success">Active</span>
                                                </div>
                                            ))}
                                            {connections.length === 0 && (
                                                <div className="empty-state">
                                                    <div className="empty-icon">🌐</div>
                                                    <div className="empty-description">No active connections</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">
                                                <span className="card-title-icon">⚠️</span>
                                                Recent Blocks
                                            </h3>
                                        </div>
                                        <div className="card-body">
                                            {blockedAttempts.slice(0, 5).map((attempt, i) => (
                                                <div key={i} className="blocked-item">
                                                    <div>
                                                        <div className="mono">{attempt.ip}</div>
                                                        <div className="table-cell-secondary">
                                                            {new Date(attempt.timestamp).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                    <span className={`badge ${attempt.reason === 'IP Blocked' ? 'badge-danger' : 'badge-warning'}`}>
                                                        {attempt.reason}
                                                    </span>
                                                </div>
                                            ))}
                                            {blockedAttempts.length === 0 && (
                                                <div className="empty-state">
                                                    <div className="empty-icon">✅</div>
                                                    <div className="empty-description">No blocked attempts</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ACTIVE CONNECTIONS */}
                        {activeView === 'connections' && (
                            <motion.div
                                key="connections"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="card-title-icon">🌐</span>
                                            Active Connections
                                            <span className="card-count">({filteredConnections.length})</span>
                                        </h3>
                                        <div className="card-actions">
                                            <button className="btn btn-secondary btn-sm" onClick={() => exportLogs('connections')}>
                                                📥 Export CSV
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-body no-padding">
                                        <div className="table-container">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>IP Address</th>
                                                        <th>Socket ID</th>
                                                        <th>Duration</th>
                                                        <th>Device Hash</th>
                                                        <th className="text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredConnections.map((conn) => (
                                                        <tr key={conn.socketId}>
                                                            <td><span className="mono">{conn.ip}</span></td>
                                                            <td>
                                                                <span className="mono table-cell-secondary">
                                                                    {conn.socketId.substring(0, 12)}...
                                                                </span>
                                                            </td>
                                                            <td>{conn.duration}s</td>
                                                            <td>
                                                                <span className="mono table-cell-secondary">
                                                                    {conn.deviceHash?.substring(0, 12)}...
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="table-actions">
                                                                    <button
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={() => blockIpFromConnection(conn.ip)}
                                                                        title="Block this IP address"
                                                                    >
                                                                        🚫 IP
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={() => blockDeviceFromConnection(conn.deviceHash)}
                                                                        title="Block this device"
                                                                    >
                                                                        📱 Device
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-danger btn-sm"
                                                                        onClick={() => forceDisconnect(conn.socketId)}
                                                                        title="Force disconnect user"
                                                                    >
                                                                        ⚡ Disconnect
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {filteredConnections.length === 0 && (
                                            <div className="empty-state">
                                                <div className="empty-icon">🔌</div>
                                                <div className="empty-title">No active connections</div>
                                                <div className="empty-description">
                                                    Connections will appear here when users are online
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* QUEUE STATUS */}
                        {activeView === 'queue' && (
                            <motion.div
                                key="queue"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="card-title-icon">⏳</span>
                                            Queue Status
                                            <span className="card-count">({queueStats.total || 0} waiting)</span>
                                        </h3>
                                    </div>
                                    <div className="card-body">
                                        <div className="stats-grid">
                                            <div className="stat-card stat-primary">
                                                <div className="stat-title">Total in Queue</div>
                                                <div className="stat-value">{queueStats.total || 0}</div>
                                            </div>
                                            <div className="stat-card stat-info">
                                                <div className="stat-title">Male</div>
                                                <div className="stat-value">{queueStats.byGender?.male || 0}</div>
                                            </div>
                                            <div className="stat-card stat-warning">
                                                <div className="stat-title">Female</div>
                                                <div className="stat-value">{queueStats.byGender?.female || 0}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* IP BLOCKING */}
                        {activeView === 'ip-blocking' && (
                            <motion.div
                                key="ip-blocking"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="card-title-icon">🚫</span>
                                            Blocked IP Logs
                                            <span className="card-count">({blocked.blocked?.filter(b => b.type === 'ip').length})</span>
                                        </h3>
                                    </div>
                                    <div className="card-body">
                                        <div className="form-group">
                                            <label className="form-label required">Block New IP Address</label>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Enter IP address (e.g., 192.168.1.1)"
                                                    value={newBlockIp}
                                                    onChange={(e) => setNewBlockIp(e.target.value)}
                                                />
                                                <button className="btn btn-danger" onClick={blockIp}>
                                                    🚫 Block IP
                                                </button>
                                            </div>
                                            <p className="form-helper">Manually blocked IPs are permanent by default.</p>
                                        </div>

                                        <div className="table-container">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>IP Address</th>
                                                        <th>Reason</th>
                                                        <th>Severity</th>
                                                        <th>Expires</th>
                                                        <th className="text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {blocked.blocked?.filter(b => b.type === 'ip').map((ban) => (
                                                        <tr key={ban.key}>
                                                            <td><span className="mono">{ban.key}</span></td>
                                                            <td>{ban.reason || 'N/A'}</td>
                                                            <td>
                                                                <span className={`badge ${ban.severity === 'level2' ? 'badge-danger' : 'badge-warning'}`}>
                                                                    {ban.severity === 'level2' ? 'Permanent' : 'Temporary'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {ban.expiresAt ? new Date(ban.expiresAt).toLocaleString() : 'Never'}
                                                            </td>
                                                            <td className="text-right">
                                                                <button
                                                                    className="btn btn-secondary btn-sm"
                                                                    onClick={() => unblockIp(ban.key)}
                                                                >
                                                                    Unblock
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {(!blocked.blocked || blocked.blocked.filter(b => b.type === 'ip').length === 0) && (
                                            <div className="empty-state">
                                                <div className="empty-icon">✅</div>
                                                <div className="empty-title">No blocked IPs</div>
                                                <div className="empty-description">
                                                    Blocked IP addresses will appear here
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* DEVICE BLOCKING */}
                        {activeView === 'device-blocking' && (
                            <motion.div
                                key="device-blocking"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="card-title-icon">📱</span>
                                            Blocked Device Logs
                                            <span className="card-count">({blocked.blocked?.filter(b => b.type === 'device').length})</span>
                                        </h3>
                                    </div>
                                    <div className="card-body">
                                        <div className="form-group">
                                            <label className="form-label required">Block New Device Hash</label>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Enter Device Hash"
                                                    value={newBlockDevice}
                                                    onChange={(e) => setNewBlockDevice(e.target.value)}
                                                />
                                                <button className="btn btn-danger" onClick={blockDevice}>
                                                    🚫 Block Device
                                                </button>
                                            </div>
                                            <p className="form-helper">Permanently ban a specific device. Use with caution.</p>
                                        </div>

                                        <div className="table-container">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Device Hash</th>
                                                        <th>Reason</th>
                                                        <th>Severity</th>
                                                        <th>Expires</th>
                                                        <th className="text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {blocked.blocked?.filter(b => b.type === 'device').map((ban) => (
                                                        <tr key={ban.key}>
                                                            <td>
                                                                <span className="mono table-cell-secondary" title={ban.key}>
                                                                    {ban.key.substring(0, 16)}...
                                                                </span>
                                                            </td>
                                                            <td>{ban.reason || 'N/A'}</td>
                                                            <td>
                                                                <span className={`badge ${ban.severity === 'level2' ? 'badge-danger' : 'badge-warning'}`}>
                                                                    {ban.severity === 'level2' ? 'Permanent' : 'Temporary'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {ban.expiresAt ? new Date(ban.expiresAt).toLocaleString() : 'Never'}
                                                            </td>
                                                            <td className="text-right">
                                                                <button
                                                                    className="btn btn-secondary btn-sm"
                                                                    onClick={() => unblockDevice(ban.key)}
                                                                >
                                                                    Unblock
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {(!blocked.blocked || blocked.blocked.filter(b => b.type === 'device').length === 0) && (
                                            <div className="empty-state">
                                                <div className="empty-icon">✅</div>
                                                <div className="empty-title">No blocked devices</div>
                                                <div className="empty-description">
                                                    Blocked devices will appear here
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* BLOCKED ATTEMPTS */}
                        {activeView === 'attempts' && (
                            <motion.div
                                key="attempts"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="card-title-icon">⚠️</span>
                                            Blocked Connection Attempts
                                            <span className="card-count">({blockedAttempts.length})</span>
                                        </h3>
                                        <div className="card-actions">
                                            <button className="btn btn-secondary btn-sm" onClick={() => exportLogs('blocked_attempts')}>
                                                📥 Export CSV
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-body no-padding">
                                        <div className="table-container">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Timestamp</th>
                                                        <th>IP Address</th>
                                                        <th>Reason</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {blockedAttempts.map((attempt, i) => (
                                                        <tr key={i}>
                                                            <td className="table-cell-secondary">
                                                                {new Date(attempt.timestamp).toLocaleString()}
                                                            </td>
                                                            <td><span className="mono">{attempt.ip}</span></td>
                                                            <td>
                                                                <span className={`badge ${attempt.reason === 'IP Blocked' ? 'badge-danger' : 'badge-warning'}`}>
                                                                    {attempt.reason}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {blockedAttempts.length === 0 && (
                                            <div className="empty-state">
                                                <div className="empty-icon">🛡️</div>
                                                <div className="empty-title">No blocked attempts</div>
                                                <div className="empty-description">
                                                    Security events will appear here
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* MATCH HISTORY */}
                        {activeView === 'match-history' && (
                            <motion.div
                                key="match-history"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="card-title-icon">📜</span>
                                            Match History
                                            <span className="card-count">({matchLogs.length})</span>
                                        </h3>
                                        <div className="card-actions">
                                            <button className="btn btn-secondary btn-sm" onClick={() => exportLogs('matches')}>
                                                📥 Export CSV
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-body no-padding">
                                        <div className="table-container">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Timestamp</th>
                                                        <th>Duration</th>
                                                        <th>User A</th>
                                                        <th>User B</th>
                                                        <th>Reason</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {matchLogs.map((log, i) => (
                                                        <tr key={i}>
                                                            <td className="table-cell-secondary">
                                                                {new Date(log.timestamp).toLocaleString()}
                                                            </td>
                                                            <td>{Math.floor(log.duration / 1000)}s</td>
                                                            <td>
                                                                <div className="mono">{log.userA?.ip}</div>
                                                                <div className="table-cell-secondary">
                                                                    {log.userA?.device?.substring(0, 12)}...
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="mono">{log.userB?.ip}</div>
                                                                <div className="table-cell-secondary">
                                                                    {log.userB?.device?.substring(0, 12)}...
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-info">{log.reason}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {matchLogs.length === 0 && (
                                            <div className="empty-state">
                                                <div className="empty-icon">📋</div>
                                                <div className="empty-title">No match history</div>
                                                <div className="empty-description">
                                                    Match records will appear here
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeView === 'reports' && (
                            <motion.div
                                key="reports"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="card-title-icon">⚠️</span>
                                            User Reports
                                        </h3>
                                        <button className="btn btn-secondary btn-sm" onClick={fetchReports}>
                                            Refresh
                                        </button>
                                    </div>
                                    <div className="table-container">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Device Hash</th>
                                                    <th>Reports</th>
                                                    <th>Last Reason</th>
                                                    <th>Last Reported</th>
                                                    <th className="text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reports.length === 0 ? (
                                                    <tr><td colSpan="5" className="text-center p-4 text-gray-400">No active reports.</td></tr>
                                                ) : (
                                                    reports.map((report) => (
                                                        <tr key={report.hash}>
                                                            <td><span className="mono">{report.hash.substring(0, 12)}...</span></td>
                                                            <td>
                                                                <span className={`badge ${report.count >= 3 ? 'badge-danger' : 'badge-warning'}`}>
                                                                    {report.count}
                                                                </span>
                                                            </td>
                                                            <td>{report.reports[report.reports.length - 1]?.reason}</td>
                                                            <td className="text-sm text-gray-400">
                                                                {new Date(report.reports[report.reports.length - 1]?.timestamp).toLocaleString()}
                                                            </td>
                                                            <td className="text-right space-x-2">
                                                                <button
                                                                    className="btn btn-secondary btn-sm"
                                                                    onClick={() => dismissReport(report.hash)}
                                                                >
                                                                    Dismiss
                                                                </button>
                                                                <button
                                                                    className="btn btn-danger btn-sm"
                                                                    onClick={() => {
                                                                        if (confirm('Permanently ban this user?')) {
                                                                            const password = localStorage.getItem('admin_password');
                                                                            fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(report.hash)}`, {
                                                                                method: 'POST',
                                                                                headers: { 'x-admin-password': password }
                                                                            }).then(() => {
                                                                                alert('User Banned');
                                                                                fetchReports();
                                                                            });
                                                                        }
                                                                    }}
                                                                >
                                                                    Ban User
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}

export default AdminDashboard;
