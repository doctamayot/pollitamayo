import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ADMIN_EMAIL } from '../config';

const Leaderboard = ({ isAdmin }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUserId, setEditingUserId] = useState(null);
    const [newScore, setNewScore] = useState('');
    const [isDeleting, setIsDeleting] = useState(null);

    useEffect(() => {
        const usersQuery = query(collection(db, 'users'));
        const leaderboardQuery = query(collection(db, 'leaderboard'), orderBy('totalWins', 'desc'));

        const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
            const allUsers = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const allPlayers = allUsers.filter(user => user.email !== ADMIN_EMAIL);

            const unsubLeaderboard = onSnapshot(leaderboardQuery, (leaderboardSnapshot) => {
                const winners = leaderboardSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const winnersMap = new Map(winners.map(w => [w.id, w.totalWins]));
                const fullLeaderboard = allPlayers.map(user => ({
                    id: user.id,
                    displayName: user.displayName,
                    totalWins: winnersMap.get(user.id) || 0
                }));

                fullLeaderboard.sort((a, b) => b.totalWins - a.totalWins);

                setLeaderboardData(fullLeaderboard);
                setLoading(false);
            });
            return unsubLeaderboard;
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
            alert("No se pudo guardar el puntaje.");
        } finally {
            handleCancel();
        }
    };

    const handleDeleteUser = async (userToDelete) => {
        if (!window.confirm(`¿ESTÁS SEGURO de borrar todos los datos de ${userToDelete.displayName}? Esta acción es PERMANENTE.`)) {
            return;
        }
        
        setIsDeleting(userToDelete.id);
        try {
            const batch = writeBatch(db);

            const userRef = doc(db, 'users', userToDelete.id);
            batch.delete(userRef);

            const leaderboardRef = doc(db, 'leaderboard', userToDelete.id);
            batch.delete(leaderboardRef);

            const quinielasSnapshot = await getDocs(query(collection(db, 'quinielas')));
            quinielasSnapshot.forEach(quinielaDoc => {
                const predictionRef = doc(db, 'quinielas', quinielaDoc.id, 'predictions', userToDelete.id);
                batch.delete(predictionRef);
            });
            
            await batch.commit();
            alert(`Todos los datos de ${userToDelete.displayName} han sido borrados.`);

        } catch (error) {
            console.error("Error al borrar los datos del usuario:", error);
            alert("Error: " + error.message);
        } finally {
            setIsDeleting(null);
        }
    };

    if (loading) {
        return <div className="text-center text-slate-400 py-10">Cargando el Leaderboard...</div>;
    }

    return (
        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 text-center">🏆 Salón de la Fama 🏆</h2>
            {leaderboardData.length === 0 ? (
                <p className="text-center text-slate-400">Aún no hay jugadores registrados.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full w-full max-w-2xl mx-auto divide-y divide-slate-700">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Jugador</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Victorias</th>
                                {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {leaderboardData.map((user, index) => (
                                <tr key={user.id} className={index === 0 && user.totalWins > 0 ? 'bg-amber-500/10' : 'hover:bg-slate-700/30'}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-300">{index + 1}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{user.displayName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-bold">
                                        {editingUserId === user.id ? (
                                            <input 
                                                type="number" 
                                                value={newScore}
                                                onChange={(e) => setNewScore(e.target.value)}
                                                className="w-16 text-center form-input py-1"
                                            />
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
                                                    <button 
                                                        onClick={() => handleDeleteUser(user)} 
                                                        className="text-red-500 hover:text-red-400 font-semibold"
                                                        disabled={isDeleting === user.id}
                                                    >
                                                        {isDeleting === user.id ? 'Borrando...' : 'Borrar'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;