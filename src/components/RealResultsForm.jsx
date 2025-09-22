import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getLiveResultsByIds } from '../services/apiFootball';

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

const MatchInputAdmin = ({ partido, value, onChange, disabled }) => (
    <div className="col-span-1 bg-slate-900/50 p-3 rounded-md border border-slate-700">
        {/* --- ▼▼▼ LÓGICA PARA MOSTRAR FECHA Y ESTADO AÑADIDA ▼▼▼ --- */}
        <div className="flex justify-between items-center text-xs text-center text-amber-400 mb-3 font-semibold">
            <span>
                {new Date(partido.date).toLocaleDateString('es-ES', {
                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
            </span>
            {partido.status && (
                <span className="text-green-400 font-bold">
                    {statusTranslations[partido.status] || partido.status}
                </span>
            )}
        </div>
        <div className="flex items-center justify-between gap-x-2">
            <label htmlFor={`admin-${partido.id}-home`} className="flex items-center justify-end text-[10px] sm:text-xs font-medium text-slate-300 flex-1 min-w-0">
                <span className="text-right">{partido.home}</span>
                <div className="ml-2 h-5 w-5 rounded-full overflow-hidden flex-shrink-0 bg-slate-700">
                    <img src={partido.homeCrest || `https://flagcdn.com/w20/${partido.homeCode}.png`} alt={partido.home} className="h-full w-full object-contain" />
                </div>
            </label>
            <div className="flex items-center space-x-2 flex-shrink-0">
                <input type="number" id={`admin-${partido.id}-home`} name={`${partido.id}-home`} value={value.home} onChange={onChange} min="0" className="w-14 text-center form-input py-2" disabled={disabled} />
                <span className="text-slate-400">-</span>
                <input type="number" id={`admin-${partido.id}-away`} name={`${partido.id}-away`} value={value.away} onChange={onChange} min="0" className="w-14 text-center form-input py-2" disabled={disabled} />
            </div>
            <label htmlFor={`admin-${partido.id}-away`} className="flex items-center text-[10px] sm:text-xs font-medium text-slate-300 flex-1 min-w-0">
                <div className="mr-2 h-5 w-5 rounded-full overflow-hidden flex-shrink-0 bg-slate-700">
                    <img src={partido.awayCrest || `https://flagcdn.com/w20/${partido.awayCode}.png`} alt={partido.away} className="h-full w-full object-contain" />
                </div>
                <span>{partido.away}</span>
            </label>
        </div>
    </div>
);

const RealResultsForm = ({ quiniela }) => {
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
                const liveResults = await getLiveResultsByIds(matchIds);
                if (Object.keys(liveResults).length > 0) {
                    const docRef = doc(db, 'quinielas', quiniela.id);
                    await updateDoc(docRef, { realResults: liveResults }, { merge: true });
                    setLastUpdate(`Resultados guardados: ${new Date().toLocaleTimeString()}`);
                } else {
                    setLastUpdate(`Sin cambios: ${new Date().toLocaleTimeString()}`);
                }
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
    }, [isLiveUpdating, quiniela.id, quiniela.matches]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const sanitizedValue = value.replace(/[^0-9]/g, '');
        const nameParts = name.split('-');
        const team = nameParts.pop();
        const partidoId = nameParts.join('-');
        setResults(prev => ({ ...prev, [partidoId]: { ...prev[partidoId], [team]: sanitizedValue }}));
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

    return (
        <form onSubmit={handleSubmit}>
            {!quiniela.isClosed && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 mb-6 bg-slate-700/50 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setIsLiveUpdating(prev => !prev)}
                        className={`font-bold py-2 px-4 rounded-md text-sm transition w-full sm:w-auto ${isLiveUpdating ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                    >
                        {isLiveUpdating ? '⏹️ Detener Auto-Guardado' : '▶️ Iniciar Auto-Guardado (30s)'}
                    </button>
                    <p className="text-xs text-slate-300 text-center sm:text-left">
                        {isLiveUpdating ? lastUpdate || 'Buscando resultados...' : 'El auto-guardado está detenido.'}
                    </p>
                </div>
            )}

            <div className="space-y-8">
                {Object.keys(groupedMatches).map(championship => (
                    <div key={championship}>
                        <h3 className="text-lg font-semibold text-blue-400 border-b border-slate-700 pb-3 mb-4">{championship}</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {groupedMatches[championship].map((partido) => (
                                <MatchInputAdmin 
                                    key={partido.id} 
                                    partido={partido} 
                                    value={results[partido.id] || {home: '', away: ''}} 
                                    onChange={handleChange}
                                    disabled={quiniela.isClosed || isLiveUpdating}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                {!isLiveUpdating && (
                    <button 
                        type="submit" 
                        disabled={isLoading || quiniela.isClosed}
                        className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg shadow-md disabled:bg-slate-500 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Guardando...' : 'Guardar Resultados Manuales'}
                    </button>
                )}

                {quiniela.isClosed && (<p className="text-sm text-yellow-400 mt-4">Esta quiniela está cerrada.</p>)}
                {feedback && <div className="mt-4 text-center text-green-400 font-medium">{feedback}</div>}
            </div>
        </form>
    );
};

export default RealResultsForm;