import React, { useMemo, useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { calculatePoints } from '../utils/scoring';

const ScoringTable = ({ quiniela, allPredictions, currentUserDisplayName }) => {
    // --- Lógica interna sin cambios ---
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
                const points = calculatePoints(
                    prediction.predictions?.[match.id],
                    quiniela.realResults?.[match.id]
                );
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
            if (score.points !== lastScore) {
                rank = index + 1;
                lastScore = score.points;
            }
            return { ...score, rank };
        });

    }, [quiniela, allPredictions, allUsers]);

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
    // --- Fin de la lógica interna ---

    if (allPredictions.length === 0) {
        return <div className="text-center p-8 text-uefa-text-secondary">Aún no hay predicciones para esta quiniela.</div>;
    }

    const maxRank = scores.length > 0 ? Math.max(...scores.map(s => s.rank)) : 0;

    return (
        // --- ▼▼▼ CÓDIGO DE LA INTERFAZ ACTUALIZADO ▼▼▼ ---
        <div className="overflow-x-auto">
            <h2 className="text-xl font-bold text-uefa-cyan mb-4">Puntuación: "{quiniela.name}"</h2>
            <div className="align-middle inline-block min-w-full">
                <div className="shadow border-b border-uefa-border sm:rounded-lg">
                    <table className="min-w-full divide-y divide-uefa-border">
                        <thead className="bg-uefa-dark-blue-secondary/60">
                            <tr>
                                <th scope="col" className="sticky left-0 bg-uefa-dark-blue-secondary z-20 px-4 py-3 text-left text-xs font-medium text-uefa-text-secondary uppercase tracking-wider">Apostador</th>
                                {Object.keys(groupedMatches).map(championship => (
                                    <th key={championship} colSpan={groupedMatches[championship].length} className="py-3 px-2 text-center text-xs font-medium text-uefa-cyan uppercase tracking-wider border-x border-uefa-border">
                                        {championship}
                                    </th>
                                ))}
                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-uefa-text-secondary uppercase tracking-wider">TOTAL</th>
                            </tr>
                            <tr>
                                <th scope="col" className="sticky left-0 bg-uefa-dark-blue-secondary z-10 py-3"></th>
                                {Object.values(groupedMatches).flat().map(p => (
                                    <th scope="col" key={p.id} className="px-1 py-3 text-center text-xs font-semibold text-white min-w-[75px]">
                                        <div className="flex flex-col items-center justify-center space-y-0.5">
                                            <span className="text-[9px] font-bold text-uefa-text-secondary uppercase leading-none">{p.homeCode || p.home.substring(0, 3)}</span>
                                            <div className="h-4 w-4 rounded-full overflow-hidden bg-slate-600">
                                                <img src={p.homeCrest || `https://flagcdn.com/w20/${p.homeCode}.png`} title={p.home} className="h-full w-full object-contain" />
                                            </div>
                                            <span className="text-[10px]">vs</span>
                                            <div className="h-4 w-4 rounded-full overflow-hidden bg-slate-600">
                                                <img src={p.awayCrest || `https://flagcdn.com/w20/${p.awayCode}.png`} title={p.away} className="h-full w-full object-contain" />
                                            </div>
                                            <span className="text-[9px] font-bold text-uefa-text-secondary uppercase leading-none">{p.awayCode || p.away.substring(0, 3)}</span>
                                        </div>
                                    </th>
                                ))}
                                <th scope="col" className="z-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-uefa-border/50">
                            {scores.map(score => {
                                const isCurrentUser = currentUserDisplayName && score.apostador && (score.apostador.toLowerCase() === currentUserDisplayName.toLowerCase());
                                
                                // --- Lógica de estilo de fila actualizada ---
                                let rowClass = 'bg-uefa-dark-blue-secondary/30 hover:bg-uefa-dark-blue-secondary/60';
                                if (score.rank === 1 && score.points > 0) {
                                    rowClass = 'bg-green-500/20 hover:bg-green-500/30';
                                } else if (score.rank === maxRank && score.rank > 1) {
                                    rowClass = 'bg-red-800/20 hover:bg-red-800/30';
                                } else if (isCurrentUser) {
                                    rowClass = 'bg-uefa-primary-blue/20 hover:bg-uefa-primary-blue/30';
                                }
                                
                                let stickyBgClass = rowClass.split(' ')[0];

                                return (
                                    <tr key={score.userId} className={rowClass}>
                                        <td className={`sticky left-0 px-4 py-4 whitespace-nowrap text-sm font-medium text-white flex items-center gap-x-3 ${stickyBgClass}`}>
                                            {score.rank === 1 && score.points > 0 ? (
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white font-bold text-xs flex-shrink-0">
                                                    {score.rank}
                                                </span>
                                            ) : (
                                                <span className="text-uefa-text-secondary font-bold w-6 text-center flex-shrink-0">
                                                    {score.rank}.
                                                </span>
                                            )}
                                            <span>
                                                <span className="sm:hidden">{score.apostador?.split(' ')[0]}</span>
                                                <span className="hidden sm:inline">{score.apostador}</span>
                                            </span>
                                        </td>
                                        {quiniela.matches.map(p => {
                                            const points = score.pointsPerMatch[p.id] ?? 0;
                                            const prediction = score.userPredictions?.[p.id];

                                            // --- Lógica de estilo de puntos actualizada ---
                                            let pointsClass = '';
                                            if (points === 6) { pointsClass = 'text-green-400 animate-pulse font-extrabold'; } 
                                            else if (points > 0) { pointsClass = 'text-yellow-400'; } 
                                            else { pointsClass = 'text-red-500/70'; }

                                            return (
                                                <td key={p.id} className="px-2 py-4 whitespace-nowrap text-sm text-center text-uefa-text-secondary">
                                                    {prediction ? `${prediction.home}-${prediction.away}` : '?'} 
                                                    <span className={`ml-1 font-bold ${pointsClass}`}>({points})</span>
                                                </td>
                                            );
                                        })}
                                        <td className={`px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-uefa-cyan`}>
                                            {score.points}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="bg-uefa-dark-blue-secondary/60 border-t-2 border-uefa-border">
                            <tr>
                                <td className="sticky left-0 bg-uefa-dark-blue-secondary px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Resultado Real</td>
                                {quiniela.matches.map(p => {
                                    const result = quiniela.realResults?.[p.id];
                                    const scoreText = result ? `${result.home} - ${result.away}` : '-';
                                    return <td key={p.id} className="px-2 py-3 text-center text-sm font-extrabold text-green-400 animate-pulse">{scoreText}</td>;
                                })}
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ScoringTable;