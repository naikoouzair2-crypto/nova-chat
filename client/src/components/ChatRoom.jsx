import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Heart, Image, Mic, Info, ArrowLeft, Trash, Check, CheckCheck } from 'lucide-react';

function ChatRoom({ socket, username, room, recipient, onBack }) {

    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const messagesEndRef = useRef(null);
    const isCancelledRef = useRef(false);
    const timerRef = useRef(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            isCancelledRef.current = false;
            const audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                if (isCancelledRef.current) return; // Do not process if cancelled

                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Audio = reader.result;
                    sendAudio(base64Audio);
                };
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start Timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            alert("Microphone access denied or not available." + err);
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
        isCancelledRef.current = true; // Flag to ignore the data
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setRecordingTime(0);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const sendAudio = async (base64Content) => {
        const messageData = {
            room: room,
            author: username,
            recipient: recipient.username, // Add recipient for notifications
            type: 'audio',
            content: base64Content,
            message: "🎤 Voice Message", // Fallback text
            time: new Date().toISOString(),
        };
        await socket.emit("send_message", messageData);
        setMessageList((list) => [...list, messageData]);
    };

    const sendMessage = async () => {
        if (currentMessage !== "") {
            const messageData = {
                room: room,
                author: username,
                recipient: recipient.username, // Add recipient for notifications
                type: 'text',
                message: currentMessage,
                time: new Date().toISOString(),
            };

            await socket.emit("send_message", messageData);
            setMessageList((list) => [...list, messageData]);
            setCurrentMessage("");
        }
    };

    useEffect(() => {
        // Fetch History
        const fetchHistory = async () => {
            try {
                const res = await fetch(`${API_URL}/messages/${room}`);
                const data = await res.json();
                setMessageList(data);
                // Mark seen immediately after fetching
                socket.emit('mark_seen', { room, username });
            } catch (err) {
                console.error(err);
            }
        };
        fetchHistory();

        const handleReceiveMessage = (data) => {
            setMessageList((list) => [...list, data]);
            // If I receive a message while in the room, I see it immediately.
            // But 'mark_seen' is usually for the OTHER person's messages.
            // If data.author !== username, we should emit mark_seen?
            if (data.author !== username) {
                socket.emit('mark_seen', { room, username });
            }
        };

        const handleChatCleared = () => {
            setMessageList([]);
        };

        const handleMessageDeleted = (id) => {
            setMessageList((list) => list.filter(msg => msg.id !== id));
        };

        const handleSeenUpdate = ({ room: updatedRoom }) => {
            if (updatedRoom === room) {
                // Simplest way: re-fetch history to get updated 'seen' flags
                // Or update local state if we know which ones.
                // Re-fetching is safer for now.
                fetchHistory();
            }
        };

        socket.on("receive_message", handleReceiveMessage);
        socket.on("chat_cleared", handleChatCleared);
        socket.on("message_deleted", handleMessageDeleted);
        socket.on("messages_seen_update", handleSeenUpdate);

        return () => {
            socket.off("receive_message", handleReceiveMessage);
            socket.off("chat_cleared", handleChatCleared);
            socket.off("message_deleted", handleMessageDeleted);
            socket.off("messages_seen_update", handleSeenUpdate);
        };
    }, [socket, room, username]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messageList]);

    const handleDeleteMessage = (id) => {
        if (confirm("Delete this message?")) {
            socket.emit("delete_message", { room, id });
        }
    };

    const handleDeleteChat = async () => {
        if (confirm("Delete this entire chat?")) {
            await fetch(`${API_URL}/messages/${room}`, { method: 'DELETE' });
            setMessageList([]);
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-black text-white relative overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-[#0d0d0d] border-b border-[#262626] shrink-0 sticky top-0 z-20 pb-[env(safe-area-inset-top)] pt-[env(safe-area-inset-top)]">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden text-white mr-2">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <img src={recipient?.avatar} className="w-8 h-8 rounded-full bg-gray-800" />
                    <div className="flex flex-col">
                        <span className="text-white font-semibold text-sm leading-tight">{recipient?.username}</span>
                        <span className="text-gray-500 text-xs leading-tight">Active today</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-white">
                    <button onClick={handleDeleteChat} title="Delete Chat">
                        <Trash className="w-5 h-5 text-red-500 hover:text-red-400" />
                    </button>
                    <Info className="w-6 h-6" />
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {/* ... Profile Section ... */}

                {messageList.map((msg, idx) => {
                    const isMe = username === msg.author;
                    const isAudio = msg.type === 'audio';

                    return (
                        <motion.div
                            key={msg.id || idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex mb-2 ${isMe ? "justify-end" : "justify-start"}`}
                        >
                            {!isMe && (
                                <img src={recipient?.avatar} className="w-7 h-7 rounded-full mr-2 self-end mb-1" />
                            )}
                            <div
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    handleDeleteMessage(msg.id);
                                }}
                                className={`relative max-w-[70%] px-4 py-2.5 text-[15px] cursor-pointer ${isMe
                                    ? "bg-[#3797f0] text-white rounded-[22px]"
                                    : "bg-[#262626] text-white rounded-[22px]"
                                    }`}
                                title="Right-click to delete"
                            >
                                {isAudio ? (
                                    <audio src={msg.content} controls className="w-[200px] h-8" />
                                ) : (
                                    <div className="flex flex-col">
                                        <span>{msg.message}</span>
                                    </div>
                                )}

                                {isMe && (
                                    <div className="flex justify-end -mt-0.5 ml-1 inline-block float-right">
                                        {msg.seen ? (
                                            <CheckCheck className="w-3.5 h-3.5 text-blue-200 opacity-90" />
                                        ) : (
                                            <Check className="w-3.5 h-3.5 text-gray-300 opacity-70" />
                                        )}
                                    </div>
                                )}

                                {!isMe && !isAudio && (
                                    <div className="absolute top-1/2 -right-8 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                                        <Heart className="w-4 h-4 text-gray-500 hover:text-red-500" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Footer: Input OR Accept Request */}
            <div className="p-4 shrink-0">
                {recipient.isRequest ? (
                    <div className="flex flex-col items-center gap-3 bg-[#262626] rounded-[22px] px-6 py-4">
                        <p className="text-sm text-gray-300">
                            {recipient.username} wants to send you a message.
                        </p>
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={async () => {
                                    // Delete Chat (Decline)
                                    await handleDeleteChat();
                                    onBack(); // Go back to list
                                }}
                                className="flex-1 bg-red-500/20 text-red-500 font-bold py-2 rounded-xl text-sm hover:bg-red-500/30 transition"
                            >
                                Delete
                            </button>
                            <button
                                onClick={async () => {
                                    // Accept Request
                                    try {
                                        await fetch(`${API_URL}/accept`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ user: username, sender: recipient.username })
                                        });
                                        // Refresh the page state logic implicitly by reloading or ideally updating parent state
                                        // For prototype, we can reload or just hide the banner by assuming success
                                        alert("Request Accepted!");
                                        window.location.reload(); // Simple refresh to update lists
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }}
                                className="flex-1 bg-blue-500 text-white font-bold py-2 rounded-xl text-sm hover:bg-blue-600 transition"
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 bg-[#262626] rounded-[22px] px-4 py-2.5">
                        <input
                            type="text"
                            value={currentMessage}
                            placeholder={isRecording ? "Recording audio..." : "Message..."}
                            className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-[15px]"
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            onKeyPress={(e) => { e.key === "Enter" && sendMessage() }}
                            disabled={isRecording}
                        />
                        {currentMessage ? (
                            <button onClick={sendMessage} className="text-[#3797f0] font-semibold text-sm">Send</button>
                        ) : (
                            <div className="flex items-center gap-3 text-white">
                                {isRecording ? (
                                    <div className="flex items-center gap-3 animate-pulse">
                                        <span className="text-red-500 text-xs font-mono font-bold mr-2">{formatTime(recordingTime)}</span>
                                        <Trash
                                            className="w-5 h-5 text-gray-400 hover:text-red-500 cursor-pointer"
                                            onClick={cancelRecording}
                                            title="Cancel"
                                        />
                                        <button
                                            onClick={stopRecording}
                                            className="text-red-500 font-bold text-xs border border-red-500/50 bg-red-500/10 px-2 py-1 rounded"
                                        >
                                            STOP & SEND
                                        </button>
                                    </div>
                                ) : (
                                    <Mic
                                        className="w-6 h-6 cursor-pointer hover:text-gray-300"
                                        onClick={startRecording}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}

export default ChatRoom;
