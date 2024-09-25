import { useEffect, useState } from 'react';
import Scanner from './Scanner.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import './App.css';

function App() {
  const [cardDatabase, setCardDatabase] = useState(null);

  useEffect(() => {
    fetch("/card_database.json").then(r => r.json())
      .then(setCardDatabase);
  }, [setCardDatabase]);

  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);

  return <>
    <ErrorBoundary>
      {cardDatabase != null ? <Scanner cardDatabase={cardDatabase} /> : 'Loading...'}
    </ErrorBoundary>
  </>
}

export default App
