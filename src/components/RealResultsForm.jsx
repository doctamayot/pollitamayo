import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const MatchInputAdmin = ({ partido, value, onChange }) => (
     <div className="flex items-center justify-between col-span-1">
        <label htmlFor={`admin-${partido.id}-home`} className="flex items-center justify-end text-xs sm:text-sm font-medium w-2/5 pr-2 truncate text-gray-200">
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
                id={`admin-${partido.id}-home`} 
                name={`${partido.id}-home`} 
                value={value.home} 
                onChange={onChange} 
                min="0" 
                className="w-12 text-center rounded-md border bg-gray-700 border-gray-600 text-gray-200 focus:ring-blue-500 focus:border-blue-500"
            />
            <span>-</span>
            <input 
                type="number" 
                id={`admin-${partido.id}-away`} 
                name={`${partido.id}-away`} 
                value={value.away} 
                onChange={onChange} 
                min="0" 
                className="w-12 text-center rounded-md border bg-gray-700 border-gray-600 text-gray-200 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
        <label htmlFor={`admin-${partido.id}-away`} className="flex items-center text-xs sm:text-sm font-medium w-2/5 pl-2 truncate text-gray-200">
            <img 
                src={`https://flagcdn.com/w20/${partido.awayCode}.png`} 
                alt={partido.away} 
                className="mr-2 h-3 rounded-sm bg-gray-600"
            />
            <span>{partido.away}</span>
        </label>
    </div>
);

const RealResultsForm = ({ quiniela }) => {
    const [results, setResults] = useState({});
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const initialResults = {};
        quiniela.matches.forEach(p => {
             initialResults[p.id] = {
                home: quiniela.realResults?.[p.id]?.home || '',
                away: quiniela.realResults?.[p.id]?.away || '',
            };
        });
        setResults(initialResults);
    }, [quiniela]);

    // ***** LÓGICA DE HANDLECHANGE CORREGIDA *****
    const handleChange = (e) => {
        const { name, value } = e.target;
        const sanitizedValue = value.replace(/[^0-9]/g, '');

        const nameParts = name.split('-');         // -> ['par', 'ecu', 'home']
        const team = nameParts.pop();             // -> 'home'
        const partidoId = nameParts.join('-');    // -> 'par-ecu'

        setResults(prev => ({
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
        
        const newResults = Object.entries(results).reduce((acc, [key, value]) => {
            if (value.home !== '' && value.away !== '') {
                acc[key] = value;
            }
            return acc;
        }, {});

        try {
            const docRef = doc(db, 'quinielas', quiniela.id);
            await updateDoc(docRef, { realResults: newResults });
            setFeedback('¡Resultados reales guardados con éxito!');
        } catch (error) {
            console.error("Error al guardar:", error);
            setFeedback('Error al guardar. Inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
            setTimeout(() => setFeedback(''), 3000);
        }
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold text-amber-400 mb-4">Ingresar Resultados Reales para "{quiniela.name}"</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                 {quiniela.matches.map((partido) => (
                    <MatchInputAdmin
                        key={partido.id}
                        partido={partido}
                        value={results[partido.id] || {home: '', away: ''}}
                        onChange={handleChange}
                    />
                ))}
            </div>

            <button type="submit" disabled={isLoading} className="mt-8 w-full md:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-wait text-white font-bold py-3 px-6 rounded-md transition duration-300">
                {isLoading ? 'Guardando...' : 'Guardar Resultados Reales'}
            </button>
            {feedback && <div className="mt-4 text-center text-green-400 font-medium">{feedback}</div>}
        </form>
    );
};

export default RealResultsForm;