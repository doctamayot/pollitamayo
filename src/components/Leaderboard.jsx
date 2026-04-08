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
                        totalWins: winnersMap.get(user.id) || 0
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

    // --- FUNCIÓN PARA ACORTAR EL NOMBRE (Máximo 2 palabras) ---
    const getShortName = (name) => {
        if (!name) return 'Usuario';
        const words = name.trim().split(' ');
        return words.slice(0, 2).join(' ');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-foreground-muted font-bold tracking-widest uppercase text-sm">Cargando Salón de la Fama...</p>
            </div>
        );
    }
    
    const maxRank = leaderboardData.length > 0 ? Math.max(...leaderboardData.map(u => u.rank)) : 0;

    return (
        <div className="bg-card border border-card-border p-4 sm:p-8 rounded-3xl shadow-sm animate-fade-in w-full">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-8 text-center flex items-center justify-center gap-3">
                <span className="text-4xl">🏆</span> Salón de la Fama
            </h2>
            
            <div className="overflow-x-auto shadow-sm border border-border sm:rounded-2xl">
                <table className="min-w-full divide-y divide-border table-fixed">
                    <thead className="bg-background-offset">
                        <tr>
                            {/* COLUMNAS STICKY (Fijas a la izquierda) */}
                            <th className="sticky left-0 z-20 bg-background-offset border-r border-border px-4 py-3 text-left text-xs font-bold text-foreground-muted uppercase tracking-wider w-[60px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Rank</th>
                            <th className="sticky left-[60px] z-20 bg-background-offset border-r border-border px-4 py-3 text-left text-xs font-bold text-foreground-muted uppercase tracking-wider w-[140px] sm:w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Jugador</th>
                            
                            <th className="px-4 py-3 text-center text-xs font-bold text-foreground-muted uppercase tracking-wider w-[100px]">Victorias</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-foreground-muted uppercase tracking-wider min-w-[250px]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 bg-card">
                        {leaderboardData.map((user) => {
                            
                            // Lógica de resaltado (usando border-left para evitar problemas de transparencia)
                            let highlightClass = 'border-l-4 border-transparent';
                            if (user.isBlocked) {
                                highlightClass = 'border-l-4 border-red-900 opacity-60';
                            } else if (user.rank === 1 && user.totalWins > 0) {
                                highlightClass = 'border-l-4 border-green-500';
                            } else if (user.rank === maxRank && user.rank > 1 && leaderboardData.length > 2) {
                                highlightClass = 'border-l-4 border-red-500';
                            }

                            return (
                                <tr key={user.id} className="group hover:bg-background-offset transition-colors">
                                    {/* CELDA RANK (Sticky) */}
                                    <td className={`sticky left-0 z-10 bg-card group-hover:bg-background-offset border-r border-border px-4 py-4 whitespace-nowrap text-sm font-medium text-foreground-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors ${highlightClass}`}>
                                        {user.rank === 1 && user.totalWins > 0 ? (
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white font-bold text-xs shadow-sm">
                                                {user.rank}
                                            </span>
                                        ) : (
                                            <span className="font-bold px-1">{user.rank}</span>
                                        )}
                                    </td>
                                    
                                    {/* CELDA JUGADOR (Sticky) */}
                                    <td className="sticky left-[60px] z-10 bg-card group-hover:bg-background-offset border-r border-border px-4 py-4 whitespace-nowrap text-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                                        <button 
                                            onClick={() => onViewProfile(user.id)} 
                                            className="flex items-center space-x-2 font-bold text-foreground hover:text-primary transition-colors duration-200 w-full text-left"
                                        >
                                            {/* Aquí aplicamos el acortador de nombre y evitamos que se desborde */}
                                            <span className="truncate block w-full">{getShortName(user.displayName)}</span>
                                            {user.isBlocked && <span className="text-red-500 text-[10px] ml-1 flex-shrink-0">(BLOQ)</span>}
                                        </button>
                                    </td>
                                    
                                    {/* CELDA VICTORIAS */}
                                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-foreground font-black">
                                        {isAdmin && editingUserId === user.id ? (
                                            <input 
                                                type="number" 
                                                value={newScore} 
                                                onChange={(e) => setNewScore(e.target.value)} 
                                                className="w-16 mx-auto text-center bg-background border border-border rounded-lg py-1 px-1 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                                            />
                                        ) : (
                                            <span className="text-primary text-base">{user.totalWins}</span>
                                        )}
                                    </td>
                                    
                                    {/* CELDA ACCIONES */}
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {isAdmin ? (
                                            editingUserId === user.id ? (
                                                <div className="flex justify-center space-x-2">
                                                    <button onClick={() => handleSave(user)} className="text-green-500 hover:text-green-600 font-bold bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-colors">Guardar</button>
                                                    <button onClick={handleCancel} className="text-foreground-muted hover:text-foreground font-bold bg-background-offset hover:bg-border/50 px-3 py-1.5 rounded-lg transition-colors">Cancelar</button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-center space-x-2 items-center">
                                                    <button onClick={() => handleEdit(user)} className="text-blue-500 hover:text-blue-600 font-bold bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">Editar</button>
                                                    <button onClick={() => onViewProfile(user.id)} className="text-primary hover:text-amber-600 font-bold bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors">Stats</button>
                                                    <button 
                                                        onClick={() => handleToggleBlockUser(user)} 
                                                        className={`font-bold px-3 py-1.5 rounded-lg transition-colors ${user.isBlocked ? 'text-green-500 hover:text-green-600 bg-green-500/10 hover:bg-green-500/20' : 'text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20'}`}
                                                    >
                                                        {user.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <div className="flex justify-center">
                                                <button onClick={() => onViewProfile(user.id)} className="text-primary hover:text-amber-600 font-bold bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-lg transition-colors shadow-sm">
                                                    Ver Estadísticas
                                                </button>
                                            </div>
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