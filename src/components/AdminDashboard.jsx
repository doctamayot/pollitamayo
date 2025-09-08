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

    // Sincronizar la selección con la lista de quinielas
    useEffect(() => {
        const currentSelectionExists = allQuinielas.some(q => q.id === selectedId);
        if (selectedId && !currentSelectionExists) {
            setSelectedId(allQuinielas.length > 0 ? allQuinielas[0].id : null);
        } else if (!selectedId && allQuinielas.length > 0) {
            setSelectedId(allQuinielas[0].id);
        }
    }, [allQuinielas, selectedId]);

    const selectedQuiniela = allQuinielas.find(q => q.id === selectedId);

    // ***** FUNCIÓN CORREGIDA *****
    const handleDeleteQuiniela = async () => {
        // Usar 'selectedQuiniela' en lugar de 'quiniela'
        if (!selectedQuiniela) {
            return;
        }

        setIsDeleting(true);
        try {
            // Borrar la subcolección de predicciones
            const predictionsCollectionRef = collection(db, 'quinielas', selectedQuiniela.id, 'predictions');
            const predictionsSnapshot = await getDocs(predictionsCollectionRef);
            
            const batch = writeBatch(db);
            predictionsSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // Borrar el documento principal de la quiniela
            await deleteDoc(doc(db, 'quinielas', selectedQuiniela.id));
            
            alert(`La quiniela "${selectedQuiniela.name}" ha sido eliminada.`);

        } catch (error) {
            console.error("Error al borrar la quiniela:", error);
            alert("Hubo un error al borrar la quiniela. Revisa la consola para más detalles.");
        } finally {
            setIsDeleting(false);
        }
    };


    return (
        <div>
            <div className="flex justify-center items-center border-b border-gray-700 mb-6">
                <div className="flex-1">
                    <button onClick={() => setActiveView('manage')} className={`px-4 py-2 font-medium text-sm ${activeView === 'manage' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>
                        Gestionar Quinielas
                    </button>
                    <button onClick={() => setActiveView('create')} className={`px-4 py-2 font-medium text-sm ${activeView === 'create' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>
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
                        <div className="mt-8 pt-6 border-t border-red-500/30 text-center">
                             <button onClick={handleDeleteQuiniela} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-md text-sm transition disabled:bg-red-800 disabled:cursor-wait">
                                {isDeleting ? 'Borrando...' : 'Borrar Esta Quiniela'}
                            </button>
                            <p className="text-xs text-gray-500 mt-2">Esta acción no se puede deshacer.</p>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-10 text-gray-400">
                        <p>No has creado ninguna quiniela todavía.</p>
                    </div>
                )
            )}
        </div>
    );
};

export default AdminDashboard;