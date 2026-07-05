import { useMemo, useState } from 'react';
import './DecklistImage.css';
import CardImageForID from './CardImageForID.tsx';
import { buildMinRarityDecklist } from './DeckComparison';

function DecklistImage({
    decklist,
    cardDatabase,
}) {
    const [forceLowRarity, setForceLowRarity] = useState(false);
    const displayDecklist = useMemo(
        () => forceLowRarity
            ? buildMinRarityDecklist(decklist, cardDatabase)
            : decklist.map((card, index) => ({
                ...card,
                displayKey: `${card.id ?? 'index'}-${index}`,
            })),
        [decklist, cardDatabase, forceLowRarity]
    );

    return <div className='decklist-image'>
        <div className='decklist-image-cards'>
            {displayDecklist.map((card, index) => <div className='decklist-image-card-container' key={card.displayKey}>
                <div className='decklist-image-card'>
                    <CardImageForID key={card.id} id={card.id} />
                </div>
                <div className='decklist-image-card-count'>
                    <div className='number-circle'>  {card.count}
                    </div>
                </div>
            </div>)}
        </div>
        <div className='decklist-image-force-low-rarity-row'>
            <span className='decklist-image-force-low-rarity-label'>Show min rarity</span>
            <label className={`toggle-switch ${forceLowRarity ? 'checked' : ''}`}>
                <input
                    className="toggle-input"
                    type="checkbox"
                    checked={forceLowRarity}
                    onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        setForceLowRarity(checked);
                    }}
                    aria-label="Force min rarity decklist image"
                />
                <span className="toggle-track" aria-hidden="true">
                    <span className="toggle-knob" />
                </span>
            </label>
        </div>
    </div>
}

export default DecklistImage;
