import React, { useState, useEffect, useMemo } from 'react';
import { getStandings } from '../services/apiFootball';

// --- ▼▼▼ DATOS DE PREDICCIONES CON NOMBRES NORMALIZADOS ▼▼▼ ---
const predictionsData = {
    leagues: [
        { name: "La Liga", id: 2014, positions: ["1º", "2º", "3º", "4º"], emblem: "https://crests.football-data.org/PD.png" },
        { name: "Premier League", id: 2021, positions: ["1º", "2º", "3º", "4º"], emblem: "https://crests.football-data.org/PL.png" },
        { name: "Bundesliga", id: 2002, positions: ["1º", "2º", "3º", "4º"], emblem: "https://crests.football-data.org/BL1.png" },
        { name: "Serie A", id: 2019, positions: ["1º", "2º", "3º", "4º"], emblem: "https://crests.football-data.org/SA.svg" },
        { name: "Liga Colombiana", id: null, positions: ["1º", "1º", "2º", "2º"], countryCode: 'co' },
    ],
    players: [
        { name: "DANIEL", predictions: [["Real Madrid CF", "FC Barcelona", "Club Atlético de Madrid", "Athletic Club"], ["Liverpool FC", "Arsenal FC", "Chelsea FC", "Manchester City FC"], ["FC Bayern München", "Borussia Dortmund", "Eintracht Frankfurt", "Bayer 04 Leverkusen"], ["FC Internazionale Milano", "SSC Napoli", "AS Roma", "Atalanta BC"], ["Junior", "Santafe", "Nacional", "Medellin"]] },
        { name: "ANDRES", predictions: [["FC Barcelona", "Club Atlético de Madrid", "Real Madrid CF", "Athletic Club"], ["Arsenal FC", "Liverpool FC", "Tottenham Hotspur FC", "Manchester United FC"], ["FC Bayern München", "Borussia Dortmund", "RB Leipzig", "Bayer 04 Leverkusen"], ["SSC Napoli", "FC Internazionale Milano", "Juventus FC", "AC Milan"], ["Junior", "Santafe", "Nacional", "Tolima"]] },
        { name: "JAVIER", predictions: [["FC Barcelona", "Real Madrid CF", "Club Atlético de Madrid", "Villarreal CF"], ["Chelsea FC", "Liverpool FC", "Arsenal FC", "Manchester City FC"], ["FC Bayern München", "Bayer 04 Leverkusen", "Borussia Dortmund", "Eintracht Frankfurt"], ["FC Internazionale Milano", "Juventus FC", "AC Milan", "SSC Napoli"], ["Medellin", "Nacional", "Junior", "Caldas"]] },
        { name: "HUGO", predictions: [["FC Barcelona", "Real Madrid CF", "Club Atlético de Madrid", "Real Sociedad de Fútbol"], ["Liverpool FC", "Arsenal FC", "Manchester City FC", "Chelsea FC"], ["FC Bayern München", "Borussia Dortmund", "Bayer 04 Leverkusen", "Eintracht Frankfurt"], ["FC Internazionale Milano", "SSC Napoli", "Atalanta BC", "AS Roma"], ["Junior", "Santafe", "Nacional", "Medellin"]] }
    ]
};

const getPredictionStyleAndPoints = (predictedTeam, positionIndex, realTeams) => {
    if (!realTeams || realTeams.length < 4) return { className: '', points: 0 };
    const isExactMatch = predictedTeam === realTeams[positionIndex];
    const isInTop4 = realTeams.includes(predictedTeam);
    if (positionIndex === 0 && isExactMatch) return { className: 'bg-green-500/30 font-bold', points: 5 };
    if (isExactMatch) return { className: 'bg-yellow-500/20', points: 3 };
    if (isInTop4) return { className: 'bg-blue-500/20', points: 1 };
    return { className: 'bg-red-500/20 opacity-60', points: 0 };
};

const calculatePlayerScores = (players, realStandings, leagues) => {
    const scores = players.map(player => {
        let totalPoints = 0;
        leagues.forEach((league, leagueIndex) => {
            if (league.id === null) return;
            const playerPrediction = player.predictions[leagueIndex];
            const realPositionNames = realStandings[league.name];
            if (!playerPrediction || !realPositionNames || realPositionNames.length < 4) return;
            const scoredPredictions = new Set();
            for (let i = 0; i < 4; i++) {
                if (playerPrediction[i] === realPositionNames[i]) {
                    totalPoints += (i === 0) ? 5 : 3;
                    scoredPredictions.add(playerPrediction[i]);
                }
            }
            for (let i = 0; i < 4; i++) {
                const predictedTeam = playerPrediction[i];
                if (!scoredPredictions.has(predictedTeam) && realPositionNames.includes(predictedTeam)) {
                    totalPoints += 1;
                }
            }
        });
        return { name: player.name, score: totalPoints };
    });
    return scores;
};

const LeagueChampionsView = () => {
    const [realStandings, setRealStandings] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllStandings = async () => {
            setLoading(true);
            const cacheKey = 'leagueChampionsStandings_v5';
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                const { timestamp, data } = JSON.parse(cachedData);
                const isCacheValid = (new Date().getTime() - timestamp) < 24 * 60 * 60 * 1000;
                if (isCacheValid) {
                    setRealStandings(data);
                    setLoading(false);
                    return;
                }
            }
            const leaguesToFetch = predictionsData.leagues.filter(league => league.id !== null);
            const promises = leaguesToFetch.map(league => getStandings(league.id));
        
            try {
                const results = await Promise.allSettled(promises);
                const standingsMap = {};
                leaguesToFetch.forEach((league, index) => {
                    const result = results[index];
                    if (result.status === 'fulfilled' && result.value) {
                        standingsMap[league.name] = result.value;
                    } else {
                        console.error(`Falló la carga para ${league.name}:`, result.reason);
                    }
                });
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: new Date().getTime(), data: standingsMap }));
                setRealStandings(standingsMap);
            } catch (error) {
                console.error("Error al ejecutar las promesas:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllStandings();
    }, []);

    const sortedPlayers = useMemo(() => {
        if (loading || Object.keys(realStandings).length === 0) {
            return predictionsData.players.map(p => ({ ...p, score: 0 }));
        }
        const scores = calculatePlayerScores(predictionsData.players, realStandings, predictionsData.leagues);
        const scoresMap = new Map(scores.map(s => [s.name, s.score]));
        const playersWithScores = predictionsData.players.map(player => ({ ...player, score: scoresMap.get(player.name) || 0 }));
        return playersWithScores.sort((a, b) => b.score - a.score);
    }, [loading, realStandings]);

    return (
        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-amber-400 mb-6 text-center">Polla Campeones de Ligas</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full w-full border-collapse border border-slate-700">
                    <thead className="bg-slate-700/50">
                        <tr className='p-1'>
                            <th className="sticky left-0 z-20 bg-slate-700/50 border border-slate-600 p-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider w-20">Liga</th>
                            <th className="sticky left-[80px] z-20 bg-slate-700/50 border border-slate-600 px-1 py-3 text-center text-xs font-medium text-green-400 uppercase tracking-wider w-28">Resultados Reales</th>
                            {sortedPlayers.map(player => (
                                <th key={player.name} className="border border-slate-600 p-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider min-w-[150px]">
                                    {player.name}
                                    <span className="block text-amber-400 text-sm font-bold mt-1">{player.score} Pts</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {predictionsData.leagues.map((league, leagueIndex) => (
                            <React.Fragment key={league.name}>
                                {league.positions.map((position, positionIndex) => {
                                    const realStandingsForLeague = realStandings[league.name];
                                    return (
                                        <tr key={`${league.name}-${positionIndex}`} className="hover:bg-gray-800">
                                            {positionIndex === 0 && (
                                                <td rowSpan={league.positions.length} className="sticky left-0 z-10 bg-gray-800 border border-slate-600 p-1 text-sm font-medium text-white align-middle text-center">
                                                    <div className="flex justify-center items-center h-full">
                                                        <div className="h-10 w-10 bg-white rounded-full flex justify-center items-center p-1 shadow-md">
                                                            <img src={league.emblem || `https://flagcdn.com/w40/${league.countryCode}.png`} alt={league.name} className="h-8 w-8 object-contain" title={league.name} />
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="sticky left-[80px] z-10 bg-gray-800 border border-slate-600 p-1 text-[10px] text-white text-center font-semibold w-28">
                                                <span title={realStandingsForLeague?.[positionIndex] || 'No disponible'}>
                                                    {`${position} - ${realStandingsForLeague?.[positionIndex] || 'N/A'}`}
                                                </span>
                                            </td>
                                            {sortedPlayers.map(player => {
                                                const predictedTeam = player.predictions[leagueIndex][positionIndex];
                                                const styleInfo = getPredictionStyleAndPoints(predictedTeam, positionIndex, realStandingsForLeague);
                                                return (
                                                    <td key={`${player.name}-${league.name}-${positionIndex}`} className={`border border-slate-600 p-3 text-[10px] text-white text-center transition-colors duration-300 ${styleInfo.className}`}>
                                                        {predictedTeam}
                                                        {league.id && (
                                                            <span className="text-xs ml-2 opacity-80">({styleInfo.points > 0 ? `+${styleInfo.points}` : '0'})</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LeagueChampionsView;