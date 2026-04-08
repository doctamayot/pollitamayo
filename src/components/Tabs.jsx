import React from 'react';

const Tabs = ({ activeTab, setActiveTab, isAdmin, resultsVisible }) => {
    
    const showScoringTab = isAdmin || resultsVisible;

    return (
        <div className="border-b border-border mb-6">
            <nav className="flex space-x-2 overflow-x-auto hide-scrollbar" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('predictions')}
                    className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-colors duration-200 whitespace-nowrap ${
                        activeTab === 'predictions' 
                        ? 'bg-card border-t border-x border-card-border text-primary shadow-sm relative top-[1px]' 
                        : 'border-transparent text-foreground-muted hover:text-foreground hover:bg-background-offset'
                    }`}
                >
                    {isAdmin ? 'Ingresar Resultados' : 'Mis Predicciones'}
                </button>
                               
                {showScoringTab && (
                    <button
                        onClick={() => setActiveTab('scoring')}
                        className={`px-5 py-3 font-bold text-sm rounded-t-xl transition-colors duration-200 whitespace-nowrap ${
                            activeTab === 'scoring' 
                            ? 'bg-card border-t border-x border-card-border text-primary shadow-sm relative top-[1px]'
                            : 'border-transparent text-foreground-muted hover:text-foreground hover:bg-background-offset'
                        }`}
                    >
                        Puntuación
                    </button>
                )}
            </nav>
        </div>
    );
};

export default Tabs;