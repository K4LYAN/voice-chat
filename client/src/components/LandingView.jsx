import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.03,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 24 }
    }
};

const LandingView = ({ languages, selectedFilters, onToggleFilter, onQuickStart, detectedLang, isConnected }) => {
    return (
        <motion.main
            className="hero-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
        >
            <motion.h1
                className="hero-title"
                layout
            >
                Global Connection.
            </motion.h1>

            <motion.p className="hero-subtitle" layout>
                Connect with people who prefer your languages. Tap Quick Start to begin.
            </motion.p>

            {/* Quick Start CTA */}
            <motion.button
                className="btn-quick-start"
                onClick={onQuickStart}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                layout
                title="Connect instantly with people who speak your language"
            >
                <span style={{ fontSize: '1.4rem' }}>⚡</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                    <span>{selectedFilters.length > 0 ? 'Quick Match' : 'Global Quick Start'}</span>
                    {selectedFilters.length > 0 && (
                        <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 400 }}>
                            Searching in {selectedFilters.slice(0, 2).join(', ')} {selectedFilters.length > 2 ? `+${selectedFilters.length - 2}` : ''}
                        </span>
                    )}
                </div>
            </motion.button>

            {/* Active Filter Banner */}
            {selectedFilters.length > 0 && (
                <motion.div
                    className="filter-banner"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <span className="filter-label">Active Filters:</span>
                    <div className="filter-pills">
                        {selectedFilters.map(filter => (
                            <motion.span key={filter} layoutId={`pill-${filter}`} className="filter-pill">
                                {filter}
                                <button className="pill-remove" onClick={(e) => { e.stopPropagation(); onToggleFilter(filter); }}>×</button>
                            </motion.span>
                        ))}
                    </div>
                </motion.div>
            )}

            <div className="filter-header">Select Regional Languages</div>

            <motion.div
                className="language-grid"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {languages.map(lang => {
                    const isSelected = selectedFilters.includes(lang.code);
                    const isDetected = detectedLang === lang.code;

                    return (
                        <motion.button
                            key={lang.code}
                            className={`lang-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => onToggleFilter(lang.code)}
                            variants={itemVariants}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            layout
                            aria-label={`Select ${lang.name}`}
                            aria-pressed={isSelected}
                        >
                            <div className="lang-info">
                                <span className="lang-name">{lang.name}</span>
                                <span className="lang-native">{lang.native}</span>
                            </div>
                            <div className="lang-status">
                                {isDetected && <span className="badge-detected">Detected</span>}
                                {isSelected && <motion.span layoutId={`check-${lang.code}`} className="check-icon">✓</motion.span>}
                            </div>
                        </motion.button>
                    );
                })}
            </motion.div>
        </motion.main>
    );
};

export default React.memo(LandingView);
