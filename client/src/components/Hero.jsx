import React from 'react';
import { motion } from 'framer-motion';

const Hero = ({ onQuickStart }) => {
    return (
        <section className="hero-section" id="hero">
            {/* Animated Background Glow */}
            <motion.div
                className="hero-glow-blob blob-1"
                animate={{
                    x: [0, 30, -30, 0],
                    y: [0, -50, 20, 0],
                    scale: [1, 1.1, 0.9, 1]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="hero-glow-blob blob-2"
                animate={{
                    x: [0, -40, 40, 0],
                    y: [0, 40, -40, 0],
                    scale: [1, 1.2, 0.8, 1]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="hero-content container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="hero-header"
                >
                    <div className="trust-badge-glass">
                        <span className="pulse-dot"></span>
                        <span>Join 100K+ Users Online</span>
                    </div>

                    <h1 className="hero-title-premium">
                        Connect with the world,
                        <br />
                        <span className="text-gradient">Anonymously.</span>
                    </h1>


                    <p className="hero-subtitle-premium">
                        Experience borderless voice matching with crystal clear audio.
                        <br />
                        No registration required.
                    </p>

                    <motion.button
                        className="btn-premium-cta"
                        onClick={onQuickStart}
                        whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(99, 102, 241, 0.4)" }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <span className="btn-icon">⚡</span>
                        <span className="btn-text">Start Matching Now</span>
                    </motion.button>

                    {/* Quick Stats Below CTA */}
                    <motion.div
                        className="hero-stats"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        <div className="stat-item">
                            <span className="stat-icon">🌍</span>
                            <span className="stat-text">150+ Countries</span>
                        </div>
                        <div className="stat-divider">•</div>
                        <div className="stat-item">
                            <span className="stat-icon">🔒</span>
                            <span className="stat-text">End-to-End Encrypted</span>
                        </div>
                        <div className="stat-divider">•</div>
                        <div className="stat-item">
                            <span className="stat-icon">⚡</span>
                            <span className="stat-text">Instant Match</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
