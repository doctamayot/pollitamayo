import React, { useState } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, increment, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { QUINIELAS_COLLECTION } from '../config';
import { calculatePoints } from '../utils/scoring';

const AdminPanel = ({ quiniela }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleConfigChange = async (field, value) => {
        try {
            const docRef = doc(db, 'quinielas', quiniela.id);
            await updateDoc(docRef, { [field]: value });
        } catch (error) {
            console.error(`Error al cambiar ${field}`, error);
        }
    };

    const handleActivationToggle = async (shouldActivate) => {
        setIsUpdating(true);
        if (shouldActivate) {
            try {
                const batch = writeBatch(db);
                const q = query(collection(db, QUINIELAS_COLLECTION), where("isActive", "==", true));
                const activeQuinielasSnapshot = await getDocs(q);
                activeQuinielasSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { isActive: false });
                });
                const newActiveQuinielaRef = doc(db, QUINIELAS_COLLECTION, quiniela.id);
                batch.update(newActiveQuinielaRef, { isActive: true });
                await batch.commit();
            } catch (error) {
                console.error("Error al activar la quiniela:", error);
            }
        } else {
            try {
                await handleConfigChange('isActive', false);
            } catch (error) {
                console.error("Error al desactivar la quiniela:", error);
            }
        }
        setIsUpdating(false);
    };
    
    const handleToggleCloseQuiniela = async () => {
        // ... (lógica de cierre/reapertura sin cambios)
    };
    
    const allResultsFilled = quiniela.matches.every(
        match => quiniela.realResults?.[match.id]?.home !== '' && 
                 quiniela.realResults?.[match.id]?.away !== '' && 
                 quiniela.realResults?.[match.id] !== undefined
    );

    return (
        <div className="bg-slate-700/50 p-4 rounded-lg mb-6 flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
            <h3 className="text-white font-bold text-sm sm:text-base">
                Panel de Admin: <span className="text-amber-300">{quiniela.name}</span>
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                
                <div className="flex items-center">
                    <span className={`mr-3 text-sm font-medium ${quiniela.isActive ? 'text-green-400' : 'text-slate-300'}`}>
                        Activa
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.isActive || false} onChange={(e) => handleActivationToggle(e.target.checked)} className="sr-only peer" disabled={isUpdating}/>
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-green-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                </div>

                <div className="flex items-center">
                    <span className="mr-3 text-sm text-slate-300">Mostrar Puntuación</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.resultsVisible || false} onChange={(e) => handleConfigChange('resultsVisible', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                
                <div className="flex items-center">
                    <span className="mr-3 text-sm text-slate-300">Bloquear</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={quiniela.locked || false} onChange={(e) => handleConfigChange('locked', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                
                <div className="flex flex-col items-center">
                    <button onClick={handleToggleCloseQuiniela} disabled={isUpdating || (!allResultsFilled && !quiniela.isClosed)} className={`font-bold py-2 px-4 rounded-md text-sm transition ${quiniela.isClosed ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-red-600 hover:bg-red-700 text-white'} disabled:bg-slate-500 disabled:cursor-not-allowed`}>
                        {isUpdating ? 'Procesando...' : (quiniela.isClosed ? 'Re-abrir Quiniela' : 'Cerrar y Puntuar')}
                    </button>
                    {!allResultsFilled && !quiniela.isClosed && (
                        <span className="text-xs text-slate-400 mt-1">Llenar resultados para cerrar</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;