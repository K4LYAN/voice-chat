import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import './App.css'; // We'll create a basic CSS file
import Layout from './components/Layout';
import Hero from './components/Hero';
import Features from './components/Features';

// Socket.io connection to backend server
// Socket.io connection to backend server
// Usage: Set VITE_SERVER_URL in .env (local) or Vercel Environment Variables (prod)
// Fallback: If no env var, check if localhost (use :5000), else use Render URL
const getSocketUrl = () => {
  if (process.env.VITE_SERVER_URL) return process.env.VITE_SERVER_URL;

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }

  return 'https://voice-chat-0dnh.onrender.com';
};

const SOCKET_URL = getSocketUrl();
console.log('🔌 Attempting to connect to:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Russian'];

function App() {
  const [step, setStep] = useState('LANDING'); // LANDING, SEARCHING, CHATTING
  const [language, setLanguage] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [myStream, setMyStream] = useState(null);
  const [partnerStream, setPartnerStream] = useState(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false); // Default to Text, user can toggle Voice

  const myVideoRef = useRef();
  const partnerVideoRef = useRef();
  const connectionRef = useRef(); // To store the SimplePeer instance
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      console.error('Full error:', error);
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    // Socket Listeners for Matchmaking
    socket.on('match-found', ({ roomId: assignedRoomId, initiator }) => {
      console.log('🎉 Match Found! Room:', assignedRoomId, 'Initiator:', initiator, 'My ID:', socket.id);
      setRoomId(assignedRoomId);
      setStep('CHATTING');

      const iAmInitiator = initiator === socket.id;
      console.log('🔄 Initializing Peer. Am I initiator?', iAmInitiator);
      initializePeer(iAmInitiator, assignedRoomId);
    });

    socket.on('partner-disconnected', () => {
      console.log('Partner disconnected');
      alert('Partner disconnected!');
      endCall();
    });

    // WebRTC Signals routed via Server
    socket.on('offer', (payload) => {
      // Only non-initiator receives offer, and ignore self-messages
      if (payload.caller !== socket.id && connectionRef.current) {
        connectionRef.current.signal(payload.sdp);
      }
    });

    socket.on('answer', (payload) => {
      if (payload.caller !== socket.id && connectionRef.current) {
        connectionRef.current.signal(payload.sdp);
      }
    });

    socket.on('ice-candidate', (payload) => {
      // Although ICE candidates don't usually have a 'caller' field in standard payload if not added,
      // checking if it works. Standard ICE candidate object doesn't have it.
      // But we can check via logic or assume server filters it (which we just fixed).
      if (connectionRef.current) {
        connectionRef.current.signal(payload.candidate);
      }
    });

    socket.on('receive-message', ({ message, sender }) => {
      setMessages(prev => [...prev, { text: message, sender }]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('match-found');
      socket.off('partner-disconnected');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('receive-message');
    };
  }, []);

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMyStream(stream);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Error accessing media:', err);
      alert('Could not access Camera/Microphone. Please allow permissions.');
      return null;
    }
  };

  const stopMedia = () => {
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
      setMyStream(null);
    }
  };

  const initializePeer = async (initiator, currentRoomId) => {
    try {
      console.log('🎥 Initializing peer connection...', { initiator, currentRoomId, isVoiceMode });

      // If voice mode is on, ensure we have stream
      let stream = myStream;
      if (isVoiceMode && !stream) {
        console.log('📹 Voice mode ON but no stream, requesting media...');
        stream = await getMedia();
        if (!stream) {
          console.error('❌ Failed to get media stream, cannot initialize peer');
          return;
        }
      }

      const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: stream || undefined
      });

      peer.on('signal', (data) => {
        console.log('📡 Peer signal:', data.type);
        if (data.type === 'offer') {
          socket.emit('offer', { target: currentRoomId, sdp: data, caller: socket.id });
        } else if (data.type === 'answer') {
          socket.emit('answer', { target: currentRoomId, sdp: data, caller: socket.id });
        } else if (data.candidate) {
          // ICE candidate doesn't usually carry caller ID inside data, but we wrap it
          socket.emit('ice-candidate', { target: currentRoomId, candidate: data });
        }
      });

      peer.on('stream', (stream) => {
        console.log('✅ Received partner stream!');
        setPartnerStream(stream);
        if (partnerVideoRef.current) {
          partnerVideoRef.current.srcObject = stream;
        }
      });

      peer.on('error', (err) => {
        console.error('❌ Peer error:', err.code, err.message);
        console.error('Full peer error:', err);
      });

      peer.on('close', () => {
        console.log("🔌 Peer connection closed");
        connectionRef.current = null;
      });

      connectionRef.current = peer;
      console.log('✅ Peer initialized successfully');

    } catch (error) {
      console.error('❌ Fatal error initializing peer:', error);
      alert('Failed to establish connection. Please try again.');
    }
  };

  // Switch between Voice/Text in-call (Simulated by adding/removing stream)
  const toggleVoiceMode = async () => {
    const newMode = !isVoiceMode;
    // setIsVoiceMode moved to after success to avoid UI flicker if failed? 
    // No, keep optimistic but handle error.

    if (newMode) {
      const stream = await getMedia();
      if (stream) {
        setIsVoiceMode(true);
        if (connectionRef.current && !connectionRef.current.destroyed) {
          connectionRef.current.addStream(stream);
        } else {
          console.warn("Peer destroyed or null, cannot add stream");
        }
      } else {
        setIsVoiceMode(false); // Revert if failed
      }
    } else {
      setIsVoiceMode(false);
      stopMedia();
      if (connectionRef.current && !connectionRef.current.destroyed && myStream) {
        try {
          connectionRef.current.removeStream(myStream);
        } catch (e) {
          console.warn("Error removing stream", e);
        }
      }
    }
  };

  const joinQueue = (lang) => {
    setLanguage(lang);
    setStep('SEARCHING');
    socket.emit('join-queue', { language: lang });
  };

  const sendMessage = () => {
    if (!inputMsg.trim()) return;
    socket.emit('send-message', { roomId, message: inputMsg });
    setMessages(prev => [...prev, { text: inputMsg, sender: 'me' }]);
    setInputMsg('');
  };

  const endCall = (keepMedia = false) => {
    setStep('LANDING');
    setRoomId(null);
    setMessages([]);
    setPartnerStream(null);
    if (!keepMedia) {
      stopMedia();
    }

    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }

    socket.emit('leave-room');
  };

  const nextPartner = () => {
    endCall(true); // Keep media stream active
    joinQueue(language);
  };

  return (
    <Layout language={step !== 'LANDING' ? language : null} onJoinQueue={joinQueue}>

      {step === 'LANDING' && (
        <>
          <Hero />
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {isConnected ?
              <span style={{ color: 'green' }}>✅ Connected to Server</span> :
              <span style={{ color: 'red' }}>❌ Disconnected - Check Server</span>
            }
          </div>
          <div className="container" id="pro-languages">
            <h2 className="text-center" style={{ marginBottom: '2rem' }}>Select a Language</h2>
            <div className="landing-grid">
              {LANGUAGES.map(lang => (
                <button key={lang} className="lang-card" onClick={() => joinQueue(lang)}>
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <Features />
        </>
      )}

      {step === 'SEARCHING' && (
        <div className="searching-state fade-in">
          <div className="loader"></div>
          <h2>Looking for a {language} speaker...</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Connecting you to the world.</p>
        </div>
      )}

      {step === 'CHATTING' && (
        <div className="chat-layout fade-in">
          {/* Main Chat Area */}
          <div className="chat-main">
            <div className="messages-area">
              {messages.map((m, i) => (
                <div key={i} className={`message-bubble ${m.sender}`}>
                  {m.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="input-area">
              <input
                className="chat-input"
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
              />
              <button className="btn btn-primary" onClick={sendMessage}>Send</button>
            </div>
          </div>

          {/* Sidebar / Video Area */}
          <div className="video-sidebar">
            <div className="video-card">
              <video ref={partnerVideoRef} autoPlay playsInline muted={false} />
              {!partnerStream && (
                <div className="video-placeholder">
                  {isVoiceMode ? 'Waiting for video...' : 'Partner (Voice Off)'}
                </div>
              )}
            </div>

            <div className="video-card">
              <video ref={myVideoRef} autoPlay playsInline muted />
              {!isVoiceMode && <div className="video-placeholder">You (Voice Off)</div>}
            </div>

            <div className="controls-card">
              <div className="controls-primary">
                <button
                  className={`btn control-btn ${isVoiceMode ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={toggleVoiceMode}
                >
                  {isVoiceMode ? '🎥 Stop' : '🎥 Start'}
                </button>
              </div>

              <div className="controls-divider"></div>

              <div className="controls-secondary">
                <button className="btn btn-secondary control-btn" onClick={nextPartner}>
                  ⏭️ Next
                </button>
                <button className="btn btn-danger control-btn" onClick={endCall}>
                  ❌ End
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}

export default App;