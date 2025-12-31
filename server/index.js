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
let friends = {};
let requests = {};
let groups = []; // [{ id, name, members: [username...], admin: username }]

// Load Data
try {
    if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE);
        const data = JSON.parse(raw);
        users = data.users || [];
        messages = data.messages || {};
        friends = data.friends || {};
        friends = data.friends || {};
        requests = data.requests || {};
        groups = data.groups || [];
        console.log("Data loaded from disk.");
        console.log("Data loaded from disk.");
    }
} catch (e) {
    console.error("Failed to load data:", e);
}

// Save Data Helper
const saveData = () => {
    try {
        const data = { users, messages, friends, requests, groups };
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

// Generate 6-digit numeric ID
const generateId = () => Math.floor(100000 + Math.random() * 900000).toString();

app.post('/register', (req, res) => {
    const { username, name, avatar } = req.body;

    // Check if username already exists (and it's not the same user logging in again)
    const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (existingUser) {
        // If it's a login attempt (same username), return existing user data
        // For strict registration, we might want to return an error, but for this app's flow, 
        // we'll update the name/avatar and return the existing user (preserving their ID)
        existingUser.name = name;
        existingUser.avatar = avatar;
        saveData();
        return res.json(existingUser);
    }

    // Create New User
    let newId = generateId();
    // Ensure ID is unique
    while (users.find(u => u.uniqueId === newId)) {
        newId = generateId();
    }

    const newUser = {
        username,
        name,
        avatar,
        uniqueId: newId,
        status: "Active"
    };

    users.push(newUser);
    console.log("Registered New User:", newUser);
    saveData();
    res.json(newUser);
});

app.get('/search', (req, res) => {
    const q = (req.query.q || "").toLowerCase();
    if (!q) return res.json([]);

    const results = users.filter(u =>
        u.username.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.uniqueId && String(u.uniqueId).includes(q))
    );
    res.json(results);
});


// Get Friends List
app.get('/friends/:username', (req, res) => {
    const username = req.params.username;
    // Map friends to full user objects if possible
    const friendNames = friends[username] || [];
    const friendObjects = friendNames.map(name => {
        const u = users.find(user => user.username === name);
        return u || { username: name, name: name, avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${name}` };
    });
    res.json(friendObjects);
});

// Get Requests List
app.get('/requests/:username', (req, res) => {
    const username = req.params.username;
    const requestNames = requests[username] || [];
    const requestObjects = requestNames.map(name => {
        const u = users.find(user => user.username === name);
        return u || { username: name, name: name, avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${name}` };
    });
    res.json(requestObjects);
});

// Get Messages (History)
app.get('/messages/:room', (req, res) => {
    const room = req.params.room;
    res.json(messages[room] || []);
});

app.post('/accept', (req, res) => {
    const { user, sender } = req.body;

    // Bidirectional Add
    if (!friends[user]) friends[user] = [];
    if (!friends[user].includes(sender)) friends[user].push(sender);

    if (!friends[sender]) friends[sender] = [];
    if (!friends[sender].includes(user)) friends[sender].push(user);

    // Remove from Requests
    if (requests[user]) {
        requests[user] = requests[user].filter(u => u !== sender);
    }

    saveData();
    res.json({ success: true, friend: sender });
});

app.post('/reject', (req, res) => {
    const { user, sender } = req.body;
    if (requests[user]) {
        requests[user] = requests[user].filter(u => u !== sender);
    }
    saveData();
    res.json({ success: true });
});

app.delete('/messages/:room', (req, res) => {
    const room = req.params.room;
    messages[room] = [];
    io.to(room).emit('chat_cleared');
    saveData(); // <--- SAVE
    res.json({ success: true });
});

app.post('/send_request', (req, res) => {
    const { from, to } = req.body;
    // Check if already friends
    if (friends[from]?.includes(to)) {
        return res.json({ success: false, message: "Already friends" });
    }
    // Check if already requested
    if (requests[to]?.includes(from)) {
        return res.json({ success: false, message: "Request already sent" });
    }

    if (!requests[to]) requests[to] = [];
    requests[to].push(from);

    // Notify recipient (using the room joined by username)
    io.to(to).emit('request_received', { sender: from });

    saveData();
    res.json({ success: true });
});

app.post('/groups', (req, res) => {
    const { name, members, admin } = req.body;
    const id = uuidv4();
    // Ensure all members are valid (optional check)
    // Add admin to members if not present
    const uniqueMembers = [...new Set([...members, admin])];

    const newGroup = {
        id,
        name,
        members: uniqueMembers,
        admin,
        isGroup: true,
        avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${name}&backgroundColor=000000,333333`
    };
    groups.push(newGroup);

    messages[id] = [{
        id: uuidv4(),
        author: "System",
        recipient: "all",
        message: `Group "${name}" created by ${admin}`,
        time: new Date().toISOString(),
        type: 'system'
    }];
    saveData();
    res.json(newGroup);
});

app.get('/groups/:username', (req, res) => {
    const { username } = req.params;
    const userGroups = groups.filter(g => g.members.includes(username));
    res.json(userGroups);
});

io.on('connection', (socket) => {
    // ...
    socket.on('login', (username) => {
        socket.join(username);
        console.log(`User ${username} joined their personal room`);
    });

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
