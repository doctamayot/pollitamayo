import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const MatchInput = ({ partido, value, onChange, disabled }) => (
    <div className="flex items-center justify-between col-span-1">
        <label htmlFor={`${partido.id}-home`} className="flex items-center justify-end text-xs sm:text-sm font-medium w-2/5 pr-2 truncate text-gray-200">
            <span className="text-right">{partido.home}</span>
            <img 
                src={`https://flagcdn.com/w20/${partido.homeCode}.png`} 
                alt={partido.home} 
                className="ml-2 h-3 rounded-sm bg-gray-600" 
            />
        </label>
        <div className="flex items-center space-x-2">
            <input 
                type="number" 
                id={`${partido.id}-home`} 
                name={`${partido.id}-home`} 
                value={value.home} 
                onChange={onChange} 
                min="0" 
                className="w-12 text-center rounded-md border bg-gray-700 border-gray-600 text-gray-200 focus:ring-blue-500 focus:border-blue-500" 
                required 
                disabled={disabled} 
            />
            <span>-</span>
            <input 
                type="number" 
                id={`${partido.id}-away`} 
                name={`${partido.id}-away`} 
                value={value.away} 
                onChange={onChange} 
                min="0" 
                className="w-12 text-center rounded-md border bg-gray-700 border-gray-600 text-gray-200 focus:ring-blue-500 focus:border-blue-500" 
                required 
                disabled={disabled} 
            />
        </div>
        <label htmlFor={`${partido.id}-away`} className="flex items-center text-xs sm:text-sm font-medium w-2/5 pl-2 truncate text-gray-200">
            <img 
                src={`https://flagcdn.com/w20/${partido.awayCode}.png`} 
                alt={partido.away} 
                className="mr-2 h-3 rounded-sm bg-gray-600" 
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

    // ***** LÓGICA DE HANDLECHANGE CORREGIDA *****
    const handleChange = (e) => {
        const { name, value } = e.target;
        const sanitizedValue = value.replace(/[^0-9]/g, '');

        const nameParts = name.split('-');         // -> ['par', 'ecu', 'home']
        const team = nameParts.pop();             // -> 'home'
        const partidoId = nameParts.join('-');    // -> 'par-ecu'
        
        setPredictions(prev => ({
            ...prev,
            [partidoId]: {
                ...prev[partidoId],
                [team]: sanitizedValue
            }
        }));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setFeedback('Guardando...');
        try {
            const docRef = doc(db, 'quinielas', quiniela.id, 'predictions', user.uid);
            await setDoc(docRef, {
                apostador: user.displayName,
                predictions,
                timestamp: serverTimestamp()
            });
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
        ? 'mt-8 w-full md:w-auto bg-gray-500 text-white font-bold py-3 px-6 rounded-md cursor-not-allowed opacity-50'
        : 'mt-8 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md transition duration-300';

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {quiniela.matches.map((partido) => (
                    <MatchInput 
                        key={partido.id}
                        partido={partido}
                        value={predictions[partido.id] || {home: '', away: ''}}
                        onChange={handleChange}
                        disabled={isLocked}
                    />
                ))}
            </div>
            <button type="submit" className={buttonClasses} disabled={isLocked || isLoading}>
                {isLoading ? 'Guardando...' : buttonText}
            </button>
            {feedback && <div className="mt-4 text-center text-green-400 font-medium">{feedback}</div>}
        </form>
    );
};

export default PredictionsForm;