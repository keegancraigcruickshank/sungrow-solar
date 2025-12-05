import React, { useState, useRef, useEffect } from 'react';
import { Sun, BatteryFull, Zap, ChevronDown } from 'lucide-react';

function PlantOption({ plant, isSelected, onClick }) {
  const capacity = plant.total_capcity?.value;
  const capacityUnit = plant.total_capcity?.unit || 'kW';

  return (
    <div
      className={`plant-option ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="plant-option-name">{plant.ps_name}</div>
      <div className="plant-option-meta">
        <Sun size={12} className="icon-solar" />
        {plant.hasBattery && <BatteryFull size={12} className="icon-battery" />}
        {capacity && (
          <>
            <Zap size={12} className="icon-capacity" />
            <span className="plant-option-capacity">{capacity} {capacityUnit}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function PlantSelect({ plants, currentPlant, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!plants || plants.length === 0) {
    return <div className="plant-select-wrapper"><div className="plant-select-trigger">No Plants</div></div>;
  }

  const capacity = currentPlant?.total_capcity?.value;
  const capacityUnit = currentPlant?.total_capcity?.unit || 'kW';
  const hasMultiple = plants.length > 1;

  function handleSelect(plant) {
    onChange(plant.ps_id);
    setIsOpen(false);
  }

  return (
    <div className="plant-select-wrapper" ref={containerRef}>
      <div
        className={`plant-select-trigger ${hasMultiple ? 'has-dropdown' : ''} ${isOpen ? 'open' : ''}`}
        onClick={() => hasMultiple && setIsOpen(!isOpen)}
      >
        <div className="plant-select-content">
          <div className="plant-select-name">{currentPlant?.ps_name}</div>
          <div className="plant-select-meta">
            <Sun size={12} className="icon-solar" />
            {currentPlant?.hasBattery && <BatteryFull size={12} className="icon-battery" />}
            {capacity && (
              <>
                <Zap size={12} className="icon-capacity" />
                <span className="plant-option-capacity">{capacity} {capacityUnit}</span>
              </>
            )}
          </div>
        </div>
        {hasMultiple && <ChevronDown size={16} className="plant-select-arrow" />}
      </div>

      {isOpen && hasMultiple && (
        <div className="plant-select-dropdown">
          {plants.map((plant) => (
            <PlantOption
              key={plant.ps_id}
              plant={plant}
              isSelected={String(plant.ps_id) === String(currentPlant?.ps_id)}
              onClick={() => handleSelect(plant)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
