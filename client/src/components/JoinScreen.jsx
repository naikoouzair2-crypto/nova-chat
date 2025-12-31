import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import novaLogo from '/nova_logo_v3.jpg';

// Premium 3D Avatars with Backgrounds
const avatars = [
    'https://api.dicebear.com/9.x/notionists/svg?seed=Felix&backgroundColor=ffdfbf,c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Aneka&backgroundColor=b6e3f4,ffdfbf',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Zack&backgroundColor=c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Molly&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Leo&backgroundColor=b6e3f4,ffdfbf',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Simba&backgroundColor=c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Nala&backgroundColor=ffdfbf,c0aede',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Willow&backgroundColor=b6e3f4,ffdfbf',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Jack&backgroundColor=c0aede,b6e3f4',
    'https://api.dicebear.com/9.x/notionists/svg?seed=Lola&backgroundColor=ffdfbf,c0aede',
];

function JoinScreen({ onJoin }) {
    const [username, setUsername] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);

    const handleJoin = () => {
        if (username.trim()) {
            onJoin({ username, avatar: selectedAvatar });
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] w-full bg-black relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-900/40 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-900/40 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-sm px-6 relative z-10 flex flex-col items-center"
            >
                {/* Logo & Title */}
                <div className="flex flex-col items-center mb-8">
                    <img
                        src={novaLogo}
                        alt="Nova Chat"
                        className="w-20 h-20 mb-4 object-contain drop-shadow-2xl"
                        style={{ filter: "drop-shadow(0 0 15px rgba(59, 130, 246, 0.5))" }}
                    />
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 tracking-tight">
                        Nova Chat
                    </h1>
                    <p className="text-gray-400 text-sm mt-2 font-medium">Join the frequency.</p>
                </div>

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

                {/* Input & Button */}
                <div className="w-full space-y-4">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
                        <input
                            type="text"
                            placeholder="Type your username..."
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="relative w-full bg-[#121212] border border-[#262626] text-white text-center text-lg font-semibold placeholder-gray-600 rounded-xl py-4 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <button
                        onClick={handleJoin}
                        disabled={!username.trim()}
                        className="w-full bg-white text-black font-extrabold text-lg py-4 rounded-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    >
                        <span>Enter Nova</span>
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </motion.div>

            {/* Footer */}
            <div className="absolute bottom-6 text-gray-600 text-[10px] tracking-widest uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Next Gen Messaging</span>
            </div>
        </div>
    );
}

export default JoinScreen;
