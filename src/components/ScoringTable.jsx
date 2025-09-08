import React, { useMemo, useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { calculatePoints } from '../utils/scoring';

const ScoringTable = ({ quiniela, allPredictions, currentUserDisplayName }) => {
    const [allUsers, setAllUsers] = useState([]);

    // Cargar la lista completa de usuarios para tener siempre los nombres actualizados
    useEffect(() => {
        const usersQuery = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllUsers(usersData);
        });
        return () => unsubscribe();
    }, []);
    
    // Calcula los puntajes una sola vez y los memoriza
    const scores = useMemo(() => {
        if (!quiniela || allPredictions.length === 0 || allUsers.length === 0) return [];

        // Crear un mapa de usuarios para una búsqueda rápida de nombres
        const usersMap = new Map(allUsers.map(user => [user.id, user.displayName]));

        const calculatedScores = allPredictions.map(prediction => {
            let totalPoints = 0;
            const pointsPerMatch = {};

            quiniela.matches.forEach(match => {
                const points = calculatePoints(
                    prediction.predictions?.[match.id],
                    quiniela.realResults?.[match.id]
                );
                totalPoints += points;
                pointsPerMatch[match.id] = points;
            });

            return {
                userId: prediction.id,
                // Usa el nombre actualizado del mapa de usuarios, con un respaldo
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
            if (score.points !== lastScore) { 
                rank = index + 1; 
                lastScore = score.points;
            }
            return { ...score, rank };
        });

    }, [quiniela, allPredictions, allUsers]);

    // Agrupa los partidos por campeonato para la visualización
    const groupedMatches = useMemo(() => {
        if (!quiniela) return {};
        return quiniela.matches.reduce((acc, match) => {
            const champ = match.championship || 'Otros';
            if (!acc[champ]) {
                acc[champ] = [];
            }
            acc[champ].push(match);
            return acc;
        }, {});
    }, [quiniela]);
    
    if (allPredictions.length === 0) {
        return <div className="text-center p-8 text-slate-400">Aún no hay predicciones para calcular puntos en esta quiniela.</div>;
    }

    const maxScore = scores.length > 0 ? scores[0].points : 0;

    return (
        <div className="overflow-x-auto">
             <h2 className="text-xl font-bold text-blue-400 mb-4">Puntuación: "{quiniela.name}"</h2>
             <div className="align-middle inline-block min-w-full">
                <div className="shadow overflow-hidden border-b border-slate-700 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th scope="col" className="sticky left-0 bg-slate-700/50 z-10 px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Apostador</th>
                                {Object.keys(groupedMatches).map(championship => (
                                    <th key={championship} colSpan={groupedMatches[championship].length} className="py-3 px-2 text-center text-xs font-medium text-blue-300 uppercase tracking-wider border-x border-slate-600">
                                        {championship}
                                    </th>
                                ))}
                                <th scope="col" className="sticky right-0 bg-slate-700/50 z-10 px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">TOTAL</th>
                            </tr>
                            <tr>
                                <th scope="col" className="sticky left-0 bg-slate-700/50 z-10 py-3"></th>
                                {Object.values(groupedMatches).flat().map(p => (
                                    <th scope="col" key={p.id} className="px-1 py-3 text-center text-xs font-semibold text-white min-w-[75px]">
                                        <div className="flex flex-col items-center justify-center space-y-0.5">
                                            <span className="text-[9px] font-bold text-slate-300 uppercase leading-none">{p.home.substring(0, 3)}</span>
                                            <img src={`https://flagcdn.com/w20/${p.homeCode}.png`} title={p.home} className="h-3 rounded-sm bg-slate-600" />
                                            <span className="text-[10px]">vs</span>
                                            <img src={`https://flagcdn.com/w20/${p.awayCode}.png`} title={p.away} className="h-3 rounded-sm bg-slate-600" />
                                            <span className="text-[9px] font-bold text-slate-300 uppercase leading-none">{p.away.substring(0, 3)}</span>
                                        </div>
                                    </th>
                                ))}
                                <th scope="col" className="sticky right-0 bg-slate-700/50 z-10"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-slate-700/50">
                            {scores.map(score => {
                                const isLeader = score.points === maxScore && maxScore > 0;
                                const isCurrentUser = currentUserDisplayName && score.apostador && (score.apostador.toLowerCase() === currentUserDisplayName.toLowerCase());
                                
                                let rowClass = isLeader ? 'bg-amber-500/10' : 'hover:bg-slate-700/30';
                                if (isCurrentUser && !isLeader) rowClass = 'bg-blue-900/40 hover:bg-blue-900/60';
                                
                                const stickyBgClass = rowClass.includes('hover') ? 'bg-gray-800' : rowClass.split(' ')[0];

                                return (
                                     <tr key={score.userId} className={rowClass}>
                                        <td className={`sticky left-0 ${stickyBgClass} px-4 py-4 whitespace-nowrap text-sm font-medium text-white`}>{score.rank}. {score.apostador}</td>
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
                                        <td className={`sticky right-0 ${stickyBgClass} px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-300`}>{score.points}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="bg-slate-700/50 border-t-2 border-slate-600">
                           <tr>
                                <td className="sticky left-0 bg-slate-700/50 px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Resultado Real</td>
                                {quiniela.matches.map(p => {
                                    const result = quiniela.realResults?.[p.id];
                                    const scoreText = result ? `${result.home} - ${result.away}` : '-';
                                    return <td key={p.id} className="px-2 py-3 text-center text-sm font-bold text-amber-300">{scoreText}</td>;
                                })}
                                <td className="sticky right-0 bg-slate-700/50"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ScoringTable;