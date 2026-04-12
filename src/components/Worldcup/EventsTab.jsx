import React from 'react';
import { specialEvents } from '../tempFolder/constantes';

const EventsTab = ({ eventPicks, handleEventChange, isCurrentMainTabLocked }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {specialEvents.map(e => (
                <div key={e.id} className="bg-background-offset border border-border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex-1">
                        <h4 className="text-base font-black text-foreground mb-1">{e.label}</h4>
                        <p className="text-xs text-foreground-muted">{e.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border">
                        {['SI', 'NO'].map(opt => (
                            <button 
                                key={opt} 
                                disabled={isCurrentMainTabLocked} 
                                onClick={() => handleEventChange(e.id, opt)} 
                                className={`w-20 py-2 rounded-lg font-black text-sm disabled:opacity-50 ${eventPicks[e.id] === opt ? (opt === 'SI' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'text-foreground-muted'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default EventsTab;