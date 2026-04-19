import React, { useState, useEffect } from 'react';
import { db } from '../../firebase'; // Ajusta la ruta a tu firebase.js
import { doc, onSnapshot } from 'firebase/firestore';

const NewsTicker = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("Iniciando conexión con el ticker de noticias...");
        
        // Agregamos un bloque para atrapar errores de permisos
        const unsub = onSnapshot(
            doc(db, 'systemAdmin', 'ai_news'), 
            (docSnap) => {
                if (docSnap.exists() && docSnap.data().titulares) {
                    console.log("¡Datos recibidos!", docSnap.data().titulares);
                    setNews(docSnap.data().titulares);
                } else {
                    console.log("El documento existe pero no tiene titulares");
                    setNews(["🔥 Preparando los mejores datos del torneo...", "⚽ La IA está analizando las predicciones..."]);
                }
                setLoading(false);
            }, 
            (error) => {
                // 🔴 SI HAY UN PROBLEMA DE PERMISOS, SALDRÁ AQUÍ
                console.error("Error gigante leyendo Firebase:", error.message);
                setNews(["⚠️ Error de conexión con la IA"]);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    // 💡 COMENTAMOS ESTO PARA OBLIGARLO A MOSTRARSE SÍ O SÍ
    // if (loading || news.length === 0) return null;

    return (
        <div className="w-full bg-slate-950 border-b border-amber-500/30 overflow-hidden relative flex items-center z-50 h-10 sm:h-12 shadow-md">
            {/* Etiqueta Fija de "ÚLTIMA HORA" */}
            <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black uppercase text-[10px] sm:text-xs tracking-widest px-3 sm:px-6 flex items-center justify-center z-20 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
                <span className="animate-pulse mr-1 sm:mr-2">🔴</span> EN VIVO
            </div>

            {/* Contenedor del texto rodante */}
            <div className="flex whitespace-nowrap animate-ticker items-center h-full">
                
                {/* CAJA 1 (Original) */}
                <div className="flex items-center shrink-0">
                    {/* Le agregamos un padding inicial solo al primer elemento para que no salga pegado al "EN VIVO" */}
                    <span className="w-32 sm:w-40 inline-block"></span> 
                    {news.map((titular, index) => (
                        <div key={index} className="flex items-center text-slate-200 font-bold text-xs sm:text-sm tracking-wide">
                            {titular}
                            <span className="mx-6 text-amber-500 opacity-50">||</span>
                        </div>
                    ))}
                </div>

                {/* CAJA 2 (Clon exacto para el ciclo infinito) */}
                <div className="flex items-center shrink-0">
                    <span className="w-32 sm:w-40 inline-block"></span>
                    {news.map((titular, index) => (
                        <div key={`dup-${index}`} className="flex items-center text-slate-200 font-bold text-xs sm:text-sm tracking-wide">
                            {titular}
                            <span className="mx-6 text-amber-500 opacity-50">||</span>
                        </div>
                    ))}
                </div>

            </div>

            {/* Estilos inyectados para la animación de marquesina infinita */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-ticker {
                    /* Si sientes que va muy rápido, sube este 40s a 50s o 60s */
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