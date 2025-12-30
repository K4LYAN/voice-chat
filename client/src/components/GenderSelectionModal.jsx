import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { INTERESTS } from '../constants'; // Import shared constants

const GenderSelectionModal = ({ onSelect, onCancel, initialGender = 'male', initialLookingFor = 'female', initialInterests = [] }) => {
    const [myGender, setMyGender] = useState(initialGender);
    const [lookingFor, setLookingFor] = useState(initialLookingFor);
    const [selectedInterests, setSelectedInterests] = useState(initialInterests);

    const toggleInterest = (id) => {
        if (selectedInterests.includes(id)) {
            setSelectedInterests(prev => prev.filter(i => i !== id));
        } else {
            setSelectedInterests(prev => [...prev, id]);
        }
    };

    const handleNext = () => {
        onSelect(myGender, lookingFor, selectedInterests);
    };

    return (
        <AnimatePresence>
            <motion.div
                className="gender-modal-overlay-premium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div className="modal-glow-bg" />

                <motion.div
                    className="gender-modal-glass"
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                >
                    {/* Header */}
                    <div className="modal-header">
                        <div className="gender-modal-drag-handle" style={{
                            width: '48px', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '4px', margin: '0 auto 24px', display: 'none'
                        }}></div>
                        <h2 className="gender-modal-title">Customize Match</h2>
                        <p className="modal-subtitle">Set your preferences to find the perfect one.</p>
                    </div>

                    {/* Scrollable Content */}
                    <div className="gender-modal-content" style={{ flex: 1, overflowY: 'auto' }}>
                        <div className="gender-filter-container">
                            {/* I AM */}
                            <div className="gender-section-group">
                                <span className="filter-label">I am</span>
                                <div className="filter-options">
                                    <button
                                        className={`filter-pill ${myGender === 'male' ? 'active' : ''}`}
                                        onClick={() => setMyGender('male')}
                                    >
                                        Male
                                    </button>
                                    <button
                                        className={`filter-pill ${myGender === 'female' ? 'active' : ''}`}
                                        onClick={() => setMyGender('female')}
                                    >
                                        Female
                                    </button>
                                    <button
                                        className={`filter-pill ${myGender === 'other' ? 'active' : ''}`}
                                        onClick={() => setMyGender('other')}
                                    >
                                        Other
                                    </button>
                                </div>
                            </div>

                            {/* LOOKING FOR */}
                            <div className="gender-section-group">
                                <span className="filter-label">Looking for</span>
                                <div className="filter-options">
                                    <button
                                        className={`filter-pill ${lookingFor === 'male' ? 'active' : ''}`}
                                        onClick={() => setLookingFor('male')}
                                    >
                                        Male
                                    </button>
                                    <button
                                        className={`filter-pill ${lookingFor === 'female' ? 'active' : ''}`}
                                        onClick={() => setLookingFor('female')}
                                    >
                                        Female
                                    </button>
                                    <button
                                        className={`filter-pill ${lookingFor === 'any' ? 'active' : ''}`}
                                        onClick={() => setLookingFor('any')}
                                    >
                                        Anyone
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Interests */}
                        <div className="interests-section">
                            <div className="interests-header">
                                <span className="filter-label" style={{ marginBottom: 0 }}>Interests</span>
                                <span className="interests-count">{selectedInterests.length} selected</span>
                            </div>
                            <div className="interests-grid">
                                {INTERESTS.map(interest => (
                                    <button
                                        key={interest.id}
                                        className={`interest-chip ${selectedInterests.includes(interest.id) ? 'selected' : ''}`}
                                        onClick={() => toggleInterest(interest.id)}
                                    >
                                        <div className="interest-chip-icon">{interest.icon}</div>
                                        <span>{interest.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="gender-modal-actions">
                        <button className="btn-confirm-glass" onClick={handleNext}>
                            <span style={{ color: '#fde047', fontSize: '1.2em' }}>⚡</span>
                            Start Matching
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GenderSelectionModal;
