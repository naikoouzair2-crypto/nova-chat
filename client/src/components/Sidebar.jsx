import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Users, MessageSquare, MessageCircle, LogOut, Trash2, Loader, UserCheck } from 'lucide-react';
import Toast from './UiToast';

import { API_URL } from '../config';

// 3D Avatar styles matched from JoinScreen (Colorful)
const getAvatarStyle = (seed) => `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,ffdfbf`;

// Pre-defined seeds for avatar picker
const AVATAR_SEEDS = ['Felix', 'Aneka', 'Zack', 'Molly', 'Leo', 'Simba', 'Nala', 'Willow', 'Jack', 'Lola'];

function Sidebar({ currentUser, onSelectUser, selectedUser, onLogout }) {
    const [activeTab, setActiveTab] = useState('chats');
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [friendList, setFriendList] = useState([]);
    const [requestList, setRequestList] = useState([]);
    const [groupList, setGroupList] = useState([]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // New
    const [isRefreshing, setIsRefreshing] = useState(false); // Pull to refresh state

    // Group Creation State
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Toast
    const toastRef = useRef(null);

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

    // Search Logic
    useEffect(() => {
        // If we are in 'chats' or 'requests', search is local filter.
        // If we are in 'add', search is global API call.

        if (activeTab === 'add') {
            const delayDebounceFn = setTimeout(async () => {
                if (searchTerm && searchTerm.length >= 2) {
                    setIsSearching(true);
                    try {
                        const res = await fetch(`${API_URL}/search?q=${searchTerm}`);
                        const data = await res.json();
                        setSearchResults(data.filter(u => u.username !== currentUser.username));
                    } catch (err) { console.error(err); }
                    setIsSearching(false);
                } else {
                    setSearchResults([]);
                    setIsSearching(false);
                }
            }, 500); // 500ms debounce
            return () => clearTimeout(delayDebounceFn);
        } else {
            // Local filter logic handled in render
            setIsSearching(false);
        }
    }, [searchTerm, activeTab, currentUser]);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return toastRef.current.error("Please enter a group name");
        if (selectedGroupMembers.length === 0) return toastRef.current.error("Please select at least one friend");

        await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newGroupName, members: selectedGroupMembers, admin: currentUser.username })
        });

        setShowGroupModal(false);
        setNewGroupName("");
        setSelectedGroupMembers([]);
        setActiveTab('chats');
        toastRef.current.success("Group created!");

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

    const handleAvatarChange = (url) => {
        const newUser = { ...currentUser, avatar: url };
        localStorage.setItem("nova_user", JSON.stringify(newUser));
        toastRef.current.success("Avatar updated! Restarting...");
        // Delay reload slightly to show toast
        setTimeout(() => window.location.reload(), 1500);
    };

    return (
        <div className="w-full md:w-[380px] flex flex-col bg-black h-full border-r border-[#1a1a1a] relative">
            <Toast ref={toastRef} />
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
                    {isSearching && (
                        <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                </div>
            </div>

            {/* Custom Tab Navigation */}
            {/* Custom Tab Navigation */}
            <div className="flex mx-6 bg-[#161616] p-1 rounded-xl mb-4 text-[10px] font-bold tracking-wide relative">
                {['chats', 'requests', 'add'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setSearchTerm(""); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all relative z-10 ${activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {activeTab === tab && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-[#262626] rounded-lg shadow-sm -z-10"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                        {tab === 'chats' && <MessageCircle className="w-3.5 h-3.5" />}
                        {tab === 'requests' && <UserCheck className="w-3.5 h-3.5" />}
                        {tab === 'add' && <UserPlus className="w-3.5 h-3.5" />}

                        <span className="uppercase">{tab === 'requests' ? 'REQS' : tab}</span>

                        {tab === 'requests' && requestList.length > 0 && (
                            <span className="ml-1 bg-red-500 text-white text-[9px] px-1 py-0 rounded-full min-w-[14px] flex justify-center shadow-sm">{requestList.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-24">
                {activeTab === 'add' ? (
                    /* Add / Global Search Tab */
                    <div className="space-y-2">
                        {searchTerm.length < 2 && (
                            <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                <Search className="w-12 h-12 text-gray-500 mb-2" />
                                <p className="text-gray-500 text-sm">Type name to search global users</p>
                            </div>
                        )}

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
                                        <button onClick={() => { setSearchTerm(""); setActiveTab('chats'); onSelectUser(user); }} className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-blue-500/20">Chat</button>
                                    ) : (
                                        isRequested ? (
                                            <button disabled className="bg-[#222] text-gray-500 px-3 py-1.5 rounded-full text-xs font-bold cursor-default">Sent</button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    setRequestedUsers(prev => new Set(prev).add(user.username));
                                                    toastRef.current.info("Request sent");
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
                        {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                            <p className="text-gray-600 text-center text-xs mt-8">No users found.</p>
                        )}
                    </div>
                ) : (
                    /* Main Lists (Chats & Requests) */
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
                                {/* Chats Tab */}

                                {/* Filtered Lists Logic */}
                                {(() => {
                                    const filteredFriends = friendList.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()) || (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())));
                                    const filteredGroups = groupList.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

                                    const isEmpty = filteredFriends.length === 0 && filteredGroups.length === 0;

                                    if (isRefreshing) {
                                        return <div className="flex justify-center p-4"><Loader className="w-6 h-6 text-blue-500 animate-spin" /></div>;
                                    }

                                    if (isEmpty && searchTerm) {
                                        return <p className="text-gray-600 text-center text-xs mt-8">No chats found.</p>;
                                    }

                                    return (
                                        <div
                                            ref={listRef}
                                            className="h-full overflow-y-auto"
                                            onTouchStart={handlePullTouchStart}
                                            onTouchMove={handlePullTouchMove}
                                        >
                                            {/* Groups Section */}
                                            {filteredGroups.length > 0 && <p className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">Groups ({filteredGroups.length})</p>}
                                            {filteredGroups.map((group) => (
                                                <div
                                                    key={group.id}
                                                    onClick={() => onSelectUser(group)}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setDeleteTarget({ ...group, isGroup: true });
                                                    }}
                                                    onTouchStart={(e) => {
                                                        const timer = setTimeout(() => {
                                                            setDeleteTarget({ ...group, isGroup: true });
                                                        }, 800);
                                                        e.target.dataset.longPressTimer = timer;
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        clearTimeout(e.target.dataset.longPressTimer);
                                                    }}
                                                    onTouchMove={(e) => {
                                                        clearTimeout(e.target.dataset.longPressTimer);
                                                    }}
                                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all select-none ${selectedUser?.id === group.id ? 'bg-[#222] border-l-2 border-blue-500' : 'hover:bg-[#161616] border-l-2 border-transparent'}`}
                                                >
                                                    <div className="relative shrink-0 pointer-events-none">
                                                        <img src={group.avatar} className="w-11 h-11 rounded-full bg-[#262626] object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 pointer-events-none">
                                                        <h3 className="text-white font-bold text-sm truncate">{group.name}</h3>
                                                        <span className="text-gray-500 text-xs">{group.members.length} members</span>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Friends Section */}
                                            {filteredFriends.length > 0 && <p className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 mt-4">Direct Messages</p>}
                                            {filteredFriends.map((user) => {
                                                const isSelected = selectedUser?.username === user.username;
                                                return (
                                                    <div
                                                        key={user.username}
                                                        onClick={() => onSelectUser(user)}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            setDeleteTarget(user);
                                                        }}
                                                        onTouchStart={(e) => {
                                                            const timer = setTimeout(() => {
                                                                setDeleteTarget(user);
                                                            }, 800);
                                                            e.currentTarget.dataset.longPressTimer = timer;
                                                        }}
                                                        onTouchEnd={(e) => {
                                                            clearTimeout(e.currentTarget.dataset.longPressTimer);
                                                        }}
                                                        onTouchMove={(e) => {
                                                            clearTimeout(e.currentTarget.dataset.longPressTimer);
                                                        }}
                                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group/item select-none ${isSelected ? 'bg-[#222]' : 'hover:bg-[#161616]'}`}
                                                    >
                                                        <div className="relative shrink-0 pointer-events-none">
                                                            <img src={user.avatar} className="w-11 h-11 rounded-full bg-[#262626] object-cover" />
                                                            <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-black rounded-full ${user.unreadCount > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                                        </div>
                                                        <div className="flex-1 min-w-0 pointer-events-none">
                                                            <div className="flex justify-between items-center mb-0.5 gap-2">
                                                                <h3 className={`font-bold text-sm truncate flex-1 min-w-0 ${isSelected ? 'text-blue-400' : 'text-white'}`}>{user.name || user.username}</h3>
                                                                {user.unreadCount > 0 && (
                                                                    <span className="shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{user.unreadCount}</span>
                                                                )}
                                                            </div>
                                                            <p className={`text-xs truncate ${user.unreadCount > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                                                                {user.lastMessage ? (
                                                                    <>
                                                                        {user.lastMessage.author === currentUser.username && <span className="text-blue-400">You: </span>}
                                                                        {user.lastMessage.content}
                                                                    </>
                                                                ) : (
                                                                    "Tap to chat"
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {isEmpty && !searchTerm && (
                                                <div className="text-center py-12 px-4">
                                                    <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <MessageCircle className="w-6 h-6 text-gray-600" />
                                                    </div>
                                                    <h3 className="text-white font-bold text-sm mb-1">No chats yet</h3>
                                                    <p className="text-gray-500 text-xs">Switch to the 'ADD' tab to find people!</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
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
                                                onClick={() => handleAvatarChange(url)}
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
                        <div className="p-2 text-center">
                            <p className="text-[10px] text-gray-600">Nova Chat v1.6.1 (Debug)</p>
                            <p className="text-[8px] text-gray-800 break-all">{JSON.stringify({ id: currentUser?.uniqueId, name: currentUser?.name })}</p>
                        </div>
                    </div>
                </div>
            )}



            {/* Delete/action Confirmation Modal (Long Press) */}
            {
                deleteTarget && (
                    <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] w-full max-w-[280px] rounded-2xl p-4 border border-[#333] shadow-2xl scale-100 animate-in zoom-in-95">
                            <h3 className="text-white font-bold text-lg mb-2 text-center">
                                {deleteTarget.isGroup
                                    ? (deleteTarget.admin === currentUser.username ? "Delete Group?" : "Leave Group?")
                                    : "Delete Friend?"}
                            </h3>
                            <p className="text-gray-400 text-xs text-center mb-6">
                                {deleteTarget.isGroup
                                    ? (deleteTarget.admin === currentUser.username
                                        ? "This will delete the group for everyone."
                                        : `Leave "${deleteTarget.name}"?`)
                                    : <>Are you sure you want to remove <span className="text-blue-400 font-bold">{deleteTarget.name || deleteTarget.username}</span>?</>
                                }
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 bg-[#262626] text-white py-2 rounded-lg font-bold text-xs hover:bg-[#333] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (deleteTarget.isGroup) {
                                            if (deleteTarget.admin === currentUser.username) {
                                                // Delete Group
                                                try {
                                                    await fetch(`${API_URL}/groups/${deleteTarget.id}`, {
                                                        method: 'DELETE',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ username: currentUser.username })
                                                    });
                                                    setGroupList(prev => prev.filter(g => g.id !== deleteTarget.id));
                                                    if (selectedUser?.id === deleteTarget.id) onSelectUser(null);
                                                    toastRef.current.success("Group Deleted");
                                                } catch (e) { toastRef.current.error("Failed to delete group"); }
                                            } else {
                                                // Leave Group
                                                try {
                                                    await fetch(`${API_URL}/groups/${deleteTarget.id}/leave`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ username: currentUser.username })
                                                    });
                                                    setGroupList(prev => prev.filter(g => g.id !== deleteTarget.id));
                                                    if (selectedUser?.id === deleteTarget.id) onSelectUser(null);
                                                    toastRef.current.success("Left Group");
                                                } catch (e) { toastRef.current.error("Failed to leave group"); }
                                            }
                                        } else {
                                            // Delete Friend as before
                                            try {
                                                await fetch(`${API_URL}/friends/${deleteTarget.username}`, {
                                                    method: 'DELETE',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ user: currentUser.username })
                                                });
                                                setFriendList(prev => prev.filter(f => f.username !== deleteTarget.username));
                                                if (selectedUser?.username === deleteTarget.username) onSelectUser(null);
                                                toastRef.current.success("Friend Removed");
                                            } catch (e) {
                                                toastRef.current.error("Failed to remove");
                                            }
                                        }
                                        setDeleteTarget(null);
                                    }}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
                                >
                                    {deleteTarget.isGroup
                                        ? (deleteTarget.admin === currentUser.username ? "Delete" : "Leave")
                                        : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}

export default Sidebar;
