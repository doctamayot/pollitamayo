import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ADMIN_EMAIL } from '../config'; // Importar el email del admin

const Leaderboard = ({ isAdmin }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados para la edición manual del admin
    const [editingUserId, setEditingUserId] = useState(null);
    const [newScore, setNewScore] = useState('');

    useEffect(() => {
        // Se necesitan dos listeners: uno para los usuarios y otro para el leaderboard
        const usersQuery = query(collection(db, 'users'));
        const leaderboardQuery = query(collection(db, 'leaderboard'), orderBy('totalWins', 'desc'));

        const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
            const allUsers = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // ***** LÍNEA MODIFICADA AQUÍ *****
            // Filtra la lista de usuarios para excluir al admin
            const allPlayers = allUsers.filter(user => user.email !== ADMIN_EMAIL);

            // Segundo listener anidado para asegurar que tengamos los usuarios primero
            const unsubLeaderboard = onSnapshot(leaderboardQuery, (leaderboardSnapshot) => {
                const winners = leaderboardSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Fusionar las dos listas (usando la lista de jugadores ya filtrada)
                const winnersMap = new Map(winners.map(w => [w.id, w.totalWins]));
                const fullLeaderboard = allPlayers.map(user => ({
                    id: user.id,
                    displayName: user.displayName,
                    totalWins: winnersMap.get(user.id) || 0
                }));

                // Ordenar la lista fusionada
                fullLeaderboard.sort((a, b) => b.totalWins - a.totalWins);

                setLeaderboardData(fullLeaderboard);
                setLoading(false);
            });
            return unsubLeaderboard; // Limpiar el listener del leaderboard
        });

        return () => unsubUsers(); // Limpiar el listener de usuarios
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
            handleCancel(); // Salir del modo edición
        }
    };

    if (loading) {
        return <div className="text-center text-gray-400 py-10">Cargando el Leaderboard...</div>;
    }

    return (
        <div className="bg-gray-800/50 p-4 sm:p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 text-center">🏆 Salón de la Fama 🏆</h2>
            {leaderboardData.length === 0 ? (
                <p className="text-center text-gray-400">Aún no hay jugadores registrados.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full w-full max-w-lg mx-auto divide-y divide-gray-700">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Jugador</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Victorias</th>
                                {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {leaderboardData.map((user, index) => (
                                <tr key={user.id} className={index === 0 && user.totalWins > 0 ? 'bg-amber-500/10' : ''}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">{index + 1}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{user.displayName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-bold">
                                        {editingUserId === user.id ? (
                                            <input 
                                                type="number" 
                                                value={newScore}
                                                onChange={(e) => setNewScore(e.target.value)}
                                                className="w-16 text-center rounded-md border bg-gray-900 border-gray-600 text-white"
                                            />
                                        ) : (
                                            user.totalWins
                                        )}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {editingUserId === user.id ? (
                                                <div className="flex space-x-2">
                                                    <button onClick={() => handleSave(user)} className="text-green-400 hover:text-green-300">Guardar</button>
                                                    <button onClick={handleCancel} className="text-gray-400 hover:text-gray-300">Cancelar</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleEdit(user)} className="text-blue-400 hover:text-blue-300">Editar</button>
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