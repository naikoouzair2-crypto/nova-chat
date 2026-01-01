import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import novaLogo from '/nova_logo_v3.jpg';

// Premium 3D Avatars (Colorful 'Adventurer' Style)
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
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&backgroundColor=b6e3f4,ffdfbf',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Bella&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Max&backgroundColor=c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Lucy&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=Charlie&backgroundColor=b6e3f4,ffdfbf',
];


function JoinScreen({ onJoin }) {
    const [mode, setMode] = useState('register'); // 'register' | 'login'
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(""); // For validation feedback
    const [step, setStep] = useState(1);
    const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);

    const [isJoining, setIsJoining] = useState(false);

    const handleNext = async () => {
        if (!username.trim() || !password.trim()) {
            setError("Please fill in username and password.");
            return;
        }

        if (mode === 'register' && !name.trim()) {
            setError("Please fill in display name.");
            return;
        }

        // Normalize username: remove spaces, lowercase
        const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
        if (cleanUsername.length < 3) {
            setError("Username must be at least 3 characters.");
            return;
        }

        setError("");
        setUsername(cleanUsername); // Update state to clean version

        if (mode === 'login') {
            // Skip avatar step for login
            handleJoin(cleanUsername);
        } else {
            setStep(2);
        }
    };

    const handleJoin = async (finalUsername) => {
        setIsJoining(true); // Show loader
        // Simulate delay
        await new Promise(r => setTimeout(r, 800));

        // Pass all data including password and mode
        onJoin({
            name: name.trim(),
            username: finalUsername || username,
            avatar: selectedAvatar,
            password,
            mode
        });

        // Loader stays until parent handles it or unmounts
        // Usually parent will set error if failed, so we might need a way to reset isJoining there?
        // simple hack: set timeout to turn off loader if it takes too long (error case)
        setTimeout(() => setIsJoining(false), 5000);
    };

    return (
        <div className="flex items-center justify-center min-h-[100dvh] w-full bg-black p-4 font-sans text-white relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md border border-[#262626] bg-[#000000] p-8 rounded-2xl relative z-10 flex flex-col items-center shadow-2xl"
            >
                <div className="flex flex-col items-center mb-8">
                    <img
                        src="/nova_logo_transparent.png"
                        alt="Nova Chat"
                        className="w-32 h-32 mb-4 object-contain"
                        style={{ filter: "drop-shadow(0 0 20px rgba(59, 130, 246, 0.4))" }}
                    />
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 tracking-tight">
                        Nova Chat
                    </h1>
                    <p className="text-gray-400 text-sm mt-2 font-medium">Create your unique identity.</p>
                </div>

                {step === 1 ? (
                    <motion.div
                        className="w-full space-y-4"
                        initial={{ x: 0 }}
                        exit={{ x: -50, opacity: 0 }}
                    >
                        <div className="space-y-4">
                            {mode === 'register' && (
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider ml-1">Display Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors mt-1"
                                        placeholder="e.g. Neo Anderson"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider ml-1">Username (Unique ID)</label>
                                <input
                                    type="text"
                                    className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors mt-1"
                                    placeholder="e.g. neo_01"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                />
                                <p className="text-[10px] text-gray-500 mt-1 ml-1">This will be your unique handle.</p>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider ml-1">Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors mt-1"
                                    placeholder="Secret Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                />
                            </div>

                            {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
                        </div>

                        <button
                            onClick={handleNext}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
                        >
                            Next <ArrowRight className="w-4 h-4" />
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        className="w-full"
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                    >
                        {/* Avatar Carousel */}
                        <div className="w-full mb-8">
                            <p className="text-xs text-center text-gray-500 mb-3 uppercase tracking-widest font-bold">Choose Avatar</p>
                            <div className="flex overflow-x-auto gap-4 py-4 px-2 no-scrollbar snap-x justify-center">
                                {avatars.map((url, i) => (
                                    <motion.div
                                        key={i}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setSelectedAvatar(url)}
                                        className={`relative shrink-0 w-20 h-20 rounded-full p-1 cursor-pointer transition-all duration-300 ${selectedAvatar === url
                                            ? 'bg-gradient-to-tr from-blue-500 to-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-110'
                                            : 'bg-transparent grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
                                            }`}
                                    >
                                        <img
                                            src={url}
                                            className="w-full h-full rounded-full bg-zinc-900 object-cover border-2 border-black"
                                            alt="Avatar"
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleJoin}
                            disabled={isJoining}
                            className="w-full bg-white text-black font-extrabold text-lg py-4 rounded-xl hover:bg-gray-100 disabled:opacity-70 disabled:cursor-wait transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] relative"
                        >
                            {isJoining ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    <span>Entering...</span>
                                </>
                            ) : (
                                <>
                                    <span>{mode === 'register' ? 'Join Nova' : 'Login'}</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                setMode(mode === 'register' ? 'login' : 'register');
                                setError("");
                            }}
                            className="w-full mt-4 text-sm text-gray-500 hover:text-white transition-colors underline"
                        >
                            {mode === 'register' ? "Already have an account? Login" : "New to Nova? Create Account"}
                        </button>
                    </motion.div>
                )}
            </motion.div>

            {/* Footer */}
            <div className="absolute bottom-6 flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 text-gray-600 text-[10px] tracking-widest uppercase">
                    <Sparkles className="w-3 h-3" />
                    <span>Next Gen Messaging</span>
                </div>
                <p className="text-gray-500 text-xs mt-8 font-medium">Developed by Uzair Farooq Naikoo • v1.6</p>
            </div>
        </div>
    );
}

export default JoinScreen;
