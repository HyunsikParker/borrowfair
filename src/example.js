const row = (id, borrower, start, end, received, previousLoans, needs, purpose) => ({ id, borrower, start: `2026-11-${start}`, end: `2026-11-${end}`, received: `2026-11-${received}`, previousLoans, needs, purpose });
export function exampleBoard() {
  return { schemaVersion: 1, title: 'Film club lending week', mode: 'example', resources: [{ id: 'camera', name: 'Camera', units: 1 }, { id: 'mic', name: 'Microphone', units: 1 }, { id: 'tripod', name: 'Tripod', units: 2 }], pins: [], requests: [
    row('R01', 'Nora', '09', '15', '01', 4, { camera: 1 }, 'Week-long location study'),
    row('R02', 'Arun', '09', '11', '02', 0, { camera: 1 }, 'Interview practice'),
    row('R03', 'Bea', '11', '13', '02', 1, { camera: 1 }, 'Stop-motion exercise'),
    row('R04', 'Cy', '13', '15', '03', 0, { camera: 1 }, 'Campus short'),
    row('R05', 'Nora', '15', '16', '03', 4, { camera: 1 }, 'Alternative: one-day location study'),
    row('R06', 'Dara', '10', '13', '02', 0, { camera: 1, mic: 1 }, 'Camera and sound kit'),
    row('R07', 'Eli', '09', '11', '01', 2, { mic: 1 }, 'Audio interview'),
    row('R08', 'Finn', '11', '13', '02', 0, { mic: 1 }, 'Foley exercise'),
    row('R09', 'Gus', '13', '16', '03', 1, { mic: 1 }, 'Sound diary'),
    row('R10', 'Hana', '09', '16', '04', 0, { tripod: 1 }, 'Time-lapse project'),
    row('R11', 'Ian', '09', '16', '01', 3, { tripod: 1 }, 'Interview setup'),
    row('R12', 'Jules', '10', '13', '02', 0, { tripod: 1 }, 'Animation setup')
  ] };
}
export function blankBoard() { return { schemaVersion: 1, title: 'New lending round', mode: 'own', resources: [], requests: [], pins: [] }; }
