const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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

let users = [];
let messages = {}; // { "room_id": [msg1, msg2] }
let friends = {};   // { "userA": ["userB"], "userB": ["userA"] } - Set-like behavior preferred but array for JSON simplicity
let requests = {};  // { "recipient": ["sender1"] }

// Helper
const addFriend = (u1, u2) => {
    if (!friends[u1]) friends[u1] = [];
    if (!friends[u2]) friends[u2] = [];
    if (!friends[u1].includes(u2)) friends[u1].push(u2);
    if (!friends[u2].includes(u1)) friends[u2].push(u1);
};

app.post('/register', (req, res) => {
    const { username, avatar } = req.body;
    const user = { username, avatar, status: "Active" };
    // Update if exists, else add
    const existingIdx = users.findIndex(u => u.username === username);
    if (existingIdx >= 0) {
        users[existingIdx] = user;
    } else {
        users.push(user);
    }
    console.log("Registered:", user);
    res.json(user);
});

app.get('/search', (req, res) => {
    const q = req.query.q?.toLowerCase() || "";
    const results = users.filter(u => u.username.toLowerCase().includes(q));
    res.json(results);
});

app.get('/messages/:room', (req, res) => {
    const room = req.params.room;
    res.json(messages[room] || []);
});

app.get('/requests/:username', (req, res) => {
    const { username } = req.params;
    const reqList = requests[username] || [];
    // Enrich with avatar
    const enriched = reqList.map(senderName => {
        const u = users.find(x => x.username === senderName);
        return u || { username: senderName, avatar: '' };
    });
    res.json(enriched);
});

app.get('/friends/:username', (req, res) => {
    const { username } = req.params;
    const friendList = friends[username] || [];
    const enriched = friendList.map(fname => {
        const u = users.find(x => x.username === fname);
        return u || { username: fname, avatar: '' };
    });
    res.json(enriched);
});

app.post('/accept', (req, res) => {
    const { user, sender } = req.body; // 'user' is accepting 'sender'

    // Add to friends
    addFriend(user, sender);

    // Remove from requests
    if (requests[user]) {
        requests[user] = requests[user].filter(u => u !== sender);
    }

    res.json({ success: true });
});

app.delete('/messages/:room', (req, res) => {
    const room = req.params.room;
    messages[room] = [];
    io.to(room).emit('chat_cleared'); // Notify clients
    res.json({ success: true });
});

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('login', (username) => {
        socket.join(username);
        console.log(`User ${username} logged in (Socket ID: ${socket.id})`);
    });

    socket.on('join_room', (data) => {
        socket.join(data.room);
        console.log(`User ${data.username} joined room: ${data.room}`);
    });

    socket.on('send_message', (data) => {
        try {
            const messageWithId = { ...data, id: uuidv4() }; // Add UUID
            const { author, recipient, room } = data;

            // Check Relationship
            const isFriend = friends[author]?.includes(recipient);

            // Always save message to room for now
            if (!messages[room]) messages[room] = [];
            messages[room].push(messageWithId);

            if (isFriend || author === recipient) {
                // Normal flow
                socket.to(room).emit('receive_message', messageWithId);
                if (recipient) {
                    io.to(recipient).emit('notification', messageWithId);
                }
            } else {
                // It's a Request!
                if (!requests[recipient]) requests[recipient] = [];
                if (!requests[recipient].includes(author)) {
                    requests[recipient].push(author);
                    // Notify recipient of NEW REQUEST
                    io.to(recipient).emit('request_received', { sender: author });
                }
                // We still emit receive_message to the SENDER so they see it
                // But we do NOT emit to the room (which the recipient might be capable of joining if they guessed the ID)
                // Actually, since Join Room uses name sort, they CAN join. 
                // But the frontend usually won't show the chat unless accepted.
                // Let's just NOT emit to the recipient for now?
                // Or better: emit a distinct event? or just rely on the 'request_received'.
            }
        } catch (err) {
            console.error("Error in send_message:", err);
        }
    });

    socket.on('delete_message', (data) => {
        const { room, id } = data;
        if (messages[room]) {
            messages[room] = messages[room].filter(msg => msg.id !== id);
            io.to(room).emit('message_deleted', id);
        }
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected', socket.id);
    });
});

const PORT = 3003;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
