import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const AdminPanel = () => {
    const [sqlStatus, setSqlStatus] = useState('UNKNOWN');
    const [docAiStatus, setDocAiStatus] = useState('UNKNOWN');
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);

    // Connect to WebSocket
    useEffect(() => {
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
            path: '/ws'
        });

        socket.on('connect', () => {
            addLog('Connected to WebSocket');
        });

        socket.on('admin:status', (data) => {
            addLog(`[STATUS] ${data.message}`);
            if (data.status) {
                // Refresh status if operation completed
                if (data.status === 'DONE' || data.status === 'ENABLED' || data.status === 'DISABLED') {
                    fetchStatuses();
                }
            }
        });

        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        fetchStatuses();
    }, []);

    const addLog = (msg) => {
        setLogs(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev].slice(0, 50));
    };

    const fetchStatuses = async () => {
        try {
            const sqlRes = await axios.get('/api/admin/sql/status');
            setSqlStatus(sqlRes.data.status);

            const docAiRes = await axios.get('/api/admin/docai/status');
            setDocAiStatus(docAiRes.data.status);
        } catch (err) {
            console.error('Error fetching statuses', err);
            addLog('Error fetching current statuses');
        }
    };

    const handleAction = async (type, action) => {
        setLoading(true);
        try {
            const url = `/api/admin/${type}/${action}`;
            const res = await axios.post(url);
            addLog(`${type.toUpperCase()} ${action} initiated: ${res.data.message}`);
        } catch (err) {
            addLog(`Error: ${err.response?.data?.error || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto mt-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Resource Management</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Cloud SQL Card */}
                <div className="border rounded-xl p-6 bg-gray-50">
                    <h3 className="text-xl font-semibold mb-4 flex items-center justify-between">
                        Cloud SQL
                        <span className={`px-3 py-1 rounded-full text-sm ${sqlStatus === 'RUNNABLE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {sqlStatus}
                        </span>
                    </h3>
                    <div className="flex gap-4">
                        <button
                            onClick={() => handleAction('sql', 'start')}
                            disabled={loading || sqlStatus === 'RUNNABLE'}
                            className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Start Database
                        </button>
                        <button
                            onClick={() => handleAction('sql', 'stop')}
                            disabled={loading || sqlStatus !== 'RUNNABLE'}
                            className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Stop Database
                        </button>
                    </div>
                </div>

                {/* Document AI Card */}
                <div className="border rounded-xl p-6 bg-gray-50">
                    <h3 className="text-xl font-semibold mb-4 flex items-center justify-between">
                        Document AI
                        <span className={`px-3 py-1 rounded-full text-sm ${docAiStatus === 'ENABLED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {docAiStatus}
                        </span>
                    </h3>
                    <div className="flex gap-4">
                        <button
                            onClick={() => handleAction('docai', 'deploy')}
                            disabled={loading || docAiStatus === 'ENABLED'}
                            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Deploy Processor
                        </button>
                        <button
                            onClick={() => handleAction('docai', 'undeploy')}
                            disabled={loading || docAiStatus !== 'ENABLED'}
                            className="flex-1 bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Undeploy Processor
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Console */}
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
                <h4 className="text-gray-400 mb-2 border-b border-gray-700 pb-2">Operation Logs</h4>
                {logs.map((log, i) => (
                    <div key={i} className="text-green-400 mb-1">
                        {log}
                    </div>
                ))}
                {logs.length === 0 && <div className="text-gray-600 italic">No activity yet...</div>}
            </div>
        </div>
    );
};

export default AdminPanel;
