import React from 'react';
import Section from './Section';
import Card from './Card';

export default function Overview({ plants }) {
  if (!plants || plants.length === 0) {
    return <div className="loading">No plants found</div>;
  }

  return (
    <>
      {plants.map((plant) => (
        <Section
          key={plant.ps_id}
          title={plant.ps_name}
          meta={plant.ps_status === 1 ? 'Online' : 'Offline'}
        >
          <div className="grid">
            <Card
              title="Solar Power"
              value={plant.curr_power?.value || 0}
              unit={plant.curr_power?.unit || 'kW'}
              variant="solar"
            />
            <Card
              title="Today"
              value={plant.today_energy?.value || 0}
              unit={plant.today_energy?.unit || 'kWh'}
            />
            <Card
              title="Total"
              value={plant.total_energy?.value || 0}
              unit={plant.total_energy?.unit || 'kWh'}
            />
            <Card
              title="Capacity"
              value={plant.total_capcity?.value || '--'}
              unit={plant.total_capcity?.unit || ''}
            />
          </div>
        </Section>
      ))}
    </>
  );
}
