import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION } from '../config';

const CreateQuiniela = () => {
    const [quinielaName, setQuinielaName] = useState('');
    const [matches, setMatches] = useState([{ home: '', away: '', homeCode: '', awayCode: '', championship: '' }]);
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
        setFeedback('Creando quiniela...');

        const formattedMatches = matches.map((match, index) => ({
            ...match,
            id: `${quinielaName.replace(/\s+/g, '-').toLowerCase()}-${index}`
        }));

        try {
            await addDoc(collection(db, QUINIELAS_COLLECTION), {
                name: quinielaName,
                matches: formattedMatches,
                createdAt: serverTimestamp(),
                locked: false,
                resultsVisible: false,
                realResults: {},
                isActive: false,
                isClosed: false
            });
            setFeedback('¡Quiniela creada con éxito! Ahora puedes activarla desde la pestaña de "Gestionar".');
            setQuinielaName('');
            setMatches([{ home: '', away: '', homeCode: '', awayCode: '', championship: '' }]);
        } catch (error) {
            console.error("Error al crear la quiniela:", error);
            setFeedback('Error al crear la quiniela.');
        } finally {
            setIsLoading(false);
            setTimeout(() => setFeedback(''), 5000);
        }
    };

    return (
        <div className="p-4 bg-gray-700/50 rounded-lg">
            <h2 className="text-xl font-bold text-amber-400 mb-4">Crear Nueva Quiniela</h2>
            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    <label htmlFor="quinielaName" className="block text-sm font-medium text-gray-300 mb-2">Nombre de la Quiniela</label>
                    <input 
                        type="text"
                        id="quinielaName"
                        value={quinielaName}
                        onChange={(e) => setQuinielaName(e.target.value)}
                        className="w-full border bg-gray-700 border-gray-600 text-gray-200 rounded-md p-2"
                        placeholder="Ej: Copa América - Fase de Grupos"
                        required
                    />
                </div>

                <h3 className="text-lg font-semibold text-blue-300 mb-4">Partidos</h3>
                <div className="space-y-4">
                    {matches.map((match, index) => (
                        <div key={index} className="p-3 bg-gray-900/50 rounded-md">
                            <div className="mb-3">
                                <label className="text-xs text-gray-400">Campeonato</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Premier League" 
                                    value={match.championship} 
                                    onChange={e => handleMatchChange(index, 'championship', e.target.value)} 
                                    className="w-full mt-1 border bg-gray-700 border-gray-600 text-gray-200 rounded-md text-sm p-2" 
                                    required 
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-10 gap-2 items-center">
                                <input type="text" placeholder="Equipo Local" value={match.home} onChange={e => handleMatchChange(index, 'home', e.target.value)} className="md:col-span-3 border bg-gray-700 border-gray-600 text-gray-200 rounded-md text-sm p-2" required />
                                <input type="text" placeholder="Código (ej: ar)" value={match.homeCode} onChange={e => handleMatchChange(index, 'homeCode', e.target.value)} className="md:col-span-1 border bg-gray-700 border-gray-600 text-gray-200 rounded-md text-sm p-2" />
                                <span className="text-center text-gray-400">vs</span>
                                <input type="text" placeholder="Equipo Visitante" value={match.away} onChange={e => handleMatchChange(index, 'away', e.target.value)} className="md:col-span-3 border bg-gray-700 border-gray-600 text-gray-200 rounded-md text-sm p-2" required />
                                <input type="text" placeholder="Código (ej: br)" value={match.awayCode} onChange={e => handleMatchChange(index, 'awayCode', e.target.value)} className="md:col-span-1 border bg-gray-700 border-gray-600 text-gray-200 rounded-md text-sm p-2" />
                                <button type="button" onClick={() => removeMatch(index)} className="md:col-span-1 text-red-400 hover:text-red-600 text-sm">Quitar</button>
                            </div>
                        </div>
                    ))}
                </div>

                <button type="button" onClick={addMatch} className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-semibold">+ Añadir Partido</button>

                <div className="mt-8">
                     <button type="submit" disabled={isLoading} className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-wait text-white font-bold py-3 px-6 rounded-md transition duration-300">
                        {isLoading ? 'Guardando...' : 'Guardar Quiniela'}
                    </button>
                </div>
                 {feedback && <div className="mt-4 text-center text-green-400 font-medium">{feedback}</div>}
            </form>
        </div>
    );
};

export default CreateQuiniela;