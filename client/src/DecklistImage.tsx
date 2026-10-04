import { useMemo, useState } from 'react';
import type { MutableRefObject, Ref } from 'react';
import type { CardDatabase, CardInfo } from './DecklistSort';
import { sortDecklistCards } from './DecklistSort';
import './DecklistImage.css';
import CardImageForID from './CardImageForID.tsx';
import { buildMinRarityDecklist } from './DeckComparison';

function DecklistImage({
    decklist,
    cardDatabase,
    pdfSize,
    pdfGridRef,
    pdfCardRefs,
}: {
    decklist: CardInfo[];
    cardDatabase: CardDatabase;
    pdfSize?: { width: number; height: number };
    pdfGridRef?: Ref<HTMLDivElement>;
    pdfCardRefs?: MutableRefObject<({ element: HTMLDivElement; count: number } | null)[]>;
}) {
    const [forceLowRarity, setForceLowRarity] = useState(false);
    const displayDecklist = useMemo(
        () => sortDecklistCards(forceLowRarity
            ? buildMinRarityDecklist(decklist, cardDatabase)
            : decklist, cardDatabase).map((card, index) => ({
                ...card,
                displayKey: `${card.id ?? 'index'}-${index}`,
            })),
        [decklist, cardDatabase, forceLowRarity]
    );

    const pdfRows = pdfSize != null ? Math.max(1, Math.ceil(Math.sqrt(displayDecklist.length * (734 / 1024) / (pdfSize.width / pdfSize.height)))) : 1;
    const pdfColumns = Math.max(1, Math.ceil(displayDecklist.length / pdfRows));

    return <div className='decklist-image'>
        <div className='decklist-image-cards'>
            {displayDecklist.map(card => <div className='decklist-image-card-container' key={card.displayKey}>
                <div className='decklist-image-card'>
                    <CardImageForID key={card.id} id={card.id} cardDatabase={cardDatabase} />
                </div>
                <div className='decklist-image-card-count'>
                    <div className='number-circle'>{card.count}</div>
                </div>
            </div>)}
        </div>
        {pdfSize != null ? <div aria-hidden="true" className='decklist-image-pdf-preview'>
            <div ref={pdfGridRef} className='decklist-image-cards' style={{
                width: pdfColumns * 100,
                gridTemplateColumns: `repeat(${pdfColumns}, 1fr)`,
            }}>
                {displayDecklist.map((card, index) => <div className='decklist-image-card-container' key={card.displayKey}
                    ref={element => {
                        if (pdfCardRefs != null) {
                            pdfCardRefs.current[index] = element != null ? { element, count: card.count } : null;
                        }
                    }}>
                    <div className='decklist-image-card'>
                        <CardImageForID key={card.id} id={card.id} cardDatabase={cardDatabase} />
                    </div>
                </div>)}
            </div>
        </div> : null}
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
