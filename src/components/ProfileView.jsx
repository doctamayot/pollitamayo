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
    // --- ▼▼▼ NUEVA INSIGNIA AÑADIDA ▼▼▼ ---
    'POLVORA_MOJADA': { icon: '💨', name: 'Pólvora Mojada', desc: 'Completaste una quiniela sin acertar ningún marcador exacto.' },
};

const ProfileView = ({ userId, currentUser }) => {
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const calculateProfile = async () => {
            if (!userId) {
                setLoading(false); return;
            }
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

                const dynamicStats = { totalAciertosExactos: 0, mejorRachaVictorias: 0 };
                let newAchievements = [];
                let currentAchievements = userProfile.achievements || [];
                let rachaActualVictorias = 0;

                quinielasParticipadas.forEach(quiniela => {
                    const esGanador = quiniela.winnersData?.some(winner => winner.userId === userId);
                    if (esGanador) rachaActualVictorias++;
                    else {
                        if (rachaActualVictorias > dynamicStats.mejorRachaVictorias) {
                            dynamicStats.mejorRachaVictorias = rachaActualVictorias;
                        }
                        rachaActualVictorias = 0;
                    }
                    const userPrediction = quiniela.userPredictionData;
                    if (!userPrediction || !quiniela.matches) return;
                    quiniela.matches.forEach(match => {
                        const points = calculatePoints(userPrediction.predictions[match.id], quiniela.realResults?.[match.id]);
                        if (points === 6) dynamicStats.totalAciertosExactos++;
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
                    achievements: [...new Set([...currentAchievements, ...newAchievements])]
                });

            } catch (error) {
                console.error("Error al calcular el perfil:", error);
            } finally {
                setLoading(false);
            }
        };
        calculateProfile();
    }, [userId, currentUser]);

    if (loading) return <div className="text-center text-slate-400 py-16">Calculando estadísticas...</div>;
    if (!profileData) return <div className="text-center text-slate-400 py-16">No se pudo cargar el perfil.</div>;

    const { displayName, stats, totalWins, achievements } = profileData;

    return (
        <div className="bg-slate-800/50 p-4 sm:p-8 rounded-lg max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-amber-400 mb-8 text-center">{displayName}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center mb-10">
                <div className="bg-slate-700/50 p-4 rounded-lg"><p className="text-3xl font-bold text-white">{stats.quinielasJugadas}</p><p className="text-xs text-slate-400 uppercase tracking-wider">Jugadas</p></div>
                <div className="bg-slate-700/50 p-4 rounded-lg"><p className="text-3xl font-bold text-white">{totalWins}</p><p className="text-xs text-slate-400 uppercase tracking-wider">Victorias</p></div>
                <div className="bg-slate-700/50 p-4 rounded-lg"><p className="text-3xl font-bold text-white">{stats.totalPoints}</p><p className="text-xs text-slate-400 uppercase tracking-wider">Puntos Totales</p></div>
                <div className="bg-slate-700/50 p-4 rounded-lg"><p className="text-3xl font-bold text-white">{stats.totalAciertosExactos}</p><p className="text-xs text-slate-400 uppercase tracking-wider">Aciertos Exactos</p></div>
                <div className="bg-slate-700/50 p-4 rounded-lg"><p className="text-3xl font-bold text-white">{stats.mejorRachaVictorias}</p><p className="text-xs text-slate-400 uppercase tracking-wider">Mejor Racha</p></div>
                <div className="bg-slate-700/50 p-4 rounded-lg"><p className="text-3xl font-bold text-white">{stats.lastPlaceFinishes}</p><p className="text-xs text-slate-400 uppercase tracking-wider">Último Lugar</p></div>
            </div>
            
            <h3 className="text-xl font-bold text-blue-400 mb-4 text-center">Insignias y Logros</h3>
            <div className="space-y-3">
                {achievements && achievements.length > 0 ? achievements.map(key => achievementsMap[key] && (
                    <div key={key} className="flex items-center bg-slate-900/50 p-4 rounded-md border border-slate-700">
                        <span className="text-3xl mr-4">{achievementsMap[key].icon}</span>
                        <div>
                            <p className="font-bold text-white">{achievementsMap[key].name}</p>
                            <p className="text-sm text-slate-400">{achievementsMap[key].desc}</p>
                        </div>
                    </div>
                )) : (<p className="text-center text-slate-500 py-4">Aún no has desbloqueado ninguna insignia.</p>)}
            </div>
        </div>
    );
};

export default ProfileView;