import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

import QuinielaSelector from './QuinielaSelector';
import ScoringTable from './ScoringTable';

const HistoryView = ({ closedQuinielas, user }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Esta función se asegura de que la quiniela más reciente del historial esté seleccionada por defecto
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
        return (
            <div className="text-center py-16 animate-fade-in">
                <div className="text-5xl mb-4 opacity-50">📅</div>
                <h3 className="text-xl font-bold text-foreground mb-2">Sin Historial</h3>
                <p className="text-foreground-muted">Aún no hay quinielas cerradas en el historial.</p>
            </div>
        );
    }

    const selectedQuiniela = closedQuinielas.find(q => q.id === selectedId);

    return (
        <div className="bg-card border border-card-border p-4 sm:p-8 rounded-3xl shadow-sm animate-fade-in w-full">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-8 text-center flex items-center justify-center gap-3">
                <span>Historial de Pollas</span>
            </h2>
            
            <div className="flex justify-center mb-8 bg-background-offset p-2 sm:p-3 rounded-2xl sm:rounded-full border border-border shadow-inner">
                <QuinielaSelector 
                    quinielas={closedQuinielas}
                    selectedId={selectedId}
                    setSelectedId={setSelectedId}
                />
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-foreground-muted font-bold tracking-widest uppercase text-sm">Cargando posiciones...</p>
                </div>
            )}

            {!loading && selectedQuiniela && (
                <div className="overflow-hidden rounded-2xl border border-border">
                    <ScoringTable 
                        quiniela={selectedQuiniela}
                        allPredictions={predictions}
                        currentUserDisplayName={user.displayName}
                    />
                </div>
            )}
        </div>
    );
};

export default HistoryView;