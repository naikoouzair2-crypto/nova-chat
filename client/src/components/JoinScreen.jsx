import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, User, Lock, AtSign, Loader2 } from 'lucide-react';

const avatars = [
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Felix&backgroundColor=b6e3f4,c0aede,ffdfbf',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Zack&backgroundColor=c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Molly&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Leo&backgroundColor=b6e3f4,ffdfbf',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Simba&backgroundColor=c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Nala&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Willow&backgroundColor=b6e3f4,ffdfbf',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Jack&backgroundColor=c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Lola&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/bottts/svg?seed=Techie&backgroundColor=transparent',
    'https://api.dicebear.com/9.x/bottts/svg?seed=Cyber&backgroundColor=transparent',
    'https://api.dicebear.com/9.x/bottts/svg?seed=Coder&backgroundColor=transparent',
    'https://api.dicebear.com/9.x/bottts/svg?seed=Gamer&backgroundColor=transparent',
    'https://api.dicebear.com/9.x/bottts/svg?seed=Geek&backgroundColor=transparent',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Happy&backgroundColor=b6e3f4',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Cool&backgroundColor=c0aede',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Cute&backgroundColor=ffdfbf',
    'https://api.dicebear.com/9.x/micah/svg?seed=Artist&backgroundColor=ffdfbf',
    'https://api.dicebear.com/9.x/micah/svg?seed=Designer&backgroundColor=c0aede',
    'https://api.dicebear.com/9.x/micah/svg?seed=Dev&backgroundColor=b6e3f4',
];

function JoinScreen({ onJoin }) {
    const [mode, setMode] = useState('register'); // 'register' | 'login'
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [step, setStep] = useState(1);
    const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
    const [isJoining, setIsJoining] = useState(false);

    const handleNext = async () => {
        if (!username.trim() || !password.trim()) {
            setError("Please fill in all fields.");
            return;
        }

        if (mode === 'register' && !name.trim()) {
            setError("Please fill in display name.");
            return;
        }

        const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
        if (cleanUsername.length < 3) {
            setError("Username too short (min 3 chars).");
            return;
        }

        setError("");
        setUsername(cleanUsername);

        if (mode === 'login') {
            handleJoinInternal(cleanUsername);
        } else {
            setStep(2);
        }
    };

    const handleJoinInternal = async (fastTrackUsername = null) => {
        setIsJoining(true);
        setError(""); // Clear previous errors
        try {
            const finalUsername = (typeof fastTrackUsername === 'string') ? fastTrackUsername : username;

            // Timeout promise to handle "stuck" fetches
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Server timeout. Server might be waking up (can take 60s). Check network.")), 60000));

            const joinPromise = onJoin({
                name: name.trim(),
                username: finalUsername,
                avatar: selectedAvatar,
                password,
                mode
            });

            await Promise.race([joinPromise, timeout]);

        } catch (e) {
            console.error(e);
            setError(e.message || "Connection failed. Please try again.");
            setIsJoining(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[100dvh] w-full bg-[#050505] text-white relative overflow-hidden font-sans">
            {/* Ambient Background */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px] animate-pulse delay-700" />

            <div className="w-full max-w-sm px-6 relative z-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="relative mb-2">
                        <img src="/nova_logo_v3.png" className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Nova Chat</h1>
                    <p className="text-gray-500 text-sm font-medium">Connect beyond limits.</p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 ? (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-4"
                        >
                            {/* Toggle Switch */}
                            <div className="flex bg-[#1a1a1a] p-1 rounded-xl mb-6 border border-[#262626]">
                                <button
                                    onClick={() => setMode('login')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-[#262626] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    LOGIN
                                </button>
                                <button
                                    onClick={() => setMode('register')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'register' ? 'bg-[#262626] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    REGISTER
                                </button>
                            </div>

                            {mode === 'register' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><User className="w-3 h-3" /> Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[#111] text-white border border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-700 text-sm"
                                        placeholder="Your Name"
                                    />
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><AtSign className="w-3 h-3" /> Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-[#111] text-white border border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-700 text-sm"
                                    placeholder="unique_handle"
                                    autoCapitalize="none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Lock className="w-3 h-3" /> Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#111] text-white border border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-700 text-sm"
                                    placeholder="••••••••"
                                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                />
                            </div>

                            {error && <p className="text-red-500 text-center text-xs font-bold py-2 bg-red-500/10 rounded-lg">{error}</p>}

                            <button
                                onClick={handleNext}
                                disabled={isJoining}
                                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 mt-4"
                            >
                                {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? 'Enter Nova' : 'Next Step')}
                                {!isJoining && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col items-center"
                        >
                            <h3 className="text-xl font-bold text-white mb-6">Choose Identity</h3>

                            <div className="grid grid-cols-3 gap-4 w-full mb-8">
                                {avatars.slice(0, 9).map((url, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedAvatar(url)}
                                        className={`aspect-square rounded-full cursor-pointer p-0.5 transition-all ${selectedAvatar === url ? 'ring-2 ring-blue-500 scale-110 shadow-lg shadow-blue-500/30' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                                    >
                                        <img src={url} className="w-full h-full rounded-full bg-[#1a1a1a] object-cover" />
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => handleJoinInternal()}
                                disabled={isJoining}
                                className="w-full bg-white text-black font-extrabold py-3.5 rounded-xl hover:bg-gray-200 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
                            >
                                {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Setup"}
                            </button>

                            <button
                                onClick={() => setStep(1)}
                                className="mt-4 text-xs text-gray-500 hover:text-white"
                            >
                                Back
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="absolute bottom-4 flex flex-col items-center gap-1 pointer-events-none opacity-50">
                <p className="text-[10px] text-gray-600 font-mono tracking-widest">NOVA SECURE SYSTEM v1.1</p>
                <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-blue-900 to-transparent"></div>
            </div>
        </div>
    );
}

export default JoinScreen;
