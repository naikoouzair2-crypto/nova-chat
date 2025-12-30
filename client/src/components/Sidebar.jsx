import { useState, useEffect } from 'react';
import { Search, LogOut } from 'lucide-react';
import novaLogo from '/nova_logo_v3.jpg';
import { API_URL } from '../config';

function Sidebar({ currentUser, onSelectUser, selectedUser, onLogout }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [activeTab, setActiveTab] = useState("messages"); // "messages" | "requests"
    const [requestList, setRequestList] = useState([]);
    const [friendList, setFriendList] = useState([]);

    // Fetch Lists
    useEffect(() => {
        const fetchLists = async () => {
            if (currentUser) {
                try {
                    const [friendsRes, requestsRes] = await Promise.all([
                        fetch(`${API_URL}/friends/${currentUser.username}`),
                        fetch(`${API_URL}/requests/${currentUser.username}`)
                    ]);

                    const friendsData = await friendsRes.json();
                    const requestsData = await requestsRes.json();

                    setFriendList(friendsData);
                    setRequestList(requestsData);
                } catch (e) {
                    console.error("Failed to fetch sidebar lists", e);
                }
            }
        };

        fetchLists();

        // Polling for demo purposes (real-time would use socket events like 'request_received')
        const interval = setInterval(fetchLists, 5000);
        return () => clearInterval(interval);
    }, [currentUser]);

    // Search Debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm) {
                try {
                    const res = await fetch(`${API_URL}/search?q=${searchTerm}`); // Corrected Port
                    const data = await res.json();
                    // Filter out self
                    setSearchResults(data.filter(u => u.username !== currentUser.username));
                } catch (err) {
                    console.error(err);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentUser]);

    return (
        <div className="w-full md:w-[350px] flex flex-col border-r border-[#262626] bg-black h-full font-sans">
            {/* Header */}
            <div className="h-[60px] flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-3 cursor-pointer">
                    <img src={novaLogo} alt="Nova Chat" className="w-10 h-10 object-cover bg-white rounded-lg p-0.5" />
                    <h1 className="font-bold text-xl text-white tracking-tight">Nova Chat</h1>
                    <span className="bg-red-500 w-2 h-2 rounded-full self-start mt-1"></span>
                </div>
                <button
                    onClick={onLogout}
                    title="Logout"
                    className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-[#262626] transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Profile Snippet */}
            <div className="px-5 py-2 flex items-center gap-3 mb-2">
                <img src={currentUser.avatar} className="w-8 h-8 rounded-full bg-gray-800" />
                <span className="text-gray-400 text-sm">Logged as <span className="text-white font-bold">{currentUser.username}</span></span>
            </div>

            {/* Search Bar */}
            <div className="px-4 mb-2">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full bg-[#262626] rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gray-600 placeholder-gray-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto">
                {/* Search Results Section */}
                {searchTerm && (
                    <div className="px-5 mb-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Search Results</h3>
                        {searchResults.length === 0 && <p className="text-gray-500 text-sm italic">No users found.</p>}
                        {searchResults.map((user) => (
                            <div
                                key={user.id || user.username}
                                onClick={() => onSelectUser(user)}
                                className="flex items-center gap-3 py-2 cursor-pointer hover:bg-[#111] rounded-lg px-2 -mx-2"
                            >
                                <img src={user.avatar} className="w-10 h-10 rounded-full" />
                                <div className="flex flex-col">
                                    <span className="text-white font-semibold">{user.username}</span>
                                    <span className="text-blue-500 text-xs">Tap to chat</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main List (Tabs only visible if NOT searching) */}
                {!searchTerm && (
                    <div className="flex flex-col h-full">
                        {/* Tabs */}
                        <div className="flex items-center justify-between px-5 py-2 shrink-0">
                            <span
                                onClick={() => setActiveTab("messages")}
                                className={`font-bold text-base cursor-pointer ${activeTab === 'messages' ? 'text-white' : 'text-gray-500'}`}
                            >
                                Messages
                            </span>
                            <span
                                onClick={() => setActiveTab("requests")}
                                className={`font-semibold text-sm cursor-pointer flex items-center gap-1 ${activeTab === 'requests' ? 'text-white' : 'text-gray-500'}`}
                            >
                                Requests
                                {requestList.length > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{requestList.length}</span>
                                )}
                            </span>
                        </div>

                        <div className="px-5 flex-1 overflow-y-auto">
                            {activeTab === 'messages' ? (
                                <>
                                    {friendList.length === 0 && <p className="text-gray-500 text-sm mt-4 text-center">No active chats yet.</p>}
                                    {friendList.map(user => (
                                        <div
                                            key={user.username}
                                            onClick={() => onSelectUser(user)}
                                            className={`flex items-center gap-3 py-3 cursor-pointer hover:bg-[#111] rounded-lg px-2 -mx-2 ${selectedUser?.username === user.username ? 'bg-[#1a1a1a]' : ''}`}
                                        >
                                            <img src={user.avatar} className="w-12 h-12 rounded-full border border-[#262626]" />
                                            <div className="flex flex-col">
                                                <span className="text-white font-semibold text-sm">{user.username}</span>
                                                <span className="text-gray-500 text-xs">Active now</span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {requestList.length === 0 && <p className="text-gray-500 text-sm mt-4 text-center">No pending requests.</p>}
                                    {requestList.map(user => (
                                        <div
                                            key={user.username}
                                            onClick={() => onSelectUser({ ...user, isRequest: true })} // Mark as request
                                            className="flex items-center gap-3 py-3 cursor-pointer hover:bg-[#111] rounded-lg px-2 -mx-2 opacity-80"
                                        >
                                            <img src={user.avatar} className="w-12 h-12 rounded-full border border-red-500/30" />
                                            <div className="flex flex-col">
                                                <span className="text-white font-semibold text-sm">{user.username}</span>
                                                <span className="text-gray-400 text-xs">Sent a request</span>
                                            </div>
                                            <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* Bottom Logo - Rotated Landscape */}
            <div className="p-4 flex justify-center mt-auto">
                <img
                    src="/signature.jpg"
                    alt="Signature"
                    className="h-24 w-auto object-contain filter invert mix-blend-screen opacity-50 hover:opacity-100 transition-opacity transform rotate-90 origin-center"
                    style={{ marginBottom: '-20px' }} // Adjust as needed
                />
            </div>
        </div>
    );
}

export default Sidebar;

