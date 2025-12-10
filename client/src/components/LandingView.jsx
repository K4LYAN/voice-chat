import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300, damping: 24 }
    }
};

const LandingView = ({ languages, onJoinQueue, isConnected }) => {
    return (
        <motion.main
            className="hero-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
        >
            <motion.h1
                className="hero-title"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                Experience Global<br />Connection.
            </motion.h1>

            <motion.p
                className="hero-subtitle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                Seamless, anonymous voice and text chat with real-time matching.
                Select your language to begin.
            </motion.p>

            <motion.div
                className="language-grid"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {languages.map(lang => (
                    <motion.button
                        key={lang}
                        className="lang-card"
                        onClick={() => onJoinQueue(lang)}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02, backgroundColor: "var(--bg-element)" }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <span className="lang-name">{lang}</span>
                        <span className="lang-arrow">→</span>
                    </motion.button>
                ))}
            </motion.div>
        </motion.main>
    );
};

export default React.memo(LandingView);
