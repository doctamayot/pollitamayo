import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Componentes
import CreateQuiniela from './CreateQuiniela';
import QuinielaView from './QuinielaView';
import QuinielaSelector from './QuinielaSelector';

const AdminDashboard = ({ user, allQuinielas }) => {
    const [activeView, setActiveView] = useState('manage');
    const [selectedId, setSelectedId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Esta función se asegura de que la quiniela más reciente esté seleccionada por defecto
    useEffect(() => {
        const currentSelectionExists = allQuinielas.some(q => q.id === selectedId);
        if (selectedId && !currentSelectionExists) {
            setSelectedId(allQuinielas.length > 0 ? allQuinielas[0].id : null);
        } else if (!selectedId && allQuinielas.length > 0) {
            setSelectedId(allQuinielas[0].id);
        }
    }, [allQuinielas, selectedId]);

    const selectedQuiniela = allQuinielas.find(q => q.id === selectedId);

    const handleDeleteQuiniela = async () => {
        if (!selectedQuiniela) {
            return;
        }

        if (!window.confirm(`¿ESTÁS SEGURO de borrar la quiniela "${selectedQuiniela.name}"? Esta acción es PERMANENTE y eliminará todas las predicciones asociadas.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const batch = writeBatch(db);

            const predictionsCollectionRef = collection(db, 'quinielas', selectedQuiniela.id, 'predictions');
            const predictionsSnapshot = await getDocs(predictionsCollectionRef);
            predictionsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            const quinielaRef = doc(db, 'quinielas', selectedQuiniela.id);
            batch.delete(quinielaRef);
            
            await batch.commit();
            
            alert(`La quiniela "${selectedQuiniela.name}" y todas sus predicciones han sido eliminadas.`);

        } catch (error) {
            console.error("Error al borrar la quiniela:", error);
            alert("Hubo un error al borrar la quiniela. Revisa la consola para más detalles.");
        } finally {
            setIsDeleting(false);
        }
    };


    return (
        <div>
            <div className="flex justify-between items-center border-b border-slate-700 mb-6">
                <div className="flex space-x-2">
                    <button onClick={() => setActiveView('manage')} className={`px-4 py-3 font-semibold text-sm rounded-t-md border-b-2 transition-colors duration-200 ${activeView === 'manage' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        Gestionar Quinielas
                    </button>
                    <button onClick={() => setActiveView('create')} className={`px-4 py-3 font-semibold text-sm rounded-t-md border-b-2 transition-colors duration-200 ${activeView === 'create' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        Crear Nueva Quiniela
                    </button>
                </div>
                 {activeView === 'manage' && allQuinielas.length > 0 && (
                     <QuinielaSelector 
                        quinielas={allQuinielas}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                     />
                 )}
            </div>

            {activeView === 'create' && <CreateQuiniela />}
            
            {activeView === 'manage' && (
                selectedQuiniela ? (
                    <>
                        <QuinielaView user={user} quiniela={selectedQuiniela} isAdmin={true} />
                        <div className="mt-8 pt-6 border-t border-red-500/20 text-center">
                             <button onClick={handleDeleteQuiniela} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-md text-sm transition duration-300 disabled:bg-red-800 disabled:cursor-wait">
                                {isDeleting ? 'Borrando...' : 'Borrar Esta Quiniela'}
                            </button>
                            <p className="text-xs text-slate-500 mt-2">Esta acción no se puede deshacer.</p>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16 text-slate-400">
                        <p>No has creado ninguna quiniela todavía.</p>
                        <p className="mt-2 text-sm">Usa la pestaña "Crear Nueva Quiniela" para empezar.</p>
                    </div>
                )
            )}
        </div>
    );
};

export default AdminDashboard;