import React from 'react';
import { motion } from 'framer-motion';

const SearchingView = ({ language, onCancel }) => {
    return (
        <motion.div
            className="searching-state"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
        >
            <motion.div
                className="pulse-ring"
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0, 1],
                    borderColor: ["#8ab4f8", "rgba(138, 180, 248, 0)", "#8ab4f8"]
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                Searching for {language} speakers...
            </motion.h2>
            <motion.p
                style={{ marginTop: '1rem' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 0.2 }}
            >
                Establishing secure connection
            </motion.p>

            <motion.button
                className="btn btn-surface"
                style={{ marginTop: '2rem', maxWidth: '200px' }}
                onClick={onCancel}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                Cancel
            </motion.button>
        </motion.div>
    );
};

export default React.memo(SearchingView);
