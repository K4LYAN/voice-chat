import React from 'react';

const Features = () => {
    const features = [
        { title: "Anonymous", desc: "No sign-up required. Just jump in." },
        { title: "Global", desc: "Match with speakers from 100+ regions." },
        { title: "Crystal Clear", desc: "Low-latency voice powered by WebRTC." }
    ];

    return (
        <section className="features container fade-in" style={{ animationDelay: '0.2s' }}>
            {features.map((f, i) => (
                <div key={i} className="feature-card">
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                </div>
            ))}
        </section>
    );
};

export default Features;
