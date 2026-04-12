import React from 'react';

const SearchBar = ({ value, onChange, placeholder = "Buscar..." }) => {
    return (
        <div className="relative w-full max-w-md mx-auto mb-8 group animate-fade-in">
            {/* Ícono de lupa */}
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-transform duration-300 group-focus-within:scale-110">
                <span className="text-foreground-muted group-focus-within:text-primary transition-colors text-lg">
                    🔍
                </span>
            </div>
            
            {/* Input inteligente */}
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-card border border-card-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-full py-3.5 pl-12 pr-12 text-sm font-bold text-foreground placeholder-foreground-muted/50 shadow-sm transition-all outline-none"
                placeholder={placeholder}
            />
            
            {/* Botón de limpiar (solo si hay texto) */}
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-foreground-muted hover:text-red-500 transition-colors"
                    aria-label="Limpiar búsqueda"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default SearchBar;