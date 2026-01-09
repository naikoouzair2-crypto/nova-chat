import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
// ... existing imports ...

// ... inside App component ...
function App() {
  // ... state ...

  // Hardware Back Button Handling
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // If a chat is open (selectedRecipient is set), close the chat
        // We need to use the functional update or ref because of closure, 
        // BUT current structure has 'selectedRecipient' in state.
        // Since this effect runs once, it has stale closure. 
        // We should move this logic into a ref or re-bind.
        // Actually, easiest way is to use a ref to track if we are in a chat.
      });
    }
  }, []);

  // Use a Ref to track active state for the back button callback
  const selectedRecipientRef = useRef(selectedRecipient);
  useEffect(() => { selectedRecipientRef.current = selectedRecipient; }, [selectedRecipient]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backListener = CapacitorApp.addListener('backButton', () => {
      if (selectedRecipientRef.current) {
        // If in chat, go back to sidebar
        handleBackToSidebar();
        // Note: Since handleBackToSidebar sets state, it works.
      } else {
        // If on main screen, exit app
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backListener.then(handler => handler.remove());
    };
  }, []); // Logic depends on ref, so dep array can be empty

  // Push Notification Listeners
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Register listeners
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received:', notification);
      // Show a local toast? Or let the system handle it (if in bg).
      // If in fg, we get this.
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed:', notification.actionId, notification.inputValue);
      // Navigate to chat?
      // const data = notification.notification.data;
      // if (data.username) ... handleSelectUser ...
    });

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  import { motion, AnimatePresence } from 'framer-motion';
  import JoinScreen from './components/JoinScreen';
  import ChatRoom from './components/ChatRoom';
  import Sidebar from './components/Sidebar';
  import { requestForToken, onMessageListener, auth, db } from './firebase'; // Import auth and db
  import ErrorBoundary from './components/ErrorBoundary';
  import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'; // Auth SDK
  import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, collection } from 'firebase/firestore'; // Firestore SDK
  import { API_URL } from './config';
  // Note: API_URL usage will be removed progressively.

  // Socket Removed for Serverless
  const socket = null;

  function App() {
    const [currentUser, setCurrentUser] = useState(() => {
      const saved = localStorage.getItem("nova_user");
      return saved ? JSON.parse(saved) : null;
    });

    // Instant open, no custom splash
    const [showSplash, setShowSplash] = useState(false);
    const [isVerifyingUser, setIsVerifyingUser] = useState(true);

    // useEffect(() => {
    //   // Create Notification Channel for Android (Native Only)
    //   const createChannel = async () => {
    //     if (!Capacitor.isNativePlatform()) return;

    //     try {
    //       await PushNotifications.createChannel({
    //         id: 'default',
    //         name: 'Default Channel',
    //         description: 'General Notifications',
    //         importance: 5,
    //         visibility: 1,
    //         sound: 'default',
    //         vibration: true,
    //       });
    //       console.log('Notification channel created');
    //     } catch (e) {
    //       console.log('Channel creation failed', e);
    //     }
    //   };
    //   createChannel();
    // }, []);

    const [selectedRecipient, setSelectedRecipient] = useState(null);
    const [activeRoom, setActiveRoom] = useState("");
    const [currentTheme, setCurrentTheme] = useState('dark');

    /* Helper Functions */

    const handleLogout = () => {
      localStorage.removeItem("nova_user");
      setCurrentUser(null);
      setSelectedRecipient(null);
      setActiveRoom("");
      window.location.reload();
    };

    const handleLogin = async (userData) => {
      console.log("handleLogin called with:", userData);
      if (!userData.username) {
        console.error("handleLogin ERROR: Missing username!", userData);
        alert("Login Error: Missing username");
        return;
      }

      try {
        const email = `${userData.username}@nova.chat`;
        let firebaseUser;

        if (userData.mode === 'register') {
          const userCredential = await createUserWithEmailAndPassword(auth, email, userData.password);
          firebaseUser = userCredential.user;
          await updateProfile(firebaseUser, { displayName: userData.name, photoURL: userData.avatar });
          const uniqueId = Math.floor(100000 + Math.random() * 900000).toString();
          const userDocData = {
            username: userData.username,
            name: userData.name,
            avatar: userData.avatar || null,
            uniqueId: uniqueId,
            status: "Active",
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, "users", userData.username), userDocData);
          const finalUser = { ...userDocData, token: await firebaseUser.getIdToken(), password: userData.password };
          setCurrentUser(finalUser);
          localStorage.setItem("nova_user", JSON.stringify(finalUser));

        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, userData.password);
          firebaseUser = userCredential.user;
          const docRef = doc(db, "users", userData.username);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userDocData = docSnap.data();
            // Ensure username is present even if missing in doc data
            const finalUser = {
              ...userDocData,
              username: userData.username,
              token: await firebaseUser.getIdToken(),
              password: userData.password
            };
            setCurrentUser(finalUser);
            localStorage.setItem("nova_user", JSON.stringify(finalUser));
          } else {
            throw new Error("User record not found in database.");
          }
        }

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
    };

    const handleBackToSidebar = () => {
      setSelectedRecipient(null);
      setActiveRoom("");
    };

    useEffect(() => {
      console.log("App State Debug:", { currentUser: currentUser?.username, isVerifyingUser, showSplash });

      // Safety Check: If we have a 'user' object but no username, it's corrupted. Logout.
      if (currentUser && !currentUser.username) {
        console.error("Corrupted User Session detected. Clearing.");
        handleLogout();
        return;
      }

      if (currentUser) {
        const docRef = doc(db, "users", currentUser.username);
        getDoc(docRef)
          .then(async (docSnap) => {
            if (docSnap.exists()) {
              const freshUser = docSnap.data();
              console.log("Synced user data from Firestore:", freshUser);
              let token = currentUser.token;
              if (auth.currentUser) {
                token = await auth.currentUser.getIdToken();
              }
              // Ensure username is preserved! Firestore doc data might not have it if it was legacy.
              const updated = {
                ...freshUser,
                username: currentUser.username, // FORCE keep the username
                token,
                password: currentUser.password
              };
              setCurrentUser(updated);
              localStorage.setItem("nova_user", JSON.stringify(updated));
            }
          })
          .catch(console.error)
          .finally(() => setIsVerifyingUser(false));

        // if ("Notification" in window && Notification.permission !== "granted") {
        //   Notification.requestPermission();
        // }

        // Global Notification Listener
        // We listen to the friends collection to detect new unread messages even if not in that chat.
        const q = collection(db, "users", currentUser.username, "friends");
        const unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === "modified") {
              const data = change.doc.data();
              // Check if unread count increased and it's a recent message
              if (data.unreadCount > 0 && data.lastMessage) {
                // Avoid notifying if we are currently looking at this room
                // We check 'selectedRecipient' in a ref or just rely on the component state if valid
                // Since this effect closes over 'selectedRecipient', we might need a ref or stricter check.
                // For now simpler: Notification always fires, user can dismiss. 
                // Better: Check if document.hidden or URL. 

                // We only want to notify if the message is NEW (approx check via timestamp or local assumption)
                // To prevent duplicate notifs on re-renders, we trust the 'modified' event.

                // Prepare Avatar Logic
                // LocalNotifications on Android can use 'largeIcon' with a URL in strictly newer versions or via 'attachments'.
                const avatarUrl = data.avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${data.username}`;

                try {
                  await LocalNotifications.schedule({
                    notifications: [{
                      title: data.name || data.username,
                      body: data.lastMessage.content,
                      id: Math.floor(Math.random() * 1000000),
                      schedule: { at: new Date(Date.now() + 100) },
                      largeIcon: 'res://drawable/mipmap-xxxhdpi/ic_launcher.png', // Fallback to app icon
                      smallIcon: 'ic_stat_notifications', // Needs to exist in AndroidRes
                      attachments: [
                        { id: 'face', url: avatarUrl } // Shows avatar as big picture
                      ],
                      extra: {
                        username: data.username
                      }
                    }]
                  });
                } catch (e) {
                  console.error("Notification failed", e);
                  // Non-blocking fallback for Web Testing
                  if (Notification.permission === "granted") {
                    new Notification(data.name || data.username, {
                      body: data.lastMessage.content,
                      icon: avatarUrl
                    });
                  }
                }
              }
            }
          });
        });

        return () => {
          unsubscribe();
        };
      } else {
        setIsVerifyingUser(false);
      }
    }, [currentUser]); // Re-run only if user changes

    useEffect(() => {
      /*
      const requestPerms = async () => {
        // if ("Notification" in window && Notification.permission !== "granted") {
        //   Notification.requestPermission();
        // }
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
      */
      return () => { };
    }, [selectedRecipient, currentUser]);

    console.log("Render: showSplash", showSplash, "isVerifying", isVerifyingUser, "User", currentUser ? "Yes" : "No");
    return (
      <>
        <AnimatePresence>
        </AnimatePresence>

        {!showSplash && isVerifyingUser && (
          <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            {console.log("Rendering: Loading Screen")}
            <img src="/nova_logo_v3.png" className="w-24 h-24 object-contain rounded-3xl" />
          </div>
        )}

        {!showSplash && !isVerifyingUser && (
          !currentUser ? (
            // {console.log("Rendering: JoinScreen")} // JSX expression issue potential, wrapper needed
            (() => {
              console.log("Rendering: JoinScreen");
              return <JoinScreen onJoin={handleLogin} />;
            })()
          ) : (
            <div className="flex h-[100dvh] w-full bg-black text-white font-sans overflow-hidden relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
              {console.log("Rendering: Main Layout")}
              <div className={`${selectedRecipient ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full border-r border-[#262626] z-10`}>
                <Sidebar
                  currentUser={currentUser}
                  onSelectUser={handleSelectUser}
                  selectedUser={selectedRecipient}
                  onLogout={handleLogout}
                  socket={socket}
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
