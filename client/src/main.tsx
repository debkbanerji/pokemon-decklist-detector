import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> // messes up useEffect, causing multiple queries :(
    <App />
  // </React.StrictMode>,
)
