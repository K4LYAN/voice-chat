import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hero from './Hero';
import Features from './Features';
import Footer from './Footer';
import GenderSelectionModal from './GenderSelectionModal';

const LandingView = ({
    onQuickStart,
    isConnected,
    gender,
    preferredGender,
    onGenderChange,
    onPreferredGenderChange,
    interests = [], // Default to empty array
    onInterestsChange
}) => {
    const [showAgeGate, setShowAgeGate] = React.useState(false);
    const [showGenderModal, setShowGenderModal] = React.useState(false);

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

    const handleMatchSelect = (selectedGender, selectedLookingFor, selectedInterests) => {
        setShowGenderModal(false);
        onGenderChange(selectedGender);
        onPreferredGenderChange(selectedLookingFor);
        onInterestsChange(selectedInterests);
        onQuickStart(selectedGender, selectedLookingFor, selectedInterests);
    };

    return (
        <div className="landing-page-wrapper premium-layout">
            <AnimatePresence>
                {showGenderModal && (
                    <GenderSelectionModal
                        initialGender={gender}
                        initialLookingFor={preferredGender}
                        initialInterests={interests}
                        onSelect={handleMatchSelect}
                        onCancel={() => setShowGenderModal(false)}
                    />
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
