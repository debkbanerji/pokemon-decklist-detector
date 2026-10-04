import { useMemo } from 'react';
import type { MutableRefObject, Ref } from 'react';
import type { CardDatabase, CardInfo } from './DecklistSort';
import { sortDecklistCards } from './DecklistSort';
import CardImageForID from './CardImageForID';
import './DecklistImage.css';

function DecklistPDFGrid({
    decklist,
    cardDatabase,
    size,
    gridRef,
    cardRefs,
}: {
    decklist: CardInfo[];
    cardDatabase: CardDatabase;
    size: { width: number; height: number };
    gridRef: Ref<HTMLDivElement>;
    cardRefs: MutableRefObject<({ element: HTMLDivElement; count: number } | null)[]>;
}) {
    const cards = useMemo(() => sortDecklistCards(decklist, cardDatabase), [decklist, cardDatabase]);
    const rows = Math.max(1, Math.ceil(Math.sqrt(cards.length * (734 / 1024) / (size.width / size.height))));
    const columns = Math.max(1, Math.ceil(cards.length / rows));

    return <div aria-hidden="true" className='decklist-image-pdf-preview'>
        <div ref={gridRef} className='decklist-image-cards' style={{
            width: columns * 100,
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}>
            {cards.map((card, index) => <div className='decklist-image-card-container' key={`${card.id ?? 'index'}-${index}`}
                ref={element => {
                    cardRefs.current[index] = element != null ? { element, count: card.count } : null;
                }}>
                <div className='decklist-image-card'>
                    <CardImageForID key={card.id} id={card.id} cardDatabase={cardDatabase} />
                </div>
            </div>)}
        </div>
    </div>;
}

export default DecklistPDFGrid;
