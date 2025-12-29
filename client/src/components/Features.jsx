import React from 'react';
import { motion } from 'framer-motion';

const Features = () => {
    const features = [
        {
            icon: "🔒",
            title: "Anonymous & Safe",
            desc: "End-to-end encrypted. We don't store your data. Chats are peer-to-peer.",
            gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)"
        },
        {
            icon: "🌍",
            title: "Global Reach",
            desc: "Connect with people from over 150 countries and speak 20+ languages.",
            gradient: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)"
        },
        {
            icon: "⚡",
            title: "Lightning Fast",
            desc: "Optimized for low-latency video even on slower network connections.",
            gradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)"
        },
        {
            icon: "🎯",
            title: "Smart Matching",
            desc: "AI-powered algorithm matches you with compatible strangers instantly.",
            gradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)"
        }
    ];

    return (
        <section className="features-section-premium" id="features">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="section-header center"
                >
                    <h2 className="section-title-premium">Why Choose VoiceChat?</h2>
                    <p className="section-subtitle-premium">Experience the best in anonymous video chatting</p>
                </motion.div>

                <div className="features-grid-premium">
                    {features.map((f, i) => (
                        <motion.div
                            key={i}
                            className="feature-card-glass"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                            style={{ background: f.gradient }}
                        >
                            <div className="feature-icon-glass">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;
