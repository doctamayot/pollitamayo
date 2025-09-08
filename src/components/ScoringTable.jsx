import React, { useMemo } from 'react';
import { calculatePoints } from '../utils/scoring';

const ScoringTable = ({ quiniela, allPredictions, currentUserDisplayName }) => {
    const scores = useMemo(() => {
        if (!quiniela || !allPredictions) return [];

        const calculatedScores = allPredictions.map(userPrediction => {
            let totalPoints = 0;
            const pointsPerMatch = {};
            quiniela.matches.forEach(partido => {
                const points = calculatePoints(userPrediction.predictions?.[partido.id], quiniela.realResults?.[partido.id]);
                pointsPerMatch[partido.id] = points;
                totalPoints += points;
            });
            return { 
                apostador: userPrediction.apostador, 
                points: totalPoints, 
                pointsPerMatch,
                userPredictions: userPrediction.predictions 
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

    }, [allPredictions, quiniela]);

    const groupedMatches = useMemo(() => {
        return quiniela.matches.reduce((acc, match) => {
            const champ = match.championship || 'Otros';
            if (!acc[champ]) {
                acc[champ] = [];
            }
            acc[champ].push(match);
            return acc;
        }, {});
    }, [quiniela.matches]);
    
    if (allPredictions.length === 0) {
        return <div className="text-center p-8 text-gray-400">Aún no hay predicciones para calcular puntos en esta quiniela.</div>;
    }

    const maxScore = scores.length > 0 ? scores[0].points : 0;

    return (
        <div className="overflow-x-auto">
             <h2 className="text-xl font-bold text-blue-300 mb-4">Tabla de Puntuaciones: "{quiniela.name}"</h2>
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                    <tr>
                        <th scope="col" className="sticky left-0 bg-gray-700 z-10 py-3.5 pl-2 pr-1 sm:pl-4 sm:pr-3 text-left text-xs sm:text-sm font-semibold text-white">Apostador</th>
                        {Object.keys(groupedMatches).map(championship => (
                            <th key={championship} colSpan={groupedMatches[championship].length} className="py-3.5 px-2 text-center text-xs sm:text-sm font-semibold text-blue-300 border-l border-r border-gray-600">
                                {championship}
                            </th>
                        ))}
                        <th scope="col" className="sticky right-0 bg-gray-700 z-10 py-3.5 pl-1 pr-2 sm:pl-3 sm:pr-4 text-center text-xs sm:text-sm font-semibold text-white">TOTAL</th>
                    </tr>
                    <tr>
                        <th scope="col" className="sticky left-0 bg-gray-700 z-10"></th>
                        {Object.values(groupedMatches).flat().map(p => (
                            <th scope="col" key={p.id} className="px-1 py-3 text-center text-xs font-semibold text-white min-w-[75px]">
                                <div className="flex flex-col items-center justify-center space-y-0.5">
                                    <span className="text-[9px] font-bold text-gray-300 uppercase leading-none">{p.home.substring(0, 3)}</span>
                                    <img src={`https://flagcdn.com/w20/${p.homeCode}.png`} title={p.home} className="h-3 rounded-sm bg-gray-600" />
                                    <span className="text-[10px]">vs</span>
                                    <img src={`https://flagcdn.com/w20/${p.awayCode}.png`} title={p.away} className="h-3 rounded-sm bg-gray-600" />
                                    <span className="text-[9px] font-bold text-gray-300 uppercase leading-none">{p.away.substring(0, 3)}</span>
                                </div>
                            </th>
                        ))}
                        <th scope="col" className="sticky right-0 bg-gray-700 z-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-600 bg-gray-800">
                    {scores.map(score => {
                        const isLeader = score.points === maxScore && maxScore > 0;
                        const isCurrentUser = currentUserDisplayName && score.apostador.toLowerCase() === currentUserDisplayName.toLowerCase();
                        let rowClass = isLeader ? 'bg-amber-500/10' : '';
                        if (isCurrentUser && !isLeader) rowClass = 'bg-blue-900/60';
                        
                        let stickyBgClass = 'bg-gray-800';
                        if (isLeader) stickyBgClass = 'bg-amber-500/10';
                        if (isCurrentUser && !isLeader) stickyBgClass = 'bg-blue-900/60';

                        return (
                             <tr key={score.apostador} className={rowClass}>
                                <td className={`sticky left-0 ${stickyBgClass} whitespace-nowrap py-3 pl-2 pr-1 sm:pl-4 sm:pr-3 text-xs sm:text-sm font-medium text-white`}>{score.rank}. {score.apostador}</td>
                                {quiniela.matches.map(p => {
                                    const points = score.pointsPerMatch[p.id] ?? 0;
                                    const prediction = score.userPredictions?.[p.id];
                                    
                                    // ***** NUEVA LÓGICA DE COLORES AQUÍ *****
                                    let pointsClass = '';
                                    if (points === 6) {
                                        pointsClass = 'text-green-400 animate-pulse font-extrabold'; // 6 Puntos: Verde y titilando
                                    } else if (points > 0) {
                                        pointsClass = 'text-amber-400'; // 1-5 Puntos: Amarillo/Ámbar
                                    } else {
                                        pointsClass = 'text-red-400'; // 0 Puntos: Rojo
                                    }

                                    return (
                                        <td key={p.id} className="whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm text-center text-gray-300">
                                            {prediction ? `${prediction.home}-${prediction.away}` : '?'} 
                                            <span className={`ml-1 font-bold ${pointsClass}`}>({points})</span>
                                        </td>
                                    );
                                })}
                                <td className={`sticky right-0 ${stickyBgClass} whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm text-center font-bold text-blue-300`}>{score.points}</td>
                            </tr>
                        )
                    })}
                </tbody>
                <tfoot className="bg-gray-700/50 border-t-2 border-amber-500">
                    <tr>
                        <td className="sticky left-0 bg-gray-700/50 whitespace-nowrap py-3 pl-2 pr-1 sm:pl-4 sm:pr-3 text-xs sm:text-sm font-bold text-white">Resultado Real</td>
                        {quiniela.matches.map(p => {
                            const result = quiniela.realResults?.[p.id];
                            const scoreText = result ? `${result.home} - ${result.away}` : '-';
                            return <td key={p.id} className="whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm text-center font-bold text-amber-300">{scoreText}</td>;
                        })}
                        <td className="sticky right-0 bg-gray-700/50 whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default ScoringTable;