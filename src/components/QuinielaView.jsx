import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

import Tabs from './Tabs';
import PredictionsForm from './PredictionsForm';
import RealResultsForm from './RealResultsForm';
import ScoringTable from './ScoringTable';
import AdminPanel from './AdminPanel';

const QuinielaView = ({ user, quiniela, isAdmin = false }) => {
    const [activeTab, setActiveTab] = useState('predictions');
    const [predictions, setPredictions] = useState([]);
    const [loadingPredictions, setLoadingPredictions] = useState(true);

    useEffect(() => {
        if (!quiniela) return;

        setActiveTab('predictions');
        setLoadingPredictions(true);
        
        const predictionsQuery = query(collection(db, 'quinielas', quiniela.id, 'predictions'));
        const unsubscribe = onSnapshot(predictionsQuery, (snapshot) => {
            const predictionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPredictions(predictionsData);
            setLoadingPredictions(false);
        }, (error) => {
            console.error("Error al obtener predicciones:", error);
            setLoadingPredictions(false);
        });

        return () => unsubscribe();
    }, [quiniela]);

    if (!quiniela) {
        return <div className="text-center p-8 text-slate-400">Selecciona una quiniela para ver los detalles.</div>;
    }
    
    const canViewScoring = isAdmin || quiniela.resultsVisible;

    if (!isAdmin && !canViewScoring && activeTab === 'scoring') {
        setActiveTab('predictions');
    }

    return (
        <div>
            {/* ***** TÍTULO DE LA QUINIELA AÑADIDO AQUÍ ***** */}
            <h2 className="text-2xl sm:text-3xl font-bold text-amber-400 text-center mb-6">
                {quiniela.name}
            </h2>

            {isAdmin && <AdminPanel quiniela={quiniela} />}

            <Tabs 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                isAdmin={isAdmin}
                resultsVisible={canViewScoring}
            />
            <div className="mt-6">
                {loadingPredictions ? (
                     <div className="text-center py-10 text-slate-400">Cargando predicciones...</div>
                ) : (
                    <>
                        {activeTab === 'predictions' && (
                            isAdmin 
                            ? <RealResultsForm key={quiniela.id} quiniela={quiniela} /> 
                            : <PredictionsForm key={quiniela.id} user={user} quiniela={quiniela} allPredictions={predictions} />
                        )}
                        
                        {activeTab === 'scoring' && canViewScoring && (
                            <ScoringTable 
                                quiniela={quiniela}
                                allPredictions={predictions} 
                                currentUserDisplayName={user.displayName}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default QuinielaView;