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
import ErrorBoundary from './components/ErrorBoundary';

const socket = io.connect(API_URL);

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("nova_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Instant open, no custom splash
  const [showSplash, setShowSplash] = useState(false);
  const [isVerifyingUser, setIsVerifyingUser] = useState(true);

  useEffect(() => {
    // Create Notification Channel for Android
    const createChannel = async () => {
      try {
        await PushNotifications.createChannel({
          id: 'default',
          name: 'Default Channel',
          description: 'General Notifications',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        });
        console.log('Notification channel created');
      } catch (e) {
        console.log('Not running on Android or channel creation failed', e);
      }
    };
    createChannel();
  }, []);

  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [activeRoom, setActiveRoom] = useState("");
  const [currentTheme, setCurrentTheme] = useState('default');

  useEffect(() => {
    if (currentUser) {
      // No verification needed if we have user
    } else {
      setIsVerifyingUser(false);
    }
  }, [currentUser]);

  const handleLogin = async (userData) => {
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

      const finalUser = { ...data, password: userData.password };
      setCurrentUser(finalUser);
      localStorage.setItem("nova_user", JSON.stringify(finalUser));
    } catch (e) {
      console.error("Auth failed:", e);
      throw e;
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
    window.location.reload();
  };

  useEffect(() => {
    if (currentUser) {
      const login = () => {
        socket.emit("login", currentUser.username);
        if (activeRoom) {
          socket.emit("join_room", { username: currentUser.username, room: activeRoom });
        }
      };

      socket.on('connect', login);
      if (socket.connected) login();

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
            const updated = { ...freshUser, password: currentUser.password || freshUser.password };
            setCurrentUser(updated);
            localStorage.setItem("nova_user", JSON.stringify(updated));
          }
        })
        .catch(console.error)
        .finally(() => setIsVerifyingUser(false));

      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }

      if (currentUser) {
        requestForToken(currentUser);
      }

      return () => {
        socket.off('connect', login);
      };
    }
  }, [currentUser, activeRoom]);

  useEffect(() => {
    const requestPerms = async () => {
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
      try {
        await LocalNotifications.requestPermissions();
      } catch (e) {
      }
    };
    requestPerms();

    const handleNotification = async (data) => {
      const isChattingWithSender = selectedRecipient && selectedRecipient.username === data.author;
      const isWindowHidden = document.hidden;

      if (!isChattingWithSender || isWindowHidden) {
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
          if (Notification.permission === "granted") {
            new Notification(`New message from ${data.author}`, {
              body: data.type === 'audio' ? '🎤 Sent a voice message' : data.message,
              icon: '/nova_logo_v3.png'
            });
          }
        }
      }
    };
    socket.on("notification", handleNotification);
    return () => socket.off("notification", handleNotification);
  }, [selectedRecipient, currentUser]);

  return (
    <>
      <AnimatePresence>
      </AnimatePresence>

      {!showSplash && isVerifyingUser && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <img src="/nova_logo_v3.png" className="w-24 h-24 object-contain rounded-3xl" />
        </div>
      )}

      {!showSplash && !isVerifyingUser && (
        !currentUser ? (
          <JoinScreen onJoin={handleLogin} />
        ) : (
          <div className="flex h-[100dvh] w-full bg-black text-white font-sans overflow-hidden relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
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
                  currentTheme={currentTheme}
                  onThemeChange={setCurrentTheme}
                />
              )}
            </div>
          </div>
        )
      )}
    </>
  );
}

function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

export default AppWithBoundary;
