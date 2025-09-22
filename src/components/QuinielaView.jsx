import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { getLiveStatusesByIds } from '../services/apiFootball'; // <-- Importamos la nueva función

import Tabs from './Tabs';
import PredictionsForm from './PredictionsForm';
import RealResultsForm from './RealResultsForm';
import ScoringTable from './ScoringTable';
import AdminPanel from './AdminPanel';

const QuinielaView = ({ user, quiniela, isAdmin = false }) => {
    const [activeTab, setActiveTab] = useState('predictions');
    const [predictions, setPredictions] = useState([]);
    const [loadingPredictions, setLoadingPredictions] = useState(true);
    // --- ▼▼▼ NUEVO ESTADO PARA LOS ESTADOS EN VIVO ▼▼▼ ---
    const [liveStatuses, setLiveStatuses] = useState({});

    // Listener para las predicciones (sin cambios)
    useEffect(() => {
        if (!quiniela) return;
        setLoadingPredictions(true);
        const predictionsQuery = query(collection(db, 'quinielas', quiniela.id, 'predictions'));
        const unsubscribe = onSnapshot(predictionsQuery, (snapshot) => {
            const predictionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPredictions(predictionsData);
            setLoadingPredictions(false);
        });
        return () => unsubscribe();
    }, [quiniela]);

    // --- ▼▼▼ NUEVO useEffect PARA BUSCAR ESTADOS EN VIVO ▼▼▼ ---
    useEffect(() => {
        // 1. Nos aseguramos de que la quiniela y sus partidos existan y no estén vacíos
        if (!quiniela || !quiniela.matches || quiniela.matches.length === 0) {
            return;
        }

        const fetchStatuses = async () => {
            const matchIds = quiniela.matches.map(m => m.id).filter(id => typeof id === 'number');
            
            // 2. Verificamos que tengamos IDs válidos antes de hacer la llamada
            if (matchIds.length > 0) {
                try {
                    const statuses = await getLiveStatusesByIds(matchIds);
                    setLiveStatuses(statuses);
                } catch (error) {
                    // El error ahora solo debería aparecer si la API realmente falla
                    console.error("Error al obtener estados en vivoaaaa:", error);
                }
            }
        };
        
        fetchStatuses();
    }, [quiniela]);

    if (!quiniela) {
        return <div className="text-center p-8 text-slate-400">Selecciona una quiniela para ver los detalles.</div>;
    }
    
    const canViewScoring = isAdmin || quiniela.resultsVisible;

    return (
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-amber-400 text-center mb-6">{quiniela.name}</h2>
            {isAdmin && <AdminPanel quiniela={quiniela} />}
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} resultsVisible={canViewScoring} />
            <div className="mt-6">
                {loadingPredictions ? (
                    <div className="text-center py-10 text-slate-400">Cargando predicciones...</div>
                ) : (
                    <>
                        {activeTab === 'predictions' && (
                            isAdmin 
                            // --- Pasamos los estados en vivo a los formularios ---
                            ? <RealResultsForm key={quiniela.id} quiniela={quiniela} liveStatuses={liveStatuses} /> 
                            : <PredictionsForm key={quiniela.id} user={user} quiniela={quiniela} allPredictions={predictions} liveStatuses={liveStatuses} />
                        )}
                        {activeTab === 'scoring' && canViewScoring && (
                            <ScoringTable quiniela={quiniela} allPredictions={predictions} currentUserDisplayName={user.displayName} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default QuinielaView;