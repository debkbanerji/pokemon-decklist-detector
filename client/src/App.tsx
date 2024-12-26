import { useEffect, useMemo, useRef, useState } from 'react';
import Scanner from './Scanner.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import ExportModal from './ExportModal.tsx';
import DecklistRow from './DecklistRow.tsx';
import './App.css';
import { deserializeDecklist, deleteDecklist, getDecklists, storageEnabled } from './StorageManager';
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react"


const TITLE_ADJECTIVES = [
  'Dubious', 'Dazzling', 'Dope', 'Decent', 'Deluxe', 'Distinguished', 'Divine', 'Dynamic', 'Dastardly', 'Diabolical', 'Demure', 'Duplicitous', 'Dilapidated', 'Distinctive'
];

function App() {
  const [cardDatabase, setCardDatabase] = useState(null);
  const savedDecklists = useLiveQuery(() => getDecklists());

  const exportModalRef = useRef(null);
  const [decklistForModal, setDecklistForModal] = useState(null);

  useEffect(() => {
    fetch("/card_database.json").then(r => r.json())
      .then(setCardDatabase);
  }, [setCardDatabase]);

  const [hasStarted, setHasStarted] = useState(false);
  const [startingDeckName, setStartingDeckName] = useState('');
  const [startingCoverPokemon, setStartingCoverPokemon] = useState('');
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
          setDecklistForModal(deserializedDecklist.map((card, index) => {
            return {
              cardInfo: {
                originalIndex: index,
                ...card.cardInfo,
                ...cardDatabase[card.cardInfo.id]
              }
            }
          }));
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

  function loadInDecklist(serializedDecklist, deckName, coverPokemon) {
    const deserializedDecklist = deserializeDecklist(serializedDecklist, cardDatabase);
    setStartingCoverPokemon(coverPokemon || '');
    setStartingDeckName(deckName || '');
    setTimeout(() => {
      setStartingDecklist(deserializedDecklist.map(({ cardInfo }, index) => {
        const { id, count } = cardInfo;
        return {
          originalIndex: index,
          count,
          id,
          ...cardDatabase[id]
        }
      }));
    }, 10);
  }

  useEffect(() => {
    window.onclick = function (event) {
      // close modal contents if background is clicked
      if (event.target === exportModalRef.current) {
        setDecklistForModal(null);
        window.history.pushState({}, document.title, window.location.origin);
      }
    }
  },
    [exportModalRef, setDecklistForModal]);


  return <>
    <h3 className="title">Deb's {titleAdjective}<br /> Decklist Detector</h3>
    {hasStarted ? <ErrorBoundary>
      {cardDatabase != null ? <Scanner cardDatabase={cardDatabase} startingDecklist={startingDecklist} startingDeckName={startingDeckName} startingCoverPokemon={startingCoverPokemon} /> : 'Loading...'}
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
            coverPokemonSpriteUrl,
            coverPokemon
          }) => {
            return <DecklistRow
              key={createdTimestamp}
              cardDatabase={cardDatabase}
              loadInDecklist={loadInDecklist}
              deleteDecklist={deleteDecklist}
              createdTimestamp={createdTimestamp}
              coverPokemon={coverPokemon}
              coverPokemonSpriteUrl={coverPokemonSpriteUrl}
              name={name}
              serializedDecklist={serializedDecklist}
            />;
          })}
        </div>
      </div> : null}
    </div >}
    {
      decklistForModal != null && cardDatabase != null ?
        <div ref={exportModalRef} className="export-modal">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <div className="export-modal-content">
              <ExportModal cardDatabase={cardDatabase}
                undeletedCardData={decklistForModal}
                enableSaving={true} />
            </div>
          </motion.div>
        </div> : null
    }
  </>
}

export default App
