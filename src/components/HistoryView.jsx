import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

import QuinielaSelector from './QuinielaSelector';
import ScoringTable from './ScoringTable';

const HistoryView = ({ closedQuinielas, user }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Seleccionar la primera quiniela del historial por defecto
    useEffect(() => {
        if (closedQuinielas.length > 0 && !selectedId) {
            setSelectedId(closedQuinielas[0].id);
        }
    }, [closedQuinielas, selectedId]);

    // Cargar las predicciones para la quiniela seleccionada en el historial
    useEffect(() => {
        if (!selectedId) return;

        setLoading(true);
        const predictionsQuery = query(collection(db, 'quinielas', selectedId, 'predictions'));
        const unsubscribe = onSnapshot(predictionsQuery, (snapshot) => {
            const predictionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPredictions(predictionsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedId]);

    if (closedQuinielas.length === 0) {
        return <div className="text-center text-gray-400 py-10">Aún no hay quinielas en el historial.</div>;
    }

    const selectedQuiniela = closedQuinielas.find(q => q.id === selectedId);

    return (
        <div className="bg-gray-800/50 p-4 sm:p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-blue-300 mb-6 text-center">Historial de Quinielas</h2>
            
            <div className="flex justify-center mb-6">
                <QuinielaSelector 
                    quinielas={closedQuinielas}
                    selectedId={selectedId}
                    setSelectedId={setSelectedId}
                />
            </div>

            {loading && <p className="text-center text-gray-400">Cargando tabla de posiciones...</p>}

            {!loading && selectedQuiniela && (
                <ScoringTable 
                    quiniela={selectedQuiniela}
                    allPredictions={predictions}
                    currentUserDisplayName={user.displayName}
                />
            )}
        </div>
    );
};

export default HistoryView;