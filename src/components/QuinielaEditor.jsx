import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION } from '../config';
import { getCompetitions, getMatchesByCompetition } from '../services/apiFootball';

const QuinielaEditor = ({ quinielaToEdit, onFinishEditing }) => {
    const [quinielaName, setQuinielaName] = useState('');
    // El estado 'matches' ahora guardará los partidos seleccionados
    const [matches, setMatches] = useState([]);
    
    // --- NUEVOS ESTADOS PARA MANEJAR LA API ---
    const [competitions, setCompetitions] = useState([]);
    const [availableMatches, setAvailableMatches] = useState([]); // <-- Lista de partidos de la API
    const [selectedCompetition, setSelectedCompetition] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState('');

    const isEditMode = Boolean(quinielaToEdit);

    // Cargar competiciones al montar el componente
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

    // Cargar partidos cuando se selecciona una competición
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

    // Llenar el formulario si estamos en modo edición
    useEffect(() => {
        if (isEditMode) {
            setQuinielaName(quinielaToEdit.name);
            setMatches(quinielaToEdit.matches);
        }
    }, [isEditMode, quinielaToEdit]);

    // --- NUEVA LÓGICA PARA SELECCIONAR/DESELECCIONAR PARTIDOS ---
    const handleMatchSelect = (apiMatch, isChecked) => {
        const competitionData = competitions.find(c => c.id === parseInt(selectedCompetition));
        const formattedMatch = {
            id: apiMatch.id,
            championship: competitionData?.name || '',
            date: apiMatch.date,            
            home: apiMatch.homeTeam.name,
            away: apiMatch.awayTeam.name,
            homeCrest: apiMatch.homeTeam.crest,
            awayCrest: apiMatch.awayTeam.crest,
            homeCode: apiMatch.homeTeam.tla,
            awayCode: apiMatch.awayTeam.tla,
        };

        if (isChecked) {
            // Añadir el partido a nuestra lista de quiniela
            setMatches(prev => [...prev, formattedMatch]);
        } else {
            // Quitar el partido de nuestra lista
            setMatches(prev => prev.filter(m => m.id !== apiMatch.id));
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!quinielaName || matches.length === 0) {
            setFeedback('Por favor, completa el nombre y selecciona al menos un partido.');
            return;
        }
        setIsLoading(true);
        // ... (El resto de la lógica de guardado es la misma y funcionará)
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
                    <label htmlFor="quinielaName" className="block text-sm font-medium text-slate-300 mb-2">Nombre de la Quiniela</label>
                    <input type="text" id="quinielaName" value={quinielaName} onChange={(e) => setQuinielaName(e.target.value)} className="form-input w-full" required />
                </div>
                
                <div>
                    <label htmlFor="competition" className="block text-sm font-medium text-slate-300 mb-2">1. Selecciona una Competición</label>
                    <select id="competition" value={selectedCompetition} onChange={e => setSelectedCompetition(e.target.value)} className="form-input w-full" required>
                        <option value="">Cargando competiciones...</option>
                        {competitions.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
                    </select>
                </div>

                {/* --- NUEVA SECCIÓN PARA MOSTRAR LA LISTA DE PARTIDOS --- */}
                {selectedCompetition && (
                    <div>
                        <h3 className="text-lg font-semibold text-blue-400 mb-2">2. Selecciona los Partidos</h3>
                        {isLoading ? <p className="text-slate-400">Cargando partidos...</p> : (
                            <div className="space-y-2 max-h-96 overflow-y-auto p-2 border border-slate-700 rounded-md">
                                {availableMatches.length > 0 ? availableMatches.map(match => (
                                    <div key={match.id} className="flex items-center bg-slate-900/50 p-3 rounded-md">
                                        <input
                                            type="checkbox"
                                            id={`match-${match.id}`}
                                            className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                                            onChange={(e) => handleMatchSelect(match, e.target.checked)}
                                            checked={matches.some(m => m.id === match.id)}
                                        />
                                        <label htmlFor={`match-${match.id}`} className="ml-3 text-sm text-slate-300 flex-grow">
                                            {match.homeTeam.name} <span className="text-slate-500">vs</span> {match.awayTeam.name}
                                        </label>
                                        <span className="text-xs text-slate-400">
                                            {new Date(match.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )) : <p className="text-slate-500">No hay partidos programados para esta competición.</p>}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="pt-4 flex flex-col sm:flex-row justify-end items-center gap-4">
                    <div className="flex items-center gap-x-4">
                        {isEditMode && (
                             <button type="button" onClick={onFinishEditing} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-md">
                                 Cancelar
                             </button>
                        )}
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