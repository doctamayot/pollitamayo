import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
// AÑADIMOS query Y where PARA EL TIEMPO REAL EXACTO
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const WorldCupPot = () => {
    const [paidUsersCount, setPaidUsersCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Creamos una consulta (query) que SOLO escucha a los usuarios que ya pagaron
        const q = query(collection(db, 'worldCupPredictions'), where('hasPaid', '==', true));
        
        // onSnapshot mantendrá un túnel abierto en tiempo real con esa consulta
        const unsubscribe = onSnapshot(q, (snapshot) => {
            // snapshot.size nos da el número exacto al instante, sin tener que filtrar nada
            setPaidUsersCount(snapshot.size);
            setLoading(false);
        });

        // Limpiamos el túnel cuando cerramos la pantalla
        return () => unsubscribe();
    }, []);

    // --- CÁLCULOS MATEMÁTICOS ---
    const ENTRY_FEE = 170000;
    const grossPot = paidUsersCount * ENTRY_FEE;
    
    // El 10% es para gastos internos
    const adminFee = grossPot * 0.10;
    
    // El 90% restante es la Bolsa de Premios (Net Pot)
    const netPot = grossPot * 0.90;

    // Distribución del Net Pot
    const firstPlace = netPot * 0.70;
    const secondPlace = netPot * 0.20;
    const thirdPlace = netPot * 0.05;
    const middlePlace = netPot * 0.05;

    // Formateador a Pesos Colombianos
    const formatCOP = (value) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    if (loading) {
        return <div className="text-center py-20 text-foreground-muted font-bold tracking-widest uppercase text-sm">Calculando Bolsa de Premios...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            
            {/* ENCABEZADO DEL POT */}
            <div className="text-center mb-10">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter mb-4">
                    Bolsa de Premios Oficial
                </h2>
                <div className="inline-flex items-center justify-center bg-primary/10 border border-primary/20 px-6 py-2 rounded-full mb-6">
                    <span className="text-primary font-bold text-sm sm:text-base">
                        Valor de la inscripción: {formatCOP(ENTRY_FEE)} COP
                    </span>
                </div>
            </div>

            {/* POT ACUMULADO (GRANDE) */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-3xl p-8 sm:p-12 text-center shadow-[0_15px_40px_-10px_rgba(245,158,11,0.5)] mb-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 text-9xl opacity-20">💰</div>
                <div className="absolute -bottom-10 -left-10 text-9xl opacity-10">🔥</div>
                <h3 className="text-amber-100 font-bold tracking-widest uppercase text-sm sm:text-base mb-2 relative z-10">
                    Gran Premio Acumulado a Repartir
                </h3>
                <p className="text-5xl sm:text-7xl font-black text-white drop-shadow-md relative z-10 transition-all duration-500">
                    {formatCOP(netPot)}
                </p>
                <p className="text-amber-100/80 text-sm mt-4 font-medium relative z-10">
                    Basado en {paidUsersCount} participantes confirmados
                </p>
            </div>

            {/* TARJETAS DE DISTRIBUCIÓN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                
                {/* 1ER PUESTO */}
                <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm flex flex-col items-center text-center relative overflow-hidden hover:border-amber-500/50 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                    <div className="text-4xl mb-3">🥇</div>
                    <h4 className="text-foreground-muted font-bold text-xs uppercase tracking-widest mb-1">Campeón (70%)</h4>
                    <p className="text-2xl font-black text-foreground transition-all duration-500">{formatCOP(firstPlace)}</p>
                </div>

                {/* 2DO PUESTO */}
                <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm flex flex-col items-center text-center relative overflow-hidden hover:border-slate-400/50 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-400"></div>
                    <div className="text-4xl mb-3">🥈</div>
                    <h4 className="text-foreground-muted font-bold text-xs uppercase tracking-widest mb-1">Subcampeón (20%)</h4>
                    <p className="text-xl font-black text-foreground transition-all duration-500">{formatCOP(secondPlace)}</p>
                </div>

                {/* 3ER PUESTO */}
                <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm flex flex-col items-center text-center relative overflow-hidden hover:border-orange-600/50 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-600"></div>
                    <div className="text-4xl mb-3">🥉</div>
                    <h4 className="text-foreground-muted font-bold text-xs uppercase tracking-widest mb-1">Tercer Puesto (5%)</h4>
                    <p className="text-xl font-black text-foreground transition-all duration-500">{formatCOP(thirdPlace)}</p>
                </div>

                {/* PUESTO MITAD */}
                <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm flex flex-col items-center text-center relative overflow-hidden hover:border-blue-500/50 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                    <div className="text-4xl mb-3">🎯</div>
                    <h4 className="text-foreground-muted font-bold text-xs uppercase tracking-widest mb-1">Mitad de Tabla (5%)</h4>
                    <p className="text-xl font-black text-foreground transition-all duration-500">{formatCOP(middlePlace)}</p>
                </div>

            </div>

            {/* REGLAS DE DISTRIBUCIÓN (DESGLOSE) */}
            <div className="bg-background-offset border border-border p-6 sm:p-8 rounded-3xl shadow-sm">
                <h4 className="text-lg font-black text-foreground mb-4 border-b border-border pb-3">Reglas del Pot y Distribución</h4>
                <ul className="space-y-4 text-sm sm:text-base text-foreground-muted">
                    <li className="flex items-start gap-3">
                        <span className="text-primary mt-0.5">💰</span>
                        <p><strong>El acumulado crece</strong> únicamente con los usuarios que el administrador marca como "Pagado". Si ves tu pago pendiente, no sumarás a la bolsa todavía.</p>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-primary mt-0.5">⚙️</span>
                        <p>Del 100% recaudado ({formatCOP(grossPot)}), <strong>se deduce un 10% ({formatCOP(adminFee)})</strong> destinado exclusivamente a gastos internos de administración, plataformas y gestión de la polla.</p>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-primary mt-0.5">🎯</span>
                        <p><strong>Regla de Mitad de Tabla:</strong> El 5% designado se otorgará a la persona que quede exactamente en la mitad de la tabla de posiciones finales. Si hay 100 participantes, este premio será para el puesto #50. ¡Nadie se rinde hasta el final!</p>
                    </li>
                </ul>
            </div>

        </div>
    );
};

export default WorldCupPot;