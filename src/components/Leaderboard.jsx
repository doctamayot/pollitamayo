import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ADMIN_EMAIL } from '../config';

const Leaderboard = ({ isAdmin, onViewProfile }) => {
    // --- Lógica interna sin cambios ---
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
                    email: user.email,
                    uid: user.id,
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
            return () => unsubLeaderboard();
        });
        return () => unsubUsers();
    }, []);

    const handleEdit = (user) => {
        setEditingUserId(user.id);
        setNewScore(user.totalWins);
    };

    const handleCancel = () => {
        setEditingUserId(null);
        setNewScore('');
    };

    const handleSave = async (user) => {
        const scoreToSave = parseInt(newScore, 10);
        if (isNaN(scoreToSave) || scoreToSave < 0) {
            alert("Por favor, introduce un número válido.");
            return;
        }
        try {
            const leaderboardRef = doc(db, 'leaderboard', user.id);
            await setDoc(leaderboardRef, {
                displayName: user.displayName,
                totalWins: scoreToSave
            }, { merge: true });
        } catch (error) {
            console.error("Error al actualizar el puntaje:", error);
        } finally {
            handleCancel();
        }
    };
    // --- Fin de la lógica interna ---
    
    if (loading) {
        return <div className="text-center text-uefa-text-secondary py-10">Cargando el Salón de la Fama...</div>;
    }
    
    const maxRank = leaderboardData.length > 0 ? Math.max(...leaderboardData.map(u => u.rank)) : 0;

    return (
        // --- ▼▼▼ CÓDIGO DE LA INTERFAZ ACTUALIZADO ▼▼▼ ---
        <div className="bg-uefa-dark-blue-secondary p-4 sm:p-6 rounded-lg border border-uefa-border">
            <h2 className="text-2xl font-bold text-uefa-cyan mb-6 text-center">🏆 Salón de la Fama 🏆</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full w-full max-w-2xl mx-auto">
                    <thead className="bg-uefa-dark-blue-secondary/60">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-uefa-text-secondary uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-uefa-text-secondary uppercase tracking-wider">Jugador</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-uefa-text-secondary uppercase tracking-wider">Victorias</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-uefa-text-secondary uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-uefa-dark-blue-secondary/30">
                        {leaderboardData.map((user) => {
                            let rowClass = 'hover:bg-uefa-dark-blue-secondary/60';
                            if (user.rank === 1 && user.totalWins > 0) {
                                rowClass = 'bg-green-500/20 hover:bg-green-500/30';
                            } else if (user.rank === maxRank && user.rank > 1 && leaderboardData.length > 2) {
                                rowClass = 'bg-red-800/20 hover:bg-red-800/30';
                            }

                            return (
                                <tr key={user.id} className={`border-b border-uefa-border/50 ${rowClass}`}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-uefa-text-secondary">{user.rank}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <button 
                                            onClick={() => onViewProfile(user.id)} 
                                            className="font-medium text-white hover:text-uefa-cyan transition-colors duration-200"
                                        >
                                            {user.displayName}
                                        </button>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-bold">
                                        {isAdmin && editingUserId === user.id ? (
                                            <input type="number" value={newScore} onChange={(e) => setNewScore(e.target.value)} className="w-16 text-center form-input py-1"/>
                                        ) : (
                                            user.totalWins
                                        )}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {isAdmin ? (
                                            editingUserId === user.id ? (
                                                <div className="flex space-x-4">
                                                    <button onClick={() => handleSave(user)} className="text-green-400 hover:text-green-300 font-semibold">Guardar</button>
                                                    <button onClick={handleCancel} className="text-slate-400 hover:text-slate-300">Cancelar</button>
                                                </div>
                                            ) : (
                                                <div className="flex space-x-4 items-center">
                                                    <button onClick={() => handleEdit(user)} className="text-uefa-primary-blue hover:text-blue-400 font-semibold">Editar</button>
                                                    <button onClick={() => onViewProfile(user.id)} className="text-uefa-cyan hover:text-cyan-300 font-semibold">Ver Estadísticas</button>
                                                </div>
                                            )
                                        ) : (
                                            <button onClick={() => onViewProfile(user.id)} className="text-uefa-cyan hover:text-cyan-300 font-semibold">Ver Estadísticas</button>
                                        )}
                                    </td>
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