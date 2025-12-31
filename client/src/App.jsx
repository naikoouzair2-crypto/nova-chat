import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Send } from 'lucide-react';
import JoinScreen from './components/JoinScreen';
import ChatRoom from './components/ChatRoom';
import Sidebar from './components/Sidebar';
import { API_URL } from './config';

const socket = io.connect(API_URL);

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("nova_user");
    return saved ? JSON.parse(saved) : null;
  }); // Now an object { username, avatar }
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [activeRoom, setActiveRoom] = useState("");

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem("nova_user", JSON.stringify(user));
  };

  const handleSelectUser = (recipient) => {
    // Unique room ID: Sort usernames alphabetically so "a_b" is same as "b_a"
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

  // Notification & Login Logic
  useEffect(() => {
    if (currentUser) {
      socket.emit("login", currentUser.username);

      // Request Notification Permission
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const handleNotification = (data) => {
      // Show notification if we are NOT in the chat room with the sender, or if window is hidden
      const isChattingWithSender = selectedRecipient && selectedRecipient.username === data.author;
      const isWindowHidden = document.hidden;

      if (!isChattingWithSender || isWindowHidden) {
        if (Notification.permission === "granted") {
          new Notification(`New message from ${data.author}`, {
            body: data.type === 'audio' ? '🎤 Sent a voice message' : data.message,
            icon: '/nova_chat_logo.png' // Optional icon
          });
        }
      }
    };

    socket.on("notification", handleNotification);
    return () => socket.off("notification", handleNotification);
  }, [selectedRecipient]);

  if (!currentUser) {
    return <JoinScreen onJoin={handleLogin} />;
  }

  return (
    <div className="flex h-[100dvh] w-full bg-black text-white font-sans overflow-hidden relative">
      {/* Sidebar - Full width on mobile, 350px on desktop */}
      <div className={`
        ${selectedRecipient ? 'hidden md:flex' : 'flex'} 
        w-full md:w-auto h-full border-r border-[#262626] z-10
      `}>
        <Sidebar
          currentUser={currentUser}
          onSelectUser={handleSelectUser}
          selectedUser={selectedRecipient}
          onLogout={handleLogout}
        />
      </div>

      {/* Chat Area - Full width on mobile, remaining space on desktop */}
      <div className={`
        ${!selectedRecipient ? 'hidden md:flex' : 'flex'} 
        flex-1 h-full flex-col bg-black w-full relative z-0
      `}>
        {!selectedRecipient ? (
          // Empty State (IG Style)
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
            <div className="w-24 h-24 rounded-full border-2 border-white flex items-center justify-center mb-4 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-blue-500 opacity-20 rounded-full blur-xl"></div>
              <Send className="w-10 h-10 text-white ml-1 mt-1 relative z-10" />
            </div>
            <h2 className="text-2xl font-light mb-2">Your Space</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">Connecting you to the universe. Search for a friend to start a transmission.</p>
            <button className="bg-white text-black font-bold py-2 px-6 rounded-full text-sm hover:opacity-90 transition-opacity">Send Message</button>
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
  );
}

export default App;
