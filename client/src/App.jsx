import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JoinScreen from './components/JoinScreen';
import ChatRoom from './components/ChatRoom';
import Sidebar from './components/Sidebar';
import { API_URL } from './config';

const socket = io.connect(API_URL);

// Splash Screen Component
const SplashScreen = ({ onComplete }) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    initial={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.8 }}
    onAnimationComplete={onComplete}
  >
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1, type: "spring" }}
      className="flex flex-col items-center"
    >
      <img src="/nova_logo_transparent.png" alt="Nova Chat" className="w-32 h-32 object-contain mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
      <motion.h1
        className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 tracking-tighter"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        NOVA CHAT
      </motion.h1>
    </motion.div>
  </motion.div>
);

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("nova_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [activeRoom, setActiveRoom] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (userData) => {
    // Register user on server to ensure they are searchable
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const finalUser = await res.json();

      // Use the data from server (which has uniqueId)
      setCurrentUser(finalUser);
      localStorage.setItem("nova_user", JSON.stringify(finalUser));
    } catch (e) {
      console.error("Registration failed:", e);
      // Fallback: This is risky if server is down, but we hope next load fixes it
      // Ideally we show an error, but let's allow access for now
      setCurrentUser(userData);
      localStorage.setItem("nova_user", JSON.stringify(userData));
    }
  };

  const handleSelectUser = (recipient) => {
    const roomName = [currentUser.username, recipient.username].sort().join("_");
    setActiveRoom(roomName);
    setSelectedRecipient(recipient);
    socket.emit("join_room", { username: currentUser.username, room: roomName });
  };

  const handleBackToSidebar = () => {
    setSelectedRecipient(null);
    setActiveRoom("");
  };

  const handleLogout = () => {
    localStorage.removeItem("nova_user");
    setCurrentUser(null);
    setSelectedRecipient(null);
    setActiveRoom("");
  };

  useEffect(() => {
    if (currentUser) {
      socket.emit("login", currentUser.username);
      // Re-register silently on app load to ensure server knows about us (if server restarted)
      fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentUser)
      }).catch(console.error);

      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const handleNotification = (data) => {
      const isChattingWithSender = selectedRecipient && selectedRecipient.username === data.author;
      const isWindowHidden = document.hidden;

      if (!isChattingWithSender || isWindowHidden) {
        if (Notification.permission === "granted") {
          new Notification(`New message from ${data.author}`, {
            body: data.type === 'audio' ? '🎤 Sent a voice message' : data.message,
            icon: '/nova_chat_logo.png'
          });
        }
      }
    };
    socket.on("notification", handleNotification);
    return () => socket.off("notification", handleNotification);
  }, [selectedRecipient]);

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      {!showSplash && (
        !currentUser ? (
          <JoinScreen onJoin={handleLogin} />
        ) : (
          <div className="flex h-[100dvh] w-full bg-black text-white font-sans overflow-hidden relative">
            <div className={`${selectedRecipient ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full border-r border-[#262626] z-10`}>
              <Sidebar
                currentUser={currentUser}
                onSelectUser={handleSelectUser}
                selectedUser={selectedRecipient}
                onLogout={handleLogout}
              />
            </div>

            <div className={`${!selectedRecipient ? 'hidden md:flex' : 'flex'} flex-1 h-full flex-col bg-black w-full relative z-0`}>
              {!selectedRecipient ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
                  <div className="w-24 h-24 rounded-full border-2 border-[#333] flex items-center justify-center mb-4 relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-blue-500 opacity-20 rounded-full blur-xl"></div>
                    <Send className="w-10 h-10 text-white ml-1 mt-1 relative z-10" />
                  </div>
                  <h2 className="text-2xl font-light mb-2">Your Space</h2>
                  <p className="text-gray-400 text-sm mb-6 max-w-xs">Connecting you to the universe. Search for a friend to start a transmission.</p>
                </div>
              ) : (
                <ChatRoom
                  socket={socket}
                  username={currentUser.username}
                  room={activeRoom}
                  recipient={selectedRecipient}
                  onBack={handleBackToSidebar}
                />
              )}
            </div>
          </div>
        )
      )}
    </>
  );
}

export default App;
