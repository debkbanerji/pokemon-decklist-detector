import { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DatePicker } from 'rsuite';
import 'rsuite/dist/rsuite.min.css';
import { seralizeDecklist, addDecklistToDB, storageEnabled } from './StorageManager';
import DecklistImage from './DecklistImage.tsx';

function getDisplaySetCode(card) {
    return card['set_code'] ?? card['set_id'];
}

function isCardSecretRare(card) {
    const number = parseInt(card.number) || 0;
    const setTotal = parseInt(card.set_printed_total) || 0;
    return setTotal > 1 && number > setTotal;
}

function maybeProcessGalleryCardNumber(cardNumber) {
    const regex = /(?<=gg)0*/i;
    return cardNumber.replace(regex, '');
}

function getSpriteUrlForCard(card) {
    const nameForSpriteUrl = card.name_without_prefix_and_postfix.toLowerCase().replaceAll(' ', '-').replaceAll(/(\'|\.)/gi, '').replaceAll('é', 'e').replace('♀', 'f').replace('♂', 'm')
    return 'sprites/' + nameForSpriteUrl + '.png';
}

const AGE_DIVISION_TO_POKE_BALL_FILE = {
    'Junior Division': 'great_ball.png',
    'Senior Division': 'ultra_ball.png',
    'Masters Division': 'master_ball.png',
}

// The DB has some gaps - manually map a few pokemon
const NAME_TO_POKEDEX_NUMBER_FALLBACK = {
    "Dipplin": 1011,
    "Poltchageist": 1012,
    "Sinistcha": 1013,
    "Okidogi": 1014,
    "Munkidori": 1015,
    "Fezandipiti": 1016,
    "Ogerpon": 1017,
    "Archaludon": 1018,
    "Hydrapple": 1019,
    "Gouging Fire": 1020,
    "Raging Bolt": 1021,
    "Iron Boulder": 1022,
    "Iron Crown": 1023,
    "Terapagos": 1024,
    "Pecharunt": 1025,
}

const TYPE_TO_ENERGY_SYMBOL_URL = {
    'Grass': 'grass-energy-symbol.png',
    'Fire': 'fire-energy-symbol.png',
    'Water': 'water-energy-symbol.png',
    'Lightning': 'lightning-energy-symbol.png',
    'Psychic': 'psychic-energy-symbol.png',
    'Fighting': 'fighting-energy-symbol.png',
    'Darkness': 'darkness-energy-symbol.png',
    'Metal': 'metal-energy-symbol.png',
    'Colorless': 'colorless-energy-symbol.png',
}

const TCG_LIVE_SET_OVERRIDE = {
    'SVP': 'PR-SV',
    'PR': 'PR-SW',
    'sve': 'Energy'
}

function hexToRgb(hex) {
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

const TYPE_TO_HEADER_COLOR_PAIR = {
    'Grass': ['#1B5E20', '#E0E0E0'],
    'Fire': ['#BF360C', '#E0E0E0'],
    'Water': ['#0D47A1', '#E0E0E0'],
    'Lightning': ['#A66E00', '#E0E0E0'],
    'Psychic': ['#AD1457', '#E0E0E0'],
    'Fighting': ['#895129', '#E0E0E0'],
    'Darkness': ['#37474F', '#E0E0E0'],
    'Metal': ['#424242', '#E0E0E0'],
    'Dragon': ['#A66E00', '#E0E0E0'],
    'Colorless': ['#000000', '#E0E0E0'],
}


function ExportModal({ undeletedCardData, cardDatabase, coverPokemon, setCoverPokemon, deckName, setDeckName, enableSaving }) {
    const [hasTriedDBWrite, setHasTriedDBWrite] = useState(false);
    const [modalOpenedTimestamp, setModalOpenedTimestamp] = useState(null);
    useEffect(() => {
        if (modalOpenedTimestamp == null) {
            setModalOpenedTimestamp(Date.now());
        }
    }, [modalOpenedTimestamp, setModalOpenedTimestamp]);

    async function saveDecklistToStorage() {
        if (!enableSaving || !storageEnabled()) {
            return;
        }
        const serializedDecklist = seralizeDecklist(undeletedCardData);
        addDecklistToDB(modalOpenedTimestamp, deckName, serializedDecklist, pokemonNameToSpriteUrl[coverPokemon], coverPokemon);
    }

    const pokemonDict = {};
    const trainerDict = {};
    const energyDict = {};
    undeletedCardData.forEach(({ cardInfo }) => {
        const { supertype, id, name, count } = cardInfo;
        if (supertype === 'Energy') {
            energyDict[name] = (energyDict[name] ?? 0) + count; // key off of name for energies
        } else if (supertype === 'Trainer') {
            trainerDict[name] = (trainerDict[name] ?? 0) + count; // key off of name for trainers
        } else {
            pokemonDict[id] = (pokemonDict[id] ?? 0) + count; // key off of id for pokemon
        }
    });

    const pokemon = Object.keys(pokemonDict).map(id => [id, pokemonDict[id]]);
    const trainers = Object.keys(trainerDict).map(id => [id, trainerDict[id]]);
    const energies = Object.keys(energyDict).map(id => [id, energyDict[id]]);

    const pokemonNameToSpriteUrl = {};
    pokemon.forEach((pair) => {
        const card = cardDatabase[pair[0]];
        pokemonNameToSpriteUrl[card.name_without_prefix_and_postfix] = getSpriteUrlForCard(card);
    });

    [trainers, energies].map(pairList => {
        pairList.sort((a, b) => {
            return (b[1] - a[1]) || a[0].localeCompare(b[0]);
        })
    });

    pokemon.sort((a, b) => {
        const card1 = cardDatabase[a[0]];
        const card2 = cardDatabase[b[0]];
        return (b[1] - a[1]) || card1.name.localeCompare(card2.name);
    });

    const numPokemon = pokemon.reduce((a, b) => a + b[1], 0);
    const numTrainers = trainers.reduce((a, b) => a + b[1], 0);
    const numEnergies = energies.reduce((a, b) => a + b[1], 0);

    const totalCount = numPokemon
        + numTrainers
        + numEnergies;
    const totalCountValid = totalCount === 60;

    const fullCardNameToIDs = useMemo(() => {
        const result = {};
        Object.keys(cardDatabase).forEach(id => {
            const name = cardDatabase[id].name;
            result[name] = (result[name] ?? []).concat([id]);
        });
        for (const key of Object.keys(result)) {
            result[key].sort((a, b) => isCardSecretRare(cardDatabase[a]) - isCardSecretRare(cardDatabase[b]));
        }
        return result;
    }, [cardDatabase]);

    const [clipboardButtonText, setClipboardButtonText] = useState('Copy List to Clipboard');
    const pokemonText = `Pokemon: ${numPokemon}\n${pokemon.filter(row => row[1] > 0).map(row => {
        const id = row[0];
        const count = row[1];
        const card = cardDatabase[id];
        const setCode = getDisplaySetCode(card);
        const setCodeForTCGLive = TCG_LIVE_SET_OVERRIDE[setCode] ?? setCode;
        return `${count} ${card['name']} ${setCodeForTCGLive} ${maybeProcessGalleryCardNumber(card['number']).replace('SWSH', '')}`
    }).join('\n')}`;
    const trainerText = `Trainer: ${numTrainers}\n${trainers.filter(row => row[1] > 0).map(row => {
        const name = row[0];
        const count = row[1];
        const cardSample = cardDatabase[fullCardNameToIDs[name][0]];
        const setCode = getDisplaySetCode(cardSample);
        const setCodeForTCGLive = TCG_LIVE_SET_OVERRIDE[setCode] ?? setCode;
        return `${count} ${name} ${setCodeForTCGLive} ${maybeProcessGalleryCardNumber(cardSample['number'])}`
    }).join('\n')}`;
    const energyText = `Energy: ${numEnergies}\n${energies.filter(row => row[1] > 0).map(row => {
        const name = row[0];
        const count = row[1];
        const cardSample = cardDatabase[fullCardNameToIDs[name][0]];
        const setCode = getDisplaySetCode(cardSample);
        const setCodeForTCGLive = TCG_LIVE_SET_OVERRIDE[setCode] ?? setCode;
        return `${count} ${name} ${setCodeForTCGLive} ${maybeProcessGalleryCardNumber(cardSample['number'])}`
    }).join('\n')}`;
    const decklistText = [pokemonText, trainerText, energyText].join('\n\n');
    async function onCopyToClipboard() {
        navigator.clipboard
            .writeText(
                decklistText
            ).then(() => {
                setClipboardButtonText('Copied!');
                setTimeout(() =>
                    setClipboardButtonText('Copy List to Clipboard'), 1000)
            });
        await saveDecklistToStorage();
    }

    const shareableUrl = window.location.origin + '?decklist=' + seralizeDecklist(undeletedCardData);
    const canshareUrl = navigator.share && navigator.canShare && navigator.canShare({ url: shareableUrl }) && (shareableUrl.length < 2000);
    async function onShareUrl() {
        await saveDecklistToStorage();
        navigator.share({ url: shareableUrl });
    }

    const [playerName, setPlayerName] = useState('');
    const [playerID, setPlayerID] = useState('');
    const [playerDOB, setPlayerDOB] = useState();
    const [ageDivision, setAgeDivision] = useState('Masters Division');
    const [format, setFormat] = useState('Standard');
    const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

    function setCoverPokemonWrapped(name) {
        setCoverPokemon(name);
        if (name !== '') {
            setDeckName(name);
        }
    }

    function getCoverPokemonType(name) {
        let coverPokemonType = 'Colorless';
        const coverPokemonList = pokemon.map(pair => cardDatabase[pair[0]]).filter(
            card => {
                return card.name_without_prefix_and_postfix === name
            }
        );
        coverPokemonList.reverse();
        return (((coverPokemonList[0] ?? {})['types']) ?? [])[0] || 'Colorless';
    }


    const emailText = `Player Name: ${playerName}\n
  Player ID: ${playerID}\n
  Date of Birth: ${playerDOB != null ? playerDOB.toLocaleDateString() : ''}\n
  Age Division: ${ageDivision}\n
  Format: ${format}\n\n
  
  Decklist:\n
  ${decklistText}\n
  
  Generated by decklist.debkbanerji.com
  `.replaceAll('\n', '%0D%0A');

    const emailLink = `mailto:?to=&body=${emailText}&subject=${playerName}'s Decklist`;

    const isDownloadPDFEnabled = playerName && playerID && playerDOB;

    function onDownloadPDF() {
        setIsDownloadingPDF(true);
        setTimeout(async () => { // Wait a few ms for the UI to update before triggering pdf generation
            await saveDecklistToStorage();
            const pokemonTable = pokemon.filter(row => row[1] > 0).map(row => {
                const id = row[0];
                const count = row[1];
                const card = cardDatabase[id];
                const nationalPokedexNumber = (card.national_pokedex_numbers ?? [])[0] ?? NAME_TO_POKEDEX_NUMBER_FALLBACK[card.name_without_prefix_and_postfix] ?? 0;
                // const spriteUrl = 'sprites/' + nationalPokedexNumber + '.png';
                // const energySymbolUrl = TYPE_TO_ENERGY_SYMBOL_URL[card.types[0]];
                const spriteUrl = getSpriteUrlForCard(card);

                return [count, card['name'], getDisplaySetCode(card), maybeProcessGalleryCardNumber(card['number']), card['regulation_mark'], spriteUrl];
            }).concat([...Array(2)].map(_ => { return ['', '']; })); // add some buffer for writing in changes by hand

            const trainerTable = trainers.filter(row => row[1] > 0).map(row => {
                const name = row[0];
                const count = row[1];
                return [count, name]
            }).concat([...Array(2)].map(_ => { return ['', '']; })); // add some buffer for writing in changes by hand

            const energyTable = energies.filter(row => row[1] > 0).map(row => {
                const name = row[0];
                const count = row[1];
                return [count, name]
            }).concat([...Array(1)].map(_ => { return ['', '']; })); // add some buffer for writing in changes by hand

            const doc = new jsPDF();

            const tableStyles = { cellPadding: 0.2 };
            const columnStyles = { 0: { cellWidth: 16 } };
            const headStyles = { fillColor: '#a9a9a9' };

            doc.setFontSize(13);
            doc.setFont(undefined, 'bold').text('Player Name:', 15, 10).setFont(undefined, 'normal').text(playerName, 45, 10);
            doc.setFont(undefined, 'bold').text('Player ID:', 15, 15).setFont(undefined, 'normal').text(playerID, 37, 15);
            doc.setFont(undefined, 'bold').text('Date of Birth:', 15, 20).setFont(undefined, 'normal').text(playerDOB.toLocaleDateString(), 45, 20);
            doc.setFont(undefined, 'bold').text('Age Division:', 15, 25).setFont(undefined, 'normal').text(ageDivision, 45, 25);
            const ageDivisionPokeballIcon = new Image();
            ageDivisionPokeballIcon.src = 'customization_sprites/' + AGE_DIVISION_TO_POKE_BALL_FILE[ageDivision];
            doc.addImage(ageDivisionPokeballIcon, 'png', 45.5 + doc.getTextWidth(ageDivision), 21.5, 4.5, 4.5);
            doc.setFont(undefined, 'bold').text('Format:', 15, 30).setFont(undefined, 'normal').text(format, 33, 30);

            const coverPokemonOffset = coverPokemon.length > 0 ? 8 : 0;
            const decknameOffset = deckName || (coverPokemonOffset > 0) ? 11 : 0;
            doc.setFontSize(16);

            const coverPokemonType = getCoverPokemonType(coverPokemon);
            const coverPokemonTextRGB = hexToRgb(TYPE_TO_HEADER_COLOR_PAIR[coverPokemonType][0]);
            doc.setTextColor(coverPokemonTextRGB.r, coverPokemonTextRGB.g, coverPokemonTextRGB.b);
            doc.text(deckName, 185.5 + (coverPokemon.length > 0 ? 0 : 10) - doc.getTextWidth(deckName), decknameOffset);
            doc.setTextColor(0, 0, 0);

            doc.setFontSize(8);
            doc.text(`Generated by decklist.debkbanerji.com on ${new Date().toLocaleDateString()}`, 130, 5 + decknameOffset);
            const qrCodeImg = new Image();
            qrCodeImg.src = 'website-qr-code.png';
            doc.addImage(qrCodeImg, 'png', 175, 7 + decknameOffset, 22, 22);

            doc.setFontSize(12);
            doc.text(`Pokemon: ${numPokemon}`, 15, 40);


            const didParseCell = (table) => {
                if (table.section === 'head') {
                    // table.cell.styles.textColor = TYPE_TO_HEADER_COLOR_PAIR[coverPokemonType][0];
                    // table.cell.styles.fillColor = TYPE_TO_HEADER_COLOR_PAIR[coverPokemonType][1];
                }
            };


            autoTable(doc, {
                head: [['QTY', 'NAME', 'SET', 'COLL #', 'REG']],
                body: pokemonTable,
                styles: tableStyles,
                columnStyles,
                headStyles,
                margin: { top: 42 },
                didParseCell,
                didDrawCell: function (data) {
                    try {
                        if (data.column.index === 1 && data.row.section === 'body') {
                            const spriteUrl = pokemonTable[data.row.index][5];
                            const dim = data.cell.height - data.cell.padding('vertical');
                            const textPos = data.cell.textPos;
                            if (spriteUrl != null && spriteUrl.length > 0) {
                                const img = new Image();
                                const imgProps = doc.getImageProperties(spriteUrl);
                                const height = dim;
                                const width = (imgProps.width * height) / imgProps.height;
                                img.src = spriteUrl;
                                doc.addImage(img, 'png', data.cell.x - 6, data.cell.y, width, height);
                            }
                        }
                    } catch (e) {
                        // do nothing
                    }
                }
            });

            doc.text(`Trainer: ${numTrainers}`, 15, doc.lastAutoTable.finalY + 6);
            autoTable(doc, {
                head: [['QTY', 'NAME']],
                body: trainerTable,
                styles: tableStyles,
                columnStyles,
                headStyles,
                didParseCell,
            });

            doc.text(`Energy: ${numEnergies}`, 15, doc.lastAutoTable.finalY + 6);
            autoTable(doc, {
                head: [['QTY', 'NAME']],
                body: energyTable,
                styles: tableStyles,
                columnStyles,
                headStyles,
                didParseCell,
            });

            doc.setFont(undefined, 'normal').text(`Total Cards:  ${totalCount}`, 15, doc.lastAutoTable.finalY + 6)

            if (coverPokemon.length > 0) {
                const coverPokemonImg = new Image();
                const coverPokemonUrl = pokemonNameToSpriteUrl[coverPokemon];
                if (coverPokemonUrl && coverPokemonUrl.length > 0) {
                    const imgProps = doc.getImageProperties(coverPokemonUrl);
                    const height = 8;
                    const width = (imgProps.width * height) / imgProps.height;
                    coverPokemonImg.src = coverPokemonUrl;
                    doc.addImage(coverPokemonUrl, 'png', 188, 5, width, height);

                    // Watermark the page
                    doc.setGState(new doc.GState({ opacity: 0.08 }));
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const pageHeight = doc.internal.pageSize.getHeight();
                    const bigHeight = pageHeight / 3;
                    const bigWidth = (imgProps.width * bigHeight) / imgProps.height;
                    doc.addImage(coverPokemonUrl, 'png', (pageWidth - bigWidth) / 2, (pageHeight - bigHeight) / 2, bigWidth, bigHeight);
                    doc.setGState(new doc.GState({ opacity: 1 }));
                }
            }

            const fileName = `${deckName.length > 0 ? deckName.replaceAll(' ', '-').replaceAll('/', '-') + '-' : ''}decklist-${new Date(Date.now()).toLocaleDateString().replaceAll('/', '-')}.pdf`;
            doc.save(fileName, { returnPromise: true }).then(setTimeout(() => setIsDownloadingPDF(false), 500));
        }, 30);
    }
    return <div>
        <h2>Export Decklist</h2>
        {enableSaving ? <div className='storage-info'>
            When you export a decklist, it is also saved to your browser's local storage
        </div> : null}
        <hr style={{ marginTop: 5 }} />
        {totalCountValid ?
            <>
                <div><b className='warning-text'>Ensure the cards and counts are correct before proceeding, </b>
                    <b className='error-text'>especially for Pokémon versions</b></div>
                <br />
                <b />
                <div><b className='warning-text'>You are responsible for the correctness of your own decklist!</b></div>
            </> :
            <b>
                <div><b className='error-text'>WARNING: Your decklist doesn't have exactly 60 cards</b></div>
            </b>
        }
        <br />
        <DecklistImage decklist={undeletedCardData.map(card => card.cardInfo)} cardDatabase={cardDatabase} />
        <hr />
        <div>
            <div className='share-buttons-row'>
                <button type="button" onClick={onCopyToClipboard}>
                    {clipboardButtonText}
                </button>
                {canshareUrl ? <button type="button" onClick={onShareUrl}>
                    Share Link
                </button> : null}
                <div className='clipboard-button-subtext'>
                    Copied lists can be imported to TCG Live, etc.
                </div>
            </div>
            <h2>Or</h2>
            <div>
                <div className='export-pdf-field'>
                    Player Name: <input type="text" name='player-name' onChange={e => setPlayerName(e.target.value)} value={playerName} />
                </div>
                <div className='export-pdf-field'>
                    Player ID: <input type="text" name='player-id' onChange={e => setPlayerID(e.target.value)} value={playerID} />
                </div>
                <div className='export-pdf-field'>
                    Date of Birth: <DatePicker value={playerDOB} onChange={setPlayerDOB} format="MM/dd/yyyy" />
                </div>
                <div className='export-pdf-field'>
                    Age Division: <select onChange={e => setAgeDivision(e.target.value)} value={ageDivision}>
                        <option>Junior Division</option>
                        <option>Senior Division</option>
                        <option>Masters Division</option>
                    </select>
                </div>
                <div className='export-pdf-field'>
                    Format: <select onChange={e => setFormat(e.target.value)} value={format}>
                        <option>Standard</option>
                        <option>Expanded</option>
                    </select>
                </div>
                <br />
                <div className='export-pdf-field'>
                    Cover Pokemon (Optional): <select onChange={e => setCoverPokemonWrapped(e.target.value)} value={coverPokemon}>
                        <option value={''} key="unset">(none)</option>
                        {Object.keys(pokemonNameToSpriteUrl).map(name =>
                            <option value={name} key={name}>{name}</option>
                        )}
                    </select>
                </div>
                <div className='export-pdf-field'>
                    Deck Name (Optional): <input type="text" name='deck-name' onChange={e => setDeckName(e.target.value)} value={deckName} />
                </div>
                <br />
                <button type="button" onClick={onDownloadPDF} disabled={!(playerName && playerID && playerDOB) || isDownloadingPDF}>
                    {isDownloadingPDF ? 'Generating...' : 'Download PDF'}
                </button>
            </div>
            <h2>Or</h2>
            <a href={emailLink} onClick={saveDecklistToStorage} target="_blank"><button type="button" disabled={!(playerName && playerID && playerDOB)}>
                Email Decklist
            </button></a>
        </div>
    </div >;
}

export default ExportModal;
