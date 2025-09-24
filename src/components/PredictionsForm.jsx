import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// --- ▼▼▼ DICCIONARIO DE TRADUCCIÓN AÑADIDO ▼▼▼ ---
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

const MatchInput = ({ partido, value, onChange, disabled, liveStatuses }) => {
    const currentStatus = liveStatuses[partido.id] || partido.status;
    return (
        // Contenedor principal de la tarjeta con nuevo fondo y borde cian
        <div className="col-span-1 bg-uefa-dark-blue-secondary p-3 rounded-lg border border-uefa-cyan/30 shadow-lg">
            <div className="flex justify-between items-center text-xs text-uefa-text-secondary mb-3 font-semibold">
                <span>{new Date(partido.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {currentStatus && (
                    <span className="text-uefa-cyan font-bold">{statusTranslations[currentStatus] || currentStatus}</span>
                )}
            </div>
            <div className="flex items-center justify-between gap-x-2">
                <label htmlFor={`${partido.id}-home`} className="flex items-center justify-end sm:text-sm text-[10px] font-bold text-white flex-1 min-w-0">
                    <span className="text-right">{partido.home}</span>
                    <div className="ml-2 h-6 w-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-700">
                        <img
                            src={partido.homeCrest || `https://flagcdn.com/w20/${partido.homeCode}.png`}
                            alt={partido.home}
                            className="h-full w-full object-contain"
                        />
                    </div>
                </label>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <input type="number" id={`${partido.id}-home`} name={`${partido.id}-home`} value={value.home} onChange={onChange} min="0" className="w-14 text-center form-input py-2 text-lg font-bold" required disabled={disabled} />
                    <span className="text-slate-400">-</span>
                    <input type="number" id={`${partido.id}-away`} name={`${partido.id}-away`} value={value.away} onChange={onChange} min="0" className="w-14 text-center form-input py-2 text-lg font-bold" required disabled={disabled} />
                </div>
                <label htmlFor={`${partido.id}-away`} className="flex items-center sm:text-sm text-[10px] font-bold text-white flex-1 min-w-0">
                    <div className="mr-2 h-6 w-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-700">
                        <img
                            src={partido.awayCrest || `https://flagcdn.com/w20/${partido.awayCode}.png`}
                            alt={partido.away}
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <span>{partido.away}</span>
                </label>
            </div>
        </div>
    )
};


const PredictionsForm = ({ user, quiniela, allPredictions, liveStatuses }) => {
    const [predictions, setPredictions] = useState({});
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const userPrediction = allPredictions.find(p => p.id === user.uid);
        const initialPredictions = {};
        quiniela.matches.forEach(p => {
            initialPredictions[p.id] = {
                home: userPrediction?.predictions?.[p.id]?.home || '',
                away: userPrediction?.predictions?.[p.id]?.away || '',
            };
        });
        setPredictions(initialPredictions);
    }, [quiniela, allPredictions, user.uid]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const sanitizedValue = value.replace(/[^0-9]/g, '');
        const nameParts = name.split('-');
        const team = nameParts.pop();
        const partidoId = nameParts.join('-');
        setPredictions(prev => ({ ...prev, [partidoId]: { ...prev[partidoId], [team]: sanitizedValue }}));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setFeedback('Guardando...');
        try {
            const docRef = doc(db, 'quinielas', quiniela.id, 'predictions', user.uid);
            await setDoc(docRef, { apostador: user.displayName, predictions, timestamp: serverTimestamp() });
            setFeedback('¡Tus predicciones se han guardado con éxito!');
        } catch (error) {
            console.error("Error al guardar:", error);
            setFeedback('Error al guardar. Inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
            setTimeout(() => setFeedback(''), 3000);
        }
    };
    
    const isLocked = quiniela.locked;
    const buttonText = isLocked ? 'Predicciones Cerradas' : 'Guardar mis Predicciones';
    const buttonClasses = isLocked
        ? 'w-full sm:w-auto bg-slate-500 text-white font-bold py-3 px-6 rounded-lg cursor-not-allowed opacity-70'
        : 'w-full sm:w-auto bg-uefa-primary-blue hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-md';

    const groupedMatches = quiniela.matches.reduce((acc, match) => {
        const champ = match.championship || 'Otros';
        if (!acc[champ]) { acc[champ] = []; }
        acc[champ].push(match);
        return acc;
    }, {});

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-8">
                {Object.keys(groupedMatches).map(championship => (
                    <div key={championship}>
                        <h3 className="text-xl font-bold text-uefa-cyan border-b border-uefa-border/50 pb-3 mb-4">
                            {championship}
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {groupedMatches[championship].map((partido) => (
                                <MatchInput key={partido.id} partido={partido} value={predictions[partido.id] || {home: '', away: ''}} onChange={handleChange} disabled={isLocked} liveStatuses={liveStatuses}/>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                <button type="submit" className={buttonClasses} disabled={isLocked || isLoading}>
                    {isLoading ? 'Guardando...' : buttonText}
                </button>
                {feedback && <div className="mt-4 text-center text-green-400 font-medium">{feedback}</div>}
            </div>
        </form>
    );
};

export default PredictionsForm;