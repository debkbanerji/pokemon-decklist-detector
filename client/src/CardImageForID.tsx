import { useEffect, useState } from 'react';

function CardImageForID({ id, showSetInfo = false, cardDatabase, onLoaded }) {
  const imageUrl = `/cards/${id}.png`;
  const card = cardDatabase != null ? cardDatabase[id] : {};
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    async function waitForLoad() {
      if (!hasLoaded) {
        await fetch(imageUrl); // wait for this network request to finish
        setHasLoaded(true);
        if (onLoaded) {
          setTimeout(() => {
            onLoaded(id);
          }, 500);
        }
      }
    }
    waitForLoad();
  }, [hasLoaded, setHasLoaded,]);

  return hasLoaded ?
    <div className='card-image-container'>
      {
        showSetInfo ? <div className="card-set-info-text">
          {card.set_code}&nbsp;
          {card.number}
        </div> : null
      }
      <img src={imageUrl} style={{ width: '100%' }} />
    </div>
    :
    <div className="card-image-loading-spinner-container">
      <img src='/cardback.jpg' style={{ width: '100%' }}></img>
      <span className="card-image-loading-spinner"></span>
    </div>;
}

export default CardImageForID;
