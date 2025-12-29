import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hero from './Hero';
import Features from './Features';
import Footer from './Footer';

const LandingView = ({
    onQuickStart,
    isConnected,
    gender,
    preferredGender,
    onGenderChange,
    onPreferredGenderChange,
    interests,
    onInterestsChange
}) => {
    const [showAgeGate, setShowAgeGate] = React.useState(false);
    const [showGenderModal, setShowGenderModal] = React.useState(false);

    //Available interests
    const availableInterests = [
        '⚽ Sports', '💻 Tech', '🎬 Movies', '🎮 Gaming',
        '🎵 Music', '🎨 Art', '✈️ Travel', '🍕 Food'
    ];

    React.useEffect(() => {
        const verified = localStorage.getItem('age_verified');
        if (!verified) {
            setShowAgeGate(true);
        }
    }, []);

    const handleAgeVerify = () => {
        localStorage.setItem('age_verified', 'true');
        setShowAgeGate(false);
    };

    const handleStartClick = () => {
        setShowGenderModal(true);
    };

    const toggleInterest = (interest) => {
        const current = interests || [];
        if (current.includes(interest)) {
            onInterestsChange(current.filter(i => i !== interest));
        } else {
            onInterestsChange([...current, interest]);
        }
    };

    const handleConfirmMatch = () => {
        setShowGenderModal(false);
        onQuickStart(gender, preferredGender, interests || []);
    };

    return (
        <div className="landing-page-wrapper premium-layout">

            {/* Gender Selection Modal */}
            <AnimatePresence>
                {showGenderModal && (
                    <motion.div
                        className="age-gate-overlay" // Reuse overlay style
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="gender-modal-glass"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <h2 className="modal-title-premium">Customize Match</h2>

                            {/* Reusing the container style, ensure CSS is global or in App.css */}
                            <div className="gender-filter-container" style={{ margin: 0 }}>
                                <div className="filter-row">
                                    <span className="filter-label">I am:</span>
                                    <div className="filter-options">
                                        {['Male', 'Female'].map((g) => (
                                            <button
                                                key={g}
                                                className={`filter-pill ${gender === g.toLowerCase() ? 'active' : ''}`}
                                                onClick={() => onGenderChange(g.toLowerCase())}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="filter-row">
                                    <span className="filter-label">Looking for:</span>
                                    <div className="filter-options">
                                        {['Male', 'Female', 'Any'].map((g) => (
                                            <button
                                                key={g}
                                                className={`filter-pill ${preferredGender === g.toLowerCase() ? 'active' : ''}`}
                                                onClick={() => onPreferredGenderChange(g.toLowerCase())}
                                            >
                                                {g === 'Any' ? 'Anyone' : g}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Interests Selection */}
                            <div className="interests-section" style={{ marginTop: '1.5rem' }}>
                                <span className="filter-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                                    Interests (optional):
                                </span>
                                <div className="interests-grid">
                                    {availableInterests.map((interest) => (
                                        <button
                                            key={interest}
                                            className={`interest-chip ${(interests || []).includes(interest) ? 'selected' : ''}`}
                                            onClick={() => toggleInterest(interest)}
                                        >
                                            {interest}
                                        </button>
                                    ))}
                                </div>
                                <p className="interest-hint">Select topics you're interested in for better matches</p>
                            </div>

                            <button className="btn-confirm-glass" onClick={handleConfirmMatch}>
                                ⚡ Start Matching
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Age Gate Modal */}
            <AnimatePresence>
                {showAgeGate && (
                    <motion.div
                        className="age-gate-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="age-gate-modal-glass"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="age-gate-icon">🔞</div>
                            <h2>Age Verification</h2>
                            <p>
                                This platform is restricted to users aged 16 and above.
                                <br />
                                Please confirm your age to proceed.
                            </p>
                            <button className="btn-age-confirm-premium" onClick={handleAgeVerify}>
                                I am 16+ and agree
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Hero
                onQuickStart={handleStartClick}
            />

            <Features />

            <Footer isConnected={isConnected} />
        </div>
    );
};

export default React.memo(LandingView);
