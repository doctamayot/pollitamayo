import React, { useMemo } from 'react';
import msnData from '../utils/msn.json';

const StatsBanner = ({ activeGroup }) => {
    // Extraer todos los mensajes del grupo actual
    const groupFacts = useMemo(() => {
        const groupLetter = activeGroup?.replace('Grupo ', '') || 'A';
        const groupInfo = msnData.mundial_2026.grupos.find(g => g.grupo === groupLetter);
        
        if (!groupInfo) return ["¡Bienvenidos al Mundial 2026! 48 selecciones, un solo sueño. 🏆"];
        
        return groupInfo.datos;
    }, [activeGroup]);

    return (
        // bg-background-offset y border-border se adaptan automáticamente a tu tema
        <div className="w-full bg-background-offset border-y border-border overflow-hidden h-10 flex items-center relative backdrop-blur-sm">
            
            <div 
                key={activeGroup} 
                className="whitespace-nowrap flex animate-marquee-continuous"
            >
                {/* Renderizamos dos veces para el loop infinito */}
                {[1, 2].map((i) => (
                    <div key={`set-${i}`} className="flex items-center">
                        {groupFacts.map((fact, index) => (
                            <span 
                                key={`fact-${i}-${index}`} 
                                // text-foreground será blanco en oscuro y negro en claro
                                className="text-foreground font-medium text-xs sm:text-sm px-10 flex items-center gap-3"
                            >
                                {/* bg-foreground y text-background se invierten solos para dar contraste */}
                                <span className="bg-foreground text-background text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm">
                                    SABÍAS QUE
                                </span>
                                {fact}
                            </span>
                        ))}
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes marquee-infinite {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee-continuous {
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