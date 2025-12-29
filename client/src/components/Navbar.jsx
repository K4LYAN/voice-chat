import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = ({ isConnected }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const scrollToSection = (id) => {
        setIsMobileMenuOpen(false);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        } else if (id === 'hero') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <nav className="navbar-premium">
            <div className="container nav-container">
                <a href="/" className="brand-premium" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }}>
                    <div className="brand-logo-glass">
                        <span className="logo-text">V</span>
                    </div>
                    <span className="brand-name">VoiceChat</span>
                </a>

                {/* Desktop Links */}
                <div className="nav-links desktop-only">
                    <button onClick={() => scrollToSection('features')} className="nav-link-premium">Features</button>
                    <button onClick={() => scrollToSection('how-it-works')} className="nav-link-premium">How it Works</button>
                    <button onClick={() => scrollToSection('footer')} className="nav-link-premium">Support</button>
                </div>

                <div className="nav-right">
                    <div className="status-indicator-glass desktop-only">
                        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                        <span className="status-text">{isConnected ? 'Online' : 'Reconnecting...'}</span>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="mobile-menu-btn-glass"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? '✕' : '☰'}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        className="mobile-menu-glass"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <button className="mobile-nav-link" onClick={() => scrollToSection('features')}>Features</button>
                        <button className="mobile-nav-link" onClick={() => scrollToSection('how-it-works')}>How it Works</button>
                        <button className="mobile-nav-link" onClick={() => scrollToSection('footer')}>Support</button>

                        <div className="mobile-status-row">
                            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                            <span>{isConnected ? 'Online' : 'Reconnecting...'}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
