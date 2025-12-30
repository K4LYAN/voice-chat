import React, { useEffect, useRef } from 'react';
import SafetyShield from '../utils/SafetyShield';

const VideoPlayer = ({ src, ...props }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        // Initialize SafetyShield
        let shield = null;
        if (videoRef.current) {
            shield = new SafetyShield(videoRef.current);
            shield.init();
        }

        // Cleanup: Stop the shield when component unmounts
        return () => {
            if (shield) {
                // User requested 'dispose()', mapping to existing 'stop()' method
                shield.stop();
            }
        };
    }, []); // Run once on mount

    // Update src separately if it changes, though usually src prop changes trigger re-render
    useEffect(() => {
        if (videoRef.current && src) {
            videoRef.current.src = src;
        }
    }, [src]);

    return (
        <video
            ref={videoRef}
            className="video-full"
            controls
            playsInline
            // Allow other standard video props to be passed through
            {...props}
        />
    );
};

export default VideoPlayer;