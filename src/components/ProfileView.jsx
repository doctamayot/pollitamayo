import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { calculatePoints } from '../utils/scoring';

const achievementsMap = {
    'ROMPIENDO_HIELO': { icon: '🥉', name: 'Rompiendo el Hielo', desc: 'Participaste en tu primera quiniela.' },
    'REY_COLINA': { icon: '🏆', name: 'Rey de la Colina', desc: 'Ganaste tu primera quiniela.' },
    'FRANCOTIRADOR': { icon: '🎯', name: 'Francotirador', desc: 'Acertaste tu primer marcador exacto (6 puntos).' },
    'EN_RACHA': { icon: '🔥', name: 'En Racha', desc: 'Lograste una racha de 3 o más quinielas ganadas.' },
    'GOLEADOR_FECHA': { icon: '⚽', name: 'Goleador de la Fecha', desc: 'Lograste 30 o más puntos en una sola quiniela.' },
    'QUINIELA_DIAMANTE': { icon: '💎', name: 'La Quiniela de Diamante', desc: 'Conseguiste 5 o más aciertos exactos en una quiniela.' },
    'MARATON_PUNTOS': { icon: '🏅', name: 'Maratón de Puntos', desc: 'Alcanzaste un total de 500 puntos de por vida.' },
    'DEBUT_FONDO': { icon: '⚓', name: 'Debut en el Fondo', desc: 'Quedaste de último en una quiniela por primera vez.' },
    'POLVORA_MOJADA': { icon: '💨', name: 'Pólvora Mojada', desc: 'Completaste una quiniela sin acertar ningún marcador exacto.' },
};

const ProfileView = ({ userId, currentUser }) => {
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    // --- ▼▼▼ LÍNEA RESTAURADA ▼▼▼ ---
    const [visibleHitsCount, setVisibleHitsCount] = useState(5);

    useEffect(() => {
        const calculateProfile = async () => {
            if (!userId) { setLoading(false); return; }
            setLoading(true);
            try {
                // ... (toda la lógica de fetching y cálculo no cambia)
                const userDocRef = doc(db, 'users', userId);
                const leaderboardDocRef = doc(db, 'leaderboard', userId);
                const quinielasQuery = query(collection(db, 'quinielas'), where("isClosed", "==", true));
                const [userDocSnap, leaderboardDocSnap, quinielasSnapshot] = await Promise.all([
                    getDoc(userDocRef), getDoc(leaderboardDocRef), getDocs(quinielasQuery)
                ]);
                if (!userDocSnap.exists()) throw new Error("El perfil de este usuario no existe.");
                const userProfile = userDocSnap.data();
                const leaderboardEntry = leaderboardDocSnap.data();
                const closedQuinielas = quinielasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const predictionsPromises = closedQuinielas.map(q => getDoc(doc(db, 'quinielas', q.id, 'predictions', userId)));
                const predictionsSnapshots = await Promise.all(predictionsPromises);
                let quinielasParticipadas = [];
                predictionsSnapshots.forEach((predSnap, index) => {
                    if (predSnap.exists()) {
                        quinielasParticipadas.push({ ...closedQuinielas[index], userPredictionData: predSnap.data() });
                    }
                });
                quinielasParticipadas.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
                let dynamicStats = { totalAciertosExactos: 0, mejorRachaVictorias: 0 };
                let exactHitsDetails = [];
                let newAchievements = [];
                let currentAchievements = userProfile.achievements || [];
                let rachaActualVictorias = 0;
                quinielasParticipadas.forEach(quiniela => {
                    const esGanador = quiniela.winnersData?.some(winner => winner.userId === userId);
                    if (esGanador) { rachaActualVictorias++; } else {
                        if (rachaActualVictorias > dynamicStats.mejorRachaVictorias) {
                            dynamicStats.mejorRachaVictorias = rachaActualVictorias;
                        }
                        rachaActualVictorias = 0;
                    }
                    const userPrediction = quiniela.userPredictionData;
                    if (!userPrediction || !quiniela.matches) return;
                    quiniela.matches.forEach(match => {
                        const points = calculatePoints(userPrediction.predictions[match.id], quiniela.realResults?.[match.id]);
                        if (points === 6) {
                            dynamicStats.totalAciertosExactos++;
                            exactHitsDetails.push({
                                id: `${quiniela.id}-${match.id}`,
                                quinielaName: quiniela.name,
                                matchData: match,
                                prediction: userPrediction.predictions[match.id],
                                realResult: quiniela.realResults?.[match.id]
                            });
                        }
                    });
                });
                if (rachaActualVictorias > dynamicStats.mejorRachaVictorias) {
                    dynamicStats.mejorRachaVictorias = rachaActualVictorias;
                }
                if (quinielasParticipadas.length > 0 && !currentAchievements.includes('ROMPIENDO_HIELO')) newAchievements.push('ROMPIENDO_HIELO');
                if (leaderboardEntry && leaderboardEntry.totalWins > 0 && !currentAchievements.includes('REY_COLINA')) newAchievements.push('REY_COLINA');
                if (dynamicStats.mejorRachaVictorias >= 3 && !currentAchievements.includes('EN_RACHA')) newAchievements.push('EN_RACHA');
                if (dynamicStats.totalAciertosExactos > 0 && !currentAchievements.includes('FRANCOTIRADOR')) newAchievements.push('FRANCOTIRADOR');
                if (userProfile.totalPoints >= 500 && !currentAchievements.includes('MARATON_PUNTOS')) newAchievements.push('MARATON_PUNTOS');
                if (newAchievements.length > 0 && currentUser && currentUser.uid === userId) {
                    await updateDoc(userDocRef, { achievements: arrayUnion(...newAchievements) });
                }
                setProfileData({
                    displayName: userProfile.displayName,
                    stats: {
                        quinielasJugadas: quinielasParticipadas.length,
                        totalAciertosExactos: dynamicStats.totalAciertosExactos,
                        mejorRachaVictorias: dynamicStats.mejorRachaVictorias < 2 ? 0 : dynamicStats.mejorRachaVictorias,
                        totalPoints: userProfile.totalPoints || 0,
                        lastPlaceFinishes: userProfile.lastPlaceFinishes || 0,
                    },
                    totalWins: leaderboardEntry?.totalWins || 0,
                    achievements: [...new Set([...currentAchievements, ...newAchievements])],
                    exactHits: exactHitsDetails.reverse()
                });
            } catch (error) { console.error("Error al calcular el perfil:", error); }
            finally { setLoading(false); }
        };
        calculateProfile();
    }, [userId, currentUser]);

    if (loading) return <div className="text-center text-uefa-text-secondary py-16">Calculando estadísticas...</div>;
    if (!profileData) return <div className="text-center text-uefa-text-secondary py-16">No se pudo cargar el perfil.</div>;

    const { displayName, stats, totalWins, achievements, exactHits } = profileData;
    
    // --- ▼▼▼ FUNCIÓN RESTAURADA ▼▼▼ ---
    const handleLoadMore = () => {
        setVisibleHitsCount(prevCount => prevCount + 5);
    };

    return (
        <div className="bg-uefa-dark-blue-secondary p-4 sm:p-8 rounded-lg max-w-4xl mx-auto border border-uefa-border">
            <h2 className="text-3xl font-bold text-uefa-cyan mb-8 text-center">{displayName}</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center mb-10">
                <div className="bg-uefa-dark-blue/50 p-4 rounded-lg border border-uefa-border/50"><p className="text-3xl font-bold text-white">{stats.quinielasJugadas}</p><p className="text-xs text-uefa-text-secondary uppercase tracking-wider">Jugadas</p></div>
                <div className="bg-uefa-dark-blue/50 p-4 rounded-lg border border-uefa-border/50"><p className="text-3xl font-bold text-white">{totalWins}</p><p className="text-xs text-uefa-text-secondary uppercase tracking-wider">Victorias</p></div>
                <div className="bg-uefa-dark-blue/50 p-4 rounded-lg border border-uefa-border/50"><p className="text-3xl font-bold text-white">{stats.totalPoints}</p><p className="text-xs text-uefa-text-secondary uppercase tracking-wider">Puntos Totales</p></div>
                <div className="bg-uefa-dark-blue/50 p-4 rounded-lg border border-uefa-border/50"><p className="text-3xl font-bold text-white">{stats.totalAciertosExactos}</p><p className="text-xs text-uefa-text-secondary uppercase tracking-wider">Aciertos Exactos</p></div>
                <div className="bg-uefa-dark-blue/50 p-4 rounded-lg border border-uefa-border/50"><p className="text-3xl font-bold text-white">{stats.mejorRachaVictorias}</p><p className="text-xs text-uefa-text-secondary uppercase tracking-wider">Mejor Racha</p></div>
                <div className="bg-uefa-dark-blue/50 p-4 rounded-lg border border-uefa-border/50"><p className="text-3xl font-bold text-white">{stats.lastPlaceFinishes}</p><p className="text-xs text-uefa-text-secondary uppercase tracking-wider">Último Lugar</p></div>
            </div>
            
            <h3 className="text-xl font-bold text-uefa-cyan mb-4 text-center">Insignias y Logros</h3>
            <div className="space-y-3">
                {achievements && achievements.length > 0 ? achievements.map(key => achievementsMap[key] && (
                    <div key={key} className="flex items-center bg-uefa-dark-blue/50 p-4 rounded-md border border-uefa-border/50">
                        <span className="text-3xl mr-4">{achievementsMap[key].icon}</span>
                        <div>
                            <p className="font-bold text-white">{achievementsMap[key].name}</p>
                            <p className="text-sm text-uefa-text-secondary">{achievementsMap[key].desc}</p>
                        </div>
                    </div>
                )) : (<p className="text-center text-uefa-text-secondary py-4">Aún no has desbloqueado ninguna insignia.</p>)}
            </div>

            <h3 className="text-xl font-bold text-uefa-cyan mt-10 mb-4 text-center">Muro de la Fama: Aciertos Perfectos</h3>
            <div className="space-y-3">
                {exactHits && exactHits.length > 0 ? (
                    exactHits.slice(0, visibleHitsCount).map(hit => (
                        <div key={hit.id} className="bg-uefa-dark-blue/60 p-4 rounded-md border border-uefa-border/50">
                            <p className="text-xs text-uefa-text-secondary font-semibold mb-2">
                                En la quiniela: <span className="text-uefa-cyan">{hit.quinielaName}</span>
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-white">
                                <div className="flex items-center justify-end flex-1 space-x-2">
                                    <span className="text-right">{hit.matchData.home}</span>
                                    <img src={hit.matchData.homeCrest || `https://flagcdn.com/w20/${hit.matchData.homeCode}.png`} className="w-5 h-5 object-contain" alt={hit.matchData.home} />
                                </div>
                                <div className="flex items-center justify-center space-x-2 w-20 flex-shrink-0">
                                    <span className="font-bold text-lg text-green-400">{hit.realResult.home}</span>
                                    <span className="text-uefa-text-secondary text-sm">vs</span>
                                    <span className="font-bold text-lg text-green-400">{hit.realResult.away}</span>
                                </div>
                                <div className="flex items-center justify-start flex-1 space-x-2">
                                    <img src={hit.matchData.awayCrest || `https://flagcdn.com/w20/${hit.matchData.awayCode}.png`} className="w-5 h-5 object-contain" alt={hit.matchData.away} />
                                    <span>{hit.matchData.away}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-uefa-text-secondary py-4">Aún no has logrado un acierto perfecto.</p>
                )}
            </div>

            {exactHits && visibleHitsCount < exactHits.length && (
                <div className="text-center mt-6">
                    <button 
                        onClick={handleLoadMore}
                        className="bg-uefa-primary-blue hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition duration-300"
                    >
                        Cargar Más
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileView;