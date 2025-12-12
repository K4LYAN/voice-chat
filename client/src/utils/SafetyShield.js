import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';

/**
 * SafetyShield: a client-side module to detect and block nudity automatically.
 */
class SafetyShield {
    constructor(videoElementId) {
        this.videoElementId = videoElementId;
        this.videoElement = null;
        this.model = null;
        this.lastCheckTime = 0;
        this.checkInterval = 500; // 1.5 seconds
        this.strikeCount = 0;
        this.strikeThreshold = 2;
        this.confidenceThreshold = 0.75;
        this.isBlurred = false;
        this.overlayDisplayTime = 0;
        this.isRunning = false;

        // Categories to block
        this.blockedCategories = ['Porn', 'Hentai'];
    }

    // Singleton model instance
    static sharedModel = null;
    static modelPromise = null;

    /**
     * Initializes the SafetyShield.
     * Loads the model and starts the detection loop.
     */
    async init() {
        // 0. Ensure WebGL backend for performance
        try {
            await tf.setBackend('webgl');
            await tf.ready();
        } catch (e) {
            console.warn('SafetyShield: WebGL backend not available, falling back.', e);
        }

        // 1. Resolve Video Element (Handle ID or Direct Element)
        if (typeof this.videoElementId === 'string') {
            this.videoElement = document.getElementById(this.videoElementId);
        } else {
            this.videoElement = this.videoElementId;
        }

        if (!this.videoElement) {
            console.error(`SafetyShield: Video element not found.`, this.videoElementId);
            return;
        }

        try {
            // Load Model (Singleton)
            if (!SafetyShield.sharedModel) {
                if (!SafetyShield.modelPromise) {
                    console.log('SafetyShield: Loading shared model...');
                    SafetyShield.modelPromise = nsfwjs.load();
                }
                SafetyShield.sharedModel = await SafetyShield.modelPromise;
                console.log('SafetyShield: Shared model loaded.');
            }

            this.model = SafetyShield.sharedModel;
            this.isRunning = true;
            this.loop();
        } catch (error) {
            console.error('SafetyShield: Failed to load model.', error);
        }
    }

    /**
     * The main detection loop using requestAnimationFrame.
     */
    async loop() {
        if (!this.isRunning) return;

        const now = Date.now();
        if (now - this.lastCheckTime > this.checkInterval) {
            await this.checkFrame();
            this.lastCheckTime = now;
        }

        requestAnimationFrame(() => this.loop());
    }

    /**
     * Captures a frame and predicts content.
     */
    async checkFrame() {
        if (!this.model || !this.videoElement || this.videoElement.readyState < 2) {
            // readyState < 2 means not enough data
            return;
        }

        try {
            const predictions = await this.model.classify(this.videoElement);
            this.processPredictions(predictions);
        } catch (error) {
            // Silence errors that might happen during video stream startup/interruption
        }
    }

    /**
     * Process predictions and manage the strike system.
     * @param {Array} predictions 
     */
    processPredictions(predictions) {
        // Current top prediction
        const topPrediction = predictions[0];

        // Check if meaningful
        if (!topPrediction) return;

        const isBlockedContent = this.blockedCategories.includes(topPrediction.className);
        const isHighConfidence = topPrediction.probability > this.confidenceThreshold;

        if (isBlockedContent && isHighConfidence) {
            this.strikeCount++;
        } else {
            // Reset strikes if clear to prevent sticking in a bad state forever?
            // Or maybe decay logic. For simplicity: rapid consecutive checks needed.
            // If we see a 'Neutral' or 'Drawing' or 'Sexy' (allowed), we reset strikes immediately?
            // To be safe and strict but fair:
            // If we see SAFE content effectively, we reset.
            // 'Sexy' is explicitly ignored (treated as safe for blocking purposes).
            this.strikeCount = 0;
        }

        if (this.strikeCount >= this.strikeThreshold) {
            this.blockVideo();
        } else {
            // Optional: unblock if sustained clean? 
            // Requirement doesn't explicitly say to unblock automatically, but a safety shield usually should recover.
            // Let's assume if strikes are 0, we can unblock.
            if (this.strikeCount === 0 && this.isBlurred) {
                this.unblockVideo();
            }
        }
    }

    /**
     * Applies the blur and overlay.
     */
    blockVideo() {
        if (this.isBlurred) return;

        this.videoElement.style.filter = 'blur(30px)';

        // Create overlay
        this.createOverlay();

        this.isBlurred = true;
        console.warn('SafetyShield: Nudity Detected. Content Blocked.');
    }

    /**
     * Removes the blur and overlay.
     */
    unblockVideo() {
        if (!this.isBlurred) return;

        this.videoElement.style.filter = 'none';
        this.removeOverlay();
        this.isBlurred = false;
    }

    /**
     * Creates the blocking overlay.
     */
    createOverlay() {
        if (document.getElementById('safety-shield-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'safety-shield-overlay';
        overlay.innerText = '⚠️ Content Hidden: Nudity Detected';

        // Style the overlay
        Object.assign(overlay.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            zIndex: '1000',
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            pointerEvents: 'none', // Allow clicks to pass through if needed, though usually video is just display
            textAlign: 'center'
        });

        // We need to position this relative to the video video parent.
        // Ideally the video is in a container with position: relative.
        // If not, we might need to append to body and fix position, but that's messy with scrolling.
        // Best effort: append to video's parent and ensure parent is relative.
        const parent = this.videoElement.parentElement;
        if (parent) {
            if (getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(overlay);
        }
    }

    /**
     * Removes the blocking overlay.
     */
    removeOverlay() {
        const overlay = document.getElementById('safety-shield-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Stops the shield.
     */
    stop() {
        this.isRunning = false;
        // Clean up if needed
        // tf.disposeVariables(); // Be careful with global disposal if other tf stuff exists
    }
}

export default SafetyShield;
