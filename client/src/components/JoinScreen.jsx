import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, User, Lock, AtSign, Loader2, FileText, X } from 'lucide-react';

const avatars = [
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Felix&backgroundColor=b6e3f4,c0aede,ffdfbf',
    // ... (keep middle avatars same, they are unchanged in this file usually) ...
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

    // Terms & Conditions
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [showTerms, setShowTerms] = useState(false);

    const handleNext = async () => {
        if (!username.trim() || !password.trim()) {
            setError("Please fill in all fields.");
            return;
        }

        if (mode === 'register' && !name.trim()) {
            setError("Please fill in display name.");
            return;
        }

        if (mode === 'register' && !agreeTerms) {
            setError("You must agree to the Terms & Conditions.");
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
            let msg = e.message || "Connection failed. Please try again.";
            if (msg.includes("auth/email-already-in-use")) msg = "Username is already taken. Try another.";
            if (msg.includes("auth/weak-password")) msg = "Password should be at least 6 characters.";
            if (msg.includes("auth/network-request-failed")) msg = "Network error. Check your connection.";

            setError(msg);
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

                            {mode === 'register' && (
                                <div className="flex items-center gap-3 pt-2 px-1">
                                    <div
                                        onClick={() => setAgreeTerms(!agreeTerms)}
                                        className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center transition-colors ${agreeTerms ? 'bg-blue-600 border-blue-600' : 'border-gray-500 bg-[#111]'}`}
                                    >
                                        {agreeTerms && <ArrowRight className="w-3 h-3 text-white rotate-[-45deg] mt-[-2px]" />}
                                    </div>
                                    <label className="text-xs text-gray-400 select-none">
                                        I agree to the <span onClick={() => setShowTerms(true)} className="text-blue-400 hover:underline cursor-pointer">Terms & Conditions</span>
                                    </label>
                                </div>
                            )}

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

                            <div className="grid grid-cols-4 gap-3 w-full mb-8 max-h-[300px] overflow-y-auto pr-2">
                                {avatars.map((url, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedAvatar(url)}
                                        className={`aspect-square rounded-full cursor-pointer p-0.5 transition-all ${selectedAvatar === url ? 'ring-2 ring-blue-500 scale-110 shadow-lg shadow-blue-500/30' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                                    >
                                        <img src={url} className="w-full h-full rounded-full bg-[#1a1a1a] object-cover" />
                                    </div>
                                ))}
                            </div>

                            {error && <p className="text-red-500 text-center text-xs font-bold py-2 bg-red-500/10 rounded-lg mb-4">{error}</p>}

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

            {/* Terms Modal */}
            <AnimatePresence>
                {showTerms && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTerms(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#1a1a1a] border border-[#333] w-full max-w-md rounded-2xl relative flex flex-col max-h-[80vh] shadow-2xl"
                        >
                            <div className="p-4 border-b border-[#333] flex items-center justify-between sticky top-0 bg-[#1a1a1a] rounded-t-2xl z-10">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400" /> Terms & Conditions</h2>
                                <button onClick={() => setShowTerms(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar text-gray-300 text-sm space-y-4">
                                <p className="opacity-80">Last Updated: January 2026</p>
                                <p>Welcome to Nova Chat. By accessing or using our app, you agree to be bound by these terms.</p>

                                <h4 className="text-white font-bold">1. User Conduct</h4>
                                <p>You agree not to use the app to harass, abuse, or harm other users. Hate speech, violence, and illegal content are strictly prohibited and will result in account suspension.</p>

                                <h4 className="text-white font-bold">2. Privacy</h4>
                                <p>We respect your privacy. Messages are encrypted in transit. We do not sell your personal data to third parties.</p>

                                <h4 className="text-white font-bold">3. Account Security</h4>
                                <p>You are responsible for maintaining the confidentiality of your account credentials.</p>

                                <h4 className="text-white font-bold">4. Termination</h4>
                                <p>We reserve the right to terminate accounts that violate these terms without prior notice.</p>

                                <p className="text-xs text-gray-500 mt-4">For any questions, contact support@nova.chat</p>
                            </div>
                            <div className="p-4 border-t border-[#333] bg-[#1a1a1a] rounded-b-2xl">
                                <button onClick={() => { setAgreeTerms(true); setShowTerms(false); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors">
                                    I Agree
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default JoinScreen;
