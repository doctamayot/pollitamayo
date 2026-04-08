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
    const [visibleHitsCount, setVisibleHitsCount] = useState(5);

    useEffect(() => {
        const calculateProfile = async () => {
            if (!userId) { setLoading(false); return; }
            setLoading(true);
            try {
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

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-foreground-muted font-bold tracking-widest uppercase text-sm">Calculando Estadísticas...</p>
        </div>
    );
    
    if (!profileData) return (
        <div className="text-center py-16 animate-fade-in bg-card border border-card-border rounded-3xl shadow-sm">
            <div className="text-5xl mb-4 opacity-50">👤</div>
            <h3 className="text-xl font-bold text-foreground mb-2">Perfil no encontrado</h3>
            <p className="text-foreground-muted">No se pudo cargar la información de este usuario.</p>
        </div>
    );

    const { displayName, stats, totalWins, achievements, exactHits } = profileData;
    
    const handleLoadMore = () => {
        setVisibleHitsCount(prevCount => prevCount + 5);
    };

    return (
        <div className="bg-card p-4 sm:p-8 rounded-3xl border border-card-border max-w-4xl mx-auto shadow-sm animate-fade-in w-full">
            <div className="text-center mb-10">
                <div className="w-20 h-20 bg-background-offset border border-border rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
                    👤
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter">
                    {displayName}
                </h2>
                <p className="text-primary font-bold tracking-widest uppercase text-xs mt-2">
                    Estadísticas Oficiales
                </p>
            </div>
            
            {/* --- ESTADÍSTICAS GENERALES --- */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-12">
                <div className="bg-background-offset p-4 rounded-2xl border border-border text-center flex flex-col justify-center shadow-inner hover:border-primary/50 transition-colors">
                    <p className="text-3xl font-black text-foreground">{stats.quinielasJugadas}</p>
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mt-1">Jugadas</p>
                </div>
                <div className="bg-background-offset p-4 rounded-2xl border border-border text-center flex flex-col justify-center shadow-inner hover:border-primary/50 transition-colors">
                    <p className="text-3xl font-black text-primary">{totalWins}</p>
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mt-1">Victorias</p>
                </div>
                <div className="bg-background-offset p-4 rounded-2xl border border-border text-center flex flex-col justify-center shadow-inner hover:border-primary/50 transition-colors">
                    <p className="text-3xl font-black text-foreground">{stats.totalPoints}</p>
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mt-1">Pts Totales</p>
                </div>
                <div className="bg-background-offset p-4 rounded-2xl border border-border text-center flex flex-col justify-center shadow-inner hover:border-primary/50 transition-colors">
                    <p className="text-3xl font-black text-green-500">{stats.totalAciertosExactos}</p>
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mt-1">Aciertos 100%</p>
                </div>
                <div className="bg-background-offset p-4 rounded-2xl border border-border text-center flex flex-col justify-center shadow-inner hover:border-primary/50 transition-colors">
                    <p className="text-3xl font-black text-amber-500">{stats.mejorRachaVictorias}</p>
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mt-1">Mejor Racha</p>
                </div>
                <div className="bg-background-offset p-4 rounded-2xl border border-border text-center flex flex-col justify-center shadow-inner hover:border-primary/50 transition-colors">
                    <p className="text-3xl font-black text-red-500">{stats.lastPlaceFinishes}</p>
                    <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mt-1">Último Lugar</p>
                </div>
            </div>
            
            {/* --- INSIGNIAS Y LOGROS --- */}
            <div className="mb-12">
                <h3 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3 border-b border-border pb-3">
                    <span>🎖️</span> Insignias y Logros
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {achievements && achievements.length > 0 ? achievements.map(key => achievementsMap[key] && (
                        <div key={key} className="flex items-center bg-background-offset p-4 rounded-2xl border border-border hover:border-primary/50 transition-colors group shadow-sm">
                            <span className="text-4xl mr-4 group-hover:scale-110 transition-transform">{achievementsMap[key].icon}</span>
                            <div>
                                <p className="font-bold text-foreground">{achievementsMap[key].name}</p>
                                <p className="text-xs text-foreground-muted leading-relaxed mt-1">{achievementsMap[key].desc}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full bg-background-offset p-6 rounded-2xl border border-border text-center">
                            <p className="text-foreground-muted font-semibold">Aún no se han desbloqueado insignias.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MURO DE LA FAMA (ACIERTOS PERFECTOS) --- */}
            <div>
                <h3 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3 border-b border-border pb-3">
                    <span>🎯</span> Muro de la Fama: Aciertos Perfectos
                </h3>
                <div className="space-y-4">
                    {exactHits && exactHits.length > 0 ? (
                        <>
                            {exactHits.slice(0, visibleHitsCount).map(hit => (
                                <div key={hit.id} className="bg-background-offset p-4 sm:p-5 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-green-500/50 transition-colors">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-1">En la quiniela</p>
                                        <p className="text-sm font-black text-primary truncate max-w-[200px] sm:max-w-xs">{hit.quinielaName}</p>
                                    </div>
                                    
                                    <div className="flex items-center justify-center bg-card p-3 rounded-xl border border-card-border shadow-inner shrink-0">
                                        <div className="flex items-center justify-end w-24 sm:w-32 gap-2">
                                            <span className="text-xs font-bold text-foreground truncate">{hit.matchData.home}</span>
                                            <div className="w-6 h-6 bg-background rounded-full border border-border flex items-center justify-center shrink-0">
                                                <img src={hit.matchData.homeCrest || `https://flagcdn.com/w20/${hit.matchData.homeCode}.png`} className="w-4 h-4 object-contain" alt={hit.matchData.home} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-center gap-2 px-3">
                                            <span className="font-black text-lg text-green-500">{hit.realResult.home}</span>
                                            <span className="text-foreground-muted text-xs font-bold">-</span>
                                            <span className="font-black text-lg text-green-500">{hit.realResult.away}</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-start w-24 sm:w-32 gap-2">
                                            <div className="w-6 h-6 bg-background rounded-full border border-border flex items-center justify-center shrink-0">
                                                <img src={hit.matchData.awayCrest || `https://flagcdn.com/w20/${hit.matchData.awayCode}.png`} className="w-4 h-4 object-contain" alt={hit.matchData.away} />
                                            </div>
                                            <span className="text-xs font-bold text-foreground truncate">{hit.matchData.away}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {visibleHitsCount < exactHits.length && (
                                <div className="text-center pt-4">
                                    <button 
                                        onClick={handleLoadMore}
                                        className="bg-card border border-border hover:border-primary text-foreground font-bold py-2.5 px-6 rounded-full transition-colors text-sm shadow-sm"
                                    >
                                        Ver Más Aciertos ({exactHits.length - visibleHitsCount})
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-background-offset p-8 rounded-2xl border border-border text-center shadow-inner">
                            <div className="text-4xl mb-3 opacity-50">🔭</div>
                            <p className="text-foreground-muted font-semibold">Aún no se ha logrado un acierto perfecto.</p>
                            <p className="text-xs text-foreground-muted mt-2">¡Sigue intentando para aparecer aquí!</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default ProfileView;