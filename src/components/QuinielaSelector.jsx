import React from 'react';

const QuinielaSelector = ({ quinielas, selectedId, setSelectedId }) => {
    return (
        <div className="flex items-center justify-center flex-1">
            <label htmlFor="quiniela-select" className="sr-only">Seleccionar Quiniela</label>
            <select
                id="quiniela-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="form-input rounded-md text-sm sm:text-base font-semibold text-center"
            >
                {quinielas.map(q => (
                    <option key={q.id} value={q.id}>
                        {q.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default QuinielaSelector;