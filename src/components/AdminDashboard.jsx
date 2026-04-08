import React, { useState, useEffect } from 'react';
import { collection, doc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Componentes
import QuinielaEditor from './QuinielaEditor'; 
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
                    <div className="animate-fade-in">
                        <QuinielaView user={user} quiniela={selectedQuiniela} isAdmin={true} />
                        <div className="mt-12 pt-6 border-t border-red-500/20 text-center">
                             <button 
                                onClick={handleDeleteQuiniela} 
                                disabled={isDeleting} 
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold py-2.5 px-6 rounded-xl text-sm transition-colors duration-300 disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isDeleting ? 'Borrando...' : '🗑️ Borrar Esta Quiniela'}
                            </button>
                            <p className="text-xs text-foreground-muted mt-3">Esta acción eliminará todos los pronósticos de los jugadores y no se puede deshacer.</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 animate-fade-in bg-card border border-card-border rounded-3xl shadow-sm">
                        <div className="text-5xl mb-4 opacity-50">⚽</div>
                        <h3 className="text-xl font-bold text-foreground mb-2">Sin Quinielas</h3>
                        <p className="text-foreground-muted">No has creado ninguna quiniela todavía.</p>
                        <button 
                            onClick={() => setActiveView('create')}
                            className="mt-6 bg-primary text-primary-foreground font-bold py-2 px-6 rounded-full hover:bg-amber-600 transition-colors shadow-sm"
                        >
                            Crear mi primera quiniela
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="w-full">
            {/* TABS Y CONTROLES SUPERIORES */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-border mb-8 gap-4 pb-2">
                <div className="flex space-x-2 w-full md:w-auto overflow-x-auto hide-scrollbar">
                    <button 
                        onClick={() => setActiveView('manage')} 
                        className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-colors whitespace-nowrap ${
                            activeView === 'manage' 
                            ? 'bg-card border-t border-x border-card-border text-primary shadow-sm relative top-[1px]' 
                            : 'text-foreground-muted hover:text-foreground hover:bg-background-offset'
                        }`}
                    >
                        Gestionar Activas
                    </button>
                    <button 
                        onClick={() => setActiveView('create')} 
                        className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-colors whitespace-nowrap ${
                            activeView === 'create' 
                            ? 'bg-card border-t border-x border-card-border text-primary shadow-sm relative top-[1px]' 
                            : 'text-foreground-muted hover:text-foreground hover:bg-background-offset'
                        }`}
                    >
                        Crear Nueva
                    </button>
                </div>
                
                {activeView === 'manage' && selectedQuiniela && (
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex-1 md:flex-none">
                            <QuinielaSelector quinielas={allQuinielas} selectedId={selectedId} setSelectedId={setSelectedId}/>
                        </div>
                        <button 
                            onClick={() => setActiveView('edit')} 
                            disabled={selectedQuiniela.isClosed}
                            className="bg-background-offset border border-border hover:border-foreground/50 text-foreground font-bold py-2.5 px-5 rounded-xl text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            title={selectedQuiniela.isClosed ? "No se puede editar una quiniela cerrada" : "Editar quiniela seleccionada"}
                        >
                            <span>✏️</span> <span className="hidden sm:inline">Editar</span>
                        </button>
                    </div>
                )}
            </div>

            {/* CONTENIDO (VISTA O EDITOR) */}
            {renderContent()}
        </div>
    );
};

export default AdminDashboard;