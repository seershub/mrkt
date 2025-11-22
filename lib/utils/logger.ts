import { create } from 'zustand';

export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    data?: any;
}

interface LoggerState {
    logs: LogEntry[];
    addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
    clearLogs: () => void;
}

export const useLogger = create<LoggerState>((set) => ({
    logs: [],
    addLog: (entry) =>
        set((state) => ({
            logs: [
                {
                    ...entry,
                    id: Math.random().toString(36).substring(7),
                    timestamp: Date.now(),
                },
                ...state.logs,
            ].slice(0, 100), // Keep last 100 logs
        })),
    clearLogs: () => set({ logs: [] }),
}));

export const logger = {
    info: (message: string, data?: any) => {
        console.log(`[INFO] ${message}`, data || '');
        useLogger.getState().addLog({ level: 'info', message, data });
    },
    warn: (message: string, data?: any) => {
        console.warn(`[WARN] ${message}`, data || '');
        useLogger.getState().addLog({ level: 'warn', message, data });
    },
    error: (message: string, data?: any) => {
        console.error(`[ERROR] ${message}`, data || '');
        useLogger.getState().addLog({ level: 'error', message, data });
    },
    success: (message: string, data?: any) => {
        console.log(`[SUCCESS] ${message}`, data || '');
        useLogger.getState().addLog({ level: 'success', message, data });
    },
};
