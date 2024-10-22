import { useEffect, useMemo, useState } from 'react';
import Scanner from './Scanner.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import './App.css';


const TITLE_ADJECTIVES = [
  'Dubious', 'Dazzling', 'Dope', 'Decent', 'Deluxe', 'Distinguished', 'Divine', 'Dynamic', 'Dastardly', 'Diabolical', 'Demure', 'Duplicitous', 'Dilapidated', 'Distinctive'
];

function App() {
  const [cardDatabase, setCardDatabase] = useState(null);

  useEffect(() => {
    fetch("/card_database.json").then(r => r.json())
      .then(setCardDatabase);
  }, [setCardDatabase]);

  const [hasStarted, setHasStarted] = useState(false);

  const titleAdjective = useMemo(() => {
    return TITLE_ADJECTIVES[Math.floor(Math.random() * TITLE_ADJECTIVES.length)];
  }, [TITLE_ADJECTIVES]);

  return <>
    <h3 className="title">Deb's {titleAdjective} Decklist Detector</h3>
    {hasStarted ? <ErrorBoundary>
      {cardDatabase != null ? <Scanner cardDatabase={cardDatabase} /> : 'Loading...'}
    </ErrorBoundary> : <div>
      <div className='top-description'>
        Easily scan in your decklist,
          <br />
          then export it to Email, PDF, or TCG Live       
        <br />
      </div>
      <video className='demo-video' autoPlay loop muted playsInline>
        <source src="demo-video.mp4" type="video/mp4" />
      </video>
      <button onClick={() => setHasStarted(true)}>Start Scanning</button>
    </div >}
  </>
}

export default App
