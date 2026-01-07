import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold mb-2">Something went wrong.</h1>
                    <p className="text-gray-400 mb-6">The app encountered a critical error.</p>
                    <div className="bg-[#1a1a1a] p-4 rounded-xl border border-red-900/50 text-left w-full max-w-lg overflow-auto max-h-64 mb-6">
                        <p className="text-red-400 font-mono text-xs whitespace-pre-wrap">
                            {this.state.error && this.state.error.toString()}
                        </p>
                        <p className="text-gray-500 font-mono text-[10px] mt-2 whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-500 transition-colors"
                    >
                        Reload App
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
