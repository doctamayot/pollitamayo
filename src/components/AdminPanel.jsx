

import React, { useState } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION, USERS_COLLECTION } from '../config';
import { calculatePoints } from '../utils/scoring'; // Importaremos la lógica de puntuación

const AdminPanel = ({ quiniela }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleConfigChange = async (field, value) => {
        try {
            const docRef = doc(db, 'quinielas', quiniela.id);
            await updateDoc(docRef, { [field]: value });
        } catch (error) {
            console.error(`Error al cambiar ${field}`, error);
        }
    }

    const handleActivationToggle = async (shouldActivate) => {
        setIsUpdating(true);
        if (shouldActivate) {
            // Lógica para activar (YA NO PIDE CONFIRMACIÓN)
            try {
                const batch = writeBatch(db);
                const q = query(collection(db, QUINIELAS_COLLECTION), where("isActive", "==", true));
                const activeQuinielasSnapshot = await getDocs(q);
                activeQuinielasSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { isActive: false });
                });
                const newActiveQuinielaRef = doc(db, QUINIELAS_COLLECTION, quiniela.id);
                batch.update(newActiveQuinielaRef, { isActive: true });
                await batch.commit();
            } catch (error) {
                console.error("Error al activar la quiniela:", error);
            }
        } else {
            // Lógica simple para desactivar
            try {
                await handleConfigChange('isActive', false);
            } catch (error) {
                console.error("Error al desactivar la quiniela:", error);
            }
        }
        setIsUpdating(false);
    };
    
    // ***** NUEVA FUNCIÓN PARA CERRAR LA QUINIELA *****
    const handleCloseQuiniela = async () => {
        if (!window.confirm(`¿Estás seguro de que quieres CERRAR y PUNTUAR la quiniela "${quiniela.name}"? Esta acción es final.`)) {
            return;
        }
        setIsClosing(true);

        try {
            // 1. Obtener todas las predicciones de esta quiniela
            const predictionsRef = collection(db, 'quinielas', quiniela.id, 'predictions');
            const predictionsSnapshot = await getDocs(predictionsRef);
            const allPredictions = predictionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (allPredictions.length === 0) {
                alert("No hay predicciones para puntuar. Cerrando sin ganadores.");
                await updateDoc(doc(db, 'quinielas', quiniela.id), { isClosed: true });
                setIsClosing(false);
                return;
            }

            // 2. Calcular los puntajes finales
            let highscore = -1;
            const scores = allPredictions.map(pred => {
                let totalPoints = 0;
                quiniela.matches.forEach(match => {
                    totalPoints += calculatePoints(pred.predictions[match.id], quiniela.realResults?.[match.id]);
                });
                if (totalPoints > highscore) highscore = totalPoints;
                return { userId: pred.id, apostador: pred.apostador, points: totalPoints };
            });

            // 3. Encontrar al/los ganador(es)
            const winners = scores.filter(score => score.points === highscore);
            
            // 4. Actualizar el leaderboard y cerrar la quiniela en un batch
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
            batch.update(quinielaRef, { isClosed: true });

            await batch.commit();

            const winnerNames = winners.map(w => w.apostador).join(', ');
            alert(`¡Quiniela cerrada! Ganador(es): ${winnerNames} con ${highscore} puntos. El leaderboard ha sido actualizado.`);

        } catch (error) {
            console.error("Error al cerrar la quiniela:", error);
            alert("Hubo un error al cerrar la quiniela.");
        } finally {
            setIsClosing(false);
        }
    };

    return (
        <div className="bg-gray-700 p-4 rounded-md mb-6 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
             <h3 className="text-white font-bold text-sm sm:text-base">Panel de Admin para "{quiniela.name}"</h3>
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                
                <div className="flex items-center">
                    <span className={`mr-3 text-sm font-medium ${quiniela.isActive ? 'text-green-400' : 'text-gray-300'}`}>
                        Quiniela Activa
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={quiniela.isActive || false} 
                            onChange={(e) => handleActivationToggle(e.target.checked)} 
                            className="sr-only peer"
                            disabled={isUpdating}
                        />
                        <div className="w-11 h-6 bg-gray-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-green-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                </div>

                <div className="flex items-center">
                    <span className="mr-3 text-sm text-gray-300">Permitir ver predicciones</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.resultsVisible || false} onChange={(e) => handleConfigChange('resultsVisible', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                
                <div className="flex items-center">
                    <span className="mr-3 text-sm text-gray-300">Bloquear predicciones</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.locked || false} onChange={(e) => handleConfigChange('locked', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* --- NUEVO INTERRUPTOR PARA CERRAR QUINIELA --- */}
                {!quiniela.isClosed && (
                     <div className="flex items-center">
                        <span className="mr-3 text-sm font-medium text-red-400">Cerrar Quiniela</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={false}
                                onChange={handleCloseQuiniela}
                                className="sr-only peer"
                                disabled={isClosing}
                            />
                            <div className="w-11 h-6 bg-gray-500 rounded-full peer peer-focus:ring-2 peer-focus:ring-red-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                    </div>
                )}
                 {quiniela.isClosed && (
                    <div className="p-3 rounded-md bg-gray-800 text-center">
                        <div className="font-bold text-gray-400">QUINIELA CERRADA</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;

// La lógica de calculatePoints y los demás interruptores se mantiene igual,
// pero la he omitido aquí para no hacer el bloque de código tan largo.
// Asegúrate de fusionar este cambio con tu archivo AdminPanel.jsx existente.