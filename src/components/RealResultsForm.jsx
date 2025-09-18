import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getLiveResultsByIds } from '../services/apiFootball';

const MatchInputAdmin = ({ partido, value, onChange, disabled }) => ( // 'readOnly' ya no es necesario
    <div className="col-span-1 bg-slate-900/50 p-3 rounded-md border border-slate-700">
        <div className="text-xs text-center text-amber-400 mb-3 font-semibold space-x-2">
            <span>{new Date(partido.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            {partido.venue && <span className="text-slate-400">|</span>}
            {partido.venue && <span className="text-slate-400">🏟️ {partido.venue}</span>}
        </div>
        <div className="flex items-center justify-between gap-x-2">
            <label htmlFor={`admin-${partido.id}-home`} className="flex items-center justify-end text-xs sm:text-sm font-medium text-slate-300 flex-1 min-w-0">
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
            <label htmlFor={`admin-${partido.id}-away`} className="flex items-center text-xs sm:text-sm font-medium text-slate-300 flex-1 min-w-0">
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
    
    const [isAutoUpdating, setIsAutoUpdating] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const intervalRef = useRef(null);

    const canAutoUpdate = quiniela && quiniela.matches.every(match => typeof match.id === 'number');

    useEffect(() => {
        const initialResults = {};
        quiniela.matches.forEach(p => {
            initialResults[p.id] = { home: quiniela.realResults?.[p.id]?.home || '', away: quiniela.realResults?.[p.id]?.away || '' };
        });
        setResults(initialResults);
    }, [quiniela]);

    useEffect(() => {
        // --- ▼▼▼ LÓGICA DE AUTO-GUARDADO ▼▼▼ ---
        const fetchAndSaveLiveResults = async () => {
            setStatusMessage('Buscando y guardando en vivo...');
            const matchIds = quiniela.matches.map(m => m.id);
            try {
                const liveResults = await getLiveResultsByIds(matchIds);
                
                // Si la API devuelve resultados, los guardamos en Firebase
                if (Object.keys(liveResults).length > 0) {
                    const docRef = doc(db, 'quinielas', quiniela.id);
                    // Usamos { merge: true } para no sobrescribir resultados de partidos que no estén en vivo
                    await updateDoc(docRef, { realResults: liveResults }, { merge: true });
                    setStatusMessage(`Resultados guardados en Firebase: ${new Date().toLocaleTimeString()}`);
                } else {
                    setStatusMessage('No hay partidos en juego para actualizar.');
                }
            } catch (error) {
                console.error(error);
                setStatusMessage('Error al contactar la API.');
            }
        };

        if (isAutoUpdating) {
            fetchAndSaveLiveResults();
            // CAMBIO: El intervalo ahora es de 30 segundos (30000 ms)
            intervalRef.current = setInterval(fetchAndSaveLiveResults, 30000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isAutoUpdating, quiniela.id, quiniela.matches]);
    
    const handleToggleAutoUpdate = () => {
        setIsAutoUpdating(prev => !prev);
        if (isAutoUpdating) {
            setStatusMessage('Auto-actualización detenida. Modo manual activado.');
        }
    };

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
        setFeedback('Guardando cambios manuales...');
        const docRef = doc(db, 'quinielas', quiniela.id);
        try {
            await updateDoc(docRef, { realResults: results });
            setFeedback('¡Resultados manuales guardados con éxito!');
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
            {!quiniela.isClosed && canAutoUpdate && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 mb-6 bg-slate-700/50 rounded-lg">
                    <button
                        type="button"
                        onClick={handleToggleAutoUpdate}
                        className={`font-bold py-2 px-4 rounded-md text-sm transition w-full sm:w-auto ${isAutoUpdating ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                    >
                        {isAutoUpdating ? '⏹️ Detener Auto-Guardado' : '▶️ Iniciar Auto-Guardado'}
                    </button>
                    <p className="text-xs text-slate-300 text-center sm:text-left">
                        {statusMessage || 'El guardado automático está detenido.'}
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
                                    disabled={quiniela.isClosed || isAutoUpdating} // Se deshabilita también en modo auto
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                {/* --- ▼▼▼ CAMBIO: El botón de guardado ahora es condicional ▼▼▼ --- */}
                {!isAutoUpdating && (
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