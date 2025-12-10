import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatSidebar = ({ isOpen, onToggle, currentPartner }) => {
    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="sidebar-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onToggle}
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Panel */}
            <motion.aside
                className={`chat-sidebar ${isOpen ? 'open' : ''}`}
                initial={false}
                animate={{
                    x: isOpen ? 0 : '-100%'
                }}
                transition={{
                    type: 'spring',
                    damping: 30,
                    stiffness: 300
                }}
                aria-label="Chat sidebar"
                aria-hidden={!isOpen}
            >
                <div className="sidebar-header">
                    <h3 className="sidebar-title">Chat History</h3>
                    <button
                        className="sidebar-close"
                        onClick={onToggle}
                        aria-label="Close sidebar"
                    >
                        ×
                    </button>
                </div>

                <div className="sidebar-content">
                    {/* Current Partner Info */}
                    {currentPartner && (
                        <div className="current-partner">
                            <div className="partner-avatar">
                                {currentPartner.name?.[0] || 'P'}
                            </div>
                            <div className="partner-info">
                                <div className="partner-name">{currentPartner.name || 'Partner'}</div>
                                <div className="partner-status">● Active now</div>
                            </div>
                        </div>
                    )}

                    {/* Conversation List Placeholder */}
                    <div className="conversation-list">
                        <div className="conversation-empty">
                            <p>No previous conversations</p>
                            <span>Start chatting to see your history here</span>
                        </div>
                    </div>
                </div>

                <div className="sidebar-footer">
                    <button className="sidebar-action">
                        Settings
                    </button>
                </div>
            </motion.aside>
        </>
    );
};

export default ChatSidebar;
