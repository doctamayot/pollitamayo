import React from 'react';

const Tabs = ({ activeTab, setActiveTab, isAdmin, resultsVisible }) => {
    
    const showScoringTab = isAdmin || resultsVisible;

    return (
        <div className="border-b border-slate-700">
            <nav className="flex space-x-2" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('predictions')}
                    className={`px-4 py-3 font-semibold text-sm rounded-t-md border-b-2 transition-colors duration-200 ${
                        activeTab === 'predictions' 
                        ? 'border-blue-500 text-white' 
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                >
                    {isAdmin ? 'Ingresar Resultados' : 'Mis Predicciones'}
                </button>
                               
                {showScoringTab && (
                    <button
                        onClick={() => setActiveTab('scoring')}
                        className={`px-4 py-3 font-semibold text-sm rounded-t-md border-b-2 transition-colors duration-200 ${
                            activeTab === 'scoring' 
                            ? 'border-blue-500 text-white'
                            : 'border-transparent text-slate-400 hover:text-white'
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