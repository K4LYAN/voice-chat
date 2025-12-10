import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "tween", duration: 0.3 }
    }
};

const LandingView = ({ languages, selectedFilters, onToggleFilter, onQuickStart, detectedLang, isConnected }) => {
    const [searchTerm, setSearchTerm] = React.useState('');

    return (
        <div className="landing-page-wrapper">
            <motion.section
                className="hero-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
            >
                <h1 className="hero-title">
                    Global Connection.
                </h1>

                <p className="hero-subtitle">
                    Connect instantly with people who speak your language. Simple, fast, and free.
                </p>

                {/* Quick Start CTA */}
                <motion.button
                    className="btn-quick-start"
                    onClick={onQuickStart}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <div className="btn-icon">⚡</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedFilters.length > 0 ? 'Start Matching' : 'Global Quick Start'}</span>
                    </div>
                </motion.button>

                {/* Active Filter Banner */}
                {selectedFilters.length > 0 && (
                    <div className="filter-banner">
                        {selectedFilters.map(filter => (
                            <motion.span key={filter} layoutId={`pill-${filter}`} className="filter-pill">
                                {filter}
                                <button className="pill-remove" onClick={(e) => { e.stopPropagation(); onToggleFilter(filter); }}>×</button>
                            </motion.span>
                        ))}
                        <button className="pill-clear" onClick={() => selectedFilters.forEach(f => onToggleFilter(f))}>Clear All</button>
                    </div>
                )}

                <div className="filter-section">
                    <div className="filter-header-row">
                        <span className="filter-header">Select Language</span>
                        <div className="search-wrapper">
                            <span className="search-icon" style={{ opacity: 0.5, fontSize: '0.9rem' }}>🔍</span>
                            <input
                                type="text"
                                className="lang-search-input"
                                placeholder="Find..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <motion.div
                        className="language-grid"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        key={searchTerm}
                    >
                        {languages
                            .filter(lang =>
                                lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                lang.native.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map(lang => {
                                const isSelected = selectedFilters.includes(lang.code);

                                return (
                                    <motion.button
                                        key={lang.code}
                                        className={`lang-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => onToggleFilter(lang.code)}
                                        variants={itemVariants}
                                        whileHover={{ y: -2 }}
                                        whileTap={{ y: 0 }}
                                    >
                                        <div className="lang-info">
                                            <span className="lang-name">{lang.name}</span>
                                            <span className="lang-native">{lang.native}</span>
                                        </div>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="check-icon"
                                            >
                                                ✓
                                            </motion.div>
                                        )}
                                    </motion.button>
                                );
                            })}
                    </motion.div>
                </div>
            </motion.section>

            {/* How It Works Section */}
            <section className="section-container how-it-works">
                <h2 className="section-title">How It Works</h2>
                <div className="steps-grid">
                    <div className="step-card">
                        <div className="step-number">01</div>
                        <h3>Select Language</h3>
                        <p>Choose your preferred language or region to find matching partners.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number">02</div>
                        <h3>Instant Match</h3>
                        <p>Our algorithm connects you with available users in seconds.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number">03</div>
                        <h3>Start Chatting</h3>
                        <p>Connect via high-quality video and audio. No sign-up required.</p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="section-container features-section">
                <div className="feature-content">
                    <h2 className="section-title">Why VoiceChat?</h2>
                    <div className="features-grid">
                        <div className="feature-item">
                            <span className="feature-icon">🔒</span>
                            <h3>Anonymous & Safe</h3>
                            <p>We don't store your data. Chats are peer-to-peer and private.</p>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">🌍</span>
                            <h3>Global Reach</h3>
                            <p>Connect with people from over 100 countries instantly.</p>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">⚡</span>
                            <h3>Lightning Fast</h3>
                            <p>Optimized for low-latency video even on slow networks.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Simple Footer */}
            <footer className="site-footer">
                <div className="footer-content">
                    <div className="footer-brand">VoiceChat</div>
                    <div className="footer-links">
                        <span>Terms</span>
                        <span>Privacy</span>
                        <span>Contact</span>
                    </div>
                    <div className="footer-copyright">© 2024 VoiceChat Inc.</div>
                </div>
            </footer>
        </div>
    );
};

export default React.memo(LandingView);
