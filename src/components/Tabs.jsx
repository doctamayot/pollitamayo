import React from 'react';

const Tabs = ({ activeTab, setActiveTab, isAdmin, resultsVisible }) => {
    
    // La pestaña de puntuación se muestra si el usuario es admin O si la visibilidad está activada
    const showScoringTab = isAdmin || resultsVisible;

    return (
        <div className="border-b border-gray-700">
            <nav className="flex space-x-1 sm:space-x-4" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('predictions')}
                    className={`px-2 sm:px-3 py-2 font-medium text-xs sm:text-sm rounded-t-md border-b-2 transition-colors duration-200 ${
                        activeTab === 'predictions' 
                        ? 'tab-active' 
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                    }`}
                >
                    {isAdmin ? 'Ingresar Resultados' : 'Mis Predicciones'}
                </button>
                
                {/* --- BOTÓN DE RESULTADOS DE TODOS ELIMINADO --- */}
               
                {showScoringTab && (
                    <button
                        onClick={() => setActiveTab('scoring')}
                        className={`px-2 sm:px-3 py-2 font-medium text-xs sm:text-sm rounded-t-md border-b-2 transition-colors duration-200 ${
                            activeTab === 'scoring' 
                            ? 'tab-active' 
                            : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
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