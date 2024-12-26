import { useEffect, useMemo, useRef, useState } from 'react';
import ExportModal from './ExportModal.tsx';
import './App.css';
import { deserializeDecklist, deleteDecklist, getDecklists, storageEnabled } from './StorageManager';
import { motion } from "motion/react"

function DecklistRow({ cardDatabase, loadInDecklist, deleteDecklist, createdTimestamp, coverPokemon, coverPokemonSpriteUrl, name, serializedDecklist }) {
    return <div className="decklist-row">
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
            <button onClick={() => { loadInDecklist(serializedDecklist, name, coverPokemon) }}>Load</button>
            <button onClick={() => { deleteDecklist(createdTimestamp) }}>Delete</button>
        </div>
    </div>;
}

export default DecklistRow;
