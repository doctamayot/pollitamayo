import React, { useMemo } from 'react';

const calculatePoints = (prediction, realResult) => {
    if (!prediction || !realResult || prediction.home === '' || realResult.home === '' || isNaN(parseInt(prediction.home)) || isNaN(parseInt(prediction.away)) || isNaN(parseInt(realResult.home)) || isNaN(parseInt(realResult.away))) {
        return 0;
    }
    const predHome = parseInt(prediction.home, 10);
    const predAway = parseInt(prediction.away, 10);
    const realHome = parseInt(realResult.home, 10);
    const realAway = parseInt(realResult.away, 10);

    if (predHome === realHome && predAway === realAway) return 6;
    
    let points = 0;
    const predWinner = predHome > predAway ? 'H' : (predAway > predHome ? 'A' : 'D');
    const realWinner = realHome > realAway ? 'H' : (realAway > realHome ? 'A' : 'D');

    if (predWinner === realWinner) points += 2;
    if (predHome === realHome) points += 1;
    if (predAway === realAway) points += 1;
    
    return points;
};

const ScoringTable = ({ quiniela, allPredictions, currentUserDisplayName }) => {
    
    const scores = useMemo(() => {
        if (allPredictions.length === 0) return [];
        
        const calculatedScores = allPredictions.map(userPrediction => {
            let totalPoints = 0;
            const pointsPerMatch = {};
            quiniela.matches.forEach(partido => {
                const points = calculatePoints(userPrediction.predictions[partido.id], quiniela.realResults?.[partido.id]);
                pointsPerMatch[partido.id] = points;
                totalPoints += points;
            });
            return { apostador: userPrediction.apostador, points: totalPoints, pointsPerMatch };
        });

        if (Object.keys(quiniela.realResults || {}).length > 0) {
            calculatedScores.sort((a, b) => b.points - a.points);
        } else {
            calculatedScores.sort((a, b) => a.apostador.localeCompare(b.apostador));
        }

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

    if (allPredictions.length === 0) {
        return <div className="text-center text-gray-400">Aún no hay predicciones para calcular puntos en esta quiniela.</div>;
    }

    const maxScore = scores.length > 0 ? scores[0].points : 0;

    return (
        <div id="scoring-table-container" className="overflow-x-auto">
             <h2 className="text-xl font-bold text-blue-300 mb-4">Tabla de Puntuaciones: "{quiniela.name}"</h2>
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                    <tr>
                        <th scope="col" className="sticky left-0 bg-gray-700 py-3.5 pl-2 pr-1 sm:pl-4 sm:pr-3 text-left text-xs sm:text-sm font-semibold text-white z-10">Apostador</th>
                        {quiniela.matches.map(p => (
                            <th scope="col" key={p.id} className="px-1 py-3 text-center text-xs font-semibold text-white">
                                 <div className="flex flex-col items-center justify-center space-y-0.5">
                                    <img src={`https://flagcdn.com/w20/${p.homeCode}.png`} title={p.home} className="h-3 rounded-sm" />
                                    <span className="text-[10px]">vs</span>
                                    <img src={`https://flagcdn.com/w20/${p.awayCode}.png`} title={p.away} className="h-3 rounded-sm" />
                                </div>
                            </th>
                        ))}
                        <th scope="col" className="py-3.5 pl-1 pr-2 sm:pl-3 sm:pr-4 text-center text-xs sm:text-sm font-semibold text-white">TOTAL</th>
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
                                    const cellClass = points === 6 ? 'bg-green-600/50 text-white font-bold' : '';
                                    return <td key={p.id} className={`whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm text-center text-gray-300 ${cellClass}`}>{points}</td>;
                                })}
                                <td className="whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm text-center font-bold text-blue-300">{score.points}</td>
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
                        <td className="whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default ScoringTable;