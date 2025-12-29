import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import './AdminDashboard.css';

const API_BASE = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return 'https://voice-chat-0dnh.onrender.com';
})();

function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [health, setHealth] = useState(null);
    const [blocked, setBlocked] = useState({ blockedIps: [], blockedDevices: [] });
    const [blockedAttempts, setBlockedAttempts] = useState([]);
    const [connections, setConnections] = useState([]);
    const [queueStats, setQueueStats] = useState({ total: 0, byGender: {}, byPreference: {}, users: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newBlockIp, setNewBlockIp] = useState('');
    const [newBlockDevice, setNewBlockDevice] = useState('');
    const [refreshInterval, setRefreshInterval] = useState(2000);
    const [searchFilter, setSearchFilter] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, healthRes, blockedRes, attemptsRes, connectionsRes, queueRes] = await Promise.all([
                fetch(`${API_BASE}/admin/stats`),
                fetch(`${API_BASE}/health`),
                fetch(`${API_BASE}/admin/blocked`),
                fetch(`${API_BASE}/admin/blocked/attempts`),
                fetch(`${API_BASE}/admin/connections`),
                fetch(`${API_BASE}/admin/queue`)
            ]);

            if (!statsRes.ok || !healthRes.ok || !blockedRes.ok) {
                throw new Error('Failed to fetch data');
            }

            const [statsData, healthData, blockedData, attemptsData, connectionsData, queueData] = await Promise.all([
                statsRes.json(),
                healthRes.json(),
                blockedRes.json(),
                attemptsRes.ok ? attemptsRes.json() : { attempts: [] },
                connectionsRes.ok ? connectionsRes.json() : { connections: [] },
                queueRes.ok ? queueRes.json() : { total: 0, byGender: {}, byPreference: {}, users: [] }
            ]);

            setStats(statsData);
            setHealth(healthData);
            setBlocked(blockedData);
            setBlockedAttempts(attemptsData.attempts || []);
            setConnections(connectionsData.connections || []);
            setQueueStats(queueData);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchData, refreshInterval]);

    // INPUT-BASED BLOCKING (from text inputs)
    const blockIp = async () => {
        if (!newBlockIp.trim()) return;
        if (!confirm(`Are you sure you want to block IP: ${newBlockIp}?`)) return;

        try {
            const res = await fetch(`${API_BASE}/admin/block/ip/${encodeURIComponent(newBlockIp)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                alert(`✅ IP ${newBlockIp} blocked successfully`);
                setNewBlockIp('');
                fetchData();
            } else {
                throw new Error('Server returned error');
            }
        } catch (err) {
            alert(`❌ Failed to block IP: ${err.message}`);
        }
    };

    const unblockIp = async (ip) => {
        if (!confirm(`Unblock IP: ${ip}?`)) return;
        try {
            await fetch(`${API_BASE}/admin/block/ip/${encodeURIComponent(ip)}`, {
                method: 'DELETE'
            });
            alert(`✅ IP ${ip} unblocked`);
            fetchData();
        } catch (err) {
            alert(`❌ Failed to unblock IP: ${err.message}`);
        }
    };

    const blockDevice = async () => {
        if (!newBlockDevice.trim()) return;
        if (!confirm(`Are you sure you want to block device: ${newBlockDevice}?`)) return;

        try {
            const res = await fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(newBlockDevice)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                alert(`✅ Device ${newBlockDevice} blocked successfully`);
                setNewBlockDevice('');
                fetchData();
            } else {
                throw new Error('Server returned error');
            }
        } catch (err) {
            alert(`❌ Failed to block device: ${err.message}`);
        }
    };

    const unblockDevice = async (hash) => {
        if (!confirm(`Unblock device: ${hash}?`)) return;
        try {
            await fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(hash)}`, {
                method: 'DELETE'
            });
            alert(`✅ Device ${hash} unblocked`);
            fetchData();
        } catch (err) {
            alert(`❌ Failed to unblock device: ${err.message}`);
        }
    };

    // DIRECT BLOCKING (from connection list - safe, no state dependency)
    const blockIpDirect = async (ip) => {
        if (!ip || !confirm(`⚠️ Block IP: ${ip}?\n\nThis will immediately block all connections from this IP address.`)) return;

        try {
            const res = await fetch(`${API_BASE}/admin/block/ip/${encodeURIComponent(ip)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                alert(`✅ IP ${ip} blocked successfully!`);
                fetchData();
            } else {
                throw new Error('Server returned error');
            }
        } catch (err) {
            alert(`❌ Failed to block IP: ${err.message}`);
        }
    };

    const blockDeviceDirect = async (deviceHash) => {
        if (!deviceHash || deviceHash === 'N/A') {
            alert('⚠️ Cannot block - no device hash available');
            return;
        }
        if (!confirm(`⚠️ Block Device: ${deviceHash}?\n\nThis will block all connections from this device.`)) return;

        try {
            const res = await fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(deviceHash)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                alert(`✅ Device blocked successfully!`);
                fetchData();
            } else {
                throw new Error('Server returned error');
            }
        } catch (err) {
            alert(`❌ Failed to block device: ${err.message}`);
        }
    };

    // FORCE DISCONNECT
    const forceDisconnect = async (socketId, ip) => {
        if (!confirm(`⚠️ Force disconnect user?\n\nSocket: ${socketId}\nIP: ${ip}\n\nThis will immediately terminate their connection.`)) return;

        try {
            const res = await fetch(`${API_BASE}/admin/disconnect/${encodeURIComponent(socketId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                alert(`✅ User disconnected successfully`);
                fetchData();
            } else {
                throw new Error('Server returned error');
            }
        } catch (err) {
            alert(`❌ Failed to disconnect user: ${err.message}`);
        }
    };

    // BLOCK + DISCONNECT (nuclear option)
    const blockAndDisconnect = async (socketId, ip, deviceHash) => {
        if (!confirm(
            `🚨 BLOCK & DISCONNECT USER?\n\n` +
            `IP: ${ip}\n` +
            `Device: ${deviceHash}\n` +
            `Socket: ${socketId}\n\n` +
            `This will:\n` +
            `1. Block their IP address\n` +
            `2. Block their device hash\n` +
            `3. Immediately disconnect them\n\n` +
            `Continue?`
        )) return;

        try {
            // Block IP and device in parallel
            const blockPromises = [];
            if (ip) {
                blockPromises.push(
                    fetch(`${API_BASE}/admin/block/ip/${encodeURIComponent(ip)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }
            if (deviceHash && deviceHash !== 'N/A') {
                blockPromises.push(
                    fetch(`${API_BASE}/admin/block/device/${encodeURIComponent(deviceHash)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }

            await Promise.all(blockPromises);

            // Then disconnect
            await fetch(`${API_BASE}/admin/disconnect/${encodeURIComponent(socketId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            alert(`✅ User blocked and disconnected successfully!`);
            fetchData();
        } catch (err) {
            alert(`❌ Failed to block and disconnect user: ${err.message}`);
        }
    };

    // Render loading state AFTER all hooks and functions are defined
    // This prevents "Rendered fewer hooks than expected" error

    return (
        <div className="admin-dashboard">
            {loading ? (
                <div className="admin-loading">
                    <div className="admin-spinner"></div>
                    <p>Loading dashboard...</p>
                </div>
            ) : (
                <>
                    <motion.div
                        className="admin-header"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h1>📊 Monitoring Dashboard</h1>
                        <div className="admin-controls">
                            <select
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                className="refresh-select"
                            >
                                <option value={1000}>1s refresh</option>
                                <option value={2000}>2s refresh</option>
                                <option value={5000}>5s refresh</option>
                                <option value={10000}>10s refresh</option>
                            </select>
                            <span className={`status-indicator ${health?.status === 'ok' ? 'online' : 'offline'}`}>
                                {health?.status === 'ok' ? '● Online' : '○ Offline'}
                            </span>
                        </div>
                    </motion.div>

                    {error && (
                        <div className="admin-error">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Real-time Stats Cards */}
                    <div className="stats-grid">
                        <motion.div
                            className="stat-card users"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div className="stat-icon">👥</div>
                            <div className="stat-content">
                                <h3>Active Users</h3>
                                <div className="stat-value">{stats?.currentUsers || 0}</div>
                                <div className="stat-subtitle">Peak: {stats?.peakUsers || 0}</div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="stat-card connections"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="stat-icon">🔗</div>
                            <div className="stat-content">
                                <h3>Total Connections</h3>
                                <div className="stat-value">{stats?.totalConnections || 0}</div>
                                <div className="stat-subtitle">Since startup</div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="stat-card matches"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="stat-icon">💬</div>
                            <div className="stat-content">
                                <h3>Total Matches</h3>
                                <div className="stat-value">{stats?.totalMatches || 0}</div>
                                <div className="stat-subtitle">Successful pairings</div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="stat-card uptime"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className="stat-icon">⏱️</div>
                            <div className="stat-content">
                                <h3>Uptime</h3>
                                <div className="stat-value">{stats?.uptime || '0s'}</div>
                                <div className="stat-subtitle">Redis: {health?.redis || 'unknown'}</div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="stat-card queue"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <div className="stat-icon">🔄</div>
                            <div className="stat-content">
                                <h3>In Queue</h3>
                                <div className="stat-value">{queueStats?.total || 0}</div>
                                <div className="stat-subtitle">
                                    ♂ {queueStats?.byGender?.male || 0} | ♀ {queueStats?.byGender?.female || 0}
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Memory Stats */}
                    <motion.div
                        className="memory-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <h3>💾 Memory Usage</h3>
                        <div className="memory-stats">
                            <div className="memory-item">
                                <span className="memory-label">Heap Used</span>
                                <span className="memory-value">{health?.memory ? (health.memory.heapUsed / 1024 / 1024).toFixed(2) + ' MB' : '-'}</span>
                            </div>
                            <div className="memory-item">
                                <span className="memory-label">Heap Total</span>
                                <span className="memory-value">{health?.memory ? (health.memory.heapTotal / 1024 / 1024).toFixed(2) + ' MB' : '-'}</span>
                            </div>
                            <div className="memory-item">
                                <span className="memory-label">RSS</span>
                                <span className="memory-value">{health?.memory ? (health.memory.rss / 1024 / 1024).toFixed(2) + ' MB' : '-'}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Connected Users with IPs */}
                    <motion.div
                        className="connections-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                    >
                        <h3>🌐 Connected Users ({connections.length})</h3>
                        <div className="connections-header">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="🔍 Search by IP, device, or ID..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                            />
                        </div>
                        <div className="connections-list">
                            {connections.length === 0 ? (
                                <div className="empty-state">No active connections</div>
                            ) : (
                                connections
                                    .filter(conn =>
                                        !searchFilter ||
                                        conn.ip?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                                        conn.deviceHash?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                                        conn.socketId?.toLowerCase().includes(searchFilter.toLowerCase())
                                    )
                                    .map((conn) => (
                                        <div key={conn.socketId} className="connection-item">
                                            <div className="connection-ip">{conn.ip}</div>
                                            <div className="connection-details">
                                                <span className="connection-id" title={conn.socketId}>
                                                    {conn.socketId.substring(0, 8)}...
                                                </span>
                                                <span className="connection-duration">{conn.duration}s</span>
                                            </div>
                                            <div className="connection-device" title={conn.deviceHash}>
                                                {conn.deviceHash?.length > 12 ? conn.deviceHash.substring(0, 12) + '...' : conn.deviceHash}
                                            </div>
                                            <div className="connection-actions">
                                                <button
                                                    className="action-btn block-ip"
                                                    onClick={() => blockIpDirect(conn.ip)}
                                                    title="Block IP"
                                                >
                                                    🚫 IP
                                                </button>
                                                <button
                                                    className="action-btn block-device"
                                                    onClick={() => blockDeviceDirect(conn.deviceHash)}
                                                    title="Block Device"
                                                >
                                                    📵 Dev
                                                </button>
                                                <button
                                                    className="action-btn disconnect"
                                                    onClick={() => forceDisconnect(conn.socketId, conn.ip)}
                                                    title="Force Disconnect"
                                                >
                                                    ⚡ DC
                                                </button>
                                                <button
                                                    className="action-btn block-all"
                                                    onClick={() => blockAndDisconnect(conn.socketId, conn.ip, conn.deviceHash)}
                                                    title="Block IP + Device + Disconnect"
                                                >
                                                    🚨 All
                                                </button>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </motion.div>

                    {/* Blocking Section */}
                    <div className="blocking-section">
                        <motion.div
                            className="block-card"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <h3>🚫 Blocked IPs ({blocked.blockedIps.length})</h3>
                            <div className="block-input-group">
                                <input
                                    type="text"
                                    placeholder="Enter IP address..."
                                    value={newBlockIp}
                                    onChange={(e) => setNewBlockIp(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && blockIp()}
                                />
                                <button onClick={blockIp}>Block</button>
                            </div>
                            <div className="blocked-list">
                                {blocked.blockedIps.length === 0 ? (
                                    <div className="empty-state">No blocked IPs</div>
                                ) : (
                                    blocked.blockedIps.map((ip) => (
                                        <div key={ip} className="blocked-item">
                                            <span>{ip}</span>
                                            <button onClick={() => unblockIp(ip)} className="unblock-btn">✕</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>

                        <motion.div
                            className="block-card"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.7 }}
                        >
                            <h3>📱 Blocked Devices ({blocked.blockedDevices.length})</h3>
                            <div className="block-input-group">
                                <input
                                    type="text"
                                    placeholder="Enter device hash..."
                                    value={newBlockDevice}
                                    onChange={(e) => setNewBlockDevice(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && blockDevice()}
                                />
                                <button onClick={blockDevice}>Block</button>
                            </div>
                            <div className="blocked-list">
                                {blocked.blockedDevices.length === 0 ? (
                                    <div className="empty-state">No blocked devices</div>
                                ) : (
                                    blocked.blockedDevices.map((hash) => (
                                        <div key={hash} className="blocked-item">
                                            <span title={hash}>{hash.length > 20 ? hash.substring(0, 20) + '...' : hash}</span>
                                            <button onClick={() => unblockDevice(hash)} className="unblock-btn">✕</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Real-time Blocked Attempts Log */}
                    <motion.div
                        className="attempts-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                    >
                        <h3>📋 Recent Blocked Attempts ({blockedAttempts.length})</h3>
                        <div className="attempts-list">
                            {blockedAttempts.length === 0 ? (
                                <div className="empty-state">No blocked attempts yet</div>
                            ) : (
                                blockedAttempts.slice(0, 10).map((attempt, idx) => (
                                    <div key={idx} className="attempt-item">
                                        <div className="attempt-time">{new Date(attempt.timestamp).toLocaleTimeString()}</div>
                                        <div className="attempt-details">
                                            <span className="attempt-ip">{attempt.ip}</span>
                                            <span className={`attempt-reason ${attempt.reason === 'IP Blocked' ? 'ip' : 'device'}`}>
                                                {attempt.reason}
                                            </span>
                                        </div>
                                        <div className="attempt-device" title={attempt.deviceHash}>
                                            {attempt.deviceHash?.length > 15 ? attempt.deviceHash.substring(0, 15) + '...' : attempt.deviceHash}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>

                    <div className="admin-footer">
                        <p>Last updated: {new Date().toLocaleTimeString()}</p>
                    </div>
                </>
            )}
        </div>
    );
}

export default AdminDashboard;
