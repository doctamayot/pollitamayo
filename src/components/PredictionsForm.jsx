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
        // Contenedor principal de la tarjeta con clases adaptables
        <div className="col-span-1 bg-card p-4 rounded-2xl border border-card-border shadow-sm hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-center text-xs text-foreground-muted mb-4 font-semibold uppercase tracking-wider">
                <span>{new Date(partido.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {currentStatus && (
                    <span className={`font-bold ${currentStatus === 'IN_PLAY' || currentStatus === 'PAUSED' ? 'text-green-500 animate-pulse' : currentStatus === 'FINISHED' ? 'text-red-500' : 'text-primary'}`}>
                        {statusTranslations[currentStatus] || currentStatus}
                    </span>
                )}
            </div>
            
            <div className="flex items-center justify-between gap-x-2">
                <label htmlFor={`${partido.id}-home`} className="flex items-center justify-end sm:text-sm text-[10px] font-bold text-foreground flex-1 min-w-0 group cursor-pointer">
                    <span className="text-right truncate group-hover:text-primary transition-colors">{partido.home}</span>
                    <div className="ml-2 h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-background border border-border shadow-sm">
                        <img
                            src={partido.homeCrest || `https://flagcdn.com/w40/${partido.homeCode}.png`}
                            alt={partido.home}
                            className="h-full w-full object-contain p-0.5"
                        />
                    </div>
                </label>
                
                <div className="flex items-center space-x-2 flex-shrink-0 bg-background-offset p-2 rounded-xl border border-border">
                    <input 
                        type="number" 
                        id={`${partido.id}-home`} 
                        name={`${partido.id}-home`} 
                        value={value.home} 
                        onChange={onChange} 
                        min="0" 
                        className="w-12 h-12 text-center bg-card border border-card-border rounded-lg text-lg font-black text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-inner transition-shadow" 
                        required 
                        disabled={disabled} 
                        placeholder="-"
                    />
                    <span className="text-foreground-muted font-bold">-</span>
                    <input 
                        type="number" 
                        id={`${partido.id}-away`} 
                        name={`${partido.id}-away`} 
                        value={value.away} 
                        onChange={onChange} 
                        min="0" 
                        className="w-12 h-12 text-center bg-card border border-card-border rounded-lg text-lg font-black text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-inner transition-shadow" 
                        required 
                        disabled={disabled} 
                        placeholder="-"
                    />
                </div>
                
                <label htmlFor={`${partido.id}-away`} className="flex items-center sm:text-sm text-[10px] font-bold text-foreground flex-1 min-w-0 group cursor-pointer">
                    <div className="mr-2 h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-background border border-border shadow-sm">
                        <img
                            src={partido.awayCrest || `https://flagcdn.com/w40/${partido.awayCode}.png`}
                            alt={partido.away}
                            className="h-full w-full object-contain p-0.5"
                        />
                    </div>
                    <span className="truncate group-hover:text-primary transition-colors">{partido.away}</span>
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
        ? 'w-full sm:w-auto bg-background-offset text-foreground-muted border border-border font-bold py-3 px-8 rounded-full cursor-not-allowed opacity-70 flex items-center justify-center gap-2 mx-auto'
        : 'w-full sm:w-auto bg-primary text-primary-foreground hover:bg-amber-600 font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-[0_4px_12px_rgba(245,158,11,0.2)] hover:scale-105 flex items-center justify-center gap-2 mx-auto text-lg';

    const groupedMatches = quiniela.matches.reduce((acc, match) => {
        const champ = match.championship || 'Otros';
        if (!acc[champ]) { acc[champ] = []; }
        acc[champ].push(match);
        return acc;
    }, {});

    return (
        <form onSubmit={handleSubmit} className="animate-fade-in">
            <div className="space-y-10">
                {Object.keys(groupedMatches).map(championship => (
                    <div key={championship} className="bg-background-offset/50 p-4 sm:p-6 rounded-3xl border border-border">
                        <h3 className="text-2xl font-black text-primary uppercase tracking-widest border-b border-border pb-3 mb-6 flex items-center gap-2">
                            <span>🏆</span> {championship}
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                            {groupedMatches[championship].map((partido) => (
                                <MatchInput 
                                    key={partido.id} 
                                    partido={partido} 
                                    value={predictions[partido.id] || {home: '', away: ''}} 
                                    onChange={handleChange} 
                                    disabled={isLocked || isLoading} 
                                    liveStatuses={liveStatuses}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-10 pt-8 border-t border-border flex flex-col items-center">
                <button type="submit" className={buttonClasses} disabled={isLocked || isLoading}>
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            Guardando...
                        </>
                    ) : (
                        <>
                            <span>{isLocked ? '🔒' : '💾'}</span> {buttonText}
                        </>
                    )}
                </button>
                
                {isLocked && (
                    <div className="bg-amber-500/10 border border-amber-500/20 px-6 py-3 rounded-xl mt-4 max-w-md text-center">
                        <p className="text-sm font-bold text-amber-500">Esta quiniela ha sido bloqueada por el administrador. Ya no se pueden modificar las predicciones.</p>
                    </div>
                )}
                
                {feedback && (
                    <div className="mt-6 bg-green-500/10 border border-green-500/20 px-6 py-3 rounded-xl animate-fade-in">
                        <p className="text-green-500 font-bold flex items-center gap-2">
                            <span>✅</span> {feedback}
                        </p>
                    </div>
                )}
            </div>
        </form>
    );
};

export default PredictionsForm;