import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';

const Toast = forwardRef((props, ref) => {
    const [toasts, setToasts] = useState([]);

    useImperativeHandle(ref, () => ({
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        info: (msg) => addToast(msg, 'info')
    }));

    const addToast = (msg, type) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => removeToast(id), 3000);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="pointer-events-auto min-w-[300px] bg-[#1a1a1a] border border-[#333] p-4 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md"
                    >
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}

                        <p className="text-sm font-bold text-white flex-1">{toast.msg}</p>

                        <button onClick={() => removeToast(toast.id)}>
                            <X className="w-4 h-4 text-gray-500 hover:text-white" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
});

Toast.displayName = "Toast";
export default Toast;
