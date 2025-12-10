import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SearchingView = ({ language, onCancel, onSearchGlobal }) => {
    const [status, setStatus] = React.useState('SEARCHING'); // SEARCHING, TIMEOUT
    const [progress, setProgress] = React.useState(0);
    const [elapsed, setElapsed] = React.useState(0);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setStatus('TIMEOUT');
        }, 30000); // 30s timeout (increased from 15s)

        return () => clearTimeout(timer);
    }, []);

    // Progress bar animation
    React.useEffect(() => {
        if (status === 'SEARCHING') {
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) return 0; // Loop
                    return prev + 0.5; // Smooth increment
                });
                setElapsed(prev => prev + 0.1);
            }, 100);

            return () => clearInterval(interval);
        }
    }, [status]);

    const handleKeepWaiting = () => {
        setStatus('SEARCHING');
        setProgress(0);
        setElapsed(0);
    };

    return (
        <motion.div
            className="searching-container"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            <motion.div
                className="scanner-card"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                {/* Enhanced Visual Radar */}
                <div className="radar-wrapper">
                    {/* Rotating scanner sweep */}
                    <motion.div
                        className="radar-sweep"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Animated rings */}
                    <motion.div
                        className="radar-ring r1"
                        animate={{
                            scale: [1, 2.2],
                            opacity: [0.6, 0]
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeOut"
                        }}
                    />
                    <motion.div
                        className="radar-ring r2"
                        animate={{
                            scale: [1, 2.8],
                            opacity: [0.4, 0]
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay: 0.8
                        }}
                    />
                    <motion.div
                        className="radar-ring r3"
                        animate={{
                            scale: [1, 3.2],
                            opacity: [0.3, 0]
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay: 1.6
                        }}
                    />

                    {/* Pulsing core */}
                    <motion.div
                        className="radar-core"
                        animate={{
                            scale: [1, 1.2, 1],
                            boxShadow: [
                                '0 0 20px rgba(59, 130, 246, 0.5)',
                                '0 0 40px rgba(59, 130, 246, 0.8)',
                                '0 0 20px rgba(59, 130, 246, 0.5)'
                            ]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                </div>

                {/* Status text with animation */}
                <motion.div
                    className="scanner-info"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h2 className="scanner-status">
                        {status === 'SEARCHING' ? (
                            <span>
                                SCANNING
                                <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    ...
                                </motion.span>
                            </span>
                        ) : 'TIMEOUT'}
                    </h2>
                    <p className="scanner-subtext">
                        {status === 'SEARCHING'
                            ? `Looking for ${language} speakers`
                            : 'No match found yet.'}
                    </p>

                    {/* Elapsed time */}
                    {status === 'SEARCHING' && (
                        <motion.p
                            className="scanner-elapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            transition={{ delay: 0.5 }}
                        >
                            {elapsed.toFixed(1)}s elapsed
                        </motion.p>
                    )}
                </motion.div>

                {/* Progress bar */}
                {status === 'SEARCHING' && (
                    <motion.div
                        className="progress-bar-container"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <motion.div
                            className="progress-bar"
                            style={{ width: `${progress % 100}%` }}
                        />
                    </motion.div>
                )}

                {/* Actions with stagger animation */}
                <AnimatePresence mode="wait">
                    {status === 'TIMEOUT' ? (
                        <motion.div
                            className="scanner-actions"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <motion.button
                                className="btn btn-primary"
                                onClick={onSearchGlobal}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Global Search
                            </motion.button>
                            <motion.button
                                className="btn btn-secondary"
                                onClick={handleKeepWaiting}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Keep Waiting
                            </motion.button>
                            <motion.button
                                className="btn btn-text"
                                onClick={onCancel}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Cancel
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.button
                            className="btn-cancel-pill"
                            onClick={onCancel}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            whileHover={{ scale: 1.05, backgroundColor: '#fee2e2' }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ delay: 0.4 }}
                        >
                            Cancel Scan
                        </motion.button>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default React.memo(SearchingView);
