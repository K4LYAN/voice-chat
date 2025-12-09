import React from 'react';

const Hero = () => {
    return (
        <section className="hero fade-in">
            <div className="container">
                <h1 className="hero-title">Connect with the World, <br /> <span className="highlight">Anonymously.</span></h1>
                <p className="hero-subtitle">Experience borderless voice matching with crystal clear audio.</p>
                <div className="hero-actions">
                    <a href="#pro-languages" className="btn btn-primary">Start Matching</a>
                    <a href="#learn-more" className="btn btn-secondary">Learn More</a>
                </div>
            </div>
        </section>
    );
};

export default Hero;
