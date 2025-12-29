import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GenderSelectionModal = ({ onSelect, onCancel }) => {
    const [myGender, setMyGender] = useState('male');
    const [lookingFor, setLookingFor] = useState('female');

    const handleNext = () => {
        onSelect(myGender, lookingFor);
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
                    <div className="modal-header">
                        <h2 className="gender-modal-title">Preferences</h2>
                        <p className="gender-modal-subtitle">Customize your matching experience</p>
                    </div>

                    <div className="gender-section-group">
                        <div className="gender-modal-section">
                            <label className="gender-modal-label">I am...</label>
                            <div className="gender-options-row">
                                <motion.button
                                    className={`gender-option-card ${myGender === 'male' ? 'active' : ''}`}
                                    onClick={() => setMyGender('male')}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="option-icon">👨</span>
                                    <span className="option-text">Male</span>
                                </motion.button>
                                <motion.button
                                    className={`gender-option-card ${myGender === 'female' ? 'active' : ''}`}
                                    onClick={() => setMyGender('female')}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="option-icon">👩</span>
                                    <span className="option-text">Female</span>
                                </motion.button>
                            </div>
                        </div>

                        <div className="gender-modal-divider">
                            <span className="divider-icon">⚡</span>
                        </div>

                        <div className="gender-modal-section">
                            <label className="gender-modal-label">Looking for...</label>
                            <div className="gender-options-row">
                                <motion.button
                                    className={`gender-option-card ${lookingFor === 'male' ? 'active' : ''}`}
                                    onClick={() => setLookingFor('male')}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="option-icon">👨</span>
                                    <span className="option-text">Male</span>
                                </motion.button>
                                <motion.button
                                    className={`gender-option-card ${lookingFor === 'female' ? 'active' : ''}`}
                                    onClick={() => setLookingFor('female')}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="option-icon">👩</span>
                                    <span className="option-text">Female</span>
                                </motion.button>
                                <motion.button
                                    className={`gender-option-card ${lookingFor === 'any' ? 'active' : ''}`}
                                    onClick={() => setLookingFor('any')}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="option-icon">🌈</span>
                                    <span className="option-text">Any</span>
                                </motion.button>
                            </div>
                        </div>
                    </div>

                    <div className="gender-modal-actions">
                        <motion.button
                            className="btn-primary-modal-premium"
                            onClick={handleNext}
                            whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)" }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span>Start Matching</span>
                            <span className="btn-arrow">→</span>
                        </motion.button>
                        <button className="btn-text-modal" onClick={onCancel}>
                            Cancel
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GenderSelectionModal;
