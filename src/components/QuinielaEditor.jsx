import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION } from '../config';

// Este componente ahora acepta dos props opcionales:
// quinielaToEdit: El objeto de la quiniela a editar. Si no se pasa, está en modo "Crear".
// onFinishEditing: Una función para volver a la vista anterior después de guardar o cancelar.
const QuinielaEditor = ({ quinielaToEdit, onFinishEditing }) => {
    const [quinielaName, setQuinielaName] = useState('');
    const [matches, setMatches] = useState([{ home: '', away: '', homeCode: '', awayCode: '', championship: '' }]);
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditMode = Boolean(quinielaToEdit);

    // Si estamos en modo edición, llenar el formulario con los datos existentes
    useEffect(() => {
        if (isEditMode) {
            setQuinielaName(quinielaToEdit.name);
            setMatches(quinielaToEdit.matches);
        }
    }, [isEditMode, quinielaToEdit]);

    const handleMatchChange = (index, field, value) => {
        const newMatches = [...matches];
        newMatches[index][field] = value;
        setMatches(newMatches);
    };

    const addMatch = () => {
        setMatches([...matches, { home: '', away: '', homeCode: '', awayCode: '', championship: '' }]);
    };

    const removeMatch = (index) => {
        const newMatches = matches.filter((_, i) => i !== index);
        setMatches(newMatches);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!quinielaName || matches.some(m => !m.home || !m.away || !m.championship)) {
            setFeedback('Por favor, completa el nombre y todos los campos de todos los partidos.');
            return;
        }
        setIsLoading(true);
        setFeedback(isEditMode ? 'Actualizando quiniela...' : 'Creando quiniela...');

        const formattedMatches = matches.map((match, index) => ({
            ...match,
            // Si el partido ya tiene un id, lo mantenemos, si no, lo creamos
            id: match.id || `${quinielaName.replace(/\s+/g, '-').toLowerCase()}-${index}`
        }));

        try {
            if (isEditMode) {
                // --- LÓGICA DE ACTUALIZACIÓN ---
                const quinielaRef = doc(db, QUINIELAS_COLLECTION, quinielaToEdit.id);
                await updateDoc(quinielaRef, {
                    name: quinielaName,
                    matches: formattedMatches,
                });
                setFeedback('¡Quiniela actualizada con éxito!');
            } else {
                // --- LÓGICA DE CREACIÓN (SIN CAMBIOS) ---
                await addDoc(collection(db, QUINIELAS_COLLECTION), {
                    name: quinielaName,
                    matches: formattedMatches,
                    createdAt: serverTimestamp(),
                    locked: false, resultsVisible: false, realResults: {},
                    isActive: false, isClosed: false, winnersData: []
                });
                setFeedback('¡Quiniela creada con éxito!');
                setQuinielaName('');
                setMatches([{ home: '', away: '', homeCode: '', awayCode: '', championship: '' }]);
            }
        } catch (error) {
            console.error("Error al guardar la quiniela:", error);
            setFeedback('Error al guardar la quiniela.');
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                setFeedback('');
                if (isEditMode) onFinishEditing(); // Volver a la vista de gestión
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
                <h3 className="text-lg font-semibold text-blue-400">Partidos</h3>
                <div className="space-y-4">
                    {matches.map((match, index) => (
                        <div key={index} className="p-4 bg-slate-900/50 rounded-md border border-slate-700">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Campeonato</label>
                                <input type="text" placeholder="Ej: Premier League" value={match.championship} onChange={e => handleMatchChange(index, 'championship', e.target.value)} className="form-input w-full" required />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-10 gap-2 items-center">
                                <input type="text" placeholder="Equipo Local" value={match.home} onChange={e => handleMatchChange(index, 'home', e.target.value)} className="sm:col-span-3 form-input" required />
                                <input type="text" placeholder="Código" value={match.homeCode} onChange={e => handleMatchChange(index, 'homeCode', e.target.value)} className="sm:col-span-1 form-input" />
                                <span className="text-center text-slate-400 hidden sm:block">vs</span>
                                <input type="text" placeholder="Equipo Visitante" value={match.away} onChange={e => handleMatchChange(index, 'away', e.target.value)} className="sm:col-span-3 form-input" required />
                                <input type="text" placeholder="Código" value={match.awayCode} onChange={e => handleMatchChange(index, 'awayCode', e.target.value)} className="sm:col-span-1 form-input" />
                                <button type="button" onClick={() => removeMatch(index)} className="sm:col-span-1 text-red-500 hover:text-red-400 font-semibold text-sm">Quitar</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button type="button" onClick={addMatch} className="text-blue-400 hover:text-blue-300 text-sm font-semibold">+ Añadir Partido</button>
                    <div className="flex items-center gap-x-4">
                        {isEditMode && (
                             <button type="button" onClick={onFinishEditing} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-md transition duration-300">
                                Cancelar
                            </button>
                        )}
                        <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white font-bold py-3 px-6 rounded-md transition duration-300">
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