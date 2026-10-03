import { useEffect, useState } from 'react';

function CardImageForID({ id, showSetInfo = false, cardDatabase, onLoaded }) {
  const imageUrl = `/cards/${id}.png`;
  const card = cardDatabase?.[id] ?? {};
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    const image = new Image();
    let loadedTimeout: ReturnType<typeof setTimeout>;
    setHasLoaded(false);

    image.onload = () => {
      setHasLoaded(true)
      if (onLoaded) {
        loadedTimeout = setTimeout(() => {
          onLoaded(id);
        }, 500);
      }
    };
    image.onerror = () => {
      setHasLoaded(false);
    };
    image.src = imageUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
      clearTimeout(loadedTimeout);
    };
  }, [imageUrl, id, onLoaded]);

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
      <div className="card-image-placeholder-details">
        <div className="card-image-placeholder-name">{card.name ?? id}</div>
        <div className="card-image-placeholder-set">{card.set_code} {card.number}</div>
      </div>
    </div>;
}

export default CardImageForID;
