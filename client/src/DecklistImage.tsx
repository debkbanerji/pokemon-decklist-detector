import './DecklistImage.css';
import CardImageForID from './CardImageForID.tsx';

function DecklistImage({ decklist, cardDatabase }) {
    return <div className='decklist-image'>
        {decklist.map((card, index) => <div className='decklist-image-card-container' key={index}>
            <div className='decklist-image-card'>
                <CardImageForID id={card.id} />
            </div>
            <div className='decklist-image-card-count'>
                <div className='number-circle'>  {card.count}
                </div>
            </div>
        </div>)}
    </div>
}

export default DecklistImage;
