import { useEffect, useMemo, useState } from 'react';
import Scanner from './Scanner.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import './App.css';
import { deserializeDecklist, deleteDecklist, getDecklists, storageEnabled } from './StorageManager';
import { useLiveQuery } from "dexie-react-hooks";


const TITLE_ADJECTIVES = [
  'Dubious', 'Dazzling', 'Dope', 'Decent', 'Deluxe', 'Distinguished', 'Divine', 'Dynamic', 'Dastardly', 'Diabolical', 'Demure', 'Duplicitous', 'Dilapidated', 'Distinctive'
];

function App() {
  const [cardDatabase, setCardDatabase] = useState(null);
  const savedDecklists = useLiveQuery(() => getDecklists());

  useEffect(() => {
    fetch("/card_database.json").then(r => r.json())
      .then(setCardDatabase);
  }, [setCardDatabase]);

  const [hasStarted, setHasStarted] = useState(false);
  const [startingDecklist, setStartingDecklist] = useState([]);
  useEffect(() => {
    if (startingDecklist.length > 0) { // if the starting decklist is set, move to scanner screen
      setHasStarted(true);
    }
  }, [startingDecklist, setHasStarted]);

  useEffect(() => {
    if (cardDatabase != null) {
      try {
        const match = window.location.href.match('[?&]' + 'decklist' + '=([^&]+)');
        if (match) {
          const deserializedDecklist = deserializeDecklist(match[1], cardDatabase);
          setStartingDecklist(deserializedDecklist.map(card => card.cardInfo));
        }
      } catch (e) {
        console.error(e)
        alert('Could not read decklist from url')
      }
    }
  }, [cardDatabase, setStartingDecklist]);

  const titleAdjective = useMemo(() => {
    return TITLE_ADJECTIVES[Math.floor(Math.random() * TITLE_ADJECTIVES.length)];
  }, [TITLE_ADJECTIVES]);

  function loadInDecklist(serializedDecklist) {
    const deserializedDecklist = deserializeDecklist(serializedDecklist, cardDatabase);
    setStartingDecklist(deserializedDecklist.map(({ cardInfo }, index) => {
      const { id, count } = cardInfo;
      return {
        originalIndex: index,
        count,
        id,
        ...cardDatabase[id]
      }
    }));
  }


  return <>
    <h3 className="title">Deb's {titleAdjective}<br /> Decklist Detector</h3>
    {hasStarted ? <ErrorBoundary>
      {cardDatabase != null ? <Scanner cardDatabase={cardDatabase} startingDecklist={startingDecklist} /> : 'Loading...'}
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
      {savedDecklists != null && savedDecklists.length > 0 && cardDatabase != null && storageEnabled() ? <div>
        <h3 className='saved-decklists-heading'>Previously Scanned Lists</h3>
        <div className='saved-decklists'>
          {(savedDecklists).map(({
            serializedDecklist,
            name,
            createdTimestamp,
            coverPokemonSpriteUrl
          }) => {
            return <div className="decklist-row" key={createdTimestamp}>
              <img height={38} src={coverPokemonSpriteUrl}></img>
              <div className='decklist-name-timestamp-container'>
                <div>
                  {name}
                </div>
                <div className='decklist-timestamp'>
                  {new Date(createdTimestamp).toLocaleString()}
                </div>
              </div>
              <div>
                <button onClick={() => { loadInDecklist(serializedDecklist) }}>Load</button>
                <button onClick={() => { deleteDecklist(createdTimestamp) }}>Delete</button>
              </div>
            </div>;
          })}
        </div>
      </div> : null}
    </div >}
  </>
}

export default App
