import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const WorldCupAdmin = () => {
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Escuchamos en tiempo real la colección donde se guardan las predicciones del mundial
        const unsubscribe = onSnapshot(collection(db, 'worldCupPredictions'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setParticipants(usersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
        return <div className="text-center py-20 text-foreground-muted font-bold tracking-widest uppercase text-sm">Cargando Panel Admin...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-fade-in">
            <div className="mb-8 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 text-4xl mb-4 mx-auto border border-red-500/20">👑</div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-2">
                    Panel de Control Mundial
                </h2>
                <p className="text-foreground-muted">
                    Gestiona los participantes, sus pagos y permisos.
                </p>
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
                            {participants.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-foreground-muted">Aún no hay participantes registrados.</td>
                                </tr>
                            ) : (
                                participants.map((p) => (
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
                                            {p.updatedAt ? new Date(p.updatedAt.toDate ? p.updatedAt.toDate() : p.updatedAt).toLocaleDateString('es-ES') : 'N/A'}
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