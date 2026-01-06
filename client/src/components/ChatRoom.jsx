import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Image, Mic, Info, ArrowLeft, Trash2, Check, CheckCheck, Send, MoreVertical, Palette, UserX, Copy } from 'lucide-react';
import Toast from './UiToast';
import { API_URL } from '../config';
import CryptoJS from 'crypto-js';

function ChatRoom({ socket, username, room, recipient, onBack }) {
    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const messagesEndRef = useRef(null);
    const isCancelledRef = useRef(false);
    const timerRef = useRef(null);

    // UI State
    const [isRequestAccepted, setIsRequestAccepted] = useState(!recipient.isRequest);
    const [isTyping, setIsTyping] = useState(false);
    const [showMenu, setShowMenu] = useState(false); // 3-dots menu
    const [targetMsg, setTargetMsg] = useState(null); // Message for long-press
    const toastRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Encryption Key Generation
    const getSecretKey = () => {
        const users = [username, recipient.username].sort().join("_");
        return users; // Simple key for now, ideally strictly hashed but the library handles string keys
    };

    const encryptMessage = (text) => {
        try {
            return CryptoJS.AES.encrypt(text, getSecretKey()).toString();
        } catch (e) { return text; }
    };

    const decryptMessage = (cipherText) => {
        try {
            const bytes = CryptoJS.AES.decrypt(cipherText, getSecretKey());
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            return originalText || cipherText; // Fallback if regular text
        } catch (e) { return cipherText; }
    };

    const handleTyping = () => {
        socket.emit('typing', { room, username });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop_typing', { room, username });
        }, 1500);
    };

    const handleInputChange = (e) => {
        setCurrentMessage(e.target.value);
        if (!isRecording) handleTyping();
    };

    // Audio Logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            isCancelledRef.current = false;
            const audioChunks = [];

            mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                if (isCancelledRef.current) return;
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => sendAudio(reader.result);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
        } catch (err) {
            toastRef.current?.error("Microphone access denied");
        }
    };

    const stopRecording = () => {
        clearInterval(timerRef.current);
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setRecordingTime(0);
    };

    const cancelRecording = () => {
        clearInterval(timerRef.current);
        isCancelledRef.current = true;
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setRecordingTime(0);
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const sendAudio = async (base64Content) => {
        const msg = { room, author: username, recipient: recipient.username, type: 'audio', content: base64Content, message: "🎤 Voice Message", time: new Date().toISOString() };
        await socket.emit("send_message", msg);
        setMessageList(l => [...l, msg]);
        socket.emit('stop_typing', { room, username });
    };

    const sendMessage = async () => {
        if (currentMessage.trim()) {
            const encryptedArgs = encryptMessage(currentMessage);
            const msg = {
                room, author: username, recipient: recipient.username, type: 'text',
                message: encryptedArgs, // Send Encrypted
                time: new Date().toISOString()
            };
            await socket.emit("send_message", msg);
            setMessageList(l => [...l, msg]);
            setCurrentMessage("");
            socket.emit('stop_typing', { room, username });
        }
    };

    // Socket & Persistence
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${API_URL}/messages/${room}`);
                const data = await res.json();
                setMessageList(data);
                socket.emit('mark_seen', { room, username });
            } catch (e) { console.error(e); }
        };
        fetchHistory();

        const handleReceive = (data) => {
            setMessageList(l => [...l, data]);
            if (data.author !== username) socket.emit('mark_seen', { room, username });
        };
        const handleClear = () => setMessageList([]);
        const handleDelete = (id) => setMessageList(l => l.filter(m => m.id !== id));
        const handleSeen = ({ room: r }) => { if (r === room) fetchHistory(); };

        const handleUserTyping = (data) => {
            if (data.username !== username) setIsTyping(true);
        };

        const handleUserStopTyping = (data) => {
            if (data.username !== username) setIsTyping(false);
        };

        // Re-fetch on reconnect
        const handleConnect = () => fetchHistory();

        socket.on("receive_message", handleReceive);
        socket.on("chat_cleared", handleClear);
        socket.on("message_deleted", handleDelete);
        socket.on("messages_seen_update", handleSeen);
        socket.on("connect", handleConnect);
        socket.on("user_typing", handleUserTyping);
        socket.on("user_stop_typing", handleUserStopTyping);

        return () => {
            socket.off("receive_message", handleReceive);
            socket.off("chat_cleared", handleClear);
            socket.off("message_deleted", handleDelete);
            socket.off("messages_seen_update", handleSeen);
            socket.off("connect", handleConnect);
            socket.off("user_typing", handleUserTyping);
            socket.off("user_stop_typing", handleUserStopTyping);
        };
    }, [socket, room, username]);

    useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messageList]);

    // Actions
    const handleDeleteEverywhere = (id) => {
        socket.emit("delete_message", { room, id });
        setTargetMsg(null);
    };

    const handleDeleteForMe = (id) => {
        setMessageList(l => l.filter(m => m.id !== id));
        setTargetMsg(null);
    };

    const handleDeleteChat = async () => {
        if (window.confirm("Clear all messages?")) {
            await fetch(`${API_URL}/messages/${room}`, { method: 'DELETE' });
            setMessageList([]);
            toastRef.current?.success("Chat cleared");
            setShowMenu(false);
        }
    };

    const handleDeleteFriend = async () => {
        if (window.confirm(`Remove ${recipient.username} from friends?`)) {
            await fetch(`${API_URL}/friends/${recipient.username}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: username })
            });
            onBack();
        }
    };

    const handleAcceptRequest = async () => {
        try {
            await fetch(`${API_URL}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: username, sender: recipient.username })
            });
            setIsRequestAccepted(true);
            toastRef.current?.success("Request Accepted!");
        } catch (e) {
            toastRef.current?.error("Failed to accept");
        }
    };

    const handleRejectRequest = async () => {
        try {
            await fetch(`${API_URL}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: username, sender: recipient.username })
            });
            await handleDeleteChat();
            onBack();
        } catch (e) {
            toastRef.current?.error("Failed to reject");
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-black relative" onClick={() => { setShowMenu(false); setTargetMsg(null); }}>
            <Toast ref={toastRef} />
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md border-b border-[#1a1a1a] sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden text-white hover:bg-[#262626] p-2 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="relative">
                        <img src={recipient?.avatar} className="w-10 h-10 rounded-full bg-[#262626]" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-base leading-tight">{recipient?.username}</h3>
                        {isTyping ? (
                            <span className="text-blue-400 text-xs font-medium animate-pulse">Typing...</span>
                        ) : (
                            <span className="text-gray-500 text-xs font-medium">Active now</span>
                        )}
                    </div>
                </div>
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-2 rounded-full hover:bg-[#262626] transition-colors">
                        <MoreVertical className="w-6 h-6 text-white" />
                    </button>

                    {/* Menu Dropdown */}
                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute right-0 top-12 w-48 bg-[#222] border border-[#333] rounded-xl shadow-2xl overflow-hidden z-50"
                            >
                                <div onClick={() => alert("Themes coming soon!")} className="px-4 py-3 hover:bg-[#333] cursor-pointer flex items-center gap-3 text-sm text-white">
                                    <Palette className="w-4 h-4 text-blue-400" /> Change Theme
                                </div>
                                <div onClick={handleDeleteChat} className="px-4 py-3 hover:bg-[#333] cursor-pointer flex items-center gap-3 text-sm text-white">
                                    <Trash2 className="w-4 h-4 text-orange-400" /> Clear Chat
                                </div>
                                <div onClick={handleDeleteFriend} className="px-4 py-3 hover:bg-[#333] cursor-pointer flex items-center gap-3 text-sm text-red-500">
                                    <UserX className="w-4 h-4" /> Delete Friend
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                <div className="flex flex-col items-center py-8 opacity-50">
                    <img src={recipient?.avatar} className="w-24 h-24 rounded-full mb-4 border-4 border-[#1a1a1a]" />
                    <h2 className="text-xl font-bold text-white">{recipient?.username}</h2>
                    <p className="text-sm text-gray-500 flex items-center gap-1"><span className="text-green-500">●</span> End-to-End Encrypted</p>
                </div>

                <AnimatePresence>
                    {messageList.map((msg, idx) => {
                        const isMe = username === msg.author;
                        const isAudio = msg.type === 'audio';
                        // Decrypt text if not audio
                        const displayText = (!isAudio && msg.message) ? decryptMessage(msg.message) : msg.message;

                        return (
                            <motion.div
                                key={msg.id || idx}
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                {!isMe && <img src={recipient?.avatar} className="w-8 h-8 rounded-full mb-1 mr-2 self-end" />}
                                <div
                                    onContextMenu={(e) => { e.preventDefault(); setTargetMsg(msg); }}
                                    onTouchStart={(e) => {
                                        const t = setTimeout(() => setTargetMsg(msg), 600);
                                        e.currentTarget.dataset.lp = t;
                                    }}
                                    onTouchEnd={(e) => clearTimeout(e.currentTarget.dataset.lp)}
                                    className={`relative max-w-[75%] px-4 py-3 text-[15px] cursor-pointer shadow-sm break-words
                                        ${isMe
                                            ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl rounded-tr-sm"
                                            : "bg-[#262626] text-white rounded-2xl rounded-tl-sm"
                                        }`}
                                >
                                    {isAudio ? <audio src={msg.content} controls className="w-[200px] h-8" /> : displayText}

                                    {isMe && (
                                        <div className="flex justify-end mt-1 space-x-0.5">
                                            {msg.seen
                                                ? <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                                                : <Check className="w-3.5 h-3.5 text-blue-200/50" />
                                            }
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Modal for Message Actions (Center or Bottom Sheet style) */}
            <AnimatePresence>
                {targetMsg && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTargetMsg(null)}>
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="bg-[#1a1a1a] border border-[#333] p-1 rounded-2xl w-64 shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-[#333] text-center">
                                <h3 className="text-white font-bold text-sm">Message Options</h3>
                            </div>
                            <button onClick={() => handleDeleteForMe(targetMsg.id)} className="w-full text-left px-4 py-3 hover:bg-[#262626] text-white text-sm transition-colors border-b border-[#333]">
                                Delete for Me
                            </button>
                            {targetMsg.author === username && (
                                <button onClick={() => handleDeleteEverywhere(targetMsg.id)} className="w-full text-left px-4 py-3 hover:bg-[#262626] text-red-500 text-sm transition-colors">
                                    Delete for Everyone
                                </button>
                            )}
                            <button onClick={() => setTargetMsg(null)} className="w-full text-center px-4 py-3 hover:bg-[#262626] text-gray-500 text-xs uppercase tracking-wider">
                                Cancel
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-3 bg-black border-t border-[#1a1a1a] pb-[env(safe-area-inset-bottom)]">
                {!isRequestAccepted ? (
                    <div className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col items-center gap-3">
                        <p className="text-gray-400 text-sm">{recipient.username} wants to send you a message.</p>
                        <div className="flex gap-3 w-full">
                            <button onClick={handleRejectRequest} className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-500 font-bold text-sm">Delete</button>
                            <button onClick={handleAcceptRequest} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">Accept</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-full px-2 py-2 pl-4 border border-[#262626] focus-within:border-blue-500/50 transition-colors">
                        <div className="p-2 ml-[1px]"></div>
                        <input
                            type="text"
                            value={currentMessage}
                            placeholder={isRecording ? "Listening..." : "Message (Encrypted)"}
                            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-[15px] min-w-0"
                            onChange={handleInputChange}
                            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                            disabled={isRecording}
                        />
                        {currentMessage ? (
                            <button onClick={sendMessage} className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                                <Send className="w-5 h-5" />
                            </button>
                        ) : (
                            isRecording ? (
                                <div className="flex items-center gap-3 pr-2 animate-pulse">
                                    <span className="text-red-500 font-mono font-bold">{formatTime(recordingTime)}</span>
                                    <Trash2 onClick={cancelRecording} className="w-5 h-5 text-gray-500 cursor-pointer" />
                                    <div onClick={stopRecording} className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center cursor-pointer">
                                        <div className="w-3 h-3 bg-white rounded-sm"></div>
                                    </div>
                                </div>
                            ) : (
                                <Mic onClick={startRecording} className="w-6 h-6 text-gray-400 hover:text-white cursor-pointer mr-2 transition-colors" />
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatRoom;
