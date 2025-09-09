import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const MatchInput = ({ partido, value, onChange, disabled }) => (
    <div className="flex items-center justify-between col-span-1 gap-x-2">
        {/* ***** CAMBIO AQUÍ: Eliminado w-2/5 y añadido flex-1 para que crezca ***** */}
        <label htmlFor={`${partido.id}-home`} className="flex items-center justify-end text-sm font-medium text-slate-300 flex-1 min-w-0">
            <span className="text-right">{partido.home}</span>
            <img 
                src={`https://flagcdn.com/w20/${partido.homeCode}.png`} 
                alt={partido.home} 
                className="ml-2 h-4 rounded-sm bg-slate-600 flex-shrink-0" 
            />
        </label>
        
        {/* Contenedor de inputs con tamaño fijo */}
        <div className="flex items-center space-x-2 flex-shrink-0">
            <input 
                type="number" 
                id={`${partido.id}-home`} 
                name={`${partido.id}-home`} 
                value={value.home} 
                onChange={onChange} 
                min="0" 
                className="w-14 text-center form-input py-2" 
                required 
                disabled={disabled} 
            />
            <span className="text-slate-400">-</span>
            <input 
                type="number" 
                id={`${partido.id}-away`} 
                name={`${partido.id}-away`} 
                value={value.away} 
                onChange={onChange} 
                min="0" 
                className="w-14 text-center form-input py-2" 
                required 
                disabled={disabled} 
            />
        </div>

        {/* ***** CAMBIO AQUÍ: Eliminado w-2/5 y añadido flex-1 para que crezca ***** */}
        <label htmlFor={`${partido.id}-away`} className="flex items-center text-sm font-medium text-slate-300 flex-1 min-w-0">
            <img 
                src={`https://flagcdn.com/w20/${partido.awayCode}.png`} 
                alt={partido.away} 
                className="mr-2 h-4 rounded-sm bg-slate-600 flex-shrink-0" 
            />
            <span>{partido.away}</span>
        </label>
    </div>
);

const PredictionsForm = ({ user, quiniela, allPredictions }) => {
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
        : 'w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-md';

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
                        <h3 className="text-lg font-semibold text-blue-400 border-b border-slate-700 pb-3 mb-4">
                            {championship}
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                            {groupedMatches[championship].map((partido) => (
                                <MatchInput key={partido.id} partido={partido} value={predictions[partido.id] || {home: '', away: ''}} onChange={handleChange} disabled={isLocked}/>
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