import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Componentes
import QuinielaEditor from './QuinielaEditor'; // <-- Cambiado de CreateQuiniela
import QuinielaView from './QuinielaView';
import QuinielaSelector from './QuinielaSelector';

const AdminDashboard = ({ user, allQuinielas }) => {
    const [activeView, setActiveView] = useState('manage'); // manage, create, edit
    const [selectedId, setSelectedId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
        if (!selectedQuiniela) return;
        if (!window.confirm(`¿ESTÁS SEGURO de borrar la quiniela "${selectedQuiniela.name}"? Esta acción es PERMANENTE.`)) return;
        
        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            const predictionsRef = collection(db, 'quinielas', selectedQuiniela.id, 'predictions');
            const predictionsSnapshot = await getDocs(predictionsRef);
            predictionsSnapshot.forEach((doc) => batch.delete(doc.ref));
            const quinielaRef = doc(db, 'quinielas', selectedQuiniela.id);
            batch.delete(quinielaRef);
            await batch.commit();
            alert(`La quiniela "${selectedQuiniela.name}" ha sido eliminada.`);
        } catch (error) {
            console.error("Error al borrar la quiniela:", error);
            alert("Hubo un error al borrar la quiniela.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Renderiza el contenido principal basado en activeView
    const renderContent = () => {
        switch (activeView) {
            case 'create':
                return <QuinielaEditor onFinishEditing={() => setActiveView('manage')} />;
            case 'edit':
                return <QuinielaEditor quinielaToEdit={selectedQuiniela} onFinishEditing={() => setActiveView('manage')} />;
            case 'manage':
            default:
                return selectedQuiniela ? (
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
                );
        }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-700 mb-6 gap-4">
                <div className="flex space-x-2">
                    <button onClick={() => setActiveView('manage')} className={`px-4 py-3 font-semibold text-sm rounded-t-md border-b-2 transition-colors duration-200 ${activeView === 'manage' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        Gestionar
                    </button>
                    <button onClick={() => setActiveView('create')} className={`px-4 py-3 font-semibold text-sm rounded-t-md border-b-2 transition-colors duration-200 ${activeView === 'create' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        Crear Nueva
                    </button>
                </div>
                
                {activeView === 'manage' && selectedQuiniela && (
                    <div className="flex items-center gap-x-4">
                        <QuinielaSelector quinielas={allQuinielas} selectedId={selectedId} setSelectedId={setSelectedId}/>
                        <button 
                            onClick={() => setActiveView('edit')} 
                            disabled={selectedQuiniela.isClosed}
                            className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-md text-sm transition disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                            title={selectedQuiniela.isClosed ? "No se puede editar una quiniela cerrada" : "Editar quiniela seleccionada"}
                        >
                            Editar
                        </button>
                    </div>
                )}
            </div>

            {renderContent()}
        </div>
    );
};

export default AdminDashboard;