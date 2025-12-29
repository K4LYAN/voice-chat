import React from 'react';

const Footer = ({ isConnected }) => {
    return (
        <footer className="site-footer-premium">
            <div className="container footer-content">
                <div className="footer-brand-section">
                    <div className="footer-brand">VoiceChat</div>
                    <p className="footer-tagline">Connect with the world, one conversation at a time.</p>
                </div>

                <div className="footer-links-grid">
                    <div className="footer-column">
                        <h4>Product</h4>
                        <a href="#">Features</a>
                        <a href="#">Pricing</a>
                    </div>
                    <div className="footer-column">
                        <h4>Legal</h4>
                        <a href="#">Privacy</a>
                        <a href="#">Terms</a>
                    </div>
                    <div className="footer-column">
                        <h4>Status</h4>
                        <span className="online-indicator">
                            <span className={`status-dot ${isConnected ? 'connected' : ''}`}></span>
                            {isConnected ? 'Systems Nominal' : 'Connecting...'}
                        </span>
                    </div>
                </div>
            </div>
            <div className="footer-bottom">
                <div className="container">
                    <span>© 2025 GlobalVoice Inc.</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
