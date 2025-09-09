import React, { useMemo, useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { calculatePoints } from '../utils/scoring';

const ScoringTable = ({ quiniela, allPredictions, currentUserDisplayName }) => {
    const [allUsers, setAllUsers] = useState([]);

    useEffect(() => {
        const usersQuery = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllUsers(usersData);
        });
        return () => unsubscribe();
    }, []);
    
    const scores = useMemo(() => {
        if (!quiniela || allPredictions.length === 0 || allUsers.length === 0) return [];
        const usersMap = new Map(allUsers.map(user => [user.id, user.displayName]));
        const calculatedScores = allPredictions.map(prediction => {
            let totalPoints = 0;
            const pointsPerMatch = {};
            quiniela.matches.forEach(match => {
                const points = calculatePoints(prediction.predictions?.[match.id], quiniela.realResults?.[match.id]);
                totalPoints += points;
                pointsPerMatch[match.id] = points;
            });
            return {
                userId: prediction.id,
                apostador: usersMap.get(prediction.id) || prediction.apostador || 'Usuario Desconocido',
                points: totalPoints,
                pointsPerMatch,
                userPredictions: prediction.predictions,
            };
        });
        calculatedScores.sort((a, b) => b.points - a.points);
        let rank = 0;
        let lastScore = -1;
        return calculatedScores.map((score, index) => {
            if (score.points !== lastScore) { rank = index + 1; lastScore = score.points; }
            return { ...score, rank };
        });
    }, [quiniela, allPredictions, allUsers]);

    const groupedMatches = useMemo(() => { /* ... (sin cambios) */ }, [quiniela]);
    
    if (allPredictions.length === 0) {
        return <div className="text-center p-8 text-slate-400">Aún no hay predicciones para esta quiniela.</div>;
    }

    const maxRank = scores.length > 0 ? Math.max(...scores.map(s => s.rank)) : 0;

    return (
        <div className="overflow-x-auto">
             <h2 className="text-xl font-bold text-blue-400 mb-4">Puntuación: "{quiniela.name}"</h2>
             <div className="align-middle inline-block min-w-full">
                <div className="shadow overflow-hidden border-b border-slate-700 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-700/50">
                            {/* ... (encabezado sin cambios) ... */}
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {scores.map(score => {
                                const isCurrentUser = currentUserDisplayName && score.apostador && (score.apostador.toLowerCase() === currentUserDisplayName.toLowerCase());
                                
                                let rowClass = 'bg-gray-800 hover:bg-slate-700/30';
                                if (score.rank === 1 && score.points > 0) {
                                    rowClass = 'bg-green-500/10 hover:bg-green-500/20';
                                } else if (score.rank === maxRank && score.rank > 1) {
                                    rowClass = 'bg-red-500/10 hover:bg-red-500/20';
                                } else if (isCurrentUser) {
                                    rowClass = 'bg-blue-900/40 hover:bg-blue-900/60';
                                }
                                
                                let stickyBgClass = rowClass.split(' ')[0];

                                return (
                                     <tr key={score.userId} className={rowClass}>
                                        <td className={`sticky left-0 px-4 py-4 whitespace-nowrap text-sm font-medium text-white flex items-center gap-x-3 ${stickyBgClass}`}>
                                            {/* ***** CÍRCULO VERDE PARA EL RANK #1 ***** */}
                                            {score.rank === 1 && score.points > 0 ? (
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white font-bold text-xs flex-shrink-0">
                                                    {score.rank}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-bold w-6 text-center flex-shrink-0">
                                                    {score.rank}.
                                                </span>
                                            )}
                                            <span>{score.apostador}</span>
                                        </td>
                                        {quiniela.matches.map(p => {
                                            const points = score.pointsPerMatch[p.id] ?? 0;
                                            const prediction = score.userPredictions?.[p.id];
                                            let pointsClass = '';
                                            if (points === 6) { pointsClass = 'text-green-400 animate-pulse font-extrabold'; } 
                                            else if (points > 0) { pointsClass = 'text-amber-400'; } 
                                            else { pointsClass = 'text-red-500'; }
                                            return (
                                                <td key={p.id} className="px-2 py-4 whitespace-nowrap text-sm text-center text-slate-300">
                                                    {prediction ? `${prediction.home}-${prediction.away}` : '?'} 
                                                    <span className={`ml-1 font-bold ${pointsClass}`}>({points})</span>
                                                </td>
                                            );
                                        })}
                                        <td className={`sticky right-0 px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-300 ${stickyBgClass}`}>
                                            {score.points}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="bg-slate-700/50 border-t-2 border-slate-600">
                           {/* ... (pie de tabla sin cambios) ... */}
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ScoringTable;