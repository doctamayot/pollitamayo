import React from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ResultsTable = ({ quiniela, allPredictions, isAdmin }) => {

    if (allPredictions.length === 0) {
        return <div className="text-center text-slate-400 py-10">Aún no hay predicciones para mostrar.</div>;
    }

    const sortedPredictions = [...allPredictions].sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));

    const handleDelete = async (predictionId) => {
        try {
            const docRef = doc(db, 'quinielas', quiniela.id, 'predictions', predictionId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error al borrar la predicción:", error);
        }
    };

    return (
        <div className="overflow-x-auto">
            <h2 className="text-xl font-bold text-blue-400 mb-4">Predicciones de Todos: "{quiniela.name}"</h2>
            <div className="align-middle inline-block min-w-full">
                <div className="shadow overflow-hidden border-b border-slate-700 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th scope="col" className="sticky left-0 bg-slate-700/50 z-10 px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Apostador</th>
                                {quiniela.matches.map(p => (
                                    <th scope="col" key={p.id} className="px-2 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider min-w-[70px]">
                                        <div className="flex flex-col items-center justify-center space-y-0.5">
                                            <span className="text-[9px] font-bold uppercase">{p.home.substring(0, 3)}</span>
                                            <img src={`https://flagcdn.com/w20/${p.homeCode}.png`} title={p.home} className="h-3 rounded-sm bg-slate-600"/>
                                            <span className="text-slate-400 text-[10px]">vs</span>
                                            <img src={`https://flagcdn.com/w20/${p.awayCode}.png`} title={p.away} className="h-3 rounded-sm bg-slate-600"/>
                                            <span className="text-[9px] font-bold uppercase">{p.away.substring(0, 3)}</span>
                                        </div>
                                    </th>
                                ))}
                                {isAdmin && <th scope="col" className="relative px-4 py-3"><span className="sr-only">Borrar</span></th>}
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-slate-700/50">
                            {sortedPredictions.map(pred => (
                                <tr key={pred.id} className="hover:bg-slate-700/30">
                                    <td className="sticky left-0 bg-gray-800 px-4 py-4 whitespace-nowrap text-sm font-medium text-white">{pred.apostador}</td>
                                    {quiniela.matches.map(p => (
                                        <td key={p.id} className="px-2 py-4 whitespace-nowrap text-sm text-center text-slate-300">
                                            {`${pred.predictions[p.id]?.home ?? '?'} - ${pred.predictions[p.id]?.away ?? '?'}`}
                                        </td>
                                    ))}
                                    {isAdmin && (
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleDelete(pred.id)} className="text-red-500 hover:text-red-400 font-semibold">
                                                Borrar
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ResultsTable;