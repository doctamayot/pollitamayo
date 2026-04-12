import React, { useMemo } from 'react';
import msnData from '../utils/msn.json';

const StatsBanner = ({ activeGroup }) => {
    // Extraer todos los mensajes del grupo actual
    const groupFacts = useMemo(() => {
        const groupLetter = activeGroup?.replace('Grupo ', '') || 'A';
        const groupInfo = msnData.mundial_2026.grupos.find(g => g.grupo === groupLetter);
        
        // Si no hay info del grupo, mensaje genérico
        if (!groupInfo) return ["¡Bienvenidos al Mundial 2026! 48 selecciones, un solo sueño. 🏆"];
        
        return groupInfo.datos; // Retorna el array completo de mensajes
    }, [activeGroup]);

    return (
        <div className="w-full bg-white/5 border-y border-white/10 overflow-hidden h-10 flex items-center relative backdrop-blur-sm">
            {/* Usamos activeGroup como KEY para que al cambiar de pestaña 
                la cinta entera se resetee y empiece desde el primer mensaje */}
            <div 
                key={activeGroup} 
                className="whitespace-nowrap flex animate-marquee-continuous"
            >
                {/* Primera tanda de todos los mensajes del grupo */}
                <div className="flex items-center">
                    {groupFacts.map((fact, index) => (
                        <span key={`fact-1-${index}`} className="text-white font-medium text-xs sm:text-sm px-10 flex items-center gap-3">
                            <span className="bg-white text-black text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">
                                SABÍAS QUE
                            </span>
                            {fact}
                        </span>
                    ))}
                </div>

                {/* Duplicamos la tanda completa para el loop infinito sin cortes */}
                <div className="flex items-center">
                    {groupFacts.map((fact, index) => (
                        <span key={`fact-2-${index}`} className="text-white font-medium text-xs sm:text-sm px-10 flex items-center gap-3">
                            <span className="bg-white text-black text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">
                                SABÍAS QUE
                            </span>
                            {fact}
                        </span>
                    ))}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes marquee-infinite {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee-continuous {
                    /* Ajustamos el tiempo según la cantidad de mensajes (aprox 8s por mensaje para que se lea bien) */
                    animation: marquee-infinite ${groupFacts.length * 8}s linear infinite;
                }
                .animate-marquee-continuous:hover {
                    animation-play-state: paused;
                }
            `}} />
        </div>
    );
};

export default StatsBanner;