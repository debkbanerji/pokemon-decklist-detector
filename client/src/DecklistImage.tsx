import { useMemo, useState } from 'react';
import './DecklistImage.css';
import CardImageForID from './CardImageForID.tsx';

function getLowRarityRank(card, cardDatabase) {
    return card?.rarity_order ?? cardDatabase?.[card?.id]?.rarity_order ?? 999;
}

function compareCardsForLowRarity(a, b, cardDatabase) {
    return getLowRarityRank(a, cardDatabase) - getLowRarityRank(b, cardDatabase)
        || (a.set_code ?? cardDatabase?.[a?.id]?.set_code ?? '').localeCompare(b.set_code ?? cardDatabase?.[b?.id]?.set_code ?? '')
        || (a.number ?? cardDatabase?.[a?.id]?.number ?? '').localeCompare(b.number ?? cardDatabase?.[b?.id]?.number ?? '')
        || (a.id ?? '').localeCompare(b.id ?? '');
}

function coalesceDecklistForDisplay(decklist, cardDatabase, forceLowRarity) {
    const groupedCards = new Map();
    decklist.forEach((card, index) => {
        const groupKey = card.cardMechanicsHash ?? card.id ?? `${index}`;
        const existingGroup = groupedCards.get(groupKey);
        if (!existingGroup) {
            groupedCards.set(groupKey, {
                displayKey: groupKey,
                representativeCard: card,
                count: card.count,
                mechanicHash: card.cardMechanicsHash ?? null,
            });
            return;
        }

        existingGroup.count += card.count;
    });

    return Array.from(groupedCards.values()).map(group => {
        if (forceLowRarity && group.mechanicHash != null) {
            const databaseCandidates = Object.values(cardDatabase).filter(card =>
                card?.cardMechanicsHash === group.mechanicHash && card?.supertype === 'Pokémon'
            );
            if (databaseCandidates.length > 0) {
                const lowRarityRepresentative = [...databaseCandidates].sort((a, b) => compareCardsForLowRarity(a, b, cardDatabase))[0];
                return {
                    ...lowRarityRepresentative,
                    count: group.count,
                    displayKey: group.displayKey,
                };
            }
        }

        return {
            ...group.representativeCard,
            count: group.count,
            displayKey: group.displayKey,
        };
    });
}

function DecklistImage({
    decklist,
    cardDatabase,
}) {
    const [forceLowRarity, setForceLowRarity] = useState(false);
    const displayDecklist = useMemo(
        () => coalesceDecklistForDisplay(decklist, cardDatabase, forceLowRarity),
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
            <span className='decklist-image-force-low-rarity-label'>Show low rarity</span>
            <label className={`toggle-switch ${forceLowRarity ? 'checked' : ''}`}>
                <input
                    className="toggle-input"
                    type="checkbox"
                    checked={forceLowRarity}
                    onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        setForceLowRarity(checked);
                    }}
                    aria-label="Force low rarity decklist image"
                />
                <span className="toggle-track" aria-hidden="true">
                    <span className="toggle-knob" />
                </span>
            </label>
        </div>
    </div>
}

export default DecklistImage;
