import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION } from '../config';
import { getCompetitions, getMatchesByCompetition } from '../services/apiFootball';

// --- ▼▼▼ DICCIONARIO DE TRADUCCIÓN DE ESTADOS ▼▼▼ ---
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

const QuinielaEditor = ({ quinielaToEdit, onFinishEditing }) => {
    const [quinielaName, setQuinielaName] = useState('');
    const [matches, setMatches] = useState([]);
    const [competitions, setCompetitions] = useState([]);
    const [availableMatches, setAvailableMatches] = useState([]);
    const [selectedCompetition, setSelectedCompetition] = useState('');
    const [manualMatch, setManualMatch] = useState({ home: '', away: '', homeCode: '', awayCode: '', championship: '', date: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState('');
    const isEditMode = Boolean(quinielaToEdit);

    useEffect(() => {
        if (isEditMode) return;
        if (matches.length === 0) {
            setQuinielaName('');
            return;
        }
        const firstDate = new Date(Math.min(...matches.map(match => new Date(match.date))));
        const month = firstDate.toLocaleString('es-ES', { month: 'long' });
        const day = firstDate.getDate();
        const year = firstDate.getFullYear();
        const newName = `${month} ${day} ${year}`;
        setQuinielaName(newName.charAt(0).toUpperCase() + newName.slice(1));
    }, [matches, isEditMode]);

    useEffect(() => {
        const fetchCompetitions = async () => {
            try {
                const comps = await getCompetitions();
                setCompetitions(comps);
            } catch (error) {
                console.error(error);
                setFeedback('Error al cargar las ligas.');
            }
        };
        fetchCompetitions();
    }, []);

    useEffect(() => {
        const fetchMatches = async () => {
            if (!selectedCompetition) {
                setAvailableMatches([]);
                return;
            }
            try {
                setIsLoading(true);
                const matchesData = await getMatchesByCompetition(selectedCompetition);
                setAvailableMatches(matchesData);
            } catch (error) {
                console.error(error);
                setFeedback('Error al cargar los partidos.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchMatches();
    }, [selectedCompetition]);

    useEffect(() => {
        if (isEditMode) {
            setQuinielaName(quinielaToEdit.name);
            setMatches(quinielaToEdit.matches);
        }
    }, [isEditMode, quinielaToEdit]);

    const handleMatchSelect = (apiMatch, isChecked) => {
        const competitionData = competitions.find(c => c.id === parseInt(selectedCompetition));
        const formattedMatch = {
            id: apiMatch.id,
            championship: competitionData?.name || '',
            date: apiMatch.date,
            venue: apiMatch.venue || null,
            status: apiMatch.status, // <-- AÑADIDO: Guardamos el estado
            home: apiMatch.homeTeam.name,
            away: apiMatch.awayTeam.name,
            homeCrest: apiMatch.homeTeam.crest,
            awayCrest: apiMatch.awayTeam.crest,
            homeCode: apiMatch.homeTeam.tla,
            awayCode: apiMatch.awayTeam.tla,
        };
        if (isChecked) {
            setMatches(prev => [...prev, formattedMatch]);
        } else {
            setMatches(prev => prev.filter(m => m.id !== apiMatch.id));
        }
    };

    const handleManualMatchChange = (field, value) => {
        setManualMatch(prev => ({ ...prev, [field]: value }));
    };

    const handleAddManualMatch = () => {
        const { home, away, homeCode, awayCode, championship, date } = manualMatch;
        if (!home || !away || !homeCode || !awayCode || !championship || !date) {
            setFeedback('Completa todos los campos del partido manual.');
            return;
        }
        const newManualMatch = {
            ...manualMatch,
            id: `manual-${Date.now()}`,
            homeCode: homeCode.toLowerCase(),
            awayCode: awayCode.toLowerCase(),
        };
        setMatches(prev => [...prev, newManualMatch]);
        setManualMatch({ home: '', away: '', homeCode: '', awayCode: '', championship: '', date: '' });
        setFeedback('');
    };
    
    const removeMatch = (matchId) => {
        setMatches(prev => prev.filter(m => m.id !== matchId));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!quinielaName || matches.length === 0) {
            setFeedback('Por favor, selecciona o añade al menos un partido.');
            return;
        }
        setIsLoading(true);
        setFeedback(isEditMode ? 'Actualizando quiniela...' : 'Creando quiniela...');
        try {
            if (isEditMode) {
                const quinielaRef = doc(db, QUINIELAS_COLLECTION, quinielaToEdit.id);
                await updateDoc(quinielaRef, { name: quinielaName, matches });
                setFeedback('¡Quiniela actualizada con éxito!');
            } else {
                await addDoc(collection(db, QUINIELAS_COLLECTION), {
                    name: quinielaName,
                    matches,
                    createdAt: serverTimestamp(),
                    locked: false, resultsVisible: false, realResults: {},
                    isActive: false, isClosed: false, winnersData: []
                });
                setFeedback('¡Quiniela creada con éxito!');
                setQuinielaName('');
                setMatches([]);
            }
        } catch (error) {
            console.error("Error al guardar la quiniela:", error);
            setFeedback('Error al guardar la quiniela.');
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                setFeedback('');
                if (isEditMode) onFinishEditing();
            }, 2000);
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-slate-800/50 rounded-lg">
            <h2 className="text-xl font-bold text-amber-400 mb-6 border-b border-slate-700 pb-4">
                {isEditMode ? `Editando: ${quinielaToEdit.name}` : 'Crear Nueva Quiniela'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="quinielaName" className="block text-sm font-medium text-slate-300 mb-2">Nombre de la Quiniela (Automático)</label>
                    <input type="text" id="quinielaName" value={quinielaName || 'Selecciona/añade partidos...'} className="form-input w-full bg-slate-700/50 border-slate-600 text-slate-400" disabled />
                </div>
                
                <div className="border border-slate-700 p-4 rounded-lg space-y-4">
                    <h3 className="text-lg font-semibold text-blue-400">Añadir Partidos desde API</h3>
                    <div>
                        <label htmlFor="competition" className="block text-sm font-medium text-slate-300 mb-2">1. Selecciona Competición</label>
                        <select id="competition" value={selectedCompetition} onChange={e => setSelectedCompetition(e.target.value)} className="form-input w-full">
                            <option value="">Selecciona una opción...</option>
                            {competitions.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
                        </select>
                    </div>
                    {selectedCompetition && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">2. Selecciona Partidos</label>
                            {isLoading ? <p className="text-slate-400">Cargando...</p> : (
                                <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-600 rounded-md">
                                    {availableMatches.length > 0 ? availableMatches.map(match => (
                                        <div key={match.id} className="flex items-center bg-slate-900/50 p-2 rounded-md">
                                            <input type="checkbox" id={`match-${match.id}`} className="h-4 w-4" onChange={(e) => handleMatchSelect(match, e.target.checked)} checked={matches.some(m => m.id === match.id)} />
                                            <label htmlFor={`match-${match.id}`} className="ml-3 text-sm text-slate-300 flex-grow">{match.homeTeam.name} vs {match.awayTeam.name}</label>
                                            
                                            {/* --- ▼▼▼ CAMBIO: SE MUESTRA EL ESTADO TRADUCIDO ▼▼▼ --- */}
                                            <span className="text-xs text-slate-400 mr-4 font-semibold">
                                                {statusTranslations[match.status] || match.status}
                                            </span>

                                            <span className="text-xs text-slate-400">{new Date(match.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    )) : <p className="text-slate-500 text-sm">No hay partidos programados.</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="border border-slate-700 p-4 rounded-lg space-y-4">
                    <h3 className="text-lg font-semibold text-blue-400">Añadir Partido Manual</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="text" placeholder="Campeonato" value={manualMatch.championship} onChange={e => handleManualMatchChange('championship', e.target.value)} className="form-input" />
                        <input type="datetime-local" value={manualMatch.date} onChange={e => handleManualMatchChange('date', e.target.value)} className="form-input" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex gap-2">
                            <input type="text" placeholder="Equipo Local" value={manualMatch.home} onChange={e => handleManualMatchChange('home', e.target.value)} className="form-input w-full" />
                            <input type="text" placeholder="Código (ej: co)" value={manualMatch.homeCode} onChange={e => handleManualMatchChange('homeCode', e.target.value)} className="form-input w-16" maxLength="2" />
                        </div>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Equipo Visitante" value={manualMatch.away} onChange={e => handleManualMatchChange('away', e.target.value)} className="form-input w-full" />
                            <input type="text" placeholder="Código (ej: ar)" value={manualMatch.awayCode} onChange={e => handleManualMatchChange('awayCode', e.target.value)} className="form-input w-16" maxLength="2" />
                        </div>
                    </div>
                    <button type="button" onClick={handleAddManualMatch} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-md text-sm">Añadir Partido Manual</button>
                </div>
                
                {matches.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold text-blue-400 mb-2">Partidos Seleccionados ({matches.length})</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-700 rounded-md">
                           {matches.map(match => (
                                <div key={match.id} className="flex items-center bg-slate-900/50 p-2 rounded-md">
                                   <span className="text-sm text-slate-300 flex-grow">{match.home} vs {match.away}</span>
                                   <button type="button" onClick={() => removeMatch(match.id)} className="text-red-500 hover:text-red-400 text-xs font-semibold">Quitar</button>
                               </div>
                           ))}
                        </div>
                    </div>
                )}
                
                <div className="pt-4 flex flex-col sm:flex-row justify-end items-center gap-4">
                    <div className="flex items-center gap-x-4">
                        {isEditMode && <button type="button" onClick={onFinishEditing} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-md">Cancelar</button>}
                        <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold py-3 px-6 rounded-md">
                            {isLoading ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Guardar Quiniela')}
                        </button>
                    </div>
                </div>
                 {feedback && <div className="mt-4 text-center text-green-400 font-medium">{feedback}</div>}
            </form>
        </div>
    );
};

export default QuinielaEditor;