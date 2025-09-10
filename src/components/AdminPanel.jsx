import React, { useState, useMemo } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, increment, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION } from '../config';
import { calculatePoints } from '../utils/scoring';

const AdminPanel = ({ quiniela }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleConfigChange = async (field, value) => {
        try {
            const docRef = doc(db, 'quinielas', quiniela.id);
            await updateDoc(docRef, { [field]: value });
        } catch (error) {
            console.error(`Error al cambiar ${field}`, error);
        }
    };

    // ***** LÓGICA DE ACTIVACIÓN SIMPLIFICADA *****
    // Ahora solo cambia el estado de la quiniela actual, sin afectar a las demás.
    const handleActivationToggle = async (shouldActivate) => {
        await handleConfigChange('isActive', shouldActivate);
    };
    
    const handleToggleCloseQuiniela = async () => {
        setIsUpdating(true);
        if (!quiniela.isClosed) {
            if (!window.confirm(`¿Estás seguro de que quieres CERRAR y PUNTUAR la quiniela "${quiniela.name}"? Esta acción es final.`)) {
                setIsUpdating(false);
                return;
            }
            try {
                const predictionsRef = collection(db, 'quinielas', quiniela.id, 'predictions');
                const predictionsSnapshot = await getDocs(predictionsRef);
                const allPredictions = predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (allPredictions.length === 0) {
                    await updateDoc(doc(db, 'quinielas', quiniela.id), { isClosed: true, winnersData: [] });
                    setIsUpdating(false);
                    return;
                }

                let highscore = -1;
                const scores = allPredictions.map(pred => {
                    let totalPoints = 0;
                    quiniela.matches.forEach(match => {
                        totalPoints += calculatePoints(pred.predictions[match.id], quiniela.realResults?.[match.id]);
                    });
                    if (totalPoints > highscore) highscore = totalPoints;
                    return { userId: pred.id, apostador: pred.apostador, points: totalPoints };
                });

                const winners = scores.filter(score => score.points === highscore);
                const winnersData = winners.map(w => ({ userId: w.userId, displayName: w.apostador, points: w.points }));
                
                const batch = writeBatch(db);
                winners.forEach(winner => {
                    const leaderboardRef = doc(db, 'leaderboard', winner.userId);
                    batch.set(leaderboardRef, {
                        displayName: winner.apostador,
                        totalWins: increment(1),
                        lastWinAt: serverTimestamp()
                    }, { merge: true });
                });
                
                const quinielaRef = doc(db, 'quinielas', quiniela.id);
                batch.update(quinielaRef, { isClosed: true, winnersData: winnersData });
                await batch.commit();

            } catch (error) {
                console.error("Error al cerrar la quiniela:", error);
            }
        } else {
            if (!window.confirm("¿Re-abrir esta quiniela? Los puntos de victoria otorgados a los ganadores en el Leaderboard serán revertidos.")) {
                setIsUpdating(false);
                return;
            }
            try {
                const batch = writeBatch(db);
                if (quiniela.winnersData && quiniela.winnersData.length > 0) {
                    quiniela.winnersData.forEach(winner => {
                        const leaderboardRef = doc(db, 'leaderboard', winner.userId);
                        batch.update(leaderboardRef, { totalWins: increment(-1) });
                    });
                }
                
                const quinielaRef = doc(db, 'quinielas', quiniela.id);
                batch.update(quinielaRef, { isClosed: false, winnersData: deleteField() });
                await batch.commit();
            } catch (error) {
                console.error("Error al re-abrir la quiniela:", error);
            }
        }
        setIsUpdating(false);
    };
    
    const allResultsFilled = useMemo(() => {
        if (!quiniela || !quiniela.matches || !quiniela.realResults) {
            return false;
        }
        const numberOfMatches = quiniela.matches.length;
        const filledResultsCount = Object.values(quiniela.realResults).filter(
            result => result && result.home !== '' && result.away !== ''
        ).length;
        
        return numberOfMatches > 0 && numberOfMatches === filledResultsCount;
    }, [quiniela]);

    return (
        <div className="bg-slate-700/50 p-4 rounded-lg mb-6 flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
            <h3 className="text-white font-bold text-sm sm:text-base">
                Panel de Admin: <span className="text-amber-300">{quiniela.name}</span>
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                
                <div className="flex items-center">
                    <span className={`mr-3 text-sm font-medium ${quiniela.isActive ? 'text-green-400' : 'text-slate-300'}`}>
                        Activa
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={quiniela.isActive || false} 
                            onChange={(e) => handleActivationToggle(e.target.checked)} 
                            className="sr-only peer"
                            disabled={isUpdating}
                        />
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-green-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                </div>

                <div className="flex items-center">
                    <span className="mr-3 text-sm text-slate-300">Mostrar Puntuación</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.resultsVisible || false} onChange={(e) => handleConfigChange('resultsVisible', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                
                <div className="flex items-center">
                    <span className="mr-3 text-sm text-slate-300">Bloquear</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.locked || false} onChange={(e) => handleConfigChange('locked', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                
                <div className="flex flex-col items-center">
                    <button
                        onClick={handleToggleCloseQuiniela}
                        disabled={isUpdating || (!allResultsFilled && !quiniela.isClosed)}
                        className={`font-bold py-2 px-4 rounded-md text-sm transition
                            ${quiniela.isClosed 
                                ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
                                : 'bg-red-600 hover:bg-red-700 text-white'}
                            disabled:bg-slate-500 disabled:cursor-not-allowed`}
                    >
                        {isUpdating ? 'Procesando...' : (quiniela.isClosed ? 'Re-abrir Quiniela' : 'Cerrar y Puntuar')}
                    </button>
                    {!allResultsFilled && !quiniela.isClosed && (
                        <span className="text-xs text-slate-400 mt-1">Llenar resultados para cerrar</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;