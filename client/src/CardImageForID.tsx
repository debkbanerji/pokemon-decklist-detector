import { useEffect, useState } from 'react';

function CardImageForID({ id }) {
  const imageUrl = `/cards/${id}.png`;
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    async function waitForLoad() {
      if (!hasLoaded) {
        await fetch(imageUrl); // wait for this network request to finish
        setHasLoaded(true);
      }
    }
    waitForLoad();
  }, [hasLoaded, setHasLoaded,]);

  return hasLoaded ?
    <img src={imageUrl} style={{ width: '100%' }} /> :
    <div className="card-image-loading-spinner-container">
      <img src='/cardback.jpg' style={{ width: '100%' }}></img>
      <span className="card-image-loading-spinner"></span>
    </div>;
}

export default CardImageForID;
