import React from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ResultsTable = ({ quiniela, allPredictions, isAdmin }) => {

    if (allPredictions.length === 0) {
        return <div className="text-center text-gray-400">Aún no hay predicciones para mostrar en esta quiniela.</div>;
    }

    const sortedPredictions = [...allPredictions].sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));

    const handleDelete = async (predictionId) => {
        if (window.confirm("¿Estás seguro de que quieres borrar esta predicción?")) {
            try {
                // Ruta a la subcolección
                const docRef = doc(db, 'quinielas', quiniela.id, 'predictions', predictionId);
                await deleteDoc(docRef);
            } catch (error) {
                console.error("Error al borrar la predicción:", error);
            }
        }
    };

    return (
        <div id="results-table-container" className="overflow-x-auto">
            <h2 className="text-xl font-bold text-blue-300 mb-4">Predicciones de "{quiniela.name}"</h2>
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                    <tr>
                        <th scope="col" className="sticky left-0 bg-gray-700 z-10 py-3 pl-2 pr-1 sm:pl-4 sm:pr-3 text-left text-xs sm:text-sm font-semibold text-white">Apostador</th>
                        {quiniela.matches.map(p => (
                            <th scope="col" key={p.id} className="px-1 py-3 text-center text-xs font-semibold text-white">
                                <div className="flex flex-col items-center justify-center space-y-0.5">
                                    <img src={`https://flagcdn.com/w20/${p.homeCode}.png`} title={p.home} className="h-3 rounded-sm" />
                                    <span className="text-[10px]">vs</span>
                                    <img src={`https://flagcdn.com/w20/${p.awayCode}.png`} title={p.away} className="h-3 rounded-sm" />
                                </div>
                            </th>
                        ))}
                         {isAdmin && <th scope="col" className="relative py-3 pl-1 pr-2 sm:pl-3 sm:pr-4"><span className="sr-only">Borrar</span></th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-600 bg-gray-800">
                    {sortedPredictions.map(pred => (
                        <tr key={pred.id}>
                            <td className="sticky left-0 bg-gray-800 whitespace-nowrap py-3 pl-2 pr-1 sm:pl-4 sm:pr-3 text-xs sm:text-sm font-medium text-white">{pred.apostador}</td>
                            {quiniela.matches.map(p => (
                                <td key={p.id} className="whitespace-nowrap px-1 sm:px-3 py-3 text-xs sm:text-sm text-center text-gray-300">
                                    {`${pred.predictions[p.id]?.home ?? '?'} - ${pred.predictions[p.id]?.away ?? '?'}`}
                                </td>
                            ))}
                             {isAdmin && (
                                <td className="relative whitespace-nowrap py-3 pl-1 pr-2 sm:pl-3 sm:pr-4 text-right text-xs sm:text-sm font-medium">
                                    <button onClick={() => handleDelete(pred.id)} className="text-red-400 hover:text-red-600">
                                        Borrar
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ResultsTable;