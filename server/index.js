const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Sequelize, DataTypes, Op } = require('sequelize');
const fs = require('fs');
// Firebase Admin Setup
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

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

// --- TiDB / MySQL Setup (Sequelize) ---
const sequelize = new Sequelize(
    process.env.DB_NAME || 'test',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 4000,
        dialect: 'mysql',
        dialectOptions: {
            ssl: {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true
            }
        },
        logging: false
    }
);

// --- Models ---
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: DataTypes.STRING,
    avatar: DataTypes.STRING,
    uniqueId: { type: DataTypes.STRING, unique: true },
    status: { type: DataTypes.STRING, defaultValue: "Active" },
    status: { type: DataTypes.STRING, defaultValue: "Active" },
    fcmToken: { type: DataTypes.STRING }, // For Firebase
    password: { type: DataTypes.STRING } // Plaintext for simplicity now, but obviously hash in prod
});

const Friend = sequelize.define('Friend', {
    user1: DataTypes.STRING, // username
    user2: DataTypes.STRING  // username
}, {
    indexes: [{ unique: true, fields: ['user1', 'user2'] }]
});

const Request = sequelize.define('Request', {
    from: DataTypes.STRING, // username
    to: DataTypes.STRING    // username
}, {
    indexes: [{ unique: true, fields: ['from', 'to'] }]
});

const Group = sequelize.define('Group', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: DataTypes.STRING,
    admin: DataTypes.STRING,
    avatar: DataTypes.STRING
});

const GroupMember = sequelize.define('GroupMember', {
    groupId: DataTypes.STRING,
    username: DataTypes.STRING // Member username
});

const Message = sequelize.define('Message', {
    id: { type: DataTypes.STRING, primaryKey: true },
    room: DataTypes.STRING, // Can be group ID or private room ID
    author: DataTypes.STRING,
    recipient: DataTypes.STRING, // 'all' or username
    type: { type: DataTypes.STRING, defaultValue: 'text' },
    content: DataTypes.TEXT('long'), // For base64 audio/images
    message: DataTypes.TEXT,
    time: DataTypes.STRING,
    seen: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Sync Database
sequelize.sync()
    .then(async () => {
        console.log('TiDB/MySQL Database Synced');
        try {
            // Check for fcmToken
            const [resultsFcm] = await sequelize.query("SHOW COLUMNS FROM Users LIKE 'fcmToken'");
            if (resultsFcm.length === 0) {
                await sequelize.query("ALTER TABLE Users ADD COLUMN fcmToken VARCHAR(255) NULL;");
                console.log("Successfully added 'fcmToken' column.");
            }

            // Check for password
            const [resultsPwd] = await sequelize.query("SHOW COLUMNS FROM Users LIKE 'password'");
            if (resultsPwd.length === 0) {
                await sequelize.query("ALTER TABLE Users ADD COLUMN password VARCHAR(255) NULL;");
                console.log("Successfully added 'password' column.");
            }
        } catch (e) {
            console.error("Column check/add error:", e.message);
        }
    })
    .catch(err => console.error('Database Sync Error:', err));


// --- Helper Functions ---
const generateId = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- Routes ---
app.post('/register', async (req, res) => {
    const { username, name, avatar, password } = req.body;
    try {
        let user = await User.findOne({ where: { username: username } });

        if (user) {
            // If user exists, maybe update? Or fail?
            // For now, let's treat it as "updating profile" ONLY if authenticated, but here we are "registering".
            // Let's assume this means "I want to takeover this username".
            // Since we added password auth, we should technically FAIL if user exists.
            // But to keep legacy logic somewhat working:
            return res.status(400).json({ error: "Username already taken. Please login." });
        }

        let newId = generateId();
        while (await User.findOne({ where: { uniqueId: newId } })) {
            newId = generateId();
        }

        user = await User.create({
            username,
            name,
            avatar,
            uniqueId: newId,
            password: password // Saving plain text as requested for now
        });
        console.log("Registered New User:", user.toJSON());
        res.json(user);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ where: { username } });
        if (!user) return res.status(404).json({ error: "User not found" });

        // If user has a password, check it
        if (user.password && user.password !== password) {
            return res.status(401).json({ error: "Invalid password" });
        }

        // If user has NO password (legacy), we allow login (and maybe they set it later)
        // Or if password matches.

        // Return full user object
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Firebase Token Registration
app.post('/register-device', async (req, res) => {
    const { username, token } = req.body;
    try {
        const user = await User.findOne({ where: { username } });
        if (user) {
            user.fcmToken = token;
            await user.save();
            console.log(`FCM Token registered for ${username}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/search', async (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    if (!q) return res.json([]);
    try {
        const results = await User.findAll({
            where: {
                [Op.or]: [
                    { username: { [Op.like]: `%${q}%` } },
                    { name: { [Op.like]: `%${q}%` } },
                    { uniqueId: { [Op.like]: `%${q}%` } }
                ]
            },
            limit: 20
        });
        res.json(results);
    } catch (e) {
        res.status(500).json([]);
    }
});

app.get('/friends/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const relations = await Friend.findAll({
            where: {
                [Op.or]: [{ user1: username }, { user2: username }]
            }
        });
        const friendNames = relations.map(r => r.user1 === username ? r.user2 : r.user1);

        const friends = await User.findAll({ where: { username: friendNames } });

        // Enrich with Last Message & Unread Count
        const mapped = await Promise.all(friends.map(async (f) => {
            const friendName = f.username;

            // Get Last Message (either sent or received)
            const lastMsg = await Message.findOne({
                where: {
                    [Op.or]: [
                        { author: username, recipient: friendName },
                        { author: friendName, recipient: username }
                    ]
                },
                order: [['time', 'DESC']]
            });

            // Get Unread Count (messages FROM friend TO user that are NOT seen)
            const unreadCount = await Message.count({
                where: {
                    author: friendName,
                    recipient: username,
                    seen: false
                }
            });

            return {
                ...f.toJSON(),
                avatar: f.avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${f.username}&backgroundColor=b6e3f4,c0aede,ffdfbf`,
                lastMessage: lastMsg ? {
                    content: lastMsg.message || (lastMsg.type === 'image' ? 'Sent an image' : 'Sent a voice message'),
                    time: lastMsg.time,
                    author: lastMsg.author
                } : null,
                unreadCount: unreadCount || 0
            };
        }));

        // Sort by last message time (descending) so active chats are top
        mapped.sort((a, b) => {
            const timeA = a.lastMessage?.time || 0;
            const timeB = b.lastMessage?.time || 0;
            return timeB < timeA ? -1 : timeB > timeA ? 1 : 0;
        });

        res.json(mapped);
    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
});

app.delete('/friends/:username', async (req, res) => {
    const { username } = req.params; // The friend to remove
    const { user } = req.body; // The current user requesting deletion

    if (!user) return res.status(400).json({ error: "User is required" });

    try {
        await Friend.destroy({
            where: {
                [Op.or]: [
                    { user1: user, user2: username },
                    { user1: username, user2: user }
                ]
            }
        });

        // Also remove messages? Maybe keep them for now, but user requested "delete user he had".
        // Usually "Unfriend" removes the connection. 
        // Let's also remove the Chat History to be "clean".
        // Or just unfriend. Let's start with unfriend. 
        // Actually, let's remove messages too if they want to "delete" the user.
        // Wait, removing messages might be aggressive. Let's just unfriend.

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/requests/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const reqs = await Request.findAll({ where: { to: username } });
        const senders = await User.findAll({ where: { username: reqs.map(r => r.from) } });
        res.json(senders);
    } catch (e) { res.status(500).json([]); }
});

app.post('/send_request', async (req, res) => {
    const { from, to } = req.body;
    try {
        const isFriend = await Friend.findOne({
            where: {
                [Op.or]: [
                    { user1: from, user2: to },
                    { user1: to, user2: from }
                ]
            }
        });
        if (isFriend) return res.json({ success: false, message: "Already friends" });

        const existing = await Request.findOne({ where: { from, to } });
        if (existing) return res.json({ success: false, message: "Request already sent" });

        await Request.create({ from, to });
        io.to(to).emit('request_received', { sender: from });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/accept', async (req, res) => {
    const { user, sender } = req.body;
    try {
        const exists = await Friend.findOne({
            where: {
                [Op.or]: [
                    { user1: user, user2: sender },
                    { user1: sender, user2: user }
                ]
            }
        });
        if (!exists) {
            await Friend.create({ user1: user, user2: sender });
        }

        await Request.destroy({ where: { from: sender, to: user } });

        res.json({ success: true, friend: sender });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/reject', async (req, res) => {
    const { user, sender } = req.body;
    try {
        await Request.destroy({ where: { from: sender, to: user } });
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
            admin,
            avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${name}&backgroundColor=000000,333333`
        });

        // Add Members
        const memberRecords = uniqueMembers.map(u => ({ groupId: id, username: u }));
        await GroupMember.bulkCreate(memberRecords);

        // System Message
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
            ...newGroup.toJSON(),
            members: uniqueMembers,
            isGroup: true
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/groups/:username', async (req, res) => {
    const { username } = req.params;
    try {
        // Find all GroupMembers where username matches
        const memberships = await GroupMember.findAll({ where: { username } });
        const groupIds = memberships.map(m => m.groupId);

        const groups = await Group.findAll({ where: { id: groupIds } });
        const groupsWithMembers = await Promise.all(groups.map(async (g) => {
            const allMembers = await GroupMember.findAll({ where: { groupId: g.id } });
            return {
                ...g.toJSON(),
                members: allMembers.map(m => m.username),
                isGroup: true
            };
        }));

        res.json(groupsWithMembers);
    } catch (e) {
        console.error(e);
        res.status(500).json([]);
    }
    res.json(groupsWithMembers);
} catch (e) {
    console.error(e);
    res.status(500).json([]);
}
});

// Leave Group
app.post('/groups/:groupId/leave', async (req, res) => {
    const { groupId } = req.params;
    const { username } = req.body;
    try {
        await GroupMember.destroy({ where: { groupId, username } });

        // System Message
        const id = uuidv4();
        await Message.create({
            id, room: groupId, author: "System", recipient: "all",
            message: `${username} left the group`, time: new Date().toISOString(), type: 'system'
        });
        io.to(groupId).emit('receive_message', { id, room: groupId, author: "System", message: `${username} left the group`, type: 'system', time: new Date().toISOString() });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete Group (Admin Only)
app.delete('/groups/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { username } = req.body; // Requester
    try {
        const group = await Group.findOne({ where: { id: groupId } });
        if (!group) return res.status(404).json({ error: "Group not found" });

        if (group.admin !== username) {
            return res.status(403).json({ error: "Only admin can delete group" });
        }

        await Group.destroy({ where: { id: groupId } });
        await GroupMember.destroy({ where: { groupId } });
        await Message.destroy({ where: { room: groupId } });

        io.to(groupId).emit('group_deleted', { groupId });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Messages
app.get('/messages/:room', async (req, res) => {
    try {
        const msgs = await Message.findAll({
            where: { room: req.params.room },
            order: [['time', 'ASC']]
        });
        res.json(msgs);
    } catch (e) { res.json([]); }
});

app.delete('/messages/:room', async (req, res) => {
    try {
        await Message.destroy({ where: { room: req.params.room } });
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

            if (!data.isGroup && recipient !== 'all') {
                const isFriend = await Friend.findOne({
                    where: {
                        [Op.or]: [
                            { user1: author, user2: recipient },
                            { user1: recipient, user2: author }
                        ]
                    }
                });

                if (!isFriend && author !== recipient) {
                    const existingReq = await Request.findOne({ where: { from: author, to: recipient } });
                    if (!existingReq) {
                        await Request.create({ from: author, to: recipient });
                        io.to(recipient).emit('request_received', { sender: author });
                    }
                }
            }

            await Message.create(messageWithId);

            // Broadcast
            socket.to(room).emit('receive_message', messageWithId);

            if (recipient && recipient !== 'all') {
                io.to(recipient).emit('notification', messageWithId);

                // Firebase Send
                const user = await User.findOne({ where: { username: recipient } });

                // Fetch sender details for Avatar
                const senderUser = await User.findOne({ where: { username: author } });
                let avatarUrl = senderUser ? senderUser.avatar : null;

                // Convert SVG to PNG for Android Notification (DiceBear specific)
                if (avatarUrl && avatarUrl.includes('.svg')) {
                    avatarUrl = avatarUrl.replace('.svg', '.png');
                }

                if (user && user.fcmToken) {
                    admin.messaging().send({
                        token: user.fcmToken,
                        notification: {
                            title: author,
                            body: messageWithId.message || (messageWithId.type === 'image' ? 'Sent an image' : 'Sent a voice message'),
                            image: avatarUrl // Shows large image of sender's avatar
                        },
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                channelId: 'default',
                                tag: room, // Group by room/chat
                                image: avatarUrl // Redundant but good for compatibility
                            }
                        },
                        webpush: {
                            headers: {
                                Urgency: 'high'
                            },
                            fcm_options: {
                                link: '/'
                            }
                        }
                    }).catch(err => console.log("FCM Error:", err.message));
                }
            }

        } catch (err) { console.error(err); }
    });

    socket.on('mark_seen', async (data) => {
        const { room, username } = data;
        try {
            const [affectedCount] = await Message.update(
                { seen: true },
                { where: { room, recipient: username, seen: false } }
            );
            if (affectedCount > 0) {
                io.to(room).emit('messages_seen_update', { room });
            }
        } catch (e) { console.error(e); }
    });

    socket.on('delete_message', async (data) => {
        const { room, id } = data;
        try {
            await Message.destroy({ where: { id } });
            io.to(room).emit('message_deleted', id);
        } catch (e) { }
    });

    // Typing Indicators
    socket.on('typing', (data) => {
        socket.to(data.room).emit('user_typing', data);
    });

    socket.on('stop_typing', (data) => {
        socket.to(data.room).emit('user_stop_typing', data);
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
