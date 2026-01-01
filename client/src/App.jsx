import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JoinScreen from './components/JoinScreen';
import ChatRoom from './components/ChatRoom';
import Sidebar from './components/Sidebar';
import { requestForToken, onMessageListener } from './firebase'; // Import requestForToken
import { API_URL } from './config';

const socket = io.connect(API_URL);

// Splash Screen Component
// Splash Screen removed in favor of Native Splash

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("nova_user");
    return saved ? JSON.parse(saved) : null;
  });
  // Instant open, no custom splash
  const [showSplash, setShowSplash] = useState(false);

  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [activeRoom, setActiveRoom] = useState("");

  useEffect(() => {
    // If we have a user, ensure splash is OFF.
    if (currentUser) {
      setShowSplash(false);
      return;
    }

    if (showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, showSplash]);

  const handleLogin = async (userData) => {
    // userData contains { username, password, mode, ... }
    try {
      let endpoint = '/register';
      if (userData.mode === 'login') {
        endpoint = '/login';
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // If login successful, we have the user object
      // We should also persist the password locally (insecure but requested) 
      // so we can re-auth silently on refresh?? 
      // Actually, silent re-auth usually uses a token. 
      // Since we don't have tokens yet, the existing code relies on 'username' in localStorage.
      // We will now store the full object.

      // Merge password into the object if it's missing from response (it likely is for security, though our server sends it back currently if asked)
      const finalUser = { ...data, password: userData.password }; // Store pwd for silent re-auth

      setCurrentUser(finalUser);
      localStorage.setItem("nova_user", JSON.stringify(finalUser));
    } catch (e) {
      console.error("Auth failed:", e);
      alert(e.message); // Simple alert for now, or we could pass error back to JoinScreen
      // Do NOT set current user
    }
  };

  const handleSelectUser = (recipient) => {
    let roomName;
    if (recipient.isGroup) {
      roomName = recipient.id;
    } else {
      roomName = [currentUser.username, recipient.username].sort().join("_");
    }
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
    window.location.reload(); // Force reload to clear all states/sockets
  };

  useEffect(() => {
    if (currentUser) {
      const login = () => {
        socket.emit("login", currentUser.username);
        // Also re-join active room if any
        if (activeRoom) {
          socket.emit("join_room", { username: currentUser.username, room: activeRoom });
        }
      };

      socket.on('connect', login);
      // Run immediately in case already connected
      if (socket.connected) login();

      // Re-register / Re-login silently on app load
      // Ideally we use a token. For now, we use the stored password.
      const endpoint = currentUser.password ? '/login' : '/register';

      fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentUser)
      })
        .then(res => res.json())
        .then(freshUser => {
          if (freshUser && (freshUser.uniqueId || freshUser.username)) {
            console.log("Synced user data from server:", freshUser);
            // Update local storage but keep password if server didn't send it back (it usually doesn't in a real app, but here it might)
            const updated = { ...freshUser, password: currentUser.password || freshUser.password };
            setCurrentUser(updated);
            localStorage.setItem("nova_user", JSON.stringify(updated));
          }
        })
        .catch(console.error);

      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }

      // Initialize Firebase Token
      requestForToken(currentUser);

      return () => {
        socket.off('connect', login);
      };
    }
  }, [currentUser, activeRoom]);

  useEffect(() => {
    // Request Permissions
    const requestPerms = async () => {
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
      try {
        await LocalNotifications.requestPermissions();
      } catch (e) {
        // Not running in Capacitor environment
      }
    };
    requestPerms();

    const handleNotification = async (data) => {
      const isChattingWithSender = selectedRecipient && selectedRecipient.username === data.author;
      const isWindowHidden = document.hidden;

      if (!isChattingWithSender || isWindowHidden) {
        // Try Capacitor
        try {
          await LocalNotifications.schedule({
            notifications: [{
              title: `New message from ${data.author}`,
              body: data.type === 'audio' ? '🎤 Sent a voice message' : data.message,
              id: Math.floor(Math.random() * 1000000),
              schedule: { at: new Date(Date.now() + 100) },
              actionTypeId: "",
              extra: null
            }]
          });
        } catch (e) {
          // Fallback to Web
          if (Notification.permission === "granted") {
            new Notification(`New message from ${data.author}`, {
              body: data.type === 'audio' ? '🎤 Sent a voice message' : data.message,
              icon: '/nova_chat_logo.png'
            });
          }
        }
      }
    };
    socket.on("notification", handleNotification);
    return () => socket.off("notification", handleNotification);
  }, [selectedRecipient]);

  return (
    <>
      <AnimatePresence>
        {/* Native splash screen handles the intro */}
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
