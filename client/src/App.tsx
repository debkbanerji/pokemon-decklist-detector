import { useEffect, useMemo, useRef, useState } from 'react';
import DecklistCreator from './DecklistCreator.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import ExportModal from './ExportModal.tsx';
import DecklistRow from './DecklistRow.tsx';
import './App.css';
import { deserializeDecklist, deleteDecklist, getDecklists, parseFormattedDecklist } from './StorageManager';
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react"
import { MdCameraAlt, MdOutlineArrowBack } from 'react-icons/md';


const TITLE_ADJECTIVES = [
  'Dubious', 'Dazzling', 'Dope', 'Decent', 'Deluxe', 'Distinguished', 'Divine', 'Dynamic', 'Dastardly', 'Diabolical', 'Demure', 'Duplicitous', 'Dilapidated', 'Distinctive'
];

const LANDING_PREVIEW_CARDS = [
  { id: 'sv6pt5-20', name: 'Dusknoir', slot: 1 },
  { id: 'sv6-200', name: 'Dragapult ex', slot: 3 },
  { id: 'sv8pt5-14', name: 'Flareon ex', slot: 2 },
];

const LANDING_POP_VARIANTS = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
  },
};

const landingPopTransition = (delay = 0) => ({
  delay,
  type: 'spring',
  stiffness: 560,
  damping: 24,
});

function LandingPreviewGraphic() {
  return (
    <div className="landing-preview-stage">
      <motion.section
        className="landing-preview"
        aria-label="Three cards turned into a decklist PDF"
      >
        <div
          className="landing-card-cluster"
          aria-hidden="true"
        >
          {LANDING_PREVIEW_CARDS.map(({ id, name, slot }, index) => (
            <div
              key={id}
              className={`landing-preview-card-wrap landing-preview-card-${slot}`}
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={LANDING_POP_VARIANTS}
                transition={landingPopTransition(0.01 + index * 0.04)}
              >
                <img
                  className="landing-preview-card"
                  src={`/cards/${id}.png`}
                  alt={name}
                />
              </motion.div>
            </div>
          ))}
        </div>

        <div className="landing-process-copy">
          <motion.p initial="hidden" animate="visible" variants={LANDING_POP_VARIANTS} transition={landingPopTransition(0.13)}>⚡ Scan your decks</motion.p>
          <motion.p initial="hidden" animate="visible" variants={LANDING_POP_VARIANTS} transition={landingPopTransition(0.17)}>🧠 Run probability analysis</motion.p>
          <motion.p initial="hidden" animate="visible" variants={LANDING_POP_VARIANTS} transition={landingPopTransition(0.21)}>📄 Create beautiful lists</motion.p>
        </div>

        <div className="landing-output-flow">
          <div className="landing-arrow-wrap" aria-hidden="true">
            <div className="landing-arrow-node">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={LANDING_POP_VARIANTS}
                transition={landingPopTransition(0.25)}
              >
                <svg className="landing-arrow" viewBox="-18 -18 274 284">
                  <path
                    d="M238.136 80.452 140.024 0l16.6 49.075C59.435 63.831-11.074 147.386 1.44 248.064c0 0 10.5-58.171 65.268-103.175a144.579 144.579 0 0 1 76.628-31.35c4.236-.386 8.645-.605 13.019-.595l-16.331 47.961Z"
                    fill="none"
                    stroke="#3f3f46"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            </div>
            <div className="landing-arrow-camera">
              <motion.div
                className="landing-arrow-camera-pop"
                initial="hidden"
                animate="visible"
                variants={LANDING_POP_VARIANTS}
                transition={landingPopTransition(0.33)}
              >
                <MdCameraAlt />
              </motion.div>
            </div>
          </div>

          <div
            className="landing-pdf-placeholder"
            aria-label="Output PDF placeholder"
          >
            <motion.div
              className="landing-pdf-pop"
              initial="hidden"
              animate="visible"
              variants={LANDING_POP_VARIANTS}
              transition={landingPopTransition(0.37)}
            >
              <div className="landing-pdf-sheet">
                <img className="landing-pdf-preview" src="/example-decklist.svg" alt="Example exported decklist" />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

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

  const headerRef = useRef(null);
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

  const isPortraitMobile = window.innerHeight > window.innerWidth;

  function scrollToTop() {
    setTimeout(() => {
      headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  return <>
    <div ref={headerRef} className="header">
      {hasStarted ? <a className='home-button modal-header-nav-button' href={window.location.origin} aria-label='Back to home'><MdOutlineArrowBack /></a> : <span></span>}
      <h3 className="title">Deb's {titleAdjective}<br /> Decklist Detector</h3>
    </div>
    {hasStarted ? <ErrorBoundary>
      {cardDatabase != null ? <DecklistCreator cardDatabase={cardDatabase} startingDecklist={startingDecklist} startingDeckName={startingDeckName} startingCoverPokemon={startingCoverPokemon} startingDecklistTimestamp={startingDecklistTimestamp} scrollToTop={scrollToTop} /> : 'Loading...'}
    </ErrorBoundary> : <div>
      <div className='subtitle top-description'>
        <small>
          <span>Made with ♥</span>&nbsp;&nbsp;&bull;&nbsp;&nbsp;
          <a href="https://github.com/debkbanerji/pokemon-decklist-detector" target="_blank">Source Code</a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;
          <a href="https://github.com/debkbanerji#contact-me" target="_blank">Contact</a>
        </small>
      </div>
      {!isPortraitMobile ? <div><b className='error-text'>Warning: this site is designed to be used on mobile devices in portrait mode</b></div> : null}
      <LandingPreviewGraphic />
      <button onClick={() => setHasStarted(true)} className='start-scanning-button'>Create List</button>
      <br />
      {cardDatabase != null ? <button onClick={importFromClipboard}>{clipboardButtonText}</button> : null}
      {savedDecklists != null && cardDatabase != null ? <div>
        <h3 className='saved-decklists-heading'>My Lists</h3>
        {savedDecklists.length > 0 ? <div className='saved-decklists'>
          {getNestedSavedDecklists(savedDecklists).map(({
            serializedDecklist,
            name,
            createdTimestamp,
            coverPokemonSpriteUrl,
            coverPokemon,
            successorCreatedTimestamp,
            previousDecklistInfo
          }) => {
            return <ErrorBoundary
              key={createdTimestamp}>
              <DecklistRow
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
              /></ErrorBoundary>;
          })}
        </div> : <p className='saved-decklists-empty'>No lists created yet</p>}
      </div> : null}
    </div >}
    {
      decklistForModal != null && cardDatabase != null ?
        <div ref={exportModalRef} className="modal">
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
                currentDeckCreatedTimestamp={startingDecklistTimestamp}
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
