import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, ArrowRight } from 'lucide-react';
import novaLogo from '/nova_logo_v3.jpg'; // Assuming I'll move the logo there
import { API_URL } from '../config';

const avatars = [
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Zack',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Molly',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Bear',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Leo',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Simba',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Nala',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Willow',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Jack',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Lola',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Max',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Sasha',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Sam',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=Nova',
];

// ... inside JoinScreen component ...



function JoinScreen({ onJoin }) {
    const [username, setUsername] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (username && !isLoading) {
            setIsLoading(true);
            setError("");

            // Register with backend
            try {
                const res = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, avatar: selectedAvatar })
                });

                if (!res.ok) throw new Error("Failed to connect to server");

                const user = await res.json();
                onJoin(user);
            } catch (err) {
                console.error("Registration failed", err);
                setError("Unable to connect to chat server. Retrying...");
                // Fallback for demo if server is dead (optional, but good for UX testing)
                // onJoin({ username, avatar: selectedAvatar }); 
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-full bg-black p-4 font-sans text-white relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md border border-[#262626] bg-[#000000] p-8 rounded-2xl relative z-10 flex flex-col items-center shadow-2xl"
            >
                <img src={novaLogo} alt="Nova Chat" className="w-24 h-24 rounded-2xl mb-6 shadow-lg shadow-purple-500/20" />
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-2">Welcome to Nova</h1>
                <p className="text-gray-400 text-sm mb-8">Create your identity to start chatting</p>

                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">

                    {/* Avatar Selection */}
                    <p className="text-center text-xs text-gray-500 mb-1">Select your avatar</p>
                    <div className="grid grid-cols-5 gap-3 mb-4 max-h-[160px] overflow-y-auto p-2 scrollbar-hide">
                        {avatars.map((av, i) => (
                            <img
                                key={i}
                                src={av}
                                onClick={() => setSelectedAvatar(av)}
                                className={`w-12 h-12 rounded-full cursor-pointer transition-all border-2 ${selectedAvatar === av ? 'border-purple-500 scale-110 shadow-lg shadow-purple-500/50' : 'border-[#262626] grayscale hover:grayscale-0 hover:scale-105'}`}
                            />
                        ))}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-gray-500 tracking-wider">Username</label>
                        <input
                            type="text"
                            placeholder="e.g. AstroBoy"
                            className="w-full bg-[#121212] border border-[#262626] rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-colors"
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white font-bold py-3 rounded-xl mt-2 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                        onClick={handleSubmit}
                        disabled={!username || isLoading}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>Start Chatting <ArrowRight className="w-4 h-4" /></>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}

export default JoinScreen;
