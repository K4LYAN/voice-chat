import { useState, useRef, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';

export const useWebRTC = (socket, onMessage) => {
    const [myStream, setMyStream] = useState(null);
    const [partnerStream, setPartnerStream] = useState(null);

    const myVideoRef = useRef();
    const partnerVideoRef = useRef();
    const connectionRef = useRef();
    const signalQueue = useRef([]);

    // Media handling - Start with audio only
    const getMedia = async (includeVideo = false) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: includeVideo,
                audio: true
            });
            setMyStream(stream);
            if (myVideoRef.current) myVideoRef.current.srcObject = stream;
            return stream;
        } catch (err) {
            console.error('Error accessing media:', err);
            const mediaType = includeVideo ? 'Camera/Microphone' : 'Microphone';
            alert(`Could not access ${mediaType}. Please allow permissions.`);
            return null;
        }
    };

    // Enable video on existing stream
    const enableVideo = async () => {
        try {
            // Stop current stream
            if (myStream) {
                myStream.getTracks().forEach(track => track.stop());
            }

            // Get new stream with video
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setMyStream(stream);
            if (myVideoRef.current) myVideoRef.current.srcObject = stream;

            // Update peer connection with new stream
            if (connectionRef.current) {
                const videoTrack = stream.getVideoTracks()[0];
                const sender = connectionRef.current._pc.getSenders().find(s => s.track?.kind === 'video');

                if (sender) {
                    await sender.replaceTrack(videoTrack);
                } else {
                    connectionRef.current.addTrack(videoTrack, stream);
                }
            }

            return stream;
        } catch (err) {
            console.error('Error enabling video:', err);
            alert('Could not access Camera. Please allow camera permissions.');
            return null;
        }
    };

    const stopMedia = () => {
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
            setMyStream(null);
        }
    };

    // Sending Data (E2E Encrypted Text)
    const sendMessage = useCallback((text) => {
        if (connectionRef.current) {
            try {
                connectionRef.current.send(text);
            } catch (err) {
                console.error('Error sending P2P message:', err);
            }
        }
    }, []);

    // Helper to handle incoming signals
    const handleIncomingSignal = useCallback((payload) => {
        const signal = payload.sdp || payload.candidate;
        if (connectionRef.current) {
            connectionRef.current.signal(signal);
        } else {
            console.log('Queueing signal:', payload.type || 'candidate');
            signalQueue.current.push(signal);
        }
    }, []);

    const initializePeer = async (initiator, partnerId) => {
        try {
            let stream = myStream;
            if (!stream) {
                stream = await getMedia();
                if (!stream) {
                    alert('Cannot establish connection without media access');
                    return;
                }
            }

            const peer = new SimplePeer({
                initiator,
                trickle: false,
                stream: stream,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            peer.on('signal', (data) => {
                if (data.type === 'offer') {
                    socket.emit('offer', { target: partnerId, sdp: data, caller: socket.id });
                } else if (data.type === 'answer') {
                    socket.emit('answer', { target: partnerId, sdp: data, caller: socket.id });
                } else if (data.candidate) {
                    socket.emit('ice-candidate', { target: partnerId, candidate: data });
                }
            });

            peer.on('stream', (stream) => {
                setPartnerStream(stream);
                if (partnerVideoRef.current) partnerVideoRef.current.srcObject = stream;
            });

            // 🔒 E2EE Message Listener
            peer.on('data', (data) => {
                const message = new TextDecoder().decode(data);
                if (onMessage) onMessage(message);
            });

            peer.on('close', () => {
                connectionRef.current = null;
            });

            connectionRef.current = peer;

            // Process queued signals
            while (signalQueue.current.length > 0) {
                const signal = signalQueue.current.shift();
                peer.signal(signal);
            }

        } catch (error) {
            console.error('Peer init error:', error);
        }
    };

    const endCall = useCallback((keepMedia = false) => {
        setPartnerStream(null);
        if (!keepMedia) stopMedia();
        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null;
        }
        // Clear queue
        signalQueue.current = [];
    }, [myStream]);

    // Socket listeners for signaling
    useEffect(() => {
        if (!socket) return;

        const onOffer = (payload) => {
            if (payload.caller !== socket.id) handleIncomingSignal(payload);
        };

        const onAnswer = (payload) => {
            if (payload.caller !== socket.id) handleIncomingSignal(payload);
        };

        const onIceCandidate = (payload) => {
            handleIncomingSignal(payload);
        };

        socket.on('offer', onOffer);
        socket.on('answer', onAnswer);
        socket.on('ice-candidate', onIceCandidate);

        return () => {
            socket.off('offer', onOffer);
            socket.off('answer', onAnswer);
            socket.off('ice-candidate', onIceCandidate);
        };
    }, [socket, handleIncomingSignal]);

    return {
        myStream,
        partnerStream,
        myVideoRef,
        partnerVideoRef,
        initializePeer,
        endCall,
        getMedia,
        enableVideo, // Expose video enabling function
        sendMessage // Expose P2P send
    };
};
