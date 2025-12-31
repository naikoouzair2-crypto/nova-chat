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

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// Memory Store
let users = [];
let messages = {};
let friends = {};
let requests = {};

// Load Data
try {
    if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE);
        const data = JSON.parse(raw);
        users = data.users || [];
        messages = data.messages || {};
        friends = data.friends || {};
        requests = data.requests || {};
        console.log("Data loaded from disk.");
    }
} catch (e) {
    console.error("Failed to load data:", e);
}

// Save Data Helper
const saveData = () => {
    try {
        const data = { users, messages, friends, requests };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to save data:", e);
    }
};

// ... (Rest of existing socket setup) ...

// Helper to wrap saveData
const saveWrapper = (fn) => {
    return (...args) => {
        const result = fn(...args);
        saveData();
        return result;
    }
};

// ... 

// Update Register to Save
app.post('/register', (req, res) => {
    const { username, avatar } = req.body;
    const user = { username, avatar, status: "Active" };
    const existingIdx = users.findIndex(u => u.username === username);
    if (existingIdx >= 0) {
        users[existingIdx] = user;
    } else {
        users.push(user);
    }
    console.log("Registered:", user);
    saveData(); // <--- SAVE
    res.json(user);
});

// ... (Search and Getters don't need changes) ...

app.post('/accept', (req, res) => {
    const { user, sender } = req.body;
    addFriend(user, sender);
    if (requests[user]) {
        requests[user] = requests[user].filter(u => u !== sender);
    }
    saveData(); // <--- SAVE
    res.json({ success: true });
});

app.delete('/messages/:room', (req, res) => {
    const room = req.params.room;
    messages[room] = [];
    io.to(room).emit('chat_cleared');
    saveData(); // <--- SAVE
    res.json({ success: true });
});

io.on('connection', (socket) => {
    // ...
    socket.on('send_message', (data) => {
        try {
            const messageWithId = { ...data, id: uuidv4() };
            const { author, recipient, room } = data;
            const isFriend = friends[author]?.includes(recipient);

            if (!messages[room]) messages[room] = [];
            messages[room].push(messageWithId);

            if (isFriend || author === recipient) {
                socket.to(room).emit('receive_message', messageWithId);
                if (recipient) io.to(recipient).emit('notification', messageWithId);
            } else {
                if (!requests[recipient]) requests[recipient] = [];
                if (!requests[recipient].includes(author)) {
                    requests[recipient].push(author);
                    io.to(recipient).emit('request_received', { sender: author });
                }
            }
            saveData(); // <--- SAVE
        } catch (err) { console.error(err); }
    });

    socket.on('mark_seen', (data) => {
        const { room, username } = data;
        if (messages[room]) {
            let updated = false;
            messages[room].forEach(msg => {
                if (msg.recipient === username && !msg.seen) {
                    msg.seen = true;
                    updated = true;
                }
            });
            if (updated) {
                io.to(room).emit('messages_seen_update', { room });
                saveData(); // <--- SAVE
            }
        }
    });

    // ...
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

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
