import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getLiveUpdateDataByIds } from '../services/apiFootball';

// --- Diccionario de traducciones sin cambios ---
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

// --- ▼▼▼ SUB-COMPONENTE CON NUEVO ESTILO DE TARJETA ADAPTABLE ▼▼▼ ---
const MatchInputAdmin = ({ partido, value, onChange, disabled, liveStatuses }) => {
    const currentStatus = liveStatuses[partido.id] || partido.status;
    return (
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
                <label htmlFor={`admin-${partido.id}-home`} className="flex items-center justify-end sm:text-sm text-[10px] font-bold text-foreground flex-1 min-w-0 group cursor-pointer">
                    <span className="text-right truncate group-hover:text-primary transition-colors">{partido.home}</span>
                    <div className="ml-2 h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-background border border-border shadow-sm">
                        <img src={partido.homeCrest || `https://flagcdn.com/w40/${partido.homeCode}.png`} alt={partido.home} className="h-full w-full object-contain p-0.5" />
                    </div>
                </label>
                
                <div className="flex items-center space-x-2 flex-shrink-0 bg-background-offset p-2 rounded-xl border border-border">
                    <input 
                        type="number" 
                        id={`admin-${partido.id}-home`} 
                        name={`${partido.id}-home`} 
                        value={value.home} 
                        onChange={onChange} 
                        min="0" 
                        className="w-12 h-12 text-center bg-card border border-card-border rounded-lg text-lg font-black text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-inner transition-shadow" 
                        disabled={disabled} 
                        placeholder="-"
                    />
                    <span className="text-foreground-muted font-bold">-</span>
                    <input 
                        type="number" 
                        id={`admin-${partido.id}-away`} 
                        name={`${partido.id}-away`} 
                        value={value.away} 
                        onChange={onChange} 
                        min="0" 
                        className="w-12 h-12 text-center bg-card border border-card-border rounded-lg text-lg font-black text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-inner transition-shadow" 
                        disabled={disabled} 
                        placeholder="-"
                    />
                </div>
                
                <label htmlFor={`admin-${partido.id}-away`} className="flex items-center sm:text-sm text-[10px] font-bold text-foreground flex-1 min-w-0 group cursor-pointer">
                    <div className="mr-2 h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-background border border-border shadow-sm">
                        <img src={partido.awayCrest || `https://flagcdn.com/w40/${partido.awayCode}.png`} alt={partido.away} className="h-full w-full object-contain p-0.5" />
                    </div>
                    <span className="truncate group-hover:text-primary transition-colors">{partido.away}</span>
                </label>
            </div>
        </div>
    );
}

const RealResultsForm = ({ quiniela, liveStatuses }) => {
    // --- Lógica interna sin cambios ---
    const [results, setResults] = useState({});
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLiveUpdating, setIsLiveUpdating] = useState(false);
    const [lastUpdate, setLastUpdate] = useState('');
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!quiniela?.id) return;
        const unsub = onSnapshot(doc(db, 'quinielas', quiniela.id), (docSnap) => {
            if (docSnap.exists()) {
                const quinielaData = docSnap.data();
                const newResults = {};
                quiniela.matches.forEach(p => {
                    newResults[p.id] = {
                        home: quinielaData.realResults?.[p.id]?.home || '',
                        away: quinielaData.realResults?.[p.id]?.away || ''
                    };
                });
                setResults(newResults);
            }
        });
        return () => unsub();
    }, [quiniela]);

    useEffect(() => {
        const fetchAndSaveLiveResults = async () => {
            const matchIds = quiniela.matches.map(m => m.id).filter(id => typeof id === 'number');
            if (matchIds.length === 0) {
                setLastUpdate('No hay partidos de API en esta quiniela.');
                return;
            };

            try {
                // --- ▼▼▼ 2. Usamos la nueva función y extraemos ambos mapas ▼▼▼ ---
                const { resultsMap, statusMap } = await getLiveUpdateDataByIds(matchIds);

                // --- ▼▼▼ 3. Preparamos los datos para la actualización ▼▼▼ ---
                
                // Creamos un nuevo array de partidos con los estados actualizados
                const updatedMatches = quiniela.matches.map(match => {
                    // Si hay un nuevo estado para este partido, lo usamos. Si no, dejamos el que tenía.
                    if (statusMap[match.id] && statusMap[match.id] !== match.status) {
                        return { ...match, status: statusMap[match.id] };
                    }
                    return match;
                });
                
                const hasScoreUpdates = Object.keys(resultsMap).length > 0;
                
                // --- ▼▼▼ 4. Guardamos ambos campos en Firestore ▼▼▼ ---
                const docRef = doc(db, 'quinielas', quiniela.id);
                await updateDoc(docRef, {
                    matches: updatedMatches, // Actualizamos el array de partidos con los nuevos estados
                    realResults: resultsMap  // Actualizamos los resultados (si los hay)
                }, { merge: true }); // Merge es importante para el realResults

                // Actualizamos el estado local del formulario inmediatamente
                if(hasScoreUpdates) {
                    setResults(prevResults => ({...prevResults, ...resultsMap}));
                }

                setLastUpdate(`Actualizado: ${new Date().toLocaleTimeString()}`);

            } catch (error) {
                console.error("Error en la actualización en vivo:", error);
                setLastUpdate("Error de conexión con la API.");
            }
        };

        if (isLiveUpdating) {
            fetchAndSaveLiveResults();
            intervalRef.current = setInterval(fetchAndSaveLiveResults, 30000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isLiveUpdating, quiniela]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const sanitizedValue = value.replace(/[^0-9]/g, '');
        const nameParts = name.split('-');
        const team = nameParts.pop();
        const partidoId = nameParts.join('-');
        setResults(prev => ({ ...prev, [partidoId]: { ...prev[partidoId], [team]: sanitizedValue } }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setFeedback('Guardando resultados...');
        const docRef = doc(db, 'quinielas', quiniela.id);
        try {
            await updateDoc(docRef, { realResults: results }, { merge: true });
            setFeedback('¡Resultados guardados con éxito!');
        } catch (error) {
            console.error("Error al guardar:", error);
            setFeedback('Error al guardar. Inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
            setTimeout(() => setFeedback(''), 3000);
        }
    };

    const groupedMatches = quiniela.matches.reduce((acc, match) => {
        const champ = match.championship || 'Otros';
        if (!acc[champ]) acc[champ] = [];
        acc[champ].push(match);
        return acc;
    }, {});
    // --- Fin de la lógica interna ---

    return (
        <form onSubmit={handleSubmit} className="animate-fade-in">
            {/* --- ▼▼▼ PANEL DE AUTO-GUARDADO ACTUALIZADO ▼▼▼ --- */}
            {!quiniela.isClosed && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 sm:p-5 mb-8 bg-background-offset rounded-2xl border border-border shadow-inner">
                    <button
                        type="button"
                        onClick={() => setIsLiveUpdating(prev => !prev)}
                        className={`font-bold py-2.5 px-6 rounded-xl text-sm transition-all w-full sm:w-auto shadow-sm ${isLiveUpdating ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' : 'bg-primary text-primary-foreground hover:bg-amber-600'}`}
                    >
                        {isLiveUpdating ? '⏹️ Detener Auto-Guardado' : '▶️ Iniciar Auto-Guardado API (30s)'}
                    </button>
                    <div className="flex flex-col items-center sm:items-start">
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-1">Estado de Conexión API</span>
                        <p className={`text-sm font-semibold ${isLiveUpdating ? 'text-primary animate-pulse' : 'text-foreground-muted'}`}>
                            {isLiveUpdating ? lastUpdate || 'Sincronizando...' : 'Auto-guardado desactivado.'}
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-10">
                {Object.keys(groupedMatches).map(championship => (
                    <div key={championship} className="bg-background-offset/50 p-4 sm:p-6 rounded-3xl border border-border">
                        {/* --- ▼▼▼ TÍTULO DE LIGA ACTUALIZADO ▼▼▼ --- */}
                        <h3 className="text-2xl font-black text-primary uppercase tracking-widest border-b border-border pb-3 mb-6 flex items-center gap-2">
                            <span>🏆</span> {championship}
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                            {groupedMatches[championship].map((partido) => (
                                <MatchInputAdmin 
                                    key={partido.id} 
                                    partido={partido} 
                                    value={results[partido.id] || {home: '', away: ''}} 
                                    onChange={handleChange}
                                    disabled={quiniela.isClosed || isLiveUpdating}
                                    liveStatuses={liveStatuses}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-10 pt-8 border-t border-border flex flex-col items-center">
                {/* --- ▼▼▼ BOTÓN DE GUARDADO MANUAL ACTUALIZADO ▼▼▼ --- */}
                {!isLiveUpdating && (
                    <button 
                        type="submit" 
                        disabled={isLoading || quiniela.isClosed}
                        className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-amber-600 font-bold py-3 px-8 rounded-full shadow-[0_4px_12px_rgba(245,158,11,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 flex items-center justify-center gap-2 text-lg"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <span>💾</span> Guardar Resultados Manuales
                            </>
                        )}
                    </button>
                )}

                {quiniela.isClosed && (
                    <div className="bg-amber-500/10 border border-amber-500/20 px-6 py-3 rounded-xl mt-4">
                        <p className="text-sm font-bold text-amber-500">🔒 Esta quiniela ha sido cerrada y no se pueden modificar los resultados.</p>
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

export default RealResultsForm;