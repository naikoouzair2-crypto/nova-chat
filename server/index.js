const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
require('dotenv').config();

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, p) => {
    console.error('UNHANDLED REJECTION:', reason);
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

// --- MongoDB Setup ---
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://nova_user:nova123@cluster0.mongodb.net/novachat?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- Schemas & Models ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    name: String,
    avatar: String,
    uniqueId: { type: String, unique: true },
    status: { type: String, default: "Active" }
});
const User = mongoose.model('User', UserSchema);

// Store friends as simple pairs to allow quick querying: who are friends of X?
// Logic: If A and B are friends, one doc {user: A, friend: B} (or bidirectional handling)
// Simpler approach for this app: User document has a 'friends' array of usernames
const FriendSchema = new mongoose.Schema({
    user1: String, // username
    user2: String  // username
});
FriendSchema.index({ user1: 1, user2: 1 }, { unique: true });
const Friend = mongoose.model('Friend', FriendSchema);

const RequestSchema = new mongoose.Schema({
    from: String, // username
    to: String    // username
});
RequestSchema.index({ from: 1, to: 1 }, { unique: true });
const Request = mongoose.model('Request', RequestSchema);

const GroupSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    members: [String], // Array of usernames
    admin: String,
    avatar: String
});
const Group = mongoose.model('Group', GroupSchema);

const MessageSchema = new mongoose.Schema({
    id: String,
    room: String,
    author: String,
    recipient: String, // 'all' for groups or username
    type: { type: String, default: 'text' },
    content: String, // for files/audio
    message: String,
    time: String,
    seen: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', MessageSchema);


// --- Helper Functions ---
const generateId = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- Routes ---

app.post('/register', async (req, res) => {
    const { username, name, avatar } = req.body;
    try {
        let user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, "i") } });

        if (user) {
            user.name = name;
            user.avatar = avatar;
            await user.save();
            return res.json(user);
        }

        let newId = generateId();
        while (await User.findOne({ uniqueId: newId })) {
            newId = generateId();
        }

        user = new User({
            username,
            name,
            avatar,
            uniqueId: newId
        });
        await user.save();
        console.log("Registered New User:", user);
        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/search', async (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    if (!q) return res.json([]);
    try {
        const results = await User.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } },
                { uniqueId: { $regex: q } }
            ]
        }).limit(20);
        res.json(results);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.get('/friends/:username', async (req, res) => {
    const username = req.params.username;
    try {
        // Find pairs where user is user1 or user2
        const relations = await Friend.find({ $or: [{ user1: username }, { user2: username }] });
        const friendNames = relations.map(r => r.user1 === username ? r.user2 : r.user1);

        const friends = await User.find({ username: { $in: friendNames } });
        // Add avatars if missing (fallback logic)
        const mapped = friends.map(f => ({
            ...f.toObject(),
            avatar: f.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${f.username}`
        }));
        res.json(mapped);
    } catch (e) { res.status(500).json([]); }
});

app.get('/requests/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const reqs = await Request.find({ to: username });
        const senders = await User.find({ username: { $in: reqs.map(r => r.from) } });
        res.json(senders);
    } catch (e) { res.status(500).json([]); }
});

app.post('/send_request', async (req, res) => {
    const { from, to } = req.body;
    try {
        // Check if friends
        const isFriend = await Friend.findOne({
            $or: [
                { user1: from, user2: to },
                { user1: to, user2: from }
            ]
        });
        if (isFriend) return res.json({ success: false, message: "Already friends" });

        // Check if requested
        const existing = await Request.findOne({ from, to });
        if (existing) return res.json({ success: false, message: "Request already sent" });

        // Create Request
        await Request.create({ from, to });
        io.to(to).emit('request_received', { sender: from });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/accept', async (req, res) => {
    const { user, sender } = req.body;
    try {
        // Create Friend Link
        const exists = await Friend.findOne({
            $or: [
                { user1: user, user2: sender },
                { user1: sender, user2: user }
            ]
        });
        if (!exists) {
            await Friend.create({ user1: user, user2: sender });
        }

        // Remove Request
        await Request.deleteOne({ from: sender, to: user });

        res.json({ success: true, friend: sender });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/reject', async (req, res) => {
    const { user, sender } = req.body;
    try {
        await Request.deleteOne({ from: sender, to: user });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// Group Endpoints
app.post('/groups', async (req, res) => {
    const { name, members, admin } = req.body;
    const id = uuidv4();
    const uniqueMembers = [...new Set([...members, admin])];

    try {
        const newGroup = await Group.create({
            id,
            name,
            members: uniqueMembers,
            admin,
            avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${name}&backgroundColor=000000,333333`
        });

        // Initial System Message
        await Message.create({
            id: uuidv4(),
            room: id,
            author: "System",
            recipient: "all",
            message: `Group "${name}" created by ${admin}`,
            time: new Date().toISOString(),
            type: 'system'
        });

        res.json({
            ...newGroup.toObject(),
            isGroup: true
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/groups/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const groups = await Group.find({ members: username });
        const mapped = groups.map(g => ({ ...g.toObject(), isGroup: true }));
        res.json(mapped);
    } catch (e) { res.status(500).json([]); }
});

// Messages
app.get('/messages/:room', async (req, res) => {
    try {
        const msgs = await Message.find({ room: req.params.room }).sort({ time: 1 });
        res.json(msgs);
    } catch (e) { res.json([]); }
});

app.delete('/messages/:room', async (req, res) => {
    try {
        await Message.deleteMany({ room: req.params.room });
        io.to(req.params.room).emit('chat_cleared');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- Socket Logic ---
io.on('connection', (socket) => {
    socket.on('login', (username) => {
        socket.join(username);
        console.log(`User ${username} joined their personal room`);
    });

    socket.on('join_room', (data) => {
        const { room } = data;
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    socket.on('send_message', async (data) => {
        try {
            const messageWithId = { ...data, id: uuidv4() };
            const { author, recipient, room } = data;

            // Check if blocked/friends logic is needed here?
            // For now assuming client side checks + request flow handles "can I message"
            // But strict backend check:
            // if not group:
            if (!data.isGroup && recipient !== 'all') {
                const isFriend = await Friend.findOne({
                    $or: [{ user1: author, user2: recipient }, { user1: recipient, user2: author }]
                });
                // If strictly enforcing, we could return early. 
                // However, "send_message" event doesn't easily ack back error to sender in this structure
                // Use Author === Recipient check (self message)
                if (!isFriend && author !== recipient) {
                    // Send Request if not exists
                    const existingReq = await Request.findOne({ from: author, to: recipient });
                    if (!existingReq) {
                        await Request.create({ from: author, to: recipient });
                        io.to(recipient).emit('request_received', { sender: author });
                    }
                    // Don't save message? Or save but don't notify?
                    // Let's save it so they don't lose it, but maybe as "pending"?
                    // For requested flow, we usually BLOCK messaging until accepted.
                    // The Frontend prevents sending now. So we can assume if it gets here, it's safe or edge case.
                }
            }

            await Message.create(messageWithId);

            // Broadcast
            socket.to(room).emit('receive_message', messageWithId);

            // Notification
            // If group: notify all members (except sender) -> Need logic to find members
            // If DM: notify recipient
            if (recipient && recipient !== 'all') {
                io.to(recipient).emit('notification', messageWithId);
            }
            // Group notification logic would require fetching group members, too heavy for now?
            // Client handles notifications if they are simple.

        } catch (err) { console.error(err); }
    });

    socket.on('mark_seen', async (data) => {
        const { room, username } = data;
        try {
            const res = await Message.updateMany(
                { room, recipient: username, seen: false },
                { $set: { seen: true } }
            );
            if (res.modifiedCount > 0) {
                io.to(room).emit('messages_seen_update', { room });
            }
        } catch (e) { console.error(e); }
    });

    socket.on('delete_message', async (data) => {
        const { room, id } = data;
        try {
            await Message.deleteOne({ id });
            io.to(room).emit('message_deleted', id);
        } catch (e) { }
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
