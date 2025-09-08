import React, { useMemo } from 'react';
import { calculatePoints } from '../utils/scoring';

const ScoringTable = ({ quiniela, allPredictions, currentUserDisplayName }) => {
    // Calcula los puntajes una sola vez y los memoriza
    const scores = useMemo(() => {
        if (!quiniela || !allPredictions || !quiniela.realResults) return [];

        return allPredictions.map(prediction => {
            let totalPoints = 0;
            const matchScores = {};

            quiniela.matches.forEach(match => {
                const points = calculatePoints(
                    prediction.predictions?.[match.id],
                    quiniela.realResults?.[match.id]
                );
                totalPoints += points;
                matchScores[match.id] = points;
            });

            return {
                userId: prediction.id,
                apostador: prediction.apostador,
                totalPoints: totalPoints,
                matchScores: matchScores,
                userPredictions: prediction.predictions,
            };
        }).sort((a, b) => b.totalPoints - a.totalPoints); // Ordenar por puntos de mayor a menor
    }, [quiniela, allPredictions]);

    // Agrupa los partidos por campeonato para la visualización
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

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg shadow-inner text-gray-200">
            <h2 className="text-xl sm:text-2xl font-bold text-blue-300 text-center mb-6">
                Tabla de Puntuación de "{quiniela.name}"
            </h2>

            {scores.length === 0 ? (
                <p className="text-center text-gray-400">Aún no hay predicciones para mostrar.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700">
                            <tr>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    Rank
                                </th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    Jugador
                                </th>
                                {/* Encabezados de Partidos Agrupados por Campeonato */}
                                {Object.keys(groupedMatches).map(championship => (
                                    <React.Fragment key={championship}>
                                        <th colSpan={groupedMatches[championship].length} className="px-3 py-3 text-center text-xs font-medium text-blue-300 uppercase tracking-wider border-l border-r border-gray-600">
                                            {championship}
                                        </th>
                                    </React.Fragment>
                                ))}
                                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider border-l border-gray-600">
                                    Total
                                </th>
                            </tr>
                            <tr>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-white uppercase tracking-wider"></th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-white uppercase tracking-wider"></th>
                                {/* Sub-encabezados con los partidos específicos */}
                                {Object.keys(groupedMatches).map(championship => (
                                    groupedMatches[championship].map(match => (
                                        <th key={match.id} scope="col" className="relative px-1 py-1 text-center text-xs font-medium text-white uppercase tracking-wider border-l border-gray-700 min-w-[70px]">
                                            <div className="flex flex-col items-center justify-center space-y-0.5">
                                                {/* --- INICIALES DEL EQUIPO LOCAL (ARRIBA) --- */}
                                                <span className="text-[8px] font-bold text-gray-300 uppercase leading-none">
                                                    {match.home.substring(0, 3)}
                                                </span>
                                                <img 
                                                    src={`https://flagcdn.com/w20/${match.homeCode}.png`} 
                                                    alt={match.home} 
                                                    className="h-3 rounded-sm bg-gray-600" 
                                                />
                                                <span className="text-[8px] font-bold text-gray-300">
                                                    vs
                                                </span>
                                                <img 
                                                    src={`https://flagcdn.com/w20/${match.awayCode}.png`} 
                                                    alt={match.away} 
                                                    className="h-3 rounded-sm bg-gray-600" 
                                                />
                                                {/* --- INICIALES DEL EQUIPO VISITANTE (ABAJO) --- */}
                                                <span className="text-[8px] font-bold text-gray-300 uppercase leading-none">
                                                    {match.away.substring(0, 3)}
                                                </span>
                                                <span className="text-[9px] font-bold text-amber-400 mt-1">
                                                    {quiniela.realResults?.[match.id]?.home} - {quiniela.realResults?.[match.id]?.away}
                                                </span>
                                            </div>
                                        </th>
                                    ))
                                ))}
                                <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-white uppercase tracking-wider border-l border-gray-600">
                                    Pts
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {scores.map((score, index) => (
                                <tr 
                                    key={score.userId} 
                                    className={`${score.apostador === currentUserDisplayName ? 'bg-blue-800/20 font-bold text-blue-300' : 'bg-gray-800'} 
                                                ${index === 0 && 'bg-amber-500/10'}`}
                                >
                                    <td className="px-3 py-3 whitespace-nowrap text-sm">{index + 1}</td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm">{score.apostador}</td>
                                    {quiniela.matches.map(match => {
                                        const userPrediction = score.userPredictions?.[match.id];
                                        const actualScore = score.matchScores[match.id];
                                        return (
                                            <td key={`${score.userId}-${match.id}`} className="px-1 py-3 whitespace-nowrap text-center text-sm border-l border-gray-700">
                                                {userPrediction?.home !== undefined && userPrediction?.away !== undefined ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-gray-300 text-xs">
                                                            {userPrediction.home} - {userPrediction.away}
                                                        </span>
                                                        <span className={`font-bold text-xs ${actualScore > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            ({actualScore || 0})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500 text-xs">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-bold border-l border-gray-600">
                                        {score.totalPoints}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ScoringTable;