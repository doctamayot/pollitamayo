import React, { useState, useMemo } from 'react';
import { doc, getDoc, updateDoc, collection, query, getDocs, writeBatch, increment, serverTimestamp, deleteField, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION, USERS_COLLECTION } from '../config';
import { calculatePoints } from '../utils/scoring';

const AdminPanel = ({ quiniela }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    // --- Lógica interna sin cambios ---
    const handleConfigChange = async (field, value) => {
        try {
            const docRef = doc(db, 'quinielas', quiniela.id);
            await updateDoc(docRef, { [field]: value });
        } catch (error) { console.error(`Error al cambiar ${field}`, error); }
    };

    const handleActivationToggle = async (shouldActivate) => {
        await handleConfigChange('isActive', shouldActivate);
    };

    const handleToggleCloseQuiniela = async () => {
        setIsUpdating(true);
        const quinielaRef = doc(db, 'quinielas', quiniela.id);
        const freshQuinielaSnap = await getDoc(quinielaRef);
        const currentQuinielaData = freshQuinielaSnap.data();

        if (!currentQuinielaData.isClosed) {
            // --- Lógica para CERRAR Y PUNTUAR ---
            if (!window.confirm(`¿Seguro que quieres CERRAR y PUNTUAR la quiniela "${currentQuinielaData.name}"?`)) {
                setIsUpdating(false); return;
            }
            try {
                const predictionsRef = collection(db, 'quinielas', quiniela.id, 'predictions');
                const predictionsSnapshot = await getDocs(predictionsRef);
                const allPredictions = predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (allPredictions.length === 0) {
                    await updateDoc(quinielaRef, { isClosed: true, winnersData: [] });
                    setIsUpdating(false); return;
                }

                const scores = allPredictions.map(pred => {
                    let totalPoints = 0;
                    let aciertosExactos = 0;
                    currentQuinielaData.matches.forEach(match => {
                        const points = calculatePoints(pred.predictions[match.id], currentQuinielaData.realResults?.[match.id]);
                        if (points === 6) aciertosExactos++;
                        totalPoints += points;
                    });
                    return { userId: pred.id, apostador: pred.apostador, points: totalPoints, aciertosExactos };
                });

                const highscore = Math.max(...scores.map(s => s.points));
                const lowestScore = Math.min(...scores.map(s => s.points));
                const winners = scores.filter(score => score.points === highscore);
                const winnersData = winners.map(w => ({ userId: w.userId, displayName: w.apostador, points: w.points }));

                const batch = writeBatch(db);

                scores.forEach(score => {
                    const userRef = doc(db, USERS_COLLECTION, score.userId);
                    const userUpdateData = { totalPoints: increment(score.points) };
                    const newAchievements = [];
                    if (score.points === lowestScore) {
                        userUpdateData.lastPlaceFinishes = increment(1);
                        newAchievements.push('DEBUT_FONDO');
                    }
                    if (score.points >= 30) newAchievements.push('GOLEADOR_FECHA');
                    if (score.aciertosExactos >= 5) newAchievements.push('QUINIELA_DIAMANTE');
                    if (score.aciertosExactos === 0) {
                        newAchievements.push('POLVORA_MOJADA');
                    }

                    if (newAchievements.length > 0) {
                        userUpdateData.achievements = arrayUnion(...newAchievements);
                    }
                    batch.set(userRef, userUpdateData, { merge: true });
                });

                winners.forEach(winner => {
                    const leaderboardRef = doc(db, 'leaderboard', winner.userId);
                    batch.set(leaderboardRef, { displayName: winner.apostador, totalWins: increment(1), lastWinAt: serverTimestamp() }, { merge: true });
                });

                batch.update(quinielaRef, { isClosed: true, winnersData: winnersData });
                await batch.commit();

            } catch (error) { console.error("Error al cerrar la quiniela:", error); }
        } else {
            // --- Lógica para RE-ABRIR ---
            if (!window.confirm("¿Re-abrir esta quiniela? Se revertirán los puntos y victorias otorgados.")) {
                setIsUpdating(false); return;
            }
            try {
                const predictionsRef = collection(db, 'quinielas', quiniela.id, 'predictions');
                const predictionsSnapshot = await getDocs(predictionsRef);
                const allPredictions = predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const batch = writeBatch(db);

                if (allPredictions.length > 0) {
                    const scores = allPredictions.map(pred => {
                        let totalPoints = 0;
                        currentQuinielaData.matches.forEach(match => {
                            totalPoints += calculatePoints(pred.predictions[match.id], currentQuinielaData.realResults?.[match.id]);
                        });
                        return { userId: pred.id, points: totalPoints };
                    });
                    const lowestScore = Math.min(...scores.map(s => s.points));

                    scores.forEach(score => {
                        const userRef = doc(db, USERS_COLLECTION, score.userId);
                        const userUpdateData = {
                            totalPoints: increment(-score.points)
                        };
                        if (score.points === lowestScore) {
                            userUpdateData.lastPlaceFinishes = increment(-1);
                        }
                        batch.set(userRef, userUpdateData, { merge: true });
                    });
                }

                if (currentQuinielaData.winnersData && currentQuinielaData.winnersData.length > 0) {
                    currentQuinielaData.winnersData.forEach(winner => {
                        const leaderboardRef = doc(db, 'leaderboard', winner.userId);
                        batch.update(leaderboardRef, { totalWins: increment(-1) });
                    });
                }

                batch.update(quinielaRef, { isClosed: false, winnersData: deleteField() });
                await batch.commit();
            } catch (error) { console.error("Error al re-abrir la quiniela:", error); }
        }
        setIsUpdating(false);
    };

    const allResultsFilled = useMemo(() => {
        if (!quiniela || !quiniela.matches || !quiniela.realResults) return false;
        const numberOfMatches = quiniela.matches.length;
        const filledResultsCount = Object.values(quiniela.realResults).filter(result => result && result.home !== '' && result.away !== '').length;
        return numberOfMatches > 0 && numberOfMatches === filledResultsCount;
    }, [quiniela]);
    // --- Fin de la lógica interna ---

    return (
        // --- ▼▼▼ CÓDIGO DE LA INTERFAZ ACTUALIZADO ▼▼▼ ---
        <div className="bg-uefa-dark-blue-secondary/80 p-4 rounded-lg mb-6 flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0 border border-uefa-border">
            <h3 className="text-white font-bold text-sm sm:text-base">Panel de Admin: <span className="text-uefa-cyan">{quiniela.name}</span></h3>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                
                {/* Toggle "Activa" */}
                <div className="flex items-center">
                    <span className={`mr-3 text-sm font-medium ${quiniela.isActive ? 'text-uefa-cyan' : 'text-uefa-text-secondary'}`}>Activa</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.isActive || false} onChange={(e) => handleActivationToggle(e.target.checked)} className="sr-only peer" disabled={isUpdating}/>
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-uefa-magenta peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-uefa-magenta"></div>
                    </label>
                </div>

                {/* Toggle "Mostrar Puntuación" */}
                <div className="flex items-center">
                    <span className={`mr-3 text-sm font-medium ${quiniela.resultsVisible ? 'text-uefa-cyan' : 'text-uefa-text-secondary'}`}>Mostrar Puntuación</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.resultsVisible || false} onChange={(e) => handleConfigChange('resultsVisible', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-uefa-magenta peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-uefa-magenta"></div>
                    </label>
                </div>

                {/* Toggle "Bloquear" */}
                <div className="flex items-center">
                    <span className={`mr-3 text-sm font-medium ${quiniela.locked ? 'text-uefa-cyan' : 'text-uefa-text-secondary'}`}>Bloquear</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.locked || false} onChange={(e) => handleConfigChange('locked', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-uefa-magenta peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-uefa-magenta"></div>
                    </label>
                </div>

                {/* Botón de Acción Principal */}
                <div className="flex flex-col items-center">
                    <button
                        onClick={handleToggleCloseQuiniela}
                        disabled={isUpdating || (!allResultsFilled && !quiniela.isClosed)}
                        className={`font-bold py-2 px-4 rounded-md text-sm transition ${quiniela.isClosed ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-uefa-primary-blue hover:bg-blue-500 text-white'} disabled:bg-slate-600 disabled:cursor-not-allowed`}
                    >
                        {isUpdating ? 'Procesando...' : (quiniela.isClosed ? 'Re-abrir Quiniela' : 'Cerrar y Puntuar')}
                    </button>
                    {!allResultsFilled && !quiniela.isClosed && (<span className="text-xs text-uefa-text-secondary mt-1">Llenar resultados para cerrar</span>)}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;