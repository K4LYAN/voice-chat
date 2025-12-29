import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Conversation Helpers
const CONVERSATION_TIPS = [
    { type: 'tip', text: "Start with a simple 'Hi, where are you from?'" },
    { type: 'question', text: "Ask: 'If you could travel anywhere right now, where would you go?'" },
    { type: 'mindset', text: "Smile! It makes your voice sound friendlier." },
    { type: 'question', text: "Ask: 'What was the highlight of your week so far?'" },
    { type: 'tip', text: "Don't worry about awkward silences, they happen to everyone." },
    { type: 'question', text: "Ask: 'Have you seen any good movies lately?'" },
];

const SEARCH_PHASES = [
    "Initializing Uplink...",
    "Scanning Global Nodes...",
    "Ping 24ms... Stable",
    "Searching Network...",
    "Triangulating Signals...",
    "Handshake Protocol Ready..."
];

const SearchingView = ({ language, onCancel, onSearchGlobal, myStream }) => {
    const [status, setStatus] = React.useState('SEARCHING'); // SEARCHING, TIMEOUT
    const [elapsed, setElapsed] = React.useState(0);
    const [tipIndex, setTipIndex] = React.useState(0);
    const [phaseIndex, setPhaseIndex] = React.useState(0);
    const [usersOnline, setUsersOnline] = React.useState(1240);
    const localVideoRef = React.useRef(null);

    React.useEffect(() => {
        if (localVideoRef.current && myStream) {
            localVideoRef.current.srcObject = myStream;
        }
    }, [myStream]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setStatus('TIMEOUT');
        }, 30000); // 30s timeout

        return () => clearTimeout(timer);
    }, []);

    // Progress, Tips, and Stats Animation
    React.useEffect(() => {
        if (status === 'SEARCHING') {
            // General elapsed timer
            const interval = setInterval(() => {
                setElapsed(prev => prev + 0.1);
            }, 100);

            // Cycle tips every 6 seconds
            const tipInterval = setInterval(() => {
                setTipIndex(prev => (prev + 1) % CONVERSATION_TIPS.length);
            }, 6000);

            // Cycle phases every 2.5 seconds
            const phaseInterval = setInterval(() => {
                setPhaseIndex(prev => (prev + 1) % SEARCH_PHASES.length);
            }, 2500);

            // Fluctuate users online count randomly
            const usersInterval = setInterval(() => {
                setUsersOnline(prev => {
                    const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
                    return prev + change;
                });
            }, 2000);

            return () => {
                clearInterval(interval);
                clearInterval(tipInterval);
                clearInterval(phaseInterval);
                clearInterval(usersInterval);
            };
        }
    }, [status]);

    const handleKeepWaiting = () => {
        setStatus('SEARCHING');
        setElapsed(0);
        setTipIndex(0);
        setPhaseIndex(0);
    };

    return (
        <motion.div
            className="searching-view-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="searching-bg-mesh" />

            <div className="search-card-glass">
                {/* Visual Header */}
                <div className="scanner-header">
                    <div className="scanner-badge">
                        <span className="badge-dot" />
                        <span>Searching: {language || 'Global'}</span>
                    </div>
                </div>

                {/* Radar Area */}
                <div className="radar-container">
                    <div className="radar-ring ring-outer" />
                    <div className="radar-ring ring-inner" />

                    <div className="radar-avatar-frame">
                        {myStream ? (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="radar-video"
                            />
                        ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-3xl">
                                👋
                            </div>
                        )}
                    </div>
                </div>

                {/* Queue Stats (New Feature) */}
                <div className="queue-stats-container">
                    <div className="stat-badge-glass">
                        <span className="live-dot" />
                        <span>{usersOnline.toLocaleString()} Online</span>
                    </div>
                    <div className="stat-badge-glass">
                        <span>⏱️ &lt; 15s Wait</span>
                    </div>
                </div>

                {/* Text Content with Dynamic Phases */}
                <div className="status-wrapper">
                    {status === 'SEARCHING' ? (
                        <>
                            <div className="phase-text-container">
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={phaseIndex}
                                        className="phase-text"
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                    >
                                        &gt; {SEARCH_PHASES[phaseIndex]}
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                            <h2 className="status-title">Looking for a partner...</h2>
                        </>
                    ) : (
                        <>
                            <h2 className="status-title">It's quiet right now</h2>
                            <p className="status-subtitle">
                                No partners found in <strong>{language || 'Global'}</strong>.
                            </p>
                        </>
                    )}
                </div>

                {/* Tips Carousel (Only when searching) */}
                {status === 'SEARCHING' && (
                    <div className="tip-carousel">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={tipIndex}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="flex flex-col items-center"
                            >
                                <span className="tip-label">
                                    {CONVERSATION_TIPS[tipIndex].type === 'question' ? 'Icebreaker' : 'Pro Tip'}
                                </span>
                                <p className="tip-text">
                                    "{CONVERSATION_TIPS[tipIndex].text}"
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                )}

                {/* Actions */}
                <div className="search-actions">
                    {status === 'TIMEOUT' ? (
                        <>
                            <button className="btn-global-search" onClick={onSearchGlobal}>
                                Try Global Search
                            </button>
                            <button className="btn-cancel-glass" onClick={handleKeepWaiting}>
                                Keep Waiting
                            </button>
                            <button
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button className="btn-cancel-glass" onClick={onCancel}>
                            Cancel Search
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default React.memo(SearchingView);