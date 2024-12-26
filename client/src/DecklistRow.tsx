import { useEffect, useMemo, useRef, useState } from 'react';
import ExportModal from './ExportModal.tsx';
import './App.css';
import { deserializeDecklist, deleteDecklist, getDecklists, storageEnabled } from './StorageManager';
import { motion } from "motion/react"
import { MdDelete, MdDeleteForever, MdEdit, MdIosShare, MdOutlineDelete, MdOutlineEdit } from "react-icons/md";

function DecklistRow({ cardDatabase, loadInDecklist, deleteDecklist, createdTimestamp, coverPokemon: startingCoverPokemon, coverPokemonSpriteUrl, name: startingDeckName, serializedDecklist }) {
    const [coverPokemon, setCoverPokemon] = useState(startingCoverPokemon);
    const [deckName, setDeckName] = useState(startingDeckName);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const exportModalRef = useRef(null);
    useEffect(() => {
        window.addEventListener("click", function (event) {
            // close modal contents if background is clicked
            if (event.target === exportModalRef.current) {
                setIsExportModalOpen(false);
            }
        });
    },
        [exportModalRef, setIsExportModalOpen]);
    return <div className="decklist-row">
        <img height={38} src={coverPokemonSpriteUrl}></img>
        <div className='decklist-name-timestamp-container'>
            <div>
                {startingDeckName}
            </div>
            <div className='decklist-timestamp'>
                {new Date(createdTimestamp).toLocaleString()}
            </div>
        </div>
        <div>
            <button onClick={() => {
                setIsExportModalOpen(true);
                setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 100);
            }}><MdIosShare /></button>
            <button onClick={() => { loadInDecklist(serializedDecklist, deckName, coverPokemon) }}><MdOutlineEdit /></button>
            <button onClick={() => { deleteDecklist(createdTimestamp) }}><MdOutlineDelete /></button>
        </div>
        {
            isExportModalOpen ?
                <div ref={exportModalRef} className="export-modal">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <div className="export-modal-content">
                            <ExportModal
                                cardDatabase={cardDatabase}
                                undeletedCardData={deserializeDecklist(serializedDecklist, cardDatabase)}
                                coverPokemon={coverPokemon}
                                setCoverPokemon={setCoverPokemon}
                                deckName={deckName}
                                setDeckName={setDeckName}
                            />
                        </div>
                    </motion.div>
                </div> : null
        }
    </div>;
}

export default DecklistRow;
