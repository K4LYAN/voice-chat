import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import './App.css';
import LandingView from './components/LandingView';
import SearchingView from './components/SearchingView';
import ChatSession from './components/ChatSession';
import { useWebRTC } from './hooks/useWebRTC';

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

const LANGUAGE_DATA = [
  { code: 'English', name: 'English', native: 'English', loc: 'en' },
  { code: 'Spanish', name: 'Spanish', native: 'Español', loc: 'es' },
  { code: 'Hindi', name: 'Hindi', native: 'हिन्दी', loc: 'hi' },
  { code: 'Bengali', name: 'Bengali', native: 'বাংলা', loc: 'bn' },
  { code: 'Marathi', name: 'Marathi', native: 'मराठी', loc: 'mr' },
  { code: 'Telugu', name: 'Telugu', native: 'తెలుగు', loc: 'te' },
  { code: 'Tamil', name: 'Tamil', native: 'தமிழ்', loc: 'ta' },
  { code: 'Gujarati', name: 'Gujarati', native: 'ગુજરાતી', loc: 'gu' },
  { code: 'Kannada', name: 'Kannada', native: 'ಕನ್ನಡ', loc: 'kn' },
  { code: 'Malayalam', name: 'Malayalam', native: 'മലയാളം', loc: 'ml' },
  { code: 'Punjabi', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', loc: 'pa' },
  { code: 'Odia', name: 'Odia', native: 'ଓଡ଼ିଆ', loc: 'or' },
  { code: 'Assamese', name: 'Assamese', native: 'অসমীয়া', loc: 'as' },
  { code: 'Urdu', name: 'Urdu', native: 'اردو', loc: 'ur' },
  { code: 'French', name: 'French', native: 'Français', loc: 'fr' },
  { code: 'German', name: 'German', native: 'Deutsch', loc: 'de' },
  { code: 'Portuguese', name: 'Portuguese', native: 'Português', loc: 'pt' },
  { code: 'Russian', name: 'Russian', native: 'Русский', loc: 'ru' },
  { code: 'Japanese', name: 'Japanese', native: '日本語', loc: 'ja' },
  { code: 'Chinese', name: 'Chinese', native: '中文', loc: 'zh' },
  { code: 'Arabic', name: 'Arabic', native: 'العربية', loc: 'ar' },
  { code: 'Indonesian', name: 'Indonesian', native: 'Bahasa', loc: 'id' },
];

function App() {
  // State
  const [step, setStep] = useState('LANDING'); // LANDING, SEARCHING, CHATTING
  const [language, setLanguage] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // New Feature State
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [detectedLang, setDetectedLang] = useState(null); // Keep detectedLang logic 

  // Use Custom WebRTC Hook
  const {
    myStream,
    partnerStream,
    myVideoRef,
    partnerVideoRef,
    isVoiceMode,
    initializePeer,
    endCall: endCallRTC,
    toggleVoiceMode
  } = useWebRTC(socket);

  // Auto-detect language
  useEffect(() => {
    const browserLang = navigator.language || navigator.userLanguage;
    const shortLang = browserLang.split('-')[0];
    const found = LANGUAGE_DATA.find(l => l.loc === shortLang);

    if (found) {
      setDetectedLang(found.code);
      setSelectedFilters(prev => {
        // Only auto-select if empty (first load)
        if (prev.length === 0) return [found.code];
        return prev;
      });
    }
  }, []);

  const endCall = useCallback((keepMedia = false) => {
    setStep('LANDING');
    setRoomId(null);
    setMessages([]);
    endCallRTC(keepMedia); // Delegated to hook
    socket.emit('leave-room');
  }, [endCallRTC]);

  // Socket setup (Only for app-level events)
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('match-found', ({ roomId: assignedRoomId, initiator, partnerId }) => {
      setRoomId(assignedRoomId);
      setStep('CHATTING');
      initializePeer(initiator === socket.id, partnerId);
    });

    socket.on('partner-disconnected', () => {
      alert('Partner disconnected');
      endCall();
    });

    socket.on('receive-message', ({ message, sender }) => {
      setMessages(prev => [...prev, { text: message, sender: 'partner' }]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('match-found');
      socket.off('partner-disconnected');
      socket.off('receive-message');
    };
  }, [endCall, initializePeer]);


  const toggleFilter = useCallback((lang) => {
    setSelectedFilters(prev => {
      if (prev.includes(lang)) return prev.filter(l => l !== lang);
      return [...prev, lang];
    });
  }, []);

  const handleQuickStart = useCallback(() => {
    let targetLang;
    if (selectedFilters.length > 0) {
      const randomIndex = Math.floor(Math.random() * selectedFilters.length);
      targetLang = selectedFilters[randomIndex];
    } else {
      const randomIndex = Math.floor(Math.random() * LANGUAGE_DATA.length);
      targetLang = LANGUAGE_DATA[randomIndex].code;
    }
    joinQueue(targetLang);
  }, [selectedFilters]); // joinQueue is defined below, wait. cyclic dep?
  // joinQueue depends on socket, safe.

  const handleGlobalSearch = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * LANGUAGE_DATA.length);
    joinQueue(LANGUAGE_DATA[randomIndex].code);
  }, []);

  const joinQueue = useCallback((lang) => {
    setLanguage(lang);
    setStep('SEARCHING');
    socket.emit('join-queue', { language: lang });
  }, []);

  const sendMessage = useCallback((text) => {
    socket.emit('send-message', { roomId, message: text });
    setMessages(prev => [...prev, { text: text, sender: 'me' }]);
  }, [roomId]);

  const nextPartner = useCallback(() => {
    endCall(true); // Keep media for next call
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
            languages={LANGUAGE_DATA}
            selectedFilters={selectedFilters}
            onToggleFilter={toggleFilter}
            onQuickStart={handleQuickStart}
            isConnected={isConnected}
          />
        )}

        {step === 'SEARCHING' && (
          <SearchingView
            key="searching"
            language={language}
            onCancel={leaveQueue}
            onSearchGlobal={handleGlobalSearch}
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