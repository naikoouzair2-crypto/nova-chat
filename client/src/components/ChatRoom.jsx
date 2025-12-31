import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Image, Mic, Info, ArrowLeft, Trash, Check, CheckCheck, Send } from 'lucide-react';
import { API_URL } from '../config';

function ChatRoom({ socket, username, room, recipient, onBack }) {
    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const messagesEndRef = useRef(null);
    const isCancelledRef = useRef(false);
    const timerRef = useRef(null);

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
        } catch (err) { alert("Microphone access denied: " + err); }
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
    };

    const sendMessage = async () => {
        if (currentMessage.trim()) {
            const msg = { room, author: username, recipient: recipient.username, type: 'text', message: currentMessage, time: new Date().toISOString() };
            await socket.emit("send_message", msg);
            setMessageList(l => [...l, msg]);
            setCurrentMessage("");
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

        socket.on("receive_message", handleReceive);
        socket.on("chat_cleared", handleClear);
        socket.on("message_deleted", handleDelete);
        socket.on("messages_seen_update", handleSeen);

        return () => {
            socket.off("receive_message", handleReceive);
            socket.off("chat_cleared", handleClear);
            socket.off("message_deleted", handleDelete);
            socket.off("messages_seen_update", handleSeen);
        };
    }, [socket, room, username]);

    useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messageList]);

    const handleDeleteMessage = (id) => { if (confirm("Delete message?")) socket.emit("delete_message", { room, id }); };
    const handleDeleteChat = async () => { if (confirm("Delete chat?")) { await fetch(`${API_URL}/messages/${room}`, { method: 'DELETE' }); setMessageList([]); } };

    return (
        <div className="flex flex-col h-[100dvh] bg-black relative">
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
                        <span className="text-gray-500 text-xs font-medium">Active now</span>
                    </div>
                </div>
                <div className="flex gap-4 text-white">
                    <Trash onClick={handleDeleteChat} className="w-6 h-6 text-red-500 opacity-80 hover:opacity-100 cursor-pointer" />
                    <Info className="w-6 h-6 text-blue-500 opacity-80 hover:opacity-100 cursor-pointer" />
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex flex-col items-center py-8 opacity-50">
                    <img src={recipient?.avatar} className="w-24 h-24 rounded-full mb-4 border-4 border-[#1a1a1a]" />
                    <h2 className="text-xl font-bold text-white">{recipient?.username}</h2>
                    <p className="text-sm text-gray-500">This is the beginning of your legendary conversation.</p>
                </div>

                <AnimatePresence>
                    {messageList.map((msg, idx) => {
                        const isMe = username === msg.author;
                        const isAudio = msg.type === 'audio';
                        return (
                            <motion.div
                                key={msg.id || idx}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                {!isMe && <img src={recipient?.avatar} className="w-8 h-8 rounded-full mb-1 mr-2 self-end" />}
                                <div
                                    onContextMenu={(e) => { e.preventDefault(); handleDeleteMessage(msg.id); }}
                                    className={`relative max-w-[70%] px-5 py-3 text-[15px] cursor-pointer shadow-sm
                                        ${isMe
                                            ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-2xl rounded-tr-sm"
                                            : "bg-[#262626] text-white rounded-2xl rounded-tl-sm"
                                        }`}
                                >
                                    {isAudio ? <audio src={msg.content} controls className="w-[200px] h-8" /> : msg.message}

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

            {/* Input Area */}
            <div className="p-3 bg-black border-t border-[#1a1a1a] pb-[env(safe-area-inset-bottom)]">
                {recipient.isRequest ? (
                    <div className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col items-center gap-3">
                        <p className="text-gray-400 text-sm">{recipient.username} wants to send you a message.</p>
                        <div className="flex gap-3 w-full">
                            <button onClick={async () => { await handleDeleteChat(); onBack(); }} className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-500 font-bold text-sm">Delete</button>
                            <button onClick={async () => {
                                await fetch(`${API_URL}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: username, sender: recipient.username }) });
                                alert("Accepted!"); window.location.reload();
                            }} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">Accept</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-full px-2 py-2 pl-4 border border-[#262626] focus-within:border-blue-500/50 transition-colors">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                            <Image className="w-5 h-5 text-blue-500" />
                        </div>
                        <input
                            type="text"
                            value={currentMessage}
                            placeholder={isRecording ? "Listening..." : "Message..."}
                            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-[15px] min-w-0"
                            onChange={(e) => setCurrentMessage(e.target.value)}
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
                                    <Trash onClick={cancelRecording} className="w-5 h-5 text-gray-500 cursor-pointer" />
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
