'use client';

import { useState, useEffect } from 'react';
import { useLogger } from '@/lib/utils/logger';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Trash2, X } from 'lucide-react';

export function ConsoleLogger() {
    const [isOpen, setIsOpen] = useState(false);
    const logs = useLogger((state) => state.logs);
    const clearLogs = useLogger((state) => state.clearLogs);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div
            className={cn(
                'fixed bottom-4 right-4 z-50 flex flex-col bg-black/90 border border-gray-800 rounded-lg shadow-2xl transition-all duration-300 font-mono text-xs',
                isOpen ? 'w-[600px] h-[400px]' : 'w-auto h-auto'
            )}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between p-2 bg-gray-900 rounded-t-lg cursor-pointer border-b border-gray-800"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-bold text-gray-200">MRKT Debugger</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px]">
                        {logs.length} logs
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {isOpen && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                clearLogs();
                            }}
                            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-red-400"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                    {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                    )}
                </div>
            </div>

            {/* Content */}
            {isOpen && (
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {logs.length === 0 ? (
                        <div className="text-gray-500 italic text-center py-4">
                            No logs yet...
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div
                                key={log.id}
                                className={cn(
                                    'p-1.5 rounded border-l-2 bg-opacity-10 mb-1',
                                    log.level === 'info' && 'border-blue-500 bg-blue-500/10',
                                    log.level === 'warn' && 'border-yellow-500 bg-yellow-500/10',
                                    log.level === 'error' && 'border-red-500 bg-red-500/10',
                                    log.level === 'success' && 'border-green-500 bg-green-500/10'
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span
                                        className={cn(
                                            'font-bold uppercase text-[10px] min-w-[50px]',
                                            log.level === 'info' && 'text-blue-400',
                                            log.level === 'warn' && 'text-yellow-400',
                                            log.level === 'error' && 'text-red-400',
                                            log.level === 'success' && 'text-green-400'
                                        )}
                                    >
                                        {log.level}
                                    </span>
                                    <span className="text-gray-500 text-[10px]">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-gray-300 mt-0.5 break-all">
                                    {log.message}
                                </div>
                                {log.data && (
                                    <pre className="mt-1 p-1 bg-black/50 rounded overflow-x-auto text-gray-400 text-[10px]">
                                        {JSON.stringify(log.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
