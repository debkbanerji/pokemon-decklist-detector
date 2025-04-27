import { useEffect, useMemo, useRef, useState } from 'react';
import ExportModal from './ExportModal.tsx';
import './App.css';
import { deserializeDecklist, deleteDecklist, getDecklists, getLatestPlayer } from './StorageManager';
import { motion } from "motion/react"
import { MdDelete, MdDeleteForever, MdEdit, MdIosShare, MdOutlineDelete, MdOutlineEdit } from "react-icons/md";

function DecklistRow({ cardDatabase, loadInDecklist, deleteDecklist, createdTimestamp, coverPokemon: startingCoverPokemon, coverPokemonSpriteUrl, name: startingDeckName, serializedDecklist, successorCreatedTimestamp, previousDecklistInfo }) {
    const [coverPokemon, setCoverPokemon] = useState(startingCoverPokemon || '');
    const [deckName, setDeckName] = useState(startingDeckName || '');

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


    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const deleteModalRef = useRef(null);
    useEffect(() => {
        window.addEventListener("click", function (event) {
            // close modal contents if background is clicked
            if (event.target === deleteModalRef.current) {
                setIsDeleteModalOpen(false);
            }
        });
    },
        [deleteModalRef, setIsDeleteModalOpen]);

    return <div>
        <div className="decklist-row">
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
                <button onClick={() => { loadInDecklist(serializedDecklist, deckName, coverPokemon, successorCreatedTimestamp || createdTimestamp) }}><MdOutlineEdit /></button>
                <button onClick={() => {
                    setIsDeleteModalOpen(true);
                    setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 100);
                }}><MdOutlineDelete /></button>
            </div>
        </div>
        {previousDecklistInfo && previousDecklistInfo.length > 0 ?
            <div className='previous-decklist-rows-container'>
                {
                    previousDecklistInfo.map(({ createdTimestamp, coverPokemon: startingCoverPokemon, coverPokemonSpriteUrl, name, serializedDecklist, successorCreatedTimestamp }) =>
                        <div key={createdTimestamp} className='previous-decklist-row'>
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
                            />
                        </div>)
                }
            </div>
            : null}
        {
            isExportModalOpen ?
                <div ref={exportModalRef} className="export-modal">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <div className="export-modal-content">
                            <ExportModal
                                cardDatabase={cardDatabase}
                                undeletedCardData={deserializeDecklist(serializedDecklist, cardDatabase)
                                    .map(({ cardInfo }, index) => {
                                        const { id, count } = cardInfo;
                                        return {
                                            cardInfo: {
                                                originalIndex: index,
                                                count,
                                                id,
                                                ...cardDatabase[id]
                                            }
                                        };
                                    })}
                                coverPokemon={coverPokemon}
                                setCoverPokemon={setCoverPokemon}
                                deckName={deckName}
                                setDeckName={setDeckName}
                            />
                        </div>
                    </motion.div>
                </div> : null
        }
        {
            isDeleteModalOpen ?
                <div ref={deleteModalRef} className="export-modal">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <div className="delete-modal-content">
                            <b>Delete this decklist?</b>
                            <button onClick={() => { deleteDecklist(createdTimestamp) }}>Yes</button>
                            <button onClick={() => { setIsDeleteModalOpen(false) }}>No</button>
                        </div>
                    </motion.div>
                </div> : null
        }
    </div>;
}

export default DecklistRow;
