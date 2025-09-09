import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ADMIN_EMAIL } from '../config';

const Leaderboard = ({ isAdmin }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [editingUserId, setEditingUserId] = useState(null);
    const [newScore, setNewScore] = useState('');

    useEffect(() => {
        const usersQuery = query(collection(db, 'users'));
        const leaderboardQuery = query(collection(db, 'leaderboard'));

        const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
            const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const allPlayers = allUsers.filter(user => user.email !== ADMIN_EMAIL);

            const unsubLeaderboard = onSnapshot(leaderboardQuery, (leaderboardSnapshot) => {
                const winners = leaderboardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const winnersMap = new Map(winners.map(w => [w.id, w.totalWins]));
                let fullLeaderboard = allPlayers.map(user => ({
                    id: user.id,
                    displayName: user.displayName,
                    totalWins: winnersMap.get(user.id) || 0
                }));

                fullLeaderboard.sort((a, b) => b.totalWins - a.totalWins);

                let rank = 0;
                let lastScore = -1;
                fullLeaderboard = fullLeaderboard.map((user, index) => {
                    if (user.totalWins !== lastScore) {
                        rank = index + 1;
                        lastScore = user.totalWins;
                    }
                    return { ...user, rank };
                });

                setLeaderboardData(fullLeaderboard);
                setLoading(false);
            });
            return unsubLeaderboard;
        });
        return () => unsubUsers();
    }, []);

    const handleEdit = (user) => { /* ... (sin cambios) */ };
    const handleCancel = () => { /* ... (sin cambios) */ };
    const handleSave = async (user) => { /* ... (sin cambios) */ };
    
    if (loading) {
        return <div className="text-center text-slate-400 py-10">Cargando el Leaderboard...</div>;
    }
    
    const maxRank = leaderboardData.length > 0 ? Math.max(...leaderboardData.map(u => u.rank)) : 0;

    return (
        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 text-center">🏆 Salón de la Fama 🏆</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full w-full max-w-2xl mx-auto">
                    <thead className="bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Jugador</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Victorias</th>
                            {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800">
                        {leaderboardData.map((user) => {
                            let rowClass = 'hover:bg-slate-700/30';
                            if (user.rank === 1 && user.totalWins > 0) {
                                rowClass = 'bg-green-500/10 hover:bg-green-500/20';
                            } else if (user.rank === maxRank && user.rank > 1) {
                                rowClass = 'bg-red-500/10 hover:bg-red-500/20';
                            }

                            return (
                                <tr key={user.id} className={`border-b border-slate-700/50 ${rowClass}`}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        {/* ***** CÍRCULO VERDE PARA EL RANK #1 ***** */}
                                        {user.rank === 1 && user.totalWins > 0 ? (
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white font-bold text-xs">
                                                {user.rank}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 w-6 text-center block">
                                                {user.rank}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{user.displayName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-bold">
                                        {editingUserId === user.id ? (
                                            <input type="number" value={newScore} onChange={(e) => setNewScore(e.target.value)} className="w-16 text-center form-input py-1" />
                                        ) : (
                                            user.totalWins
                                        )}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {editingUserId === user.id ? (
                                                <div className="flex space-x-4">
                                                    <button onClick={() => handleSave(user)} className="text-green-400 hover:text-green-300 font-semibold">Guardar</button>
                                                    <button onClick={handleCancel} className="text-slate-400 hover:text-slate-300">Cancelar</button>
                                                </div>
                                            ) : (
                                                <div className="flex space-x-4 items-center">
                                                    <button onClick={() => handleEdit(user)} className="text-blue-400 hover:text-blue-300 font-semibold">Editar</button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Leaderboard;