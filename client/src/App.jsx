import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import './App.css';
import Navbar from './components/Navbar';
import LandingView from './components/LandingView';
// SearchingView import removed
import ChatSession from './components/ChatSession';
import { useWebRTC } from './hooks/useWebRTC';
import { getSocketUrl } from './constants';

const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));

// Socket.io connection setup
const SOCKET_URL = getSocketUrl();

// Generate or retrieve a unique device hash for blocking identification
const getDeviceHash = () => {
  let hash = localStorage.getItem('deviceHash');
  if (!hash) {
    // Generate a simple unique ID (in production, consider using FingerprintJS)
    hash = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('deviceHash', hash);
  }
  return hash;
};

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  auth: {
    deviceHash: getDeviceHash()
  }
});

function App() {
  // Check if admin route
  const [isAdmin, setIsAdmin] = useState(window.location.hash === '#admin');

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setIsAdmin(window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // If admin route, show admin dashboard
  if (isAdmin) {
    return (
      <Suspense fallback={<div className="loading-spinner">Loading Admin...</div>}>
        <AdminDashboard />
      </Suspense>
    );
  }

  // State
  const [step, setStep] = useState('LANDING'); // LANDING, SEARCHING, CHATTING
  const [language, setLanguage] = useState('Global'); // Default to Global
  const [roomId, setRoomId] = useState(null);
  const [partnerSocketId, setPartnerSocketId] = useState(null); // Track partner for reporting
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // New Feature State
  const [gender, setGender] = useState('male');
  const [preferredGender, setPreferredGender] = useState('female');
  const [interests, setInterests] = useState([]); // Track user interests
  const [videoEnabled, setVideoEnabled] = useState(false); // Track video state

  // Handle incoming E2EE messages
  const onMessageReceived = useCallback((text) => {
    setMessages(prev => [...prev, { text, sender: 'partner' }]);
  }, []);

  // Use Custom WebRTC Hook
  const {
    myStream,
    partnerStream,
    myVideoRef,
    partnerVideoRef,
    initializePeer,
    endCall: endCallRTC,
    getMedia,
    enableVideo,
    sendMessage: sendP2PMessage // Alias for clarity
  } = useWebRTC(socket, onMessageReceived);

  const handleEnableVideo = useCallback(async () => {
    if (!videoEnabled) {
      const result = await enableVideo();
      if (result) {
        setVideoEnabled(true);
      }
    }
  }, [videoEnabled, enableVideo]);

  const endCall = useCallback((keepMedia = false) => {
    setStep('LANDING');
    setRoomId(null);
    setPartnerSocketId(null);
    setMessages([]);
    setVideoEnabled(false); // Reset video state
    endCallRTC(keepMedia); // Delegated to hook
    socket.emit('leave-room');
  }, [endCallRTC]);

  // Socket setup (Only for app-level events)
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('match-found', ({ roomId: assignedRoomId, initiator, partnerId }) => {
      setRoomId(assignedRoomId);
      setPartnerSocketId(partnerId);
      setStep('CHATTING');
      initializePeer(initiator === socket.id, partnerId);
    });

    socket.on('partner-disconnected', () => {
      // Automatically search for next partner instead of ending
      setMessages([]); // Clear previous chat
      setRoomId(null);
      setPartnerSocketId(null);
      endCallRTC(true); // Keep media active

      // Rejoin queue with same language
      setStep('SEARCHING');
      socket.emit('join-queue', { language: 'global' });
    });

    socket.on('receive-message', ({ message, sender }) => {
      // Ideally remove this or keep as fallback? 
      // User requested E2EE, so we ignore server messages for chat.
      // setMessages(prev => [...prev, { text: message, sender: 'partner' }]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('match-found');
      socket.off('partner-disconnected');
      socket.off('receive-message');
    };
  }, [endCall, initializePeer, endCallRTC]);

  const handleQuickStart = useCallback((selectedGender, selectedPreference) => {
    // Default to 'global' queue to remove region filtering
    joinQueue('global', selectedGender, selectedPreference);
  }, [joinQueue]);

  /* Destructure getMedia from the hook result at the top of the component first */

  const joinQueue = useCallback(async (lang = 'global', selectedGender, selectedPreference, selectedInterests) => {
    // Request permissions early
    const stream = await getMedia();

    if (stream) {
      setLanguage(lang);
      setStep('SEARCHING');

      // Use passed values or fallback to state (though state might be stale if just updated)
      // Better to rely on what's passed from the modal
      const g = selectedGender || gender;
      const pg = selectedPreference || preferredGender;
      const int = selectedInterests || interests || [];

      socket.emit('join-queue', {
        language: 'global',
        gender: g,
        preferredGender: pg,
        interests: int.map(i => i.replace(/[⚽💻🎬🎮🎵🎨✈️🍕]\s*/g, '').toLowerCase()) // Strip emojis
      });
    } else {
      // Permission denied or error - stay on landing
      // Optional: Show a toast/alert here if getMedia doesn't already
    }
  }, [getMedia, gender, preferredGender, interests]);

  const sendMessage = useCallback((text) => {
    // socket.emit('send-message', { roomId, message: text }); // Old Server-Relayed
    sendP2PMessage(text); // New E2EE
    setMessages(prev => [...prev, { text: text, sender: 'me' }]);
  }, [sendP2PMessage]);

  const nextPartner = useCallback((selectedGender = null, selectedPreference = null) => {
    // Update gender preferences if provided
    if (selectedGender) setGender(selectedGender);
    if (selectedPreference) setPreferredGender(selectedPreference);

    endCall(true); // Keep media for next call

    // Use the newly selected preferences or existing ones
    const genderToUse = selectedGender || gender;
    const prefToUse = selectedPreference || preferredGender;

    setStep('SEARCHING');
    socket.emit('join-queue', { language: 'global', gender: genderToUse, preferredGender: prefToUse });
  }, [endCall, gender, preferredGender]);

  const leaveQueue = useCallback(() => {
    socket.emit('leave-queue');
    setStep('LANDING');
  }, []);

  const handleReportUser = useCallback((reason) => {
    if (partnerSocketId) {
      socket.emit('report-user', { targetId: partnerSocketId, reason });
    }
  }, [partnerSocketId]);

  return (
    <div className="app-container">
      <Navbar
        isConnected={isConnected}
      />
      <AnimatePresence mode="wait">
        {step === 'LANDING' ? (
          <LandingView
            key="landing"
            onQuickStart={handleQuickStart}
            isConnected={isConnected}
            gender={gender}
            preferredGender={preferredGender}
            onGenderChange={setGender}
            onPreferredGenderChange={setPreferredGender}
            interests={interests}
            onInterestsChange={setInterests}
          />
        ) : (
          <ChatSession
            key="chat"
            messages={messages}
            onSendMessage={sendMessage}
            myVideoRef={myVideoRef}
            partnerVideoRef={partnerVideoRef}
            myStream={myStream}
            partnerStream={partnerStream}
            nextPartner={nextPartner}
            endCall={endCall}
            gender={gender}
            preferredGender={preferredGender}
            language="Global"
            onGenderChange={setGender}
            onPreferredGenderChange={setPreferredGender}
            onLanguageChange={() => { }}
            languages={[]}
            videoEnabled={videoEnabled}
            onEnableVideo={handleEnableVideo}
            onReport={handleReportUser}
            onNSFWDetected={(isWarning) => {
              if (isWarning) socket.emit('nsfw_warning');
              else socket.emit('nsfw_detected');
            }}
            /* Connect search functionality directly */
            isSearching={step === 'SEARCHING'}
            onStartSearch={() => joinQueue('global', gender, preferredGender)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;