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

        // Adaptive Sampling Settings
        this.baseInterval = 1000; // Resting state
        this.fastInterval = 200;  // Suspicion state
        this.checkInterval = this.baseInterval;

        // Intelligent Strike System
        this.strikeCount = 0;
        this.strikeThreshold = 2; // Block on 2nd strike
        this.confidenceThreshold = 0.75; // Confirmed hit
        this.suspicionThreshold = 0.10;  // 10% chance triggers fast mode

        this.cleanFrameCount = 0;
        this.decayThreshold = 5; // Decay 1 strike after 5 clean frames

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
        // Find if any blocked category is present with significant probability
        const topPrediction = predictions[0];
        if (!topPrediction) return;

        const unsafePrediction = predictions.find(p =>
            this.blockedCategories.includes(p.className) && p.probability > this.suspicionThreshold
        );

        if (unsafePrediction) {
            // -- SUSPICION DETECTED --
            // Switch to FAST interval for verfication
            this.checkInterval = this.fastInterval;

            // Check if it crosses the actual Blocking Threshold
            if (unsafePrediction.probability > this.confidenceThreshold) {
                this.strikeCount++;
                this.cleanFrameCount = 0; // Reset clean count
                // console.log(`SafetyShield: Strike! (${this.strikeCount}) - ${unsafePrediction.className} ${(unsafePrediction.probability*100).toFixed(0)}%`);
            }
        } else {
            // -- SAFE FRAME --
            // Return to BASE interval
            this.checkInterval = this.baseInterval;
            this.cleanFrameCount++;

            // Intelligent Strike Decay
            if (this.cleanFrameCount >= this.decayThreshold && this.strikeCount > 0) {
                this.strikeCount--;
                this.cleanFrameCount = 0;
                // console.log(`SafetyShield: Strike Decayed (${this.strikeCount})`);
            }

            // Auto-unblock if clean and strikes are gone
            if (this.strikeCount === 0 && this.isBlurred) {
                this.unblockVideo();
            }
        }

        // Apply Block if Threshold Reached
        if (this.strikeCount >= this.strikeThreshold) {
            this.blockVideo();
        }
    }

    /**
     * Applies the blur and overlay.
     */
    blockVideo() {
        if (this.isBlurred) return;

        // Add smooth transition for the blur
        this.videoElement.style.transition = 'filter 0.5s ease-out';
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

        // Clean up transition after a while so it doesn't affect other things? 
        // Or keep it, it's fine.
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
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            zIndex: '1000',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '600',
            pointerEvents: 'none', // Allow clicks to pass through if needed, though usually video is just display
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            opacity: '0', // Start invisible for fade-in
            transition: 'opacity 0.3s ease-in'
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

            // Trigger fade-in
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    overlay.style.opacity = '1';
                });
            });
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
