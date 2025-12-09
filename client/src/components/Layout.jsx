import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children, language, onJoinQueue }) => {
    return (
        <div className="layout">
            <Navbar language={language} onJoinQueue={onJoinQueue} />
            <main className="main-content">
                {children}
            </main>
            <Footer />
        </div>
    );
};

export default Layout;
