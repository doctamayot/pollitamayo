import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ADMIN_EMAIL } from '../config';

const Leaderboard = ({ isAdmin, onViewProfile }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [editingUserId, setEditingUserId] = useState(null);
    const [newScore, setNewScore] = useState('');

    useEffect(() => {
        const usersQuery = query(collection(db, 'users'));
        
        const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
            const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            let allPlayers = allUsers.filter(user => user.email !== ADMIN_EMAIL);
            if (!isAdmin) {
                allPlayers = allPlayers.filter(user => !user.isBlocked);
            }
            
            const unsubLeaderboard = onSnapshot(collection(db, 'leaderboard'), (leaderboardSnapshot) => {
                const winners = leaderboardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const winnersMap = new Map(winners.map(w => [w.id, w.totalWins]));

                let fullLeaderboard = allPlayers.map(user => {
                    const initial = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
                    return {
                        id: user.id,
                        displayName: user.displayName,
                        email: user.email,
                        uid: user.id,
                        isBlocked: user.isBlocked || false,
                        photoURL: user.photoURL,
                        placeholder: `https://placehold.co/40x40/100c3b/a9a5c4/png?text=${initial}`,
                        initial: initial,
                        totalWins: winnersMap.get(user.id) || 0 // <-- ¡ESTA LÍNEA FALTABA Y HA SIDO RESTAURADA!
                    };
                });

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
    }, [isAdmin]);
    
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
        if (isNaN(scoreToSave) || scoreToSave < 0) return;
        try {
            const leaderboardRef = doc(db, 'leaderboard', user.id);
            await setDoc(leaderboardRef, { displayName: user.displayName, totalWins: scoreToSave }, { merge: true });
        } catch (error) { console.error("Error al actualizar el puntaje:", error); }
        finally { handleCancel(); }
    };
    
    const handleToggleBlockUser = async (user) => {
        const newBlockedState = !user.isBlocked;
        const actionText = newBlockedState ? 'BLOQUEAR' : 'DESBLOQUEAR';
        if (!window.confirm(`¿Estás seguro de que quieres ${actionText} a ${user.displayName}?`)) return;
        try {
            const userDocRef = doc(db, 'users', user.id);
            await updateDoc(userDocRef, { isBlocked: newBlockedState });
        } catch (error) { console.error(`Error al ${actionText.toLowerCase()} al usuario:`, error); }
    };

    if (loading) {
        return <div className="text-center text-uefa-text-secondary py-10">Cargando el Salón de la Fama...</div>;
    }
    
    const maxRank = leaderboardData.length > 0 ? Math.max(...leaderboardData.map(u => u.rank)) : 0;

    return (
        <div className="bg-uefa-dark-blue-secondary p-4 sm:p-6 rounded-lg border border-uefa-border">
            <h2 className="text-2xl font-bold text-uefa-cyan mb-6 text-center">🏆 Salón de la Fama y Gestión de Usuarios 🏆</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full w-full max-w-4xl mx-auto">
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
                            let rowClass = `hover:bg-uefa-dark-blue-secondary/60 ${user.isBlocked ? 'opacity-50 bg-red-900/30' : ''}`;
                            if (!user.isBlocked) {
                                if (user.rank === 1 && user.totalWins > 0) rowClass = 'bg-green-500/20 hover:bg-green-500/30';
                                else if (user.rank === maxRank && user.rank > 1 && leaderboardData.length > 2) rowClass = 'bg-red-800/20 hover:bg-red-800/30';
                            }
                            return (
                                <tr key={user.id} className={`border-b border-uefa-border/50 ${rowClass}`}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-uefa-text-secondary">{user.rank}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <button 
                                            onClick={() => onViewProfile(user.id)} 
                                            className="flex items-center space-x-3 font-medium text-white hover:text-uefa-cyan transition-colors duration-200"
                                        >
                                            {/* <img 
                                                src={user.photoURL || user.placeholder}
                                                alt={user.displayName} 
                                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                                onError={(e) => { 
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = user.placeholder;
                                                }}
                                            /> */}
                                            <span>{user.displayName} {user.isBlocked && '(BLOQUEADO)'}</span>
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
                                                    <button onClick={() => onViewProfile(user.id)} className="text-uefa-cyan hover:text-cyan-300 font-semibold">Stats</button>
                                                    <button 
                                                        onClick={() => handleToggleBlockUser(user)} 
                                                        className={`font-semibold ${user.isBlocked ? 'text-green-400 hover:text-green-300' : 'text-red-500 hover:text-red-400'}`}
                                                    >
                                                        {user.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                                    </button>
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