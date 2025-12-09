import React from 'react';

const Navbar = ({ language, onJoinQueue }) => {
    return (
        <nav className="navbar">
            <div className="container nav-container">
                <div className="logo">
                    GlobalVoice
                </div>
                <div className="nav-actions">
                    {language && <span className="lang-badge">{language}</span>}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
