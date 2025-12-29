import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import SafetyShield from '../utils/SafetyShield';
import GenderSelectionModal from './GenderSelectionModal';

// Memoized Message Bubble with enhanced animations
const MessageBubble = React.memo(({ message, isMe }) => (
    <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
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
    myStream,
    partnerStream,
    nextPartner,
    endCall,
    videoEnabled,
    onEnableVideo
}) => {
    const [inputMsg, setInputMsg] = useState('');
    const messagesEndRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);
    const [showGenderModal, setShowGenderModal] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 900);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Attach partner video stream
    useEffect(() => {
        const video = partnerVideoRef.current;
        if (video && partnerStream) {
            video.srcObject = partnerStream;
            video.muted = false;
            video.volume = 1.0;

            const playVideo = async () => {
                try {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (video.srcObject === partnerStream) {
                        await video.play();
                    }
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        console.warn('Video autoplay issue:', error.message);
                    }
                }
            };
            playVideo();
        }

        let shield = null;
        if (partnerStream && partnerVideoRef.current) {
            shield = new SafetyShield(partnerVideoRef.current);
            shield.init();
        }

        return () => {
            if (shield) shield.stop();
            if (video && video.srcObject) {
                video.pause();
                video.srcObject = null;
            }
        };
    }, [partnerStream, partnerVideoRef]);

    // Attach local video stream
    useEffect(() => {
        if (myVideoRef.current && myStream) {
            myVideoRef.current.srcObject = myStream;
            myVideoRef.current.muted = true;
        }
    }, [myStream, myVideoRef]);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Swipe Logic - Only for mobile
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 0, 200], [-5, 0, 5]);
    const opacity = useTransform(x, [-250, -120, 0], [0.5, 1, 1]);
    const skipOpacity = useTransform(x, [-200, -80, 0], [1, 0, 0]);
    const skipScale = useTransform(x, [-200, -80], [1.2, 0.8]);

    const handleDragEnd = (event, info) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if (offset < -120 || velocity < -600) {
            setShowGenderModal(true); // Show modal instead of directly calling nextPartner
        }
    };

    const handleSkipClick = () => {
        setShowGenderModal(true);
    };

    const handleGenderSelect = (selectedGender, selectedPreference) => {
        setShowGenderModal(false);
        nextPartner(selectedGender, selectedPreference);
    };

    const handleCancelGenderSelection = () => {
        setShowGenderModal(false);
        endCall();
    };

    const handleSend = () => {
        if (!inputMsg.trim()) return;
        onSendMessage(inputMsg);
        setInputMsg('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="session-layout">
            {/* Swipe wrapper - only wraps video section on mobile */}
            <motion.div
                className="swipe-wrapper"
                style={isMobile ? { x, rotate, opacity } : {}}
                drag={isMobile ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.3, right: 0 }}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0, x: isMobile ? 50 : 0 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {/* Swipe Indicator - Removed for cleaner UI */}

                {/* Video Section */}
                <div className="video-section">
                    <div className="video-full">
                        <video ref={partnerVideoRef} autoPlay playsInline />
                    </div>

                    {/* Session Controls - Skip and Enable Video */}
                    <div className="session-controls">
                        {!videoEnabled && (
                            <button
                                className="btn-control btn-enable-video"
                                onClick={onEnableVideo}
                                title="Enable Video"
                                aria-label="Enable Video"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M23 7L16 12L23 17V7Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                </svg>
                            </button>
                        )}
                        <button
                            className="btn-control"
                            onClick={handleSkipClick}
                            title="Skip / Next Partner"
                            aria-label="Next Partner"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 4L15 12L5 20V4Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M19 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>


                    {/* PiP Self View */}
                    <motion.div
                        className="video-pip"
                        drag
                        dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
                        dragElastic={0.1}
                    >
                        <video ref={myVideoRef} autoPlay playsInline muted />
                    </motion.div>
                </div>
            </motion.div>

            {/* Chat Sheet - Outside swipe wrapper so it stays in place */}
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
                        placeholder="Message..."
                    />
                    <motion.button
                        className="btn-send-round"
                        onClick={handleSend}
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        aria-label="Send Message"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="currentColor" />
                        </svg>
                    </motion.button>
                </div>
            </div>

            {/* Gender Selection Modal */}
            {showGenderModal && (
                <GenderSelectionModal
                    onSelect={handleGenderSelect}
                    onCancel={handleCancelGenderSelection}
                />
            )}
        </div>
    );
};

export default React.memo(ChatSession);