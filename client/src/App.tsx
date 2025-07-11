import { useEffect, useMemo, useRef, useState } from 'react';
import Scanner from './Scanner.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import ExportModal from './ExportModal.tsx';
import DecklistRow from './DecklistRow.tsx';
import './App.css';
import { deserializeDecklist, deleteDecklist, getDecklists, parseFormattedDecklist } from './StorageManager';
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react"


const TITLE_ADJECTIVES = [
  'Dubious', 'Dazzling', 'Dope', 'Decent', 'Deluxe', 'Distinguished', 'Divine', 'Dynamic', 'Dastardly', 'Diabolical', 'Demure', 'Duplicitous', 'Dilapidated', 'Distinctive'
];

function getNestedSavedDecklists(savedDecklists) {
  // For each saved decklist, squish the previous version into a 'previousDecklistInfo' field
  const createdTimestampToDecklist = {};
  savedDecklists.forEach(decklist => {
    decklist.previousDecklistInfo = [];
    createdTimestampToDecklist[decklist.createdTimestamp] = decklist;
  });
  const result = [];
  savedDecklists.forEach(decklist => {
    if (decklist.successorCreatedTimestamp) {
      createdTimestampToDecklist[decklist.successorCreatedTimestamp].previousDecklistInfo.push(decklist);
    } else {
      result.push(decklist);
    }
  });
  return result;
}

function App() {
  const [cardDatabase, setCardDatabase] = useState(null);
  const savedDecklists = useLiveQuery(() => getDecklists());

  const exportModalRef = useRef(null);
  const [decklistForModal, setDecklistForModal] = useState(null);
  const [coverPokemonForModal, setCoverPokemonForModal] = useState('');
  const [deckNameForModal, setDeckNameForModal] = useState('');

  useEffect(() => {
    fetch("/card_database.json").then(r => r.json())
      .then(setCardDatabase);
  }, [setCardDatabase]);

  const [hasStarted, setHasStarted] = useState(false);
  const [startingDeckName, setStartingDeckName] = useState('');
  const [startingCoverPokemon, setStartingCoverPokemon] = useState('');
  const [startingDecklistTimestamp, setStartingDecklistTimestamp] = useState(null);
  const [startingDecklist, setStartingDecklist] = useState([]);
  useEffect(() => {
    if (startingDecklist.length > 0) { // if the starting decklist is set, move to scanner screen
      setHasStarted(true);
    }
  }, [startingDecklist, setHasStarted]);

  useEffect(() => {
    if (cardDatabase != null) {
      try {
        const decklistMatch = window.location.href.match('[?&]' + 'decklist' + '=([^&]+)');
        if (decklistMatch) {
          const deserializedDecklist = deserializeDecklist(decklistMatch[1], cardDatabase);

          const coverPokemonMatch = window.location.href.match('[?&]' + 'cover_pokemon' + '=([^&]+)') ?? ['', ''];
          const deckNameMatch = window.location.href.match('[?&]' + 'deck_name' + '=([^&]+)') ?? ['', ''];

          setCoverPokemonForModal(decodeURI(coverPokemonMatch[1]));
          setDeckNameForModal(decodeURI(deckNameMatch[1]));
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


  const [clipboardButtonText, setClipboardButtonText] = useState('Import from Clipboard');

  async function importFromClipboard() {
    setClipboardButtonText('Importing...');
    setTimeout(async () => {
      try {
        const clipboardContents = await navigator.clipboard.readText();
        const decklist = parseFormattedDecklist(clipboardContents, cardDatabase);
        if (decklist.length < 1) {
          throw new Error("Empty decklist");
        }
        setDecklistForModal(decklist.map((card, index) => {
            return {
              cardInfo: {
                originalIndex: index,
                ...card.cardInfo,
                ...cardDatabase[card.cardInfo.id]
              }
            }
          }));
        setClipboardButtonText('Import from Clipboard');
      } catch (e) {
        console.error(e);
        alert('Unable to read deck contents :/'); // TODO: Fancier error message?
        setClipboardButtonText('Import from Clipboard');
      }
    }, 100);
  }

  const titleAdjective = useMemo(() => {
    return TITLE_ADJECTIVES[Math.floor(Math.random() * TITLE_ADJECTIVES.length)];
  }, [TITLE_ADJECTIVES]);

  function loadInDecklist(serializedDecklist, deckName, coverPokemon, createdTimestamp) {
    const deserializedDecklist = deserializeDecklist(serializedDecklist, cardDatabase);
    setStartingCoverPokemon(coverPokemon || '');
    setStartingDeckName(deckName || '');
    setStartingDecklistTimestamp(createdTimestamp)
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
      {cardDatabase != null ? <Scanner cardDatabase={cardDatabase} startingDecklist={startingDecklist} startingDeckName={startingDeckName} startingCoverPokemon={startingCoverPokemon} startingDecklistTimestamp={startingDecklistTimestamp} /> : 'Loading...'}
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
      <button onClick={() => setHasStarted(true)} className='start-scanning-button'>Start Scanning!</button>
      <br />
      {cardDatabase != null ? <button onClick={importFromClipboard}>{clipboardButtonText}</button> : null}
      {savedDecklists != null && savedDecklists.length > 0 && cardDatabase != null ? <div>
        <h3 className='saved-decklists-heading'>Previous Lists</h3>
        <div className='saved-decklists'>
          {getNestedSavedDecklists(savedDecklists).map(({
            serializedDecklist,
            name,
            createdTimestamp,
            coverPokemonSpriteUrl,
            coverPokemon,
            successorCreatedTimestamp,
            previousDecklistInfo
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
              successorCreatedTimestamp={successorCreatedTimestamp}
              previousDecklistInfo={previousDecklistInfo}
              isNested={false}
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
                coverPokemon={coverPokemonForModal}
                setCoverPokemon={setCoverPokemonForModal}
                deckName={deckNameForModal}
                setDeckName={setDeckNameForModal}
                enableSaving={true}
                previousDecklistTimestamp={startingDecklistTimestamp}
                onClose={() => {
                  setDecklistForModal(null);

                  // clear query params if they're present, so a refresh doesn't cause the modal to show up again
                  window.location.href = window.location.origin + window.location.pathname
                }}
              />
            </div>
          </motion.div>
        </div> : null
    }
  </>
}

export default App
