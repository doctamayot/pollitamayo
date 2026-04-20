import React, { useState, useEffect } from 'react';
import { db } from '../../firebase'; 
import { doc, onSnapshot } from 'firebase/firestore';

const NewsTicker = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, 'systemAdmin', 'ai_news'), 
            (docSnap) => {
                if (docSnap.exists() && docSnap.data().titulares) {
                    setNews(docSnap.data().titulares);
                } else {
                    setNews(["🔥 PREPARANDO: Analizando los mejores datos del torneo...", "⚽ ALERTA: La IA está procesando las predicciones..."]);
                }
                setLoading(false);
            }, 
            (error) => {
                console.error("Error leyendo Firebase:", error.message);
                setNews(["⚠️ ERROR: Conexión interrumpida con el centro de datos"]);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    // 🏆 Función mágica para darle estilo ESPN al texto
    const formatNews = (text) => {
        if (!text) return null;
        const parts = text.split(':');
        
        if (parts.length > 1) {
            const prefix = parts[0];
            const content = parts.slice(1).join(':'); 
            return (
                <>
                    <span className="text-amber-400 font-black italic tracking-widest uppercase text-[10px] sm:text-sm drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                        {prefix}:
                    </span>
                    <span className="text-white font-semibold ml-1.5 sm:ml-2 text-[11px] sm:text-[15px] tracking-wide">
                        {content}
                    </span>
                </>
            );
        }
        
        return <span className="text-white font-semibold text-[11px] sm:text-[15px] tracking-wide">{text}</span>;
    };

    return (
        /* Agregamos un mt-6 (margin-top) al contenedor principal para darle espacio a la pestaña que sobresale hacia arriba */
        <div className="w-full relative mt-6 sm:mt-8 mb-2 z-50"> 
            
            {/* 🚨 PESTAÑA CENTRAL "BREAKING NEWS" SOBSITE LA BARRA */}
            <div className="absolute -top-4 sm:-top-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-700 to-red-600 text-white font-black uppercase text-[8px] sm:text-xs tracking-widest px-6 sm:px-10 py-1 sm:py-1.5 rounded-t-lg z-30 border-t border-x border-amber-500/50 shadow-[0_-5px_15px_rgba(220,38,38,0.3)] flex items-center justify-center">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-2 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span>
                <span className="mt-0.5">ÚLTIMA HORA</span>
            </div>

            {/* 🌀 CONTENEDOR DEL TEXTO RODANTE */}
            <div className="w-full bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-y border-amber-500/30 overflow-hidden relative flex items-center h-9 sm:h-12 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                
                {/* EFECTOS DE SOMBRA LATERAL (Ahora en ambos lados porque el texto cruza de punta a punta) */}
                <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none"></div>

                <div className="flex whitespace-nowrap animate-ticker items-center h-full">
                    
                    {/* CAJA 1 */}
                    <div className="flex items-center shrink-0">
                        {/* Redujimos el espacio inicial (w-8) porque ya no hay etiqueta a la izquierda bloqueando */}
                        <span className="w-8 sm:w-16 inline-block"></span> 
                        {news.map((titular, index) => (
                            <div key={index} className="flex items-center">
                                {formatNews(titular)}
                                
                                {/* Separador Deportivo Estilo TV */}
                                <div className="mx-5 sm:mx-10 flex space-x-1 opacity-60">
                                    <div className="w-1.5 sm:w-2 h-3 sm:h-4 bg-red-500 transform skew-x-[-20deg]"></div>
                                    <div className="w-1.5 sm:w-2 h-3 sm:h-4 bg-slate-500 transform skew-x-[-20deg]"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CAJA 2 (Clon para scroll infinito) */}
                    <div className="flex items-center shrink-0">
                        <span className="w-8 sm:w-16 inline-block"></span>
                        {news.map((titular, index) => (
                            <div key={`dup-${index}`} className="flex items-center">
                                {formatNews(titular)}
                                
                                {/* Separador Deportivo Estilo TV */}
                                <div className="mx-5 sm:mx-10 flex space-x-1 opacity-60">
                                    <div className="w-1.5 sm:w-2 h-3 sm:h-4 bg-red-500 transform skew-x-[-20deg]"></div>
                                    <div className="w-1.5 sm:w-2 h-3 sm:h-4 bg-slate-500 transform skew-x-[-20deg]"></div>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-ticker {
                    animation: ticker 70s linear infinite;
                    width: max-content;
                }
                .animate-ticker:hover {
                    animation-play-state: paused;
                }
            `}} />
        </div>
    );
};

export default NewsTicker;