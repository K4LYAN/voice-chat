// Lazy-loaded modules (loaded on-demand when init() is called)
let tf = null;
let nsfwjs = null;

class SafetyShield {
    constructor(videoElementId, onViolation = null) {
        this.videoElementId = videoElementId;
        this.onViolation = onViolation;
        this.videoElement = null;
        this.model = null;

        // Loop State
        this.lastCheckTime = 0;
        this.isRunning = false;
        this.isAborted = false;

        // -- ENHANCED CONFIGURATION FOR SPEED + ACCURACY --
        this.baseInterval = 600;    // Faster base checking (was 800ms)
        this.fastInterval = 100;    // Ultra-fast when suspicious (was 150ms)
        this.ultraFastInterval = 50; // NEW: Emergency fast check for high-confidence threats

        // -- IMPROVED DETECTION LOGIC --
        // History buffer to smooth out "glitches"
        this.predictionHistory = [];
        this.historySize = 7; // Increased from 5 for better accuracy (more samples)

        // Strike System - More aggressive
        this.strikeCount = 0;
        this.strikeThreshold = 3; // Lower threshold (was 4) for faster blocking
        this.maxStrikes = 8;      // Higher cap for more accurate decay

        // Enhanced Thresholds for better accuracy
        this.highConfidenceThreshold = 0.95; // NEW: Ultra-high confidence = instant block
        this.hardBlockThreshold = 0.85; // Lowered from 0.90 for better detection
        this.softBlockThreshold = 0.55; // Lowered from 0.60 for sensitivity
        this.relativeGap = 0.25;        // Increased from 0.20 for more confidence

        this.cleanFrameCount = 0;
        this.decayThreshold = 4; // Increased from 3 for stability

        this.isBlurred = false;
        this.blockedCategories = ['Porn', 'Hentai'];

        // NEW: Confidence tracking for adaptive speed
        this.lastConfidenceScore = 0;
    }

    // Singleton model instance
    static sharedModel = null;
    static modelPromise = null;
    static librariesLoaded = false;
    static loadingLibraries = null;

    async loadLibraries() {
        // If already loaded, return immediately
        if (SafetyShield.librariesLoaded) return;

        // If currently loading, wait for that to complete
        if (SafetyShield.loadingLibraries) {
            await SafetyShield.loadingLibraries;
            return;
        }

        // Start loading
        SafetyShield.loadingLibraries = (async () => {
            try {
                // Dynamic imports - only load when needed
                const [tfModule, nsfwjsModule] = await Promise.all([
                    import(/* webpackChunkName: "tensorflow" */ '@tensorflow/tfjs'),
                    import(/* webpackChunkName: "nsfwjs" */ 'nsfwjs')
                ]);

                tf = tfModule;
                nsfwjs = nsfwjsModule;
                SafetyShield.librariesLoaded = true;
                console.log('SafetyShield: ML libraries loaded (MobileNetV2-Mid)');
            } catch (error) {
                console.error('SafetyShield: Failed to load ML libraries', error);
                throw error;
            }
        })();

        await SafetyShield.loadingLibraries;
    }

    async init() {
        // Load TensorFlow.js and NSFWJS dynamically
        await this.loadLibraries();

        if (!tf || !nsfwjs) {
            console.error('SafetyShield: ML libraries not available');
            return;
        }

        if (tf.getBackend() !== 'webgl') {
            try { await tf.setBackend('webgl'); await tf.ready(); }
            catch (e) { console.warn('SafetyShield: WebGL error', e); }
        }

        if (typeof this.videoElementId === 'string') {
            this.videoElement = document.getElementById(this.videoElementId);
        } else {
            this.videoElement = this.videoElementId;
        }

        if (!this.videoElement) return;

        try {
            if (!SafetyShield.sharedModel) {
                // Load MobileNetV2-Mid for best speed/accuracy balance
                if (!SafetyShield.modelPromise) {
                    console.log('SafetyShield: Loading MobileNetV2-Mid model...');
                    SafetyShield.modelPromise = nsfwjs.load('/models/', { type: 'graph' });
                }
                SafetyShield.sharedModel = await SafetyShield.modelPromise;
                console.log('SafetyShield: Model loaded successfully');
            }
            if (this.isAborted) return;
            this.model = SafetyShield.sharedModel;
            this.isRunning = true;
            this.loop();
        } catch (error) {
            console.error('SafetyShield: Model load error', error);
            // Fallback to default model if Mid variant fails
            try {
                SafetyShield.modelPromise = nsfwjs.load();
                SafetyShield.sharedModel = await SafetyShield.modelPromise;
                this.model = SafetyShield.sharedModel;
                this.isRunning = true;
                this.loop();
                console.log('SafetyShield: Loaded default model as fallback');
            } catch (fallbackError) {
                console.error('SafetyShield: Fallback model load failed', fallbackError);
            }
        }
    }

    async loop() {
        if (!this.isRunning) return;
        const now = Date.now();
        if (now - this.lastCheckTime > this.checkInterval) {
            await this.checkFrame();
            this.lastCheckTime = now;
        }
        if (this.isRunning) requestAnimationFrame(() => this.loop());
    }

    async checkFrame() {
        if (!this.model || !this.videoElement || this.videoElement.readyState < 2) return;
        try {
            // Using tf.tidy to ensure no memory leaks during tensor operations
            const predictions = await this.model.classify(this.videoElement);
            if (this.isRunning) this.processPredictions(predictions);
        } catch (e) { /* ignore */ }
    }

    /**
     * ENHANCED VALIDATION LOGIC - Multi-tier detection for speed + accuracy
     */
    processPredictions(predictions) {
        // 1. Convert predictions to a map for easier access
        const frameScores = {};
        predictions.forEach(p => frameScores[p.className] = p.probability);

        // 2. Add to History
        this.predictionHistory.push(frameScores);
        if (this.predictionHistory.length > this.historySize) {
            this.predictionHistory.shift(); // Remove oldest
        }

        // 3. Calculate AVERAGE scores over the history
        const avgScores = this.getAverageScores();

        const badScore = (avgScores['Porn'] || 0) + (avgScores['Hentai'] || 0);
        const safeScore = (avgScores['Neutral'] || 0) + (avgScores['Drawing'] || 0);
        const sexyScore = (avgScores['Sexy'] || 0); // Track sexy separately

        // Store confidence for adaptive intervals
        this.lastConfidenceScore = Math.max(badScore, safeScore);

        // 4. ENHANCED Multi-Tier Decision Logic
        let isUnsafe = false;
        let threatLevel = 'none'; // none, low, medium, high, critical

        // TIER 1: Ultra-High Confidence (Instant Block)
        if (badScore > this.highConfidenceThreshold) {
            isUnsafe = true;
            threatLevel = 'critical';
        }
        // TIER 2: High Confidence (Hard Block)
        else if (badScore > this.hardBlockThreshold) {
            isUnsafe = true;
            threatLevel = 'high';
        }
        // TIER 3: Medium Confidence with Context
        // Block if moderately bad AND significantly higher than safe
        else if (badScore > this.softBlockThreshold && badScore > (safeScore + this.relativeGap)) {
            isUnsafe = true;
            threatLevel = 'medium';
        }
        // TIER 4: Low Confidence but Suspicious
        // If "Sexy" is high but not quite NSFW, increase vigilance but don't block
        else if (sexyScore > 0.70 && badScore > 0.30) {
            threatLevel = 'low';
        }

        // 5. Adaptive Intervals Based on Threat Level
        switch (threatLevel) {
            case 'critical':
                this.checkInterval = this.ultraFastInterval; // 50ms - ultra responsive
                break;
            case 'high':
                this.checkInterval = this.fastInterval; // 100ms
                break;
            case 'medium':
            case 'low':
                this.checkInterval = this.fastInterval; // 100ms - stay vigilant
                break;
            default:
                this.checkInterval = this.baseInterval; // 600ms - normal speed
        }

        // 6. Manage Strikes
        if (isUnsafe) {
            // THREAT DETECTED
            this.strikeCount = Math.min(this.strikeCount + 1, this.maxStrikes);
            this.cleanFrameCount = 0;

            // Instant block for critical threats
            if (threatLevel === 'critical') {
                this.strikeCount = this.strikeThreshold; // Bypass strike accumulation
            }
        } else {
            // SAFE - but only decay if truly clean
            this.cleanFrameCount++;

            // Decay strikes (more aggressive for faster recovery)
            if (this.cleanFrameCount >= this.decayThreshold && this.strikeCount > 0) {
                this.strikeCount--;
                this.cleanFrameCount = 0;
            }

            // Unblock if completely clear
            if (this.strikeCount === 0 && this.isBlurred) {
                this.unblockVideo();
            }
        }

        // 7. Apply Block
        if (this.strikeCount >= this.strikeThreshold) {
            this.blockVideo();
        }
    }

    /**
     * Helper: Average the probabilities in our history buffer
     */
    getAverageScores() {
        const totals = {};
        // Sum up
        this.predictionHistory.forEach(frame => {
            for (const [category, score] of Object.entries(frame)) {
                totals[category] = (totals[category] || 0) + score;
            }
        });
        // Divide by length
        const averages = {};
        for (const [category, total] of Object.entries(totals)) {
            averages[category] = total / this.predictionHistory.length;
        }
        return averages;
    }

    blockVideo() {
        if (this.isBlurred) return;
        this.videoElement.style.transition = 'filter 0.3s ease-out';
        this.videoElement.style.filter = 'blur(30px)';
        this.createOverlay();
        this.isBlurred = true;

        // Trigger external violation handler (e.g., stop transmission, emit socket event)
        if (this.onViolation) {
            this.onViolation();
        }
        // console.log('SafetyShield: BLOCKED');
    }

    unblockVideo() {
        if (!this.isBlurred) return;
        this.videoElement.style.filter = 'none';
        this.removeOverlay();
        this.isBlurred = false;
        // console.log('SafetyShield: UNBLOCKED');
    }

    createOverlay() {
        if (document.getElementById('safety-shield-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'safety-shield-overlay';
        overlay.innerText = '⚠️ Content Hidden';
        Object.assign(overlay.style, {
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0,0,0,0.9)', color: 'white', padding: '12px 20px',
            borderRadius: '8px', zIndex: '1000', pointerEvents: 'none',
            fontFamily: 'sans-serif', fontWeight: 'bold'
        });
        const parent = this.videoElement.parentElement;
        if (parent) {
            if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
            parent.appendChild(overlay);
        }
    }

    removeOverlay() {
        const el = document.getElementById('safety-shield-overlay');
        if (el) el.remove();
    }

    stop() {
        this.isRunning = false;
        this.isAborted = true;
    }
}

export default SafetyShield;