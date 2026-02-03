import React from 'react';
import { TYPE_TO_ENERGY_SYMBOL_URL, getPokemonSpriteUrlForCard } from './ExportModal';

function sanitizeForFilename(name: string) {
    return name.replaceAll(' ', '-').toLowerCase().replaceAll(/(\'|\.|:|\(|\))/g, '').replace('♀', 'f').replace('♂', 'm');
}



export default function CardPreviewIcon({ cardInfo }: { cardInfo: any }) {
    if (!cardInfo) return null;
    const { supertype, name } = cardInfo;

    let src = null;
    if (supertype === 'Pokémon') {
        src = getPokemonSpriteUrlForCard(cardInfo);
    } else if (supertype === 'Trainer') {
        src = 'trainer-symbols/' + sanitizeForFilename(name) + '.png';
    } else if (supertype === 'Energy') {
        const key = name.replace(' Energy', '');
        src = TYPE_TO_ENERGY_SYMBOL_URL[key];
        if (!src) {
            src = 'special-energy-symbols/' + sanitizeForFilename(name) + '.png';
        }
    }

    if (!src) return null;

    return <img className="card-preview-icon" src={src} alt="icon" />;
}
