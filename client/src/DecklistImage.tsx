import { useCallback, useRef, useState } from 'react';
import './DecklistImage.css';
import CardImageForID from './CardImageForID.tsx';

function DecklistImage({ decklist, cardDatabase, onAllCardImagesLoaded }) {
    const loadedCardIdsRef = useRef(new Set());
    const onCardImageLoaded = useCallback((id) => {
        if (!loadedCardIdsRef.current.has(id)) {
            loadedCardIdsRef.current.add(id);
            if (loadedCardIdsRef.current.size === decklist.length && onAllCardImagesLoaded) {
                onAllCardImagesLoaded();
            }
        }
    }, [decklist, loadedCardIdsRef, onAllCardImagesLoaded]);
    return <div className='decklist-image'>
        {decklist.map((card, index) => <div className='decklist-image-card-container' key={index}>
            <div className='decklist-image-card'>
                <CardImageForID id={card.id} onLoaded={onCardImageLoaded} />
            </div>
            <div className='decklist-image-card-count'>
                <div className='number-circle'>  {card.count}
                </div>
            </div>
        </div>)}
    </div>
}

export default DecklistImage;
