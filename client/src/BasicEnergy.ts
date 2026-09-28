export const BASIC_ENERGY_INFO = [
    { name: 'Grass Energy', idSample: 'mee-9', iconUri: 'grass-energy-symbol.png' },
    { name: 'Fire Energy', idSample: 'mee-10', iconUri: 'fire-energy-symbol.png' },
    { name: 'Water Energy', idSample: 'mee-11', iconUri: 'water-energy-symbol.png' },
    { name: 'Lightning Energy', idSample: 'mee-12', iconUri: 'lightning-energy-symbol.png' },
    { name: 'Psychic Energy', idSample: 'mee-13', iconUri: 'psychic-energy-symbol.png' },
    { name: 'Fighting Energy', idSample: 'mee-14', iconUri: 'fighting-energy-symbol.png' },
    { name: 'Darkness Energy', idSample: 'mee-15', iconUri: 'darkness-energy-symbol.png' },
    { name: 'Metal Energy', idSample: 'mee-16', iconUri: 'metal-energy-symbol.png' },
];

export const BASIC_ENERGY_NAMES = BASIC_ENERGY_INFO.map(energy => energy.name);

export function getDefaultBasicEnergyId(name: string) {
    return BASIC_ENERGY_INFO.find(energy => energy.name === name)?.idSample;
}
