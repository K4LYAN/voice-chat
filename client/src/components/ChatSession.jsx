import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Memoized Message Bubble to prevent re-rendering old messages
const MessageBubble = React.memo(({ message, isMe }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`message-row ${isMe ? 'me' : 'partner'}`}
    >
        <div className={`message-bubble ${isMe ? 'me' : 'partner'}`}>
            {message.text}
        </div>
    </motion.div>
));

const ChatSession = ({
    messages,
    onSendMessage,
    myVideoRef,
    partnerVideoRef,
    partnerStream,
    isVoiceMode,
    toggleVoiceMode,
    nextPartner,
    endCall
}) => {
    const [inputMsg, setInputMsg] = useState('');
    const messagesEndRef = useRef(null);

    // Attach partner video stream when it becomes available
    useEffect(() => {
        if (partnerVideoRef.current && partnerStream) {
            partnerVideoRef.current.srcObject = partnerStream;
            partnerVideoRef.current.play().catch(e => console.error("Autoplay failed:", e));
        }
    }, [partnerStream, partnerVideoRef]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
        if (!inputMsg.trim()) return;
        onSendMessage(inputMsg);
        setInputMsg('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <motion.div
            className="session-layout"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
        >
            {/* Chat Container */}
            <div className="chat-container">
                <div className="chat-messages">
                    <AnimatePresence initial={false}>
                        {messages.map((m, i) => (
                            <MessageBubble key={i} message={m} isMe={m.sender === 'me'} />
                        ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-wrapper">
                    <input
                        className="chat-input"
                        value={inputMsg}
                        onChange={e => setInputMsg(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        autoFocus
                    />
                    <motion.button
                        className="btn btn-primary"
                        style={{ width: 'auto', padding: '0 24px' }}
                        onClick={handleSend}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Send
                    </motion.button>
                </div>
            </div>

            {/* Sidebar / Controls */}
            <aside className="sidebar">
                <div className="video-container">
                    <motion.div
                        className="video-frame"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <video ref={partnerVideoRef} autoPlay playsInline />
                        <div className="video-label">{partnerStream ? 'Partner' : 'Partner (Connecting...)'}</div>
                    </motion.div>
                    <motion.div
                        className="video-frame"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <video ref={myVideoRef} autoPlay playsInline muted />
                        <div className="video-label">You</div>
                    </motion.div>
                </div>

                <div className="controls-panel">
                    <motion.button
                        className={`btn ${isVoiceMode ? 'btn-danger' : 'btn-primary'}`}
                        onClick={toggleVoiceMode}
                        whileTap={{ scale: 0.98 }}
                    >
                        {isVoiceMode ? 'Stop Voice' : 'Start Voice'}
                    </motion.button>

                    <motion.button
                        className="btn btn-surface"
                        onClick={nextPartner}
                        whileTap={{ scale: 0.98 }}
                    >
                        Find Next Match
                    </motion.button>

                    <motion.button
                        className="btn btn-danger"
                        onClick={() => endCall(false)}
                        whileTap={{ scale: 0.98 }}
                    >
                        End Session
                    </motion.button>
                </div>
            </aside>
        </motion.div>
    );
};

export default React.memo(ChatSession);