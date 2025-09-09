import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const MatchInputAdmin = ({ partido, value, onChange }) => (
     <div className="flex items-center justify-between col-span-1 gap-x-2">
        {/* ***** CAMBIO AQUÍ: Letra más pequeña para móvil ***** */}
        <label htmlFor={`admin-${partido.id}-home`} className="flex items-center justify-end text-xs sm:text-sm font-medium text-slate-300 flex-1 min-w-0">
            <span className="text-right">{partido.home}</span>
            <img src={`https://flagcdn.com/w20/${partido.homeCode}.png`} alt={partido.home} className="ml-2 h-4 rounded-sm bg-slate-600 flex-shrink-0"/>
        </label>
        
        <div className="flex items-center space-x-2 flex-shrink-0">
            <input type="number" id={`admin-${partido.id}-home`} name={`${partido.id}-home`} value={value.home} onChange={onChange} min="0" className="w-14 text-center form-input py-2"/>
            <span className="text-slate-400">-</span>
            <input type="number" id={`admin-${partido.id}-away`} name={`${partido.id}-away`} value={value.away} onChange={onChange} min="0" className="w-14 text-center form-input py-2"/>
        </div>

        {/* ***** CAMBIO AQUÍ: Letra más pequeña para móvil ***** */}
        <label htmlFor={`admin-${partido.id}-away`} className="flex items-center text-xs sm:text-sm font-medium text-slate-300 flex-1 min-w-0">
            <img src={`https://flagcdn.com/w20/${partido.awayCode}.png`} alt={partido.away} className="mr-2 h-4 rounded-sm bg-slate-600 flex-shrink-0"/>
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
             initialResults[p.id] = { home: quiniela.realResults?.[p.id]?.home || '', away: quiniela.realResults?.[p.id]?.away || '' };
        });
        setResults(initialResults);
    }, [quiniela]);

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
        setFeedback('Guardando...');
        
        const newResults = Object.entries(results).reduce((acc, [key, value]) => {
            if (value.home !== '' && value.away !== '') { acc[key] = value; }
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
                                <MatchInputAdmin key={partido.id} partido={partido} value={results[partido.id] || {home: '', away: ''}} onChange={handleChange}/>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                <button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-md disabled:bg-amber-700 disabled:cursor-wait">
                    {isLoading ? 'Guardando...' : 'Guardar Resultados Reales'}
                </button>
                {feedback && <div className="mt-4 text-center text-green-400 font-medium">{feedback}</div>}
            </div>
        </form>
    );
};

export default RealResultsForm;