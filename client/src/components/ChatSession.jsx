import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SafetyShield from '../utils/SafetyShield';

// Memoized Message Bubble to prevent re-rendering old messages
const MessageBubble = React.memo(({ message, isMe }) => (
    <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
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
    myStream, // Added prop
    partnerStream,
    nextPartner,
    endCall
}) => {
    const [inputMsg, setInputMsg] = useState('');
    const messagesEndRef = useRef(null);

    // Attach partner video stream when it becomes available
    useEffect(() => {
        const video = partnerVideoRef.current;

        if (video && partnerStream) {
            // Set the stream
            video.srcObject = partnerStream;

            // Explicitly enable audio and set volume
            video.muted = false;
            video.volume = 1.0;

            // Wait for video to be ready before playing
            const playVideo = async () => {
                try {
                    // Small delay to ensure video is ready
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Check if video is still mounted and has stream
                    if (video.srcObject === partnerStream) {
                        await video.play();
                    }
                } catch (error) {
                    // Silently handle autoplay errors - they're expected in some browsers
                    if (error.name !== 'AbortError') {
                        console.warn('Video autoplay issue:', error.message);
                    }
                }
            };

            playVideo();
        }

        // Initialize Safety Shield
        let shield = null;
        if (partnerStream && partnerVideoRef.current) {
            // Create and init shield with Direct Element Reference (Robust)
            shield = new SafetyShield(partnerVideoRef.current);
            shield.init();
        }

        // Cleanup function to prevent interrupted play requests
        return () => {
            if (shield) shield.stop();
            if (video && video.srcObject) {
                video.pause();
                video.srcObject = null;
            }
        };
    }, [partnerStream, partnerVideoRef]);



    // Ensure Local Video Stream is attached (Fix for PiP disappearance)
    useEffect(() => {
        if (myVideoRef.current && myStream) {
            myVideoRef.current.srcObject = myStream;
            myVideoRef.current.muted = true; // Always mute local video
        }
    }, [myStream, myVideoRef]);

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            {/* Video Section */}
            <div className="video-section">
                <div className="video-full">
                    <video ref={partnerVideoRef} autoPlay playsInline />
                </div>

                {/* Simplified Controls - Skip & End Call Only */}
                <div className="session-controls">
                    <button
                        className="btn-control"
                        onClick={nextPartner}
                        title="Skip / Next Partner"
                        aria-label="Next Partner"
                    >
                        ⏭️
                    </button>
                    <button
                        className="btn-control danger"
                        onClick={() => endCall(false)}
                        title="End Call"
                        aria-label="End Call"
                    >
                        📞
                    </button>
                </div>

                {/* PiP Self View */}
                <motion.div
                    className="video-pip"
                    drag
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                >
                    <video ref={myVideoRef} autoPlay playsInline muted />
                </motion.div>
            </div>

            {/* Chat Sheet */}
            <div className="chat-sheet">
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
                        placeholder="Type something here..."
                        autoFocus
                    />
                    <motion.button
                        className="btn-send-round"
                        onClick={handleSend}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Send Message"
                    >
                        ➤
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
};

export default React.memo(ChatSession);