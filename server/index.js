const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// --- Configuration ---
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_prod';

// --- Firebase Initialization ---
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Allow passing JSON via Env Var (Render Best Practice)
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        // Fallback to local file
        serviceAccount = require('./firebase-service-account.json');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized");
} catch (e) {
    console.error("CRITICAL: Firebase Init Failed. Ensure FIREBASE_SERVICE_ACCOUNT env var is set OR firebase-service-account.json exists.");
    console.error(e.message);
    process.exit(1);
}

const db = admin.firestore();

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "DELETE"]
    }
});

// --- Collections References ---
const usersRef = db.collection('users');
const friendsRef = db.collection('friends');
const requestsRef = db.collection('requests');
// groupsRef and messagesRef are removed as their writes are deprecated from backend.

// --- Helper Functions ---
const generateId = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = (user) => {
    return jwt.sign(
        { username: user.username, uniqueId: user.uniqueId },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// --- Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Routes ---

// 1. Register: Create User + Return JWT
app.post('/register', async (req, res) => {
    const { username, name, avatar, password } = req.body;
    try {
        const userDoc = await usersRef.doc(username).get();
        if (userDoc.exists) {
            return res.status(400).json({ error: "Username already taken. Please login." });
        }

        let newId = generateId();
        // Simple collision check (optional but good)
        let idCheck = await usersRef.where('uniqueId', '==', newId).get();
        while (!idCheck.empty) {
            newId = generateId();
            idCheck = await usersRef.where('uniqueId', '==', newId).get();
        }

        const newUser = {
            username,
            name,
            avatar,
            uniqueId: newId,
            password: password, // Plain text as requested
            fcmToken: null,
            status: "Active",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await usersRef.doc(username).set(newUser);

        const token = generateToken(newUser);
        // exclude password from response
        const { password: pwd, ...userWithoutPassword } = newUser;

        console.log("Registered New User:", username);
        res.json({ user: userWithoutPassword, token });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Login: Verify Creds + Return JWT
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await usersRef.doc(username).get();
        if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

        const userData = userDoc.data();

        // Password check
        if (userData.password && userData.password !== password) {
            return res.status(401).json({ error: "Invalid password" });
        }

        const token = generateToken(userData);
        const { password: pwd, ...userWithoutPassword } = userData;

        res.json({ user: userWithoutPassword, token });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Token Exchange: JWT -> Firebase Custom Token
app.post('/api/auth/firebase-token', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        // Mint Firebase Token
        const firebaseToken = await admin.auth().createCustomToken(username);
        res.json({ firebaseToken });
    } catch (e) {
        console.error("Token Mint Error:", e);
        res.status(500).json({ error: "Failed to generate Firebase token" });
    }
});

// 4. Update FCM Token (Protected)
app.post('/register-device', authenticateToken, async (req, res) => {
    const { token } = req.body;
    const username = req.user.username; // Get username from authenticated token
    try {
        await usersRef.doc(username).update({ fcmToken: token });
        console.log(`FCM Token updated for ${username}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. Global Search (Secure)
app.get('/search', async (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    if (!q) return res.json([]);
    try {
        // Firestore doesn't support native LIKE query easily.
        // We will fetch all users and filter in memory for this simple app.
        // PROD NOTE: Use Algolia or a specific search field.
        const snapshot = await usersRef.get();
        const results = [];
        snapshot.forEach(doc => {
            const u = doc.data();
            if (
                u.username.toLowerCase().includes(q) ||
                (u.name && u.name.toLowerCase().includes(q)) ||
                (u.uniqueId && u.uniqueId.includes(q))
            ) {
                // Return SAFE data only
                results.push({
                    username: u.username,
                    name: u.name,
                    avatar: u.avatar,
                    uniqueId: u.uniqueId,
                    status: u.status
                });
            }
        });
        res.json(results.slice(0, 20));
    } catch (e) {
        res.status(500).json([]);
    }
});

// --- Friendship Logic (Kept on Backend [Optionally move to frontend if needed]) ---
// The user asked to deprecate "Database Logic... for chats and groups". 
// Friendship is complex (mutual writes), so maintaining here is safer for now.

app.get('/friends/:username', async (req, res) => {
    const username = req.params.username;
    try {
        // Find friends where user is user1 OR user2
        // Firestore 'OR' queries are limited/new, let's do two queries
        const q1 = await friendsRef.where('user1', '==', username).get();
        const q2 = await friendsRef.where('user2', '==', username).get();

        const friendNames = new Set();
        q1.forEach(doc => friendNames.add(doc.data().user2));
        q2.forEach(doc => friendNames.add(doc.data().user1));

        if (friendNames.size === 0) return res.json([]);

        // Fetch user details
        const friendsDetails = [];
        // Firestore 'in' query supports up to 10
        // We'll iterate for simplicity
        const namesArray = Array.from(friendNames);
        for (const name of namesArray) {
            const uDoc = await usersRef.doc(name).get();
            if (uDoc.exists) {
                const { password, ...safeUser } = uDoc.data(); // Exclude password
                friendsDetails.push(safeUser);
            }
        }
        // Enrich with Last Message and Unread Count is now handled client-side via Firestore listeners.
        res.json(friendsDetails);

    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
});

app.delete('/friends/:username', async (req, res) => {
    const friendName = req.params.username;
    const { user } = req.body; // In a real app, 'user' would come from JWT

    if (!user) return res.status(400).json({ error: "User is required" });

    try {
        const q1 = await friendsRef.where('user1', '==', user).where('user2', '==', friendName).get();
        q1.forEach(async d => await d.ref.delete());

        const q2 = await friendsRef.where('user1', '==', friendName).where('user2', '==', user).get();
        q2.forEach(async d => await d.ref.delete());

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/requests/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const snap = await requestsRef.where('to', '==', username).get();
        const senders = [];
        for (const doc of snap.docs) {
            const r = doc.data();
            const uDoc = await usersRef.doc(r.from).get();
            if (uDoc.exists) {
                const { password, ...safeUser } = uDoc.data(); // Exclude password
                senders.push(safeUser);
            }
        }
        res.json(senders);
    } catch (e) { res.status(500).json([]); }
});

app.post('/send_request', async (req, res) => {
    const { from, to } = req.body; // In a real app, 'from' should come from Token
    try {
        // Check friend
        const q1 = await friendsRef.where('user1', '==', from).where('user2', '==', to).get();
        const q2 = await friendsRef.where('user1', '==', to).where('user2', '==', from).get();
        if (!q1.empty || !q2.empty) return res.json({ success: false, message: "Already friends" });

        // Check request
        const reqCheck = await requestsRef.where('from', '==', from).where('to', '==', to).get();
        if (!reqCheck.empty) return res.json({ success: false, message: "Request already sent" });

        await requestsRef.add({ from, to });
        io.to(to).emit('request_received', { sender: from }); // Legacy Socket Event for real-time notification
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/accept', async (req, res) => {
    const { user, sender } = req.body; // In a real app, 'user' should come from Token
    try {
        const q1 = await friendsRef.where('user1', '==', user).where('user2', '==', sender).get();
        const q2 = await friendsRef.where('user1', '==', sender).where('user2', '==', user).get();

        if (q1.empty && q2.empty) {
            await friendsRef.add({ user1: user, user2: sender });
        }

        // Delete Request
        const reqSnap = await requestsRef.where('from', '==', sender).where('to', '==', user).get();
        reqSnap.forEach(async d => await d.ref.delete());

        res.json({ success: true, friend: sender });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/reject', async (req, res) => {
    const { user, sender } = req.body; // In a real app, 'user' should come from Token
    try {
        const reqSnap = await requestsRef.where('from', '==', sender).where('to', '==', user).get();
        reqSnap.forEach(async d => await d.ref.delete());
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- DEPRECATED / REMOVED WRITES (Handled by Frontend) ---
// Groups, Messages endpoints are removed/deprecated for writes.
// Sockets now primarily for Signaling (Typing, Online Status) 
// or Real-time triggers if needed, but NOT database persistence.

// --- Socket Logic ---
io.on('connection', (socket) => {
    socket.on('login', (username) => {
        socket.join(username);
        console.log(`Socket: ${username} connected.`);
    });

    socket.on('join_room', ({ room }) => {
        socket.join(room);
    });

    // Modified: Just Relay for Push Notifications, DO NOT SAVE to DB.
    // Frontend saves messages to Firestore directly.
    socket.on('send_message', async (data) => {
        const { recipient, room, author, message } = data;

        // The original instruction implies the backend should not be writing chat/group data.
        // This means the actual message persistence is handled by the client directly to Firestore.
        // The socket 'send_message' event here is primarily for real-time notifications (e.g., FCM).
        // We do NOT emit 'receive_message' to the room here, as the client will listen to Firestore
        // for new messages to avoid duplicates.

        if (recipient && recipient !== 'all') {
            // Send Push Notification
            try {
                const userDoc = await usersRef.doc(recipient).get();
                if (userDoc.exists) {
                    const user = userDoc.data();
                    if (user.fcmToken) {
                        // Fetch sender's avatar for notification image
                        const senderDoc = await usersRef.doc(author).get();
                        let avatarUrl = senderDoc.exists ? senderDoc.data().avatar : null;
                        if (avatarUrl && avatarUrl.includes('.svg')) avatarUrl = avatarUrl.replace('.svg', '.png');

                        admin.messaging().send({
                            token: user.fcmToken,
                            notification: {
                                title: author,
                                body: message || "Sent a media message",
                                image: avatarUrl
                            },
                            android: { priority: 'high', notification: { tag: room } }
                        }).catch((e) => { console.error("FCM Send Error:", e.message); });
                    }
                }
                // Also emit socket notification event for in-app toast/badge update
                io.to(recipient).emit('notification', data);
            } catch (e) { console.error("Error processing notification for send_message:", e); }
        }
    });

    // 'mark_seen' and 'delete_message' socket events are removed as they involve database writes
    // that should now be handled by the frontend directly with Firestore.

    socket.on('typing', (data) => socket.to(data.room).emit('user_typing', data));
    socket.on('stop_typing', (data) => socket.to(data.room).emit('user_stop_typing', data));
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
