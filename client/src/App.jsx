import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import './App.css';
import LandingView from './components/LandingView';
import SearchingView from './components/SearchingView';
import ChatSession from './components/ChatSession';

// Socket.io connection setup
const getSocketUrl = () => {
  if (process.env.VITE_SERVER_URL) return process.env.VITE_SERVER_URL;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return 'https://voice-chat-0dnh.onrender.com';
};

const SOCKET_URL = getSocketUrl();
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Russian'];

function App() {
  // State
  const [step, setStep] = useState('LANDING'); // LANDING, SEARCHING, CHATTING
  const [language, setLanguage] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [myStream, setMyStream] = useState(null);
  const [partnerStream, setPartnerStream] = useState(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const myVideoRef = useRef();
  const partnerVideoRef = useRef();
  const connectionRef = useRef();

  // Socket setup
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('match-found', ({ roomId: assignedRoomId, initiator }) => {
      setRoomId(assignedRoomId);
      setStep('CHATTING');
      initializePeer(initiator === socket.id, assignedRoomId);
    });

    socket.on('partner-disconnected', () => {
      alert('Partner disconnected');
      endCall();
    });

    socket.on('offer', (payload) => {
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
      if (connectionRef.current) {
        connectionRef.current.signal(payload.candidate);
      }
    });

    socket.on('receive-message', ({ message, sender }) => {
      setMessages(prev => [...prev, { text: message, sender: 'partner' }]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('match-found');
      socket.off('partner-disconnected');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('receive-message');
    };
  }, []);

  // Media handling
  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMyStream(stream);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;
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

  // WebRTC
  const initializePeer = async (initiator, currentRoomId) => {
    try {
      let stream = myStream;
      if (isVoiceMode && !stream) {
        stream = await getMedia();
        if (!stream) return;
      }

      const peer = new SimplePeer({
        initiator,
        trickle: false,
        stream: stream || undefined
      });

      peer.on('signal', (data) => {
        if (data.type === 'offer') {
          socket.emit('offer', { target: currentRoomId, sdp: data, caller: socket.id });
        } else if (data.type === 'answer') {
          socket.emit('answer', { target: currentRoomId, sdp: data, caller: socket.id });
        } else if (data.candidate) {
          socket.emit('ice-candidate', { target: currentRoomId, candidate: data });
        }
      });

      peer.on('stream', (stream) => {
        setPartnerStream(stream);
        if (partnerVideoRef.current) partnerVideoRef.current.srcObject = stream;
      });

      peer.on('close', () => {
        connectionRef.current = null;
      });

      connectionRef.current = peer;
    } catch (error) {
      console.error('Peer init error:', error);
    }
  };

  const toggleVoiceMode = async () => {
    const newMode = !isVoiceMode;
    if (newMode) {
      const stream = await getMedia();
      if (stream) {
        setIsVoiceMode(true);
        if (connectionRef.current && !connectionRef.current.destroyed) {
          connectionRef.current.addStream(stream);
        }
      }
    } else {
      setIsVoiceMode(false);
      stopMedia();
      if (connectionRef.current && !connectionRef.current.destroyed && myStream) {
        try {
          connectionRef.current.removeStream(myStream);
        } catch (e) {
          console.warn(e);
        }
      }
    }
  };

  const joinQueue = useCallback((lang) => {
    setLanguage(lang);
    setStep('SEARCHING');
    socket.emit('join-queue', { language: lang });
  }, []);

  const sendMessage = useCallback((text) => {
    socket.emit('send-message', { roomId, message: text });
    setMessages(prev => [...prev, { text: text, sender: 'me' }]);
  }, [roomId]);

  const endCall = useCallback((keepMedia = false) => {
    setStep('LANDING');
    setRoomId(null);
    setMessages([]);
    setPartnerStream(null);
    if (!keepMedia) stopMedia();
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }
    socket.emit('leave-room');
  }, []);

  const nextPartner = useCallback(() => {
    endCall(true);
    joinQueue(language);
  }, [endCall, joinQueue, language]);

  const leaveQueue = useCallback(() => {
    socket.emit('leave-queue');
    setStep('LANDING');
  }, []);

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-dot"></div>
          <span>Antigravity</span>
        </div>
        <div className="status-indicator">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          {isConnected ? 'System Normal' : 'Reconnecting...'}
        </div>
      </nav>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {step === 'LANDING' && (
          <LandingView
            key="landing"
            languages={LANGUAGES}
            onJoinQueue={joinQueue}
            isConnected={isConnected}
          />
        )}

        {step === 'SEARCHING' && (
          <SearchingView
            key="searching"
            language={language}
            onCancel={leaveQueue}
          />
        )}

        {step === 'CHATTING' && (
          <ChatSession
            key="chat"
            messages={messages}
            onSendMessage={sendMessage}
            myVideoRef={myVideoRef}
            partnerVideoRef={partnerVideoRef}
            partnerStream={partnerStream}
            isVoiceMode={isVoiceMode}
            toggleVoiceMode={toggleVoiceMode}
            nextPartner={nextPartner}
            endCall={endCall}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;