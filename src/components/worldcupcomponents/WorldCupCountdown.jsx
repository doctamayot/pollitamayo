import React, { useState, useEffect } from 'react';

const WorldCupCountdown = () => {
    // 🎯 FECHA DEL PARTIDO INAUGURAL
    // Según tu imagen, México vs Sudáfrica es el 11 de Junio de 2026 a las 2:00 PM
    const targetDate = new Date('2026-06-11T14:00:00').getTime();

    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });
    
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                clearInterval(interval);
                setHasStarted(true);
                return;
            }

            setTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000)
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    if (hasStarted) {
        return (
            <div className="w-full flex justify-center my-6 animate-fade-in">
                <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 px-8 py-3 rounded-2xl shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                    <span className="text-green-400 font-black uppercase tracking-widest text-sm sm:text-base animate-pulse">
                        ⚽ ¡El Mundial está en juego!
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center justify-center my-6 sm:my-8 animate-fade-in">
            <p className="text-[10px] sm:text-xs text-amber-500 font-bold uppercase tracking-[0.2em] mb-3">
                El balón rueda en:
            </p>
            
            <div className="flex gap-2 sm:gap-4">
                {/* DÍAS */}
                <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-700 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1/2 bg-white/5 border-b border-white/5"></div>
                    <span className="text-2xl sm:text-4xl font-black text-white tabular-nums drop-shadow-md z-10">
                        {String(timeLeft.days).padStart(2, '0')}
                    </span>
                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5 z-10">
                        Días
                    </span>
                </div>

                <span className="text-xl sm:text-3xl font-black text-slate-600 self-center animate-pulse mb-4">:</span>

                {/* HORAS */}
                <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-700 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1/2 bg-white/5 border-b border-white/5"></div>
                    <span className="text-2xl sm:text-4xl font-black text-white tabular-nums drop-shadow-md z-10">
                        {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5 z-10">
                        Horas
                    </span>
                </div>

                <span className="text-xl sm:text-3xl font-black text-slate-600 self-center animate-pulse mb-4">:</span>

                {/* MINUTOS */}
                <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-700 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1/2 bg-white/5 border-b border-white/5"></div>
                    <span className="text-2xl sm:text-4xl font-black text-white tabular-nums drop-shadow-md z-10">
                        {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5 z-10">
                        Minutos
                    </span>
                </div>

                <span className="text-xl sm:text-3xl font-black text-slate-600 self-center animate-pulse mb-4">:</span>

                {/* SEGUNDOS */}
                <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-700 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1/2 bg-white/5 border-b border-white/5"></div>
                    <span className="text-2xl sm:text-4xl font-black text-amber-500 tabular-nums drop-shadow-[0_0_8px_rgba(245,158,11,0.4)] z-10">
                        {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-amber-500/70 font-bold mt-0.5 z-10">
                        Segundos
                    </span>
                </div>
            </div>
        </div>
    );
};

export default WorldCupCountdown;