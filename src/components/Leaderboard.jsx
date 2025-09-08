import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const Leaderboard = () => {
    const [winners, setWinners] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'leaderboard'), orderBy('totalWins', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const winnersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWinners(winnersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return <div className="text-center text-gray-400 py-10">Cargando el Leaderboard...</div>;
    }

    return (
        <div className="bg-gray-800/50 p-4 sm:p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 text-center">🏆 Salón de la Fama 🏆</h2>
            {winners.length === 0 ? (
                <p className="text-center text-gray-400">Aún no hay ganadores registrados.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full w-full max-w-lg mx-auto divide-y divide-gray-700">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Jugador</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Victorias</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {winners.map((winner, index) => (
                                <tr key={winner.id} className={index === 0 ? 'bg-amber-500/10' : ''}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">{index + 1}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{winner.displayName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-bold">{winner.totalWins}</td>
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