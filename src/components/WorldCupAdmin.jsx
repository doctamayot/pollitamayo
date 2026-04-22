import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import SearchBar from './SearchBar'; 

const WorldCupAdmin = () => {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [liveMenuMode, setLiveMenuMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); 

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'worldCupPredictions'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setParticipants(usersData);
            setLoading(false);
        });

        const settingsRef = doc(db, 'worldCupAdmin', 'settings');
        const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setLiveMenuMode(!!docSnap.data().liveMenuMode);
            }
        });

        return () => {
            unsubscribe();
            unsubSettings();
        };
    }, []);

    const filteredParticipants = useMemo(() => {
        // 1. Hacemos una copia de los participantes para poder ordenarlos
        let result = [...participants]; 
        
        // 2. Aplicamos el filtro de búsqueda si el administrador escribió algo
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(p => {
                const nameMatch = p.displayName?.toLowerCase().includes(lowerTerm);
                const emailMatch = p.email?.toLowerCase().includes(lowerTerm);
                return nameMatch || emailMatch; 
            });
        }

        // 3. Ordenamos por fecha de llegada (El primero en registrarse sale arriba)
        result.sort((a, b) => {
            const getTime = (player) => {
                const dateField = player.createdAt || player.updatedAt;
                if (!dateField) return 0; // Si no tiene fecha, lo manda al fondo
                // Firebase a veces guarda Timestamp y a veces un String ISO, aquí manejamos ambos:
                return dateField.toDate ? dateField.toDate().getTime() : new Date(dateField).getTime();
            };
            
            // Orden Ascendente (Para Orden Descendente, es decir el más nuevo arriba, cambia a: getTime(b) - getTime(a))
            return getTime(b) - getTime(a); 
        });

        return result;
    }, [participants, searchTerm]);

    const toggleLiveMode = async () => {
        // 🟢 NUEVO: Alerta de confirmación para el Admin
        const confirmMsg = liveMenuMode
            ? "¿Seguro que deseas VOLVER AL PRE-MUNDIAL? Esto reabrirá las predicciones de Grupos, Extras y Eventos para todos los usuarios."
            : "🚨 ¿INICIAR MUNDIAL? Esto BLOQUEARÁ permanentemente las predicciones de Grupos, Clasificados (Bracket), Extras y Eventos para los usuarios.";
            
        if (!window.confirm(confirmMsg)) return;

        try {
            const settingsRef = doc(db, 'worldCupAdmin', 'settings');
            // 🟢 NUEVO: Enviamos el flag "predictionsClosed" a Firebase
            await setDoc(settingsRef, { 
                liveMenuMode: !liveMenuMode,
                predictionsClosed: !liveMenuMode 
            }, { merge: true });
        } catch (error) {
            console.error("Error al cambiar de modo:", error);
            alert("No se pudo actualizar el menú de la aplicación.");
        }
    };

    const togglePaymentStatus = async (userId, currentStatus) => {
        try {
            const userRef = doc(db, 'worldCupPredictions', userId);
            await updateDoc(userRef, {
                hasPaid: !currentStatus
            });
        } catch (error) {
            console.error("Error al actualizar pago:", error);
            alert("Hubo un error al actualizar el estado de pago.");
        }
    };

    const handleDeleteUser = async (userId, userName) => {
        const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar la participación de ${userName}? Esta acción es irreversible.`);
        if (confirmDelete) {
            try {
                await deleteDoc(doc(db, 'worldCupPredictions', userId));
                alert("Usuario eliminado de la Polla Mundialista.");
            } catch (error) {
                console.error("Error al eliminar usuario:", error);
                alert("No se pudo eliminar al usuario.");
            }
        }
    };

    if (loading) {
        return <div className="text-center py-20 text-foreground-muted font-bold tracking-widest uppercase text-sm">Cargando Panel de Control...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in px-2 sm:px-0">
            <div className="mb-8 text-center relative">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 text-4xl mb-4 mx-auto border border-red-500/20">👑</div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-2">
                    Panel de Control
                </h2>
                <p className="text-foreground-muted">
                    Gestiona a los jugadores, sus pagos y el estado global del sistema.
                </p>
            </div>

            {/* BOTON DE CAMBIO DE MODO GLOBAL */}
            <div className={`mb-10 border p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 transition-colors ${liveMenuMode ? 'bg-red-500/10 border-red-500/30' : 'bg-background-offset border-border'}`}>
                <div>
                    <h3 className="text-lg font-black flex items-center gap-2">
                        <span>{liveMenuMode ? '🚨' : '📱'}</span> {liveMenuMode ? 'El Mundial está en Juego' : 'Modo Pre-Mundial Activo'}
                    </h3>
                    <p className="text-sm text-foreground-muted mt-1 max-w-md">
                        {liveMenuMode 
                            ? 'Los usuarios ya NO pueden editar sus Grupos, Clasificados ni Extras. El menú ahora muestra Grilla Live.' 
                            : 'Los usuarios pueden editar todas sus predicciones iniciales sin restricción.'}
                    </p>
                </div>
                
                <button 
                    onClick={toggleLiveMode}
                    className={`relative w-64 h-14 rounded-full p-1 transition-colors duration-300 flex items-center shrink-0 ${liveMenuMode ? 'bg-red-500' : 'bg-amber-500'}`}
                >
                    <div className="absolute inset-0 flex justify-between items-center px-4 font-bold text-[10px] sm:text-xs text-white uppercase tracking-widest pointer-events-none">
                        <span className={`${liveMenuMode ? 'opacity-100' : 'opacity-0'}`}>Cerrado</span>
                        <span className={`${!liveMenuMode ? 'opacity-100' : 'opacity-0'}`}>Abierto</span>
                    </div>
                    <div className={`w-12 h-12 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center text-xl ${liveMenuMode ? 'translate-x-[200px]' : 'translate-x-0'}`}>
                        {liveMenuMode ? '🔒' : '✍️'}
                    </div>
                </button>
            </div>

            {/* --- LA NUEVA BARRA DE BÚSQUEDA --- */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="w-full sm:w-auto flex-1">
                    <SearchBar 
                        value={searchTerm} 
                        onChange={setSearchTerm} 
                        placeholder="Buscar por nombre o correo..." 
                    />
                </div>
                <div className="shrink-0 bg-background-offset border border-border px-4 py-2.5 rounded-full text-xs font-bold text-foreground-muted mb-8 sm:mb-0">
                    Total Registrados: <span className="text-primary font-black ml-1">{filteredParticipants.length}</span>
                </div>
            </div>

            <div className="bg-card border border-card-border rounded-3xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-background-offset border-b border-border">
                            <tr className="text-foreground-muted">
                                <th className="p-4 sm:p-6 font-semibold">Jugador</th>
                                <th className="p-4 sm:p-6 font-semibold text-center">Fecha de Registro</th>
                                <th className="p-4 sm:p-6 font-semibold text-center">Estado de Pago</th>
                                <th className="p-4 sm:p-6 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredParticipants.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-foreground-muted">
                                        {searchTerm ? (
                                            <div className="flex flex-col items-center justify-center py-6">
                                                <span className="text-3xl mb-2">🕵️‍♂️</span>
                                                <p className="font-bold">No se encontraron resultados</p>
                                                <p className="text-xs mt-1">Intenta buscar con otro nombre o correo electrónico.</p>
                                            </div>
                                        ) : 'Aún no hay participantes registrados.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredParticipants.map((p) => (
                                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-background-offset/50 transition-colors">
                                        <td className="p-4 sm:p-6">
                                            <div className="flex items-center gap-3">
                                                {p.photoURL ? (
                                                    <img src={p.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-border object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-lg">👤</div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-foreground text-base">{p.displayName || 'Usuario Desconocido'}</p>
                                                    <p className="text-xs text-foreground-muted">{p.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 sm:p-6 text-center text-foreground-muted">
                                            {/* Prioridad absoluta a createdAt (la primera vez que entró) */}
                                            {p.createdAt 
                                                ? new Date(p.createdAt.toDate ? p.createdAt.toDate() : p.createdAt).toLocaleDateString('es-ES') 
                                                : (p.updatedAt ? new Date(p.updatedAt.toDate ? p.updatedAt.toDate() : p.updatedAt).toLocaleDateString('es-ES') : 'N/A')
                                            }
                                        </td>
                                        <td className="p-4 sm:p-6 text-center">
                                            <button 
                                                onClick={() => togglePaymentStatus(p.id, p.hasPaid)}
                                                className={`px-4 py-2 rounded-full font-bold text-xs transition-colors border ${
                                                    p.hasPaid 
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20' 
                                                    : 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20'
                                                }`}
                                            >
                                                {p.hasPaid ? '✅ PAGADO' : '❌ PENDIENTE'}
                                            </button>
                                        </td>
                                        <td className="p-4 sm:p-6 text-right">
                                            <button 
                                                onClick={() => handleDeleteUser(p.id, p.displayName)}
                                                className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-xl transition-colors border border-red-500/10"
                                                title="Eliminar Participante"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WorldCupAdmin;