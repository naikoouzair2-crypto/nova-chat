import { useState, useEffect } from 'react';
import { Search, LogOut, Plus, X, Camera } from 'lucide-react';

import { API_URL } from '../config';

// 3D Avatar styles matched from JoinScreen
const getAvatarStyle = (seed) => `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,ffdfbf`;

// Pre-defined seeds for avatar picker
const AVATAR_SEEDS = ['Felix', 'Aneka', 'Zack', 'Molly', 'Leo', 'Simba', 'Nala', 'Willow', 'Jack', 'Lola'];

function Sidebar({ currentUser, onSelectUser, selectedUser, onLogout }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [friendList, setFriendList] = useState([]);
    const [requestList, setRequestList] = useState([]);
    const [showProfileModal, setShowProfileModal] = useState(false);

    // ... rest of state


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
        const interval = setInterval(fetchLists, 5000);
        return () => clearInterval(interval);
    }, [currentUser]);

    // Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm) {
                try {
                    const res = await fetch(`${API_URL}/search?q=${searchTerm}`);
                    const data = await res.json();
                    setSearchResults(data.filter(u => u.username !== currentUser.username));
                } catch (err) { console.error(err); }
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentUser]);

    return (
        <div className="w-full md:w-[380px] flex flex-col bg-black h-full border-r border-[#1a1a1a] relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-6">
                <h1 className="text-3xl font-black text-white tracking-tight">Chats</h1>
                <div className="flex gap-4">
                    <button
                        onClick={onLogout}
                        className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
                    >
                        <LogOut className="w-5 h-5 text-gray-400" />
                    </button>
                    <div
                        onClick={() => setShowProfileModal(true)}
                        className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px] cursor-pointer hover:scale-105 transition-transform"
                    >
                        <img src={currentUser?.avatar || getAvatarStyle(currentUser?.username)} className="w-full h-full rounded-full bg-black object-cover" />
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="px-6 mb-6">
                <div className="relative group">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search Name, @username, or ID..."
                        className="w-full bg-[#121212] rounded-2xl py-3 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Stories / Active Users */}
            {!searchTerm && (
                <div className="mb-6 pl-6 overflow-x-auto no-scrollbar scroll-smooth">
                    <div className="flex gap-4 pr-6">

                        {/* Requests as Stories */}
                        {requestList.map((user) => (
                            <div
                                key={user.username}
                                onClick={() => onSelectUser({ ...user, isRequest: true })}
                                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                            >
                                <div className="w-[70px] h-[70px] rounded-full p-[3px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                                    <div className="w-full h-full rounded-full p-[2px] bg-black">
                                        <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-white max-w-[70px] truncate">{user.name || user.username}</span>
                            </div>
                        ))}

                        {/* Friends as Active */}
                        {friendList.map((user) => (
                            <div
                                key={user.username}
                                onClick={() => onSelectUser(user)}
                                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                            >
                                <div className="w-[70px] h-[70px] rounded-full p-[3px] bg-gradient-to-tr from-green-400 to-blue-500 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all">
                                    <div className="w-full h-full rounded-full p-[2px] bg-black">
                                        <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-gray-300 max-w-[70px] truncate">{user.name || user.username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {searchTerm ? (
                    <div className="space-y-2">
                        {searchResults.map((user) => (
                            <div
                                key={user.username}
                                onClick={() => onSelectUser(user)}
                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                            >
                                <img src={user.avatar} className="w-14 h-14 rounded-full bg-[#262626]" />
                                <div>
                                    <h3 className="text-white font-bold">{user.name || user.username}</h3>
                                    <span className="text-gray-400 text-xs">@{user.username} • ID: {user.uniqueId}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {requestList.length > 0 && <p className="px-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">New Requests</p>}

                        {/* Main Chat List */}
                        {friendList.map((user) => {
                            const isSelected = selectedUser?.username === user.username;
                            return (
                                <div
                                    key={user.username}
                                    onClick={() => onSelectUser(user)}
                                    className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-[#1a1a1a]' : 'hover:bg-[#111]'}`}
                                >
                                    <div className="relative">
                                        <img src={user.avatar} className="w-14 h-14 rounded-full bg-[#262626] object-cover" />
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-black rounded-full"></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <h3 className={`font-bold truncate text-base ${isSelected ? 'text-blue-400' : 'text-white'}`}>{user.name || user.username}</h3>
                                            <span className="text-xs text-gray-500 font-medium">Now</span>
                                        </div>
                                        <p className="text-gray-400 text-sm truncate">Tap to open chat</p>
                                    </div>
                                </div>
                            );
                        })}

                        {friendList.length === 0 && requestList.length === 0 && (
                            <div className="text-center py-10 opacity-50">
                                <p className="text-gray-500">No conversations yet.</p>
                                <p className="text-gray-600 text-sm">Search to find friends!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Signature */}
            <div className="p-4 flex justify-center opacity-20 hover:opacity-100 transition-opacity">
                <img src="/signature.jpg" className="h-8 invert mix-blend-screen" />
            </div>

            {/* Profile Modal */}
            {
                showProfileModal && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-[#1a1a1a] w-full max-w-sm rounded-3xl p-6 border border-[#333] shadow-2xl relative">
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="absolute top-4 right-4 p-2 bg-[#333] rounded-full hover:bg-[#444] text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex flex-col items-center">
                                <div className="relative mb-4">
                                    <img src={currentUser?.avatar} className="w-24 h-24 rounded-full border-4 border-black" />
                                    <div className="absolute bottom-0 right-0 p-1.5 bg-blue-500 rounded-full border-2 border-[#1a1a1a]">
                                        <Camera className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-white mb-0">{currentUser?.name || currentUser?.username}</h2>
                                <p className="text-blue-400 font-medium">@{currentUser?.username}</p>
                                <div className="bg-[#262626] px-3 py-1 rounded-full mt-2 mb-6 border border-[#333]">
                                    <p className="text-xs text-gray-400 font-mono tracking-widest">ID: {currentUser?.uniqueId || '---'}</p>
                                </div>

                                <p className="text-gray-500 text-sm mb-4">Tap avatar to change styling</p>

                                <div className="grid grid-cols-5 gap-2 w-full mb-6">
                                    {AVATAR_SEEDS.map((seed) => {
                                        const url = getAvatarStyle(seed);
                                        return (
                                            <div
                                                key={seed}
                                                onClick={() => {
                                                    // Create new user object
                                                    const newUser = { ...currentUser, avatar: url };
                                                    // Update Local Storage
                                                    localStorage.setItem("nova_user", JSON.stringify(newUser));
                                                    // Reload to reflect changes (simplest way without global context refactor)
                                                    window.location.reload();
                                                }}
                                                className="aspect-square rounded-full border-2 border-transparent hover:border-blue-500 cursor-pointer overflow-hidden bg-black"
                                            >
                                                <img src={url} className="w-full h-full object-cover" />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default Sidebar;
