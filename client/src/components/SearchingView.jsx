import React from 'react';
import { motion } from 'framer-motion';

const SearchingView = ({ language, onCancel, onSearchGlobal }) => {
    const [status, setStatus] = React.useState('SEARCHING'); // SEARCHING, TIMEOUT

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setStatus('TIMEOUT');
        }, 15000); // 15s timeout
        return () => clearTimeout(timer);
    }, []);

    const handleKeepWaiting = () => {
        setStatus('SEARCHING');
        // Ideally we would reset the server timeout here too, but client-side UI reset is enough for MVP
    };

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
                    scale: status === 'SEARCHING' ? [1, 1.5, 1] : 1,
                    opacity: status === 'SEARCHING' ? [1, 0, 1] : 0.5,
                    borderColor: status === 'SEARCHING' ? ["#8ab4f8", "rgba(138, 180, 248, 0)", "#8ab4f8"] : "#5f6368"
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
                key={status} // Animate change
            >
                {status === 'SEARCHING'
                    ? `Searching for ${language} speakers...`
                    : 'No active match found yet.'}
            </motion.h2>

            <motion.p
                style={{ marginTop: '1rem', textAlign: 'center', maxWidth: '300px' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                key={`desc-${status}`}
            >
                {status === 'SEARCHING'
                    ? 'Establishing secure connection'
                    : 'It seems quiet right now. You can keep waiting or try a global search.'}
            </motion.p>

            {status === 'TIMEOUT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '2rem', width: '100%', maxWidth: '280px' }}>
                    <motion.button
                        className="btn btn-primary"
                        onClick={onSearchGlobal}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Start Global Search
                    </motion.button>
                    <motion.button
                        className="btn btn-surface"
                        onClick={handleKeepWaiting}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Keep Waiting
                    </motion.button>
                </div>
            )}

            <motion.button
                className="btn btn-surface"
                style={{ marginTop: status === 'TIMEOUT' ? '12px' : '2rem', maxWidth: '200px', opacity: 0.8 }}
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
