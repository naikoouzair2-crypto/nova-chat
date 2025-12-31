import { useState, useEffect } from 'react';
import { Search, LogOut, Plus, X, Camera, MessageCircle, UserPlus, Users, UserCheck, Check, Trash2 } from 'lucide-react';

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
    const [groupList, setGroupList] = useState([]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'requests'

    // Group Creation State
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

    // Local state for tracking "Requested" button clicks in search to avoid refetching immediately
    const [requestedUsers, setRequestedUsers] = useState(new Set());

    // Fetch Lists
    useEffect(() => {
        const fetchLists = async () => {
            if (currentUser) {
                try {
                    const [friendsRes, requestsRes, groupsRes] = await Promise.all([
                        fetch(`${API_URL}/friends/${currentUser.username}`),
                        fetch(`${API_URL}/requests/${currentUser.username}`),
                        fetch(`${API_URL}/groups/${currentUser.username}`)
                    ]);
                    const friendsData = await friendsRes.json();
                    const requestsData = await requestsRes.json();
                    const groupsData = await groupsRes.json();

                    // Simple logic to keep arrays if data is malformed
                    if (Array.isArray(friendsData)) setFriendList(friendsData);
                    if (Array.isArray(requestsData)) setRequestList(requestsData);
                    if (Array.isArray(groupsData)) setGroupList(groupsData);
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

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return alert("Please enter a group name");
        if (selectedGroupMembers.length === 0) return alert("Please select at least one friend");

        await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newGroupName, members: selectedGroupMembers, admin: currentUser.username })
        });

        setShowGroupModal(false);
        setNewGroupName("");
        setSelectedGroupMembers([]);
        setActiveTab('chats');

        // Optimistic refresh
        const res = await fetch(`${API_URL}/groups/${currentUser.username}`);
        const data = await res.json();
        if (Array.isArray(data)) setGroupList(data);
    };

    const toggleGroupMember = (username) => {
        setSelectedGroupMembers(prev =>
            prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username]
        );
    };

    return (
        <div className="w-full md:w-[380px] flex flex-col bg-black h-full border-r border-[#1a1a1a] relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-6 border-b border-[#1a1a1a]/50">
                <h1 className="text-2xl font-black text-white tracking-tight">Chats</h1>
                <div className="flex gap-3">
                    <button
                        onClick={onLogout}
                        className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4 text-gray-400" />
                    </button>
                    <div
                        onClick={() => setShowProfileModal(true)}
                        className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px] cursor-pointer hover:scale-105 transition-transform"
                        title="Profile"
                    >
                        <img src={currentUser?.avatar || getAvatarStyle(currentUser?.username)} className="w-full h-full rounded-full bg-black object-cover" />
                    </div>
                    <button
                        onClick={() => setShowGroupModal(true)}
                        className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                        title="New Group"
                    >
                        <Plus className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-6 py-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full bg-[#161616] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Custom Tab Navigation */}
            <div className="flex mx-6 bg-[#161616] p-1 rounded-xl mb-4">
                <button
                    onClick={() => setActiveTab('chats')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'chats' ? 'bg-[#262626] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>CHATS</span>
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'requests' ? 'bg-[#262626] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="relative flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>REQUESTS</span>
                        {requestList.length > 0 && (
                            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0 rounded-full">{requestList.length}</span>
                        )}
                    </div>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {searchTerm ? (
                    /* Search Results */
                    <div className="space-y-2">
                        {searchResults.map((user) => {
                            // Check status
                            const isFriend = friendList.some(f => f.username === user.username);
                            const isRequested = requestedUsers.has(user.username); // Visual check

                            return (
                                <div
                                    key={user.username}
                                    className="flex items-center gap-3 p-3 rounded-2xl bg-[#111] border border-[#1a1a1a]"
                                >
                                    <img src={user.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${user.username}`} className="w-10 h-10 rounded-full bg-[#262626]" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold text-sm truncate">{user.name || user.username}</h3>
                                        <span className="text-gray-500 text-xs truncate">@{user.username}</span>
                                    </div>
                                    {isFriend ? (
                                        <button onClick={() => { setSearchTerm(""); onSelectUser(user); }} className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-blue-500/20">Chat</button>
                                    ) : (
                                        isRequested ? (
                                            <button disabled className="bg-[#222] text-gray-500 px-3 py-1.5 rounded-full text-xs font-bold cursor-default">Sent</button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    setRequestedUsers(prev => new Set(prev).add(user.username));
                                                    await fetch(`${API_URL}/send_request`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ from: currentUser.username, to: user.username })
                                                    });
                                                }}
                                                className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-200"
                                            >
                                                Add
                                            </button>
                                        )
                                    )}
                                </div>
                            )
                        })}
                        {searchResults.length === 0 && <p className="text-gray-600 text-center text-xs mt-8">No users found.</p>}
                    </div>
                ) : (
                    /* Main Lists */
                    <div className="space-y-1">
                        {activeTab === 'requests' ? (
                            <div className="space-y-2 animate-in fade-in duration-300">
                                {requestList.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                        <UserCheck className="w-12 h-12 text-gray-500 mb-2" />
                                        <p className="text-gray-500 text-sm">No pending requests</p>
                                    </div>
                                )}
                                {requestList.map((user) => (
                                    <div
                                        key={user.username}
                                        onClick={() => onSelectUser({ ...user, isRequest: true })}
                                        className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer bg-[#161616] hover:bg-[#222] transition-colors border border-blue-500/10"
                                    >
                                        <div className="relative">
                                            <img src={user.avatar} className="w-12 h-12 rounded-full bg-[#262626] object-cover" />
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#161616]"></div>
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-sm">{user.name || user.username}</h3>
                                            <span className="text-blue-400 text-xs font-medium">Wants to connect</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1 animate-in fade-in duration-300">
                                {/* Groups Section */}
                                {groupList.length > 0 && <p className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">Groups ({groupList.length})</p>}
                                {groupList.map((group) => (
                                    <div
                                        key={group.id}
                                        onClick={() => onSelectUser(group)}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedUser?.id === group.id ? 'bg-[#222] border-l-2 border-blue-500' : 'hover:bg-[#161616] border-l-2 border-transparent'}`}
                                    >
                                        <div className="relative shrink-0">
                                            <img src={group.avatar} className="w-11 h-11 rounded-full bg-[#262626] object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-bold text-sm truncate">{group.name}</h3>
                                            <span className="text-gray-500 text-xs">{group.members.length} members</span>
                                        </div>
                                    </div>
                                ))}

                                {/* Friends Section */}
                                {friendList.length > 0 && <p className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4">Direct Messages</p>}
                                {friendList.map((user) => {
                                    const isSelected = selectedUser?.username === user.username;
                                    return (
                                        <div
                                            key={user.username}
                                            onClick={() => onSelectUser(user)}
                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-[#222]' : 'hover:bg-[#161616]'}`}
                                        >
                                            <div className="relative shrink-0">
                                                <img src={user.avatar} className="w-11 h-11 rounded-full bg-[#262626] object-cover" />
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full"></div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-blue-400' : 'text-white'}`}>{user.name || user.username}</h3>
                                                </div>
                                                <p className="text-gray-500 text-xs truncate">Tap to chat</p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {friendList.length === 0 && groupList.length === 0 && (
                                    <div className="text-center py-12 px-4">
                                        <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search className="w-6 h-6 text-gray-600" />
                                        </div>
                                        <h3 className="text-white font-bold text-sm mb-1">No chats yet</h3>
                                        <p className="text-gray-500 text-xs">Search for your friends to start chatting!</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Profile Modal */}
            {
                showProfileModal && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-[#1a1a1a] w-full max-w-sm rounded-3xl p-6 border border-[#333] shadow-2xl relative animate-in zoom-in-95 duration-200">
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="absolute top-4 right-4 p-2 bg-[#333] rounded-full hover:bg-[#444] text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex flex-col items-center">
                                <div className="relative mb-4 group cursor-pointer">
                                    <img src={currentUser?.avatar} className="w-24 h-24 rounded-full border-4 border-[#121212] group-hover:borderColor-blue-500 transition-colors" />
                                    <div className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full border-4 border-[#1a1a1a]">
                                        <Camera className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-white mb-0">{currentUser?.name || currentUser?.username}</h2>
                                <p className="text-blue-400 font-medium text-sm">@{currentUser?.username}</p>
                                <div className="bg-[#262626] px-3 py-1 rounded-full mt-3 mb-6 border border-[#333]">
                                    <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">ID: {currentUser?.uniqueId || '---'}</p>
                                </div>

                                <p className="text-gray-500 text-xs mb-3 font-bold uppercase tracking-wider">Select New Avatar</p>

                                <div className="grid grid-cols-5 gap-3 w-full mb-2">
                                    {AVATAR_SEEDS.map((seed) => {
                                        const url = getAvatarStyle(seed);
                                        return (
                                            <div
                                                key={seed}
                                                onClick={() => {
                                                    const newUser = { ...currentUser, avatar: url };
                                                    localStorage.setItem("nova_user", JSON.stringify(newUser));
                                                    window.location.reload();
                                                }}
                                                className="aspect-square rounded-full border-2 border-transparent hover:border-blue-500 cursor-pointer overflow-hidden bg-black transition-all hover:scale-110"
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

            {/* Create Group Modal */}
            {showGroupModal && (
                <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#121212] w-full max-w-sm h-full max-h-[500px] rounded-3xl flex flex-col border border-[#333] shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[#262626] flex justify-between items-center bg-[#1a1a1a]">
                            <h2 className="text-lg font-bold text-white">New Group</h2>
                            <button onClick={() => setShowGroupModal(false)} className="p-2 bg-[#262626] rounded-full hover:bg-[#333] text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Group Name</label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="e.g., The Avengers"
                                    className="w-full bg-[#1a1a1a] rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 border border-transparent transition-all font-medium text-sm"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Add Friends</label>
                                    <span className="text-[10px] font-bold text-blue-500">{selectedGroupMembers.length} Selected</span>
                                </div>
                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                    {friendList.length === 0 && (
                                        <div className="text-center py-8 border-2 border-dashed border-[#262626] rounded-xl">
                                            <p className="text-gray-500 text-xs">Add friends first to create a group.</p>
                                        </div>
                                    )}
                                    {friendList.map(friend => {
                                        const isSelected = selectedGroupMembers.includes(friend.username);
                                        return (
                                            <div
                                                key={friend.username}
                                                onClick={() => toggleGroupMember(friend.username)}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-blue-900/10 border-blue-500/50' : 'bg-[#1a1a1a] border-[#262626] hover:bg-[#222]'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img src={friend.avatar} className="w-8 h-8 rounded-full bg-[#333]" />
                                                    <span className={`font-bold text-sm ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>{friend.name || friend.username}</span>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[#262626] bg-[#1a1a1a]">
                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg shadow-blue-900/20 text-sm"
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
}

export default Sidebar;
