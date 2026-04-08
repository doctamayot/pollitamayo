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
        <div className="p-4 sm:p-8 bg-card border border-card-border rounded-3xl shadow-sm animate-fade-in">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-primary mb-8 border-b border-border pb-4 flex items-center gap-3">
                <span>{isEditMode ? '✏️' : '✨'}</span>
                <span>{isEditMode ? `Editando: ${quinielaToEdit.name}` : 'Crear Nueva Quiniela'}</span>
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* --- CAMPO NOMBRE QUINIELA --- */}
                <div>
                    <label htmlFor="quinielaName" className="block text-sm font-bold text-foreground-muted mb-2 uppercase tracking-wider">Nombre de la Quiniela (Automático)</label>
                    <input 
                        type="text" 
                        id="quinielaName" 
                        value={quinielaName || 'Selecciona/añade partidos...'} 
                        className="w-full bg-background-offset border border-border rounded-xl py-3 px-4 text-sm font-bold text-foreground cursor-not-allowed shadow-inner" 
                        disabled 
                    />
                </div>
                
                {/* --- PANEL AÑADIR DESDE API --- */}
                <div className="bg-background-offset border border-border p-5 sm:p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
                        <span>🌐</span> Añadir Partidos desde API
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="competition" className="block text-sm font-semibold text-foreground-muted mb-2">1. Selecciona Competición</label>
                            <select 
                                id="competition" 
                                value={selectedCompetition} 
                                onChange={e => setSelectedCompetition(e.target.value)} 
                                className="w-full bg-card border border-card-border rounded-xl py-3 px-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner appearance-none cursor-pointer"
                            >
                                <option value="">Selecciona una opción...</option>
                                {competitions.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
                            </select>
                        </div>
                        
                        {selectedCompetition && (
                            <div className="mt-6">
                                <label className="block text-sm font-semibold text-foreground-muted mb-2">2. Selecciona Partidos</label>
                                {isLoading ? (
                                    <div className="flex items-center gap-3 text-primary font-bold py-4">
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        Cargando partidos...
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-border bg-card rounded-xl shadow-inner hide-scrollbar">
                                        {availableMatches.length > 0 ? availableMatches.map(match => (
                                            <div key={match.id} className="flex items-center bg-background-offset hover:bg-border/30 transition-colors p-3 rounded-lg border border-border">
                                                <input 
                                                    type="checkbox" 
                                                    id={`match-${match.id}`} 
                                                    className="w-5 h-5 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2 cursor-pointer" 
                                                    onChange={(e) => handleMatchSelect(match, e.target.checked)} 
                                                    checked={matches.some(m => m.id === match.id)} 
                                                />
                                                <label htmlFor={`match-${match.id}`} className="ml-3 text-sm font-bold text-foreground flex-grow cursor-pointer truncate">
                                                    {match.homeTeam.name} <span className="text-foreground-muted font-normal mx-1">vs</span> {match.awayTeam.name}
                                                </label>
                                                
                                                <span className="hidden sm:inline text-xs font-bold text-primary mr-4 uppercase tracking-wider">
                                                    {statusTranslations[match.status] || match.status}
                                                </span>

                                                <span className="text-xs font-semibold text-foreground-muted whitespace-nowrap bg-card px-2 py-1 rounded-md border border-card-border">
                                                    {new Date(match.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        )) : <p className="text-foreground-muted text-sm p-4 text-center">No hay partidos programados.</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* --- PANEL AÑADIR MANUAL --- */}
                <div className="bg-background-offset border border-border p-5 sm:p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
                        <span>✍️</span> Añadir Partido Manual
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input 
                                type="text" 
                                placeholder="Campeonato (Ej: Liga Colombiana)" 
                                value={manualMatch.championship} 
                                onChange={e => handleManualMatchChange('championship', e.target.value)} 
                                className="w-full bg-card border border-card-border rounded-xl py-3 px-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner" 
                            />
                            <input 
                                type="datetime-local" 
                                value={manualMatch.date} 
                                onChange={e => handleManualMatchChange('date', e.target.value)} 
                                className="w-full bg-card border border-card-border rounded-xl py-3 px-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner" 
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Equipo Local" 
                                    value={manualMatch.home} 
                                    onChange={e => handleManualMatchChange('home', e.target.value)} 
                                    className="w-full bg-card border border-card-border rounded-xl py-3 px-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner" 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Cód. (co)" 
                                    value={manualMatch.homeCode} 
                                    onChange={e => handleManualMatchChange('homeCode', e.target.value)} 
                                    className="w-20 bg-card border border-card-border rounded-xl py-3 px-2 text-sm font-semibold text-center text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner uppercase" 
                                    maxLength="3" 
                                    title="Código de 2-3 letras para la bandera"
                                />
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Equipo Visitante" 
                                    value={manualMatch.away} 
                                    onChange={e => handleManualMatchChange('away', e.target.value)} 
                                    className="w-full bg-card border border-card-border rounded-xl py-3 px-4 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner" 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Cód. (ar)" 
                                    value={manualMatch.awayCode} 
                                    onChange={e => handleManualMatchChange('awayCode', e.target.value)} 
                                    className="w-20 bg-card border border-card-border rounded-xl py-3 px-2 text-sm font-semibold text-center text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-inner uppercase" 
                                    maxLength="3" 
                                    title="Código de 2-3 letras para la bandera"
                                />
                            </div>
                        </div>
                        <button 
                            type="button" 
                            onClick={handleAddManualMatch} 
                            className="w-full bg-card hover:bg-border/50 border border-border text-foreground font-bold py-3 px-4 rounded-xl text-sm transition-colors mt-2"
                        >
                            ➕ Añadir Partido Manual a la Lista
                        </button>
                    </div>
                </div>
                
                {/* --- LISTA DE PARTIDOS SELECCIONADOS --- */}
                {matches.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 p-5 sm:p-6 rounded-2xl shadow-inner">
                        <h3 className="text-lg font-black text-primary mb-4 flex items-center justify-between">
                            <span>📋 Resumen de la Quiniela</span>
                            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">{matches.length} partidos</span>
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-border bg-card rounded-xl shadow-inner hide-scrollbar">
                            {matches.map((match, index) => (
                                <div key={match.id} className="flex items-center justify-between bg-background-offset p-3 rounded-lg border border-border group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="text-xs font-bold text-foreground-muted w-5">{index + 1}.</span>
                                        <span className="text-sm font-bold text-foreground truncate">
                                            {match.home} <span className="text-foreground-muted font-normal mx-1">vs</span> {match.away}
                                        </span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => removeMatch(match.id)} 
                                        className="text-red-500 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ml-2 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 sm:opacity-100"
                                    >
                                        Quitar
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* --- BOTONERA FINAL --- */}
                <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-end items-center gap-4">
                    {feedback && (
                        <div className="w-full sm:w-auto flex-grow text-center sm:text-left text-primary font-bold animate-fade-in">
                            {feedback}
                        </div>
                    )}
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {isEditMode && (
                            <button 
                                type="button" 
                                onClick={onFinishEditing} 
                                className="flex-1 sm:flex-none bg-background-offset hover:bg-border/50 border border-border text-foreground font-bold py-3 px-6 rounded-full transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-amber-600 font-bold py-3 px-8 rounded-full shadow-[0_4px_12px_rgba(245,158,11,0.2)] transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Guardando...
                                </>
                            ) : (
                                <span>{isEditMode ? '💾 Guardar Cambios' : '🚀 Crear Quiniela'}</span>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default QuinielaEditor;