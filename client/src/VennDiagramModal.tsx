import { useMemo } from 'react';
import { MdOutlineClose } from 'react-icons/md';
import CardImageForID from './CardImageForID';
import { buildDeckVennSections } from './DeckComparison';

function DeckSection({ title, metadata, subtitle, cards, className }) {
    return <section className={`deck-venn-section ${className}`}>
        <div className='deck-venn-section-header'>
            <h4>{title}</h4>
            {metadata ? <div className='metadata-text deck-venn-section-metadata'>{metadata}</div> : null}
            <div className='deck-venn-section-subtitle'>{subtitle}</div>
        </div>
        {cards.length > 0 ? <div className='deck-venn-card-list'>
            {cards.map(card => <div className='deck-venn-card-row' key={`${className}-${card.comparisonKey}`}>
                <div className='deck-venn-card-image'>
                    <CardImageForID id={card.id} />
                </div>
                <div className='deck-venn-card-meta'>
                    <div className='deck-venn-card-name'>{card.name}</div>
                    <div className='deck-venn-card-set'>{card.set_code} {card.number}</div>
                </div>
                <div className='deck-venn-card-count'>{card.count}</div>
            </div>)}
        </div> : null}
    </section>;
}

function VennDiagramModal({
    cardDatabase,
    leftDeck,
    rightDeck,
    onClose,
    embedded = false,
}) {
    const leftDeckName = leftDeck.name || 'Unnamed Deck';
    const rightDeckName = rightDeck.name || 'Unnamed Deck';
    const leftDeckMetadata = leftDeck.createdTimestamp != null ? new Date(leftDeck.createdTimestamp).toLocaleString() : null;
    const rightDeckMetadata = rightDeck.createdTimestamp != null ? new Date(rightDeck.createdTimestamp).toLocaleString() : null;
    const { deckAOnly, shared, deckBOnly } = useMemo(
        () => buildDeckVennSections(leftDeck.cards, rightDeck.cards, cardDatabase),
        [leftDeck.cards, rightDeck.cards, cardDatabase]
    );

    const leftOnlyCount = deckAOnly.reduce((sum, card) => sum + card.count, 0);
    const sharedCount = shared.reduce((sum, card) => sum + card.count, 0);
    const rightOnlyCount = deckBOnly.reduce((sum, card) => sum + card.count, 0);

    return <div>
        {!embedded ? <div className='modal-header-row'>
            <div>
                <h3>Deck Venn Diagram</h3>&nbsp;
                <button onClick={onClose} className='modal-header-row-button' aria-label='Close deck venn diagram'>
                    <MdOutlineClose />
                </button>
            </div>
        </div> : null}
        <div className='deck-venn-description'>
            Compared using min rarity versions
        </div>
        <div className='deck-venn-layout'>
            <div className='deck-venn-circle deck-venn-circle-left' aria-hidden='true' />
            <div className='deck-venn-circle deck-venn-circle-right' aria-hidden='true' />
            <DeckSection
                className='deck-venn-middle'
                title='Shared'
                subtitle={`${sharedCount} cards shared by both decks`}
                cards={shared}
            />
            <DeckSection
                className='deck-venn-left'
                title={leftDeckName}
                metadata={leftDeckMetadata}
                subtitle={`${leftOnlyCount} cards only in this deck`}
                cards={deckAOnly}
            />
            <DeckSection
                className='deck-venn-right'
                title={rightDeckName}
                metadata={rightDeckMetadata}
                subtitle={`${rightOnlyCount} cards only in this deck`}
                cards={deckBOnly}
            />
        </div>
    </div>;
}

export default VennDiagramModal;
