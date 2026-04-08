import React, { useMemo, useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { calculatePoints } from '../utils/scoring';

const statusTranslations = {
    SCHEDULED: 'Programado',
    TIMED: 'Confirmado',
    IN_PLAY: 'En Juego',
    PAUSED: 'En Pausa',
    FINISHED: 'Finalizado',
    SUSPENDED: 'Suspendido',
    POSTPONED: 'Pospuesto',
    CANCELLED: 'Cancelado',
    AWARDED: 'Adjudicado'
};

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

    if (allPredictions.length === 0) {
        return <div className="text-center p-8 text-foreground-muted">Aún no hay predicciones para esta quiniela.</div>;
    }

    const maxRank = scores.length > 0 ? Math.max(...scores.map(s => s.rank)) : 0;

    return (
        <div className="overflow-x-auto relative shadow-sm border border-border sm:rounded-2xl">
            <h2 className="text-xl font-bold text-primary mb-4 px-4 pt-4 hidden">Puntuación: "{quiniela.name}"</h2>
            <div className="align-middle inline-block min-w-full">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-background-offset">
                        <tr>
                            {/* COLUMNA STICKY CON FONDO SÓLIDO */}
                            <th scope="col" className="sticky left-0 bg-background-offset z-30 px-4 py-3 text-left text-xs font-bold text-foreground-muted uppercase tracking-wider border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                Apostador
                            </th>
                            {Object.keys(groupedMatches).map(championship => (
                                <th key={championship} colSpan={groupedMatches[championship].length} className="py-3 px-2 text-center text-xs font-bold text-primary uppercase tracking-wider border-x border-border">
                                    {championship}
                                </th>
                            ))}
                            <th scope="col" className="px-4 py-3 text-center text-xs font-bold text-foreground-muted uppercase tracking-wider border-l border-border bg-background-offset">
                                TOTAL
                            </th>
                        </tr>
                        <tr>
                            <th scope="col" className="sticky left-0 bg-background-offset z-30 py-3 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></th>
                            {Object.values(groupedMatches).flat().map(p => (
                                <th scope="col" key={p.id} className="px-1 py-3 text-center text-xs font-semibold text-foreground min-w-[75px] border-x border-border/50">
                                    <div className="flex flex-col items-center justify-center space-y-0.5">
                                        <span className="text-[9px] font-bold text-foreground-muted uppercase leading-none">{String(p.id).substring(0, 3) === "man" ? p.home.substring(0, 3) : p.homeCode}</span>
                                        <div className="h-4 w-4 rounded-full overflow-hidden bg-background border border-border">
                                            <img src={p.homeCrest || `https://flagcdn.com/w20/${p.homeCode}.png`} title={p.home} className="h-full w-full object-contain" alt="" />
                                        </div>
                                        <span className="text-[10px] text-foreground-muted">vs</span>
                                        <div className="h-4 w-4 rounded-full overflow-hidden bg-background border border-border">
                                            <img src={p.awayCrest || `https://flagcdn.com/w20/${p.awayCode}.png`} title={p.away} className="h-full w-full object-contain" alt="" />
                                        </div>
                                        <span className="text-[9px] font-bold text-foreground-muted uppercase leading-none">{String(p.id).substring(0, 3) === "man" ? p.away.substring(0, 3) : p.awayCode}</span>
                                        
                                        <span className={`text-[9px] font-bold mt-1 ${
                                            p.status === 'IN_PLAY' || p.status === 'PAUSED'
                                                ? 'text-green-500 animate-pulse'
                                                : p.status === 'FINISHED'
                                                ? 'text-red-500'
                                                : 'text-foreground-muted'
                                        }`}>
                                            {statusTranslations[p.status] || p.status || "Confirmado"}
                                        </span>
                                    </div>
                                </th>
                            ))}
                            <th scope="col" className="z-10 border-l border-border bg-background-offset"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 bg-card">
                        {scores.map(score => {
                            const isCurrentUser = currentUserDisplayName && score.apostador && (score.apostador.toLowerCase() === currentUserDisplayName.toLowerCase());
                            
                            // Lógica de resaltado usando border-left en lugar de fondo transparente
                            let highlightClass = '';
                            if (score.rank === 1 && score.points > 0) {
                                highlightClass = 'border-l-4 border-green-500';
                            } else if (score.rank === maxRank && score.rank > 1) {
                                highlightClass = 'border-l-4 border-red-500';
                            } else if (isCurrentUser) {
                                highlightClass = 'border-l-4 border-primary';
                            } else {
                                highlightClass = 'border-l-4 border-transparent';
                            }

                            return (
                                <tr key={score.userId} className="hover:bg-background-offset transition-colors group">
                                    {/* COLUMNA STICKY CON FONDO SÓLIDO */}
                                    <td className={`sticky left-0 bg-card group-hover:bg-background-offset px-4 py-4 whitespace-nowrap text-sm font-medium text-foreground flex items-center gap-x-3 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-20 ${highlightClass} transition-colors`}>
                                        {score.rank === 1 && score.points > 0 ? (
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white font-bold text-xs flex-shrink-0 shadow-sm">
                                                {score.rank}
                                            </span>
                                        ) : (
                                            <span className="text-foreground-muted font-bold w-6 text-center flex-shrink-0">
                                                {score.rank}.
                                            </span>
                                        )}
                                        <span>
                                            <span className="sm:hidden font-bold">{score.apostador?.split(' ')[0]}</span>
                                            <span className="hidden sm:inline font-bold">{score.apostador}</span>
                                        </span>
                                    </td>
                                    
                                    {quiniela.matches.map(p => {
                                        const points = score.pointsPerMatch[p.id] ?? 0;
                                        const prediction = score.userPredictions?.[p.id];

                                        let pointsClass = '';
                                        if (points === 6 || points === 5) { 
                                            pointsClass = 'text-green-500 animate-pulse font-black'; 
                                        } else if (points > 0) { 
                                            pointsClass = 'text-amber-500 font-bold'; 
                                        } else { 
                                            pointsClass = 'text-red-500 font-medium opacity-80'; 
                                        }

                                        return (
                                            <td key={p.id} className="px-2 py-4 whitespace-nowrap text-sm text-center text-foreground-muted border-x border-border/50">
                                                {prediction ? `${prediction.home} - ${prediction.away}` : '? - ?'} 
                                                <span className={`ml-1 ${pointsClass}`}>({points})</span>
                                            </td>
                                        );
                                    })}
                                    
                                    <td className={`px-4 py-4 whitespace-nowrap text-base text-center font-black text-primary border-l border-border`}>
                                        {score.points}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot className="bg-background-offset border-t-2 border-border">
                        <tr>
                            {/* COLUMNA STICKY CON FONDO SÓLIDO */}
                            <td className="sticky left-0 bg-background-offset px-4 py-3 text-left text-xs font-black text-foreground uppercase tracking-wider border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-30">
                                Resultado Real
                            </td>
                            {quiniela.matches.map(p => {
                                const result = quiniela.realResults?.[p.id];
                                const scoreText = result ? `${result.home} - ${result.away}` : '-';
                                return (
                                    <td key={p.id} className="px-2 py-3 text-center text-sm font-extrabold text-green-500 border-x border-border/50">
                                        {scoreText}
                                    </td>
                                );
                            })}
                            <td className="border-l border-border bg-background-offset"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default ScoringTable;