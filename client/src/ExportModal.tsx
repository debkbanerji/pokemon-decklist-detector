import { useState, useEffect, useMemo, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DatePicker } from 'rsuite';
import 'rsuite/dist/rsuite.min.css';
import { seralizeDecklist, addDecklistToDB, overWriteLatestPlayer, getLatestPlayer } from './StorageManager';
import DecklistImage from './DecklistImage.tsx';
import Select, { components, OptionProps } from 'react-select';
import { QRCode as ReactQRCode } from "react-qr-code";
import qrcode from "qrcode-generator"
import { toJpeg } from 'html-to-image';
import { set } from 'rsuite/esm/internals/utils/date/index';

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

const POKEMON_NAME_TO_MANUAL_FORM_SPRITE = {
    'Cornerstone Mask Ogerpon': 'cornerstone-mask-ogerpon.png',
    'Hearthflame Mask Ogerpon': 'hearthflame-mask-ogerpon.png',
    'Teal Mask Ogerpon': 'teal-mask-ogerpon.png',
    'Wellspring Mask Ogerpon': 'wellspring-mask-ogerpon.png',
    'Bloodmoon Ursaluna': 'bloodmoon-ursaluna.png',
    'Mega Venusaur ex': 'venusaur-mega.png',
    'Mega Charizard X ex': 'charizard-mega-x.png',
    'Mega Charizard Y ex': 'charizard-mega-y.png',
    'Mega Blastoise ex': 'blastoise-mega.png',
    'Mega Alakazam ex': 'alakazam-mega.png',
    'Mega Gengar ex': 'gengar-mega.png',
    'Mega Kangaskhan ex': 'kangaskhan-mega.png',
    'Mega Pinsir ex': 'pinsir-mega.png',
    'Mega Gyarados ex': 'gyarados-mega.png',
    'Mega Aerodactyl ex': 'aerodactyl-mega.png',
    'Mega Mewtwo X ex': 'mewtwo-mega-x.png',
    'Mega Mewtwo Y ex': 'mewtwo-mega-y.png',
    'Mega Ampharos ex': 'ampharos-mega.png',
    'Mega Scizor ex': 'scizor-mega.png',
    'Mega Heracross ex': 'heracross-mega.png',
    'Mega Houndoom ex': 'houndoom-mega.png',
    'Mega Tyranitar ex': 'tyranitar-mega.png',
    'Mega Blaziken ex': 'blaziken-mega.png',
    'Mega Gardevoir ex': 'gardevoir-mega.png',
    'Mega Mawile ex': 'mawile-mega.png',
    'Mega Aggron ex': 'aggron-mega.png',
    'Mega Medicham ex': 'medicham-mega.png',
    'Mega Manectric ex': 'manectric-mega.png',
    'Mega Banette ex': 'banette-mega.png',
    'Mega Absol ex': 'absol-mega.png',
    'Mega Latias ex': 'latias-mega.png',
    'Mega Latios ex': 'latios-mega.png',
    'Mega Garchomp ex': 'garchomp-mega.png',
    'Mega Lucario ex': 'lucario-mega.png',
    'Mega Abomasnow ex': 'abomasnow-mega.png',
    'Mega Beedrill ex': 'beedrill-mega.png',
    'Mega Pidgeot ex': 'pidgeot-mega.png',
    'Mega Slowbro ex': 'slowbro-mega.png',
    'Mega Steelix ex': 'steelix-mega.png',
    'Mega Sceptile ex': 'sceptile-mega.png',
    'Mega Swampert ex': 'swampert-mega.png',
    'Mega Sableye ex': 'sableye-mega.png',
    'Mega Sharpedo ex': 'sharpedo-mega.png',
    'Mega Camerupt ex': 'camerupt-mega.png',
    'Mega Altaria ex': 'altaria-mega.png',
    'Mega Glalie ex': 'glalie-mega.png',
    'Mega Salamence ex': 'salamence-mega.png',
    'Mega Metagross ex': 'metagross-mega.png',
    'Mega Rayquaza ex': 'rayquaza-mega.png',
    'Mega Lopunny ex': 'lopunny-mega.png',
    'Mega Gallade ex': 'gallade-mega.png',
    'Mega Audino ex': 'audino-mega.png',
    'Mega Diancie ex': 'diancie-mega.png',
    'Mega Clefable ex': 'clefable-mega.png',
    // 'Mega Victreebel ex': 'victreebel-mega.png',
    'Mega Starmie ex': 'starmie-mega.png',
    'Mega Dragonite ex': 'dragonite-mega.png',
    'Mega Meganium ex': 'meganium-mega.png',
    'Mega Feraligatr ex': 'feraligatr-mega.png',
    'Mega Skarmory ex': 'skarmory-mega.png',
    'Mega Froslass ex': 'froslass-mega.png',
    'Mega Emboar ex': 'emboar-mega.png',
    // 'Mega Excadrill ex': 'excadrill-mega.png',
    // 'Mega Scolipede ex': 'scolipede-mega.png',
    'Mega Scrafty ex': 'scrafty-mega.png',
    'Mega Eelektross ex': 'eelektross-mega.png',
    // 'Mega Chandelure ex': 'chandelure-mega.png',
    // 'Mega Chesnaught ex': 'chesnaught-mega.png',
    // 'Mega Delphox ex': 'delphox-mega.png',
    // 'Mega Greninja ex': 'greninja-mega.png',
    // 'Mega Pyroar ex': 'pyroar-mega.png',
    // 'Mega Floette ex': 'floette-mega.png',
    // 'Mega Malamar ex': 'malamar-mega.png',
    // 'Mega Barbaracle ex': 'barbaracle-mega.png',
    // 'Mega Dragalge ex': 'dragalge-mega.png',
    'Mega Hawlucha ex': 'hawlucha-mega.png',
    'Mega Zygarde ex': 'zygarde-mega.png',
    // 'Mega Drampa ex': 'drampa-mega.png',
    // 'Mega Falinks ex': 'falinks-mega.png',
    // 'Mega Raichu X ex': 'raichu-x-mega.png',
    // 'Mega Raichu Y ex': 'raichu-y-mega.png',
    // 'Mega Chimecho ex': 'chimecho-mega.png',
    // 'Mega Absol Z ex': 'absol-z-mega.png',
    // 'Mega Staraptor ex': 'staraptor-mega.png',
    // 'Mega Garchomp Z ex': 'garchomp-z-mega.png',
    // 'Mega Lucario Z ex': 'lucario-z-mega.png',
    // 'Mega Heatran ex': 'heatran-mega.png',
    // 'Mega Darkrai ex': 'darkrai-mega.png',
    // 'Mega Golurk ex': 'golurk-mega.png',
    // 'Mega Meowstic ex': 'meowstic-mega.png',
    // 'Mega Crabominable ex': 'crabominable-mega.png',
    // 'Mega Golisopod ex': 'golisopod-mega.png',
    // 'Mega Magearna ex': 'magearna-mega.png',
    // 'Mega Zeraora ex': 'zeraora-mega.png',
    // 'Mega Scovillain ex': 'scovillain-mega.png',
    // 'Mega Glimmora ex': 'glimmora-mega.png',
    // 'Mega Tatsugiri ex': 'tatsugiri-mega.png',
    // 'Mega Baxcalibur ex': 'baxcalibur-mega.png',
}

// We have specific, manually mantained sprites for some common alternate formes
export function getPokemonSpriteUrlForCard(card) {
    let selectedOverrideUrl = null;
    Object.keys(POKEMON_NAME_TO_MANUAL_FORM_SPRITE).forEach((override) => {
        if (card.name.toLowerCase().includes(override.toLowerCase())) {
            selectedOverrideUrl = 'manual_form_sprites/' + POKEMON_NAME_TO_MANUAL_FORM_SPRITE[override];
        }
    })

    if (selectedOverrideUrl != null) {
        return selectedOverrideUrl;
    } else {
        const nameForSpriteUrl = card.name_without_prefix_and_postfix.toLowerCase().replaceAll(' ', '-').replaceAll(/(\'|\.)/gi, '').replaceAll('é', 'e').replace('♀', 'f').replace('♂', 'm')
        return 'sprites/' + nameForSpriteUrl + '.png';
    }
}


function warmupSpriteURLs(cards) {
    cards.forEach(card => {
        if (card.supertype === 'Pokémon') {
            fetch(getPokemonSpriteUrlForCard(card));
        } else if (card.supertype === 'Trainer') {
            const spriteUrl = 'trainer-symbols/' + card.name.replaceAll(' ', '-').toLowerCase().replaceAll(/(\'|\.|:)/g, '') + '.png';
            fetch(spriteUrl);
        } else if (card.supertype === 'Energy') {
            let spriteUrl = TYPE_TO_ENERGY_SYMBOL_URL[card.name.replace(' Energy', '')];
            if (spriteUrl == null) {
                // special energy
                spriteUrl = 'special-energy-symbols/' + card.name.replaceAll(' ', '-').toLowerCase().replaceAll(/(\'|\.|:)/g, '') + '.png';
            }
            fetch(spriteUrl);
        }
    });
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

export const TYPE_TO_ENERGY_SYMBOL_URL = {
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

const TYPE_TO_TEXT_COLOR_PAIR = {
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


const TYPE_TO_HEADER_COLOR_PAIR = {
    'Grass': ['#145018', '#F5F5F5'],
    'Fire': ['#ba3200', '#F5F5F5'],
    'Water': ['#08306b', '#F5F5F5'],
    'Lightning': ['#7A5200', '#F5F5F5'],
    'Psychic': ['#7B1040', '#F5F5F5'],
    'Fighting': ['#5C381A', '#F5F5F5'],
    'Darkness': ['#23272B', '#F5F5F5'],
    'Metal': ['#212121', '#F5F5F5'],
    'Dragon': ['#7A5200', '#F5F5F5'],
    'Colorless': ['#222222', '#F5F5F5'],
}

// TODO: Remove the animated ones!
const playerSpriteFilenames = [
    '', // '(none)'
    'alder.png',
    'bianca.png',
    'blue.png',
    'brock.png',
    'cynthia.png',
    'erika.png',
    'giovanni.png',
    'hilbert.png',
    'hilda.png',
    'janine.png',
    'jasmine.png',
    'lucas.png',
    'misty.png',
    'nate.png',
    'red.png',
    'rosa.png',
    'steven.png',
    'volkner.png',
]

function processStringForPDFCompatibility(str) {
    return str;
}


function ExportModal({ undeletedCardData, cardDatabase, coverPokemon, setCoverPokemon, deckName, setDeckName, enableSaving, previousDecklistTimestamp, onClose }) {
    const [hasTriedDBWrite, setHasTriedDBWrite] = useState(false);
    const [modalOpenedTimestamp, setModalOpenedTimestamp] = useState(null);
    const decklistImageRef = useRef<HTMLDivElement>(null);
    const [canDownloadDecklistImage, setCanDownloadDecklistImage] = useState(false);
    const [isDownloadingDecklistImage, setIsDownloadingDecklistImage] = useState(false);

    useEffect(() => {
        if (modalOpenedTimestamp == null) {
            setModalOpenedTimestamp(Date.now());
        }
    }, [modalOpenedTimestamp, setModalOpenedTimestamp]);
    useEffect(() => {
        if (undeletedCardData.length) {
            warmupSpriteURLs(undeletedCardData.map(card => card.cardInfo));
        }
    }, [undeletedCardData]);

    const showAscendedHeroesWarning = useMemo(() => {
        // Don't show warning if it is March 6th 2026 or after
        const currentDate = new Date();
        const cutoffDate = new Date('2026-03-06T00:00:00Z');
        if (currentDate >= cutoffDate) {
            return false;
        }
        return undeletedCardData.some(({ cardInfo }) => {
            return (cardInfo.set_code === 'ASC' && cardInfo.supertype === 'Pokémon') ||
                ['Anthea & Concordea', 'Canari', 'Poké Pad', 'Thick Scale', 'Urbain', 'Waitress', 'Nighttime Mine', 'Light Ball', 'Team Rocket\'s Hypnotizer'].includes(cardInfo.name)
        });
    }, [undeletedCardData]);

    async function saveDecklistToStorage() {
        // Also save the user to storage
        await overWriteLatestPlayer({
            playerName,
            playerID,
            playerDOB,
            playerSpriteFile,
            ageDivision,
            lastUsedTimestamp: modalOpenedTimestamp
        });

        if (!enableSaving) {
            return;
        }
        const serializedDecklist = seralizeDecklist(undeletedCardData);
        await addDecklistToDB(modalOpenedTimestamp, deckName, serializedDecklist, pokemonNameToSpriteUrl[coverPokemon], coverPokemon, previousDecklistTimestamp);
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

    pokemon.sort((a, b) => {
        const card1 = cardDatabase[a[0]];
        const card2 = cardDatabase[b[0]];
        return (b[1] - a[1]) || card1.name.localeCompare(card2.name);
    });

    const pokemonNameToSpriteUrl = {};
    pokemon.forEach((pair) => {
        const card = cardDatabase[pair[0]];
        if (!pokemonNameToSpriteUrl[card.name_without_prefix_and_postfix]) {
            pokemonNameToSpriteUrl[card.name_without_prefix_and_postfix] = getPokemonSpriteUrlForCard(card);
        }
    });

    [trainers, energies].map(pairList => {
        pairList.sort((a, b) => {
            return (b[1] - a[1]) || a[0].localeCompare(b[0]);
        })
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

    const [clipboardButtonText, setClipboardButtonText] = useState('Copy to Clipboard');
    const pokemonText = `Pokémon: ${numPokemon}\n${pokemon.filter(row => row[1] > 0).map(row => {
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
                    setClipboardButtonText('Copy to Clipboard'), 1000)
            });
        await saveDecklistToStorage();
    }

    const [saveChangesButtonManuallyText, setSaveChangesButtonManuallyText] = useState(previousDecklistTimestamp == null ? 'Save to My Decks' : 'Save Changes');
    async function onSaveChangesManually() {
        await saveDecklistToStorage();
        setSaveChangesButtonManuallyText('Saved!');
        setTimeout(() =>
            setSaveChangesButtonManuallyText(previousDecklistTimestamp == null ? 'Save to My Decks' : 'Save Changes'), 1000);
    }

    const shareableUrl = `${window.location.origin}?decklist=${seralizeDecklist(undeletedCardData)}${coverPokemon.length > 0 ? ('&cover_pokemon=' + coverPokemon) : ''}${deckName.length > 0 ? ('&deck_name=' + deckName) : ''}`;
    const canshareUrl = window.location.href.indexOf('forceShareable') > -1 || (navigator.share && navigator.canShare && navigator.canShare({ url: shareableUrl }) && (shareableUrl.length < 2000));
    async function onShareUrl() {
        await saveDecklistToStorage();
        navigator.share({ url: shareableUrl });
    }

    const [playerName, setPlayerName] = useState('');
    const [playerID, setPlayerID] = useState('');
    const [playerDOB, setPlayerDOB] = useState();
    const [playerSpriteFile, setPlayerSpriteFile] = useState('');
    const [ageDivision, setAgeDivision] = useState('Masters Division');
    const [includePlayerInfoInPDF, setIncludePlayerInfoInPDF] = useState(true);


    useEffect(() => {
        async function populatePlayerInfoFromDB() {
            const latestPlayer = await getLatestPlayer();
            if (latestPlayer != null) {
                setPlayerName(latestPlayer.playerName);
                setPlayerID(latestPlayer.playerID);
                setPlayerDOB(latestPlayer.playerDOB);
                setPlayerSpriteFile(latestPlayer.playerSpriteFile ?? '');
                setAgeDivision(latestPlayer.ageDivision);
            }
        }
        populatePlayerInfoFromDB();
    }, [
        setPlayerName,
        setPlayerID,
        setPlayerDOB,
        setAgeDivision,
        getLatestPlayer
    ]);

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

    function onDownloadPDF() {
        setIsDownloadingPDF(true);
        setTimeout(async () => { // Wait a few ms for the UI to update before triggering pdf generation
            async function makeAndDownloadPDF() {
                await saveDecklistToStorage();
                const pokemonTable = pokemon.filter(row => row[1] > 0).map(row => {
                    const id = row[0];
                    const count = row[1];
                    const card = cardDatabase[id];
                    const nationalPokedexNumber = (card.national_pokedex_numbers ?? [])[0] ?? NAME_TO_POKEDEX_NUMBER_FALLBACK[card.name_without_prefix_and_postfix] ?? 0;
                    // const spriteUrl = 'sprites/' + nationalPokedexNumber + '.png';
                    // const energySymbolUrl = TYPE_TO_ENERGY_SYMBOL_URL[card.types[0]];
                    const spriteUrl = getPokemonSpriteUrlForCard(card);

                    return [count, processStringForPDFCompatibility(card['name']), getDisplaySetCode(card), maybeProcessGalleryCardNumber(card['number']), card['regulation_mark'], spriteUrl];
                }).concat([...Array(1)].map(_ => { return ['', '']; })); // add some buffer for writing in changes by hand

                const trainerTable = trainers.filter(row => row[1] > 0).map(row => {
                    const name = row[0];
                    const count = row[1];
                    return [count, processStringForPDFCompatibility(name)]
                });

                const energyTable = energies.filter(row => row[1] > 0).map(row => {
                    const name = row[0];
                    const count = row[1];
                    return [count, processStringForPDFCompatibility(name)]
                }).concat([...Array(1)].map(_ => { return ['', '']; })); // add some buffer for writing in changes by hand

                const doc = new jsPDF({ format: 'letter', compress: true, floatPrecision: 1 });

                const tableStyles = { cellPadding: 0.2 };
                const columnStyles = { 0: { cellWidth: 16 } };
                const headStyles = { fillColor: '#a9a9a9' };

                doc.setFontSize(16);
                const coverPokemonType = getCoverPokemonType(coverPokemon);
                const coverPokemonTextRGB = hexToRgb(TYPE_TO_TEXT_COLOR_PAIR[coverPokemonType][0]);
                doc.setTextColor(coverPokemonTextRGB.r, coverPokemonTextRGB.g, coverPokemonTextRGB.b);
                doc.setFont(undefined, 'bold').text(processStringForPDFCompatibility(deckName), 15, 10);
                doc.line(15, 12, 160, 12);

                doc.setTextColor(0, 0, 0);

                doc.setFontSize(8);
                const generatedText = `Generated by decklist.debkbanerji.com on ${new Date().toLocaleDateString()}`
                doc.setFont(undefined, 'normal').text(generatedText, 159.5 - doc.getTextWidth(generatedText), 10);

                doc.setFontSize(13);
                doc.setFont(undefined, 'bold').text('Player Name:', 15, 17).setFont(undefined, 'normal').text(includePlayerInfoInPDF ? playerName : '', 45, 17);
                if (playerSpriteFile != null && playerSpriteFile.length > 0 && includePlayerInfoInPDF) {
                    const playerSpriteImage = new Image();
                    playerSpriteImage.src = 'customization_sprites/' + playerSpriteFile;
                    doc.addImage(playerSpriteImage, 'png', 45.5 + doc.getTextWidth(playerName), 13, 5, 5);
                }
                doc.setFont(undefined, 'bold').text('Player ID:', 15, 22).setFont(undefined, 'normal').text(includePlayerInfoInPDF ? playerID : '', 37, 22);
                doc.setFont(undefined, 'bold').text('Date of Birth:', 15, 27).setFont(undefined, 'normal').text(includePlayerInfoInPDF ? playerDOB.toLocaleDateString() : '', 45, 27);
                doc.setFont(undefined, 'bold').text('Age Division:', 15, 32).setFont(undefined, 'normal').text(includePlayerInfoInPDF ? ageDivision : '', 45, 32);
                if (includePlayerInfoInPDF) {
                    const ageDivisionPokeballIcon = new Image();
                    ageDivisionPokeballIcon.src = 'customization_sprites/' + AGE_DIVISION_TO_POKE_BALL_FILE[ageDivision];
                    doc.addImage(ageDivisionPokeballIcon, 'png', 45.5 + doc.getTextWidth(ageDivision), 28.5, 4.5, 4.5);
                }
                doc.setFont(undefined, 'bold').text('Format:', 15, 37).setFont(undefined, 'normal').text(format, 33, 37);

                if (canshareUrl) {
                    const decklistQRObject = qrcode(0, 'M');
                    decklistQRObject.addData(shareableUrl);
                    decklistQRObject.make();
                    const decklistQRCodeImage = new Image();
                    decklistQRCodeImage.src = decklistQRObject.createDataURL(null, 0);
                    doc.addImage(decklistQRCodeImage, 'png', 161.5, 5, 40, 40);
                }


                doc.setFontSize(12);
                doc.text(`Pokemon: ${numPokemon}`, 14.5, 45);


                const didParseCell = (table) => {
                    if (table.section === 'head') {
                        // table.cell.styles.textColor = TYPE_TO_HEADER_COLOR_PAIR[coverPokemonType][1];
                        // table.cell.styles.fillColor = TYPE_TO_HEADER_COLOR_PAIR[coverPokemonType][0];
                    }
                };

                const autotableDefaultWidth = doc.internal.pageSize.getWidth() * 0.87;
                autoTable(doc, {
                    head: [['QTY', 'NAME', 'SET', 'COLL #', 'REG']],
                    body: pokemonTable,
                    styles: tableStyles,
                    columnStyles,
                    headStyles,
                    margin: { top: 47 },
                    tableWidth: autotableDefaultWidth,
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
                                    doc.addImage(img, 'png', data.cell.x - 2 - width, data.cell.y, width, height);
                                }
                            }
                        } catch (e) {
                            // do nothing
                        }
                    }
                });

                doc.text(`Trainer: ${numTrainers}`, 14.5, doc.lastAutoTable.finalY + 6);
                const targetYForTrainerTable = doc.lastAutoTable.finalY + 8;

                let trainerTablesDisplayData = [
                    { table: trainerTable, y: targetYForTrainerTable, width: autotableDefaultWidth, margin: null },
                ];
                if (trainerTable.length >= 16 && pokemonTable.length >= 12) {
                    // split the trainer table in two
                    trainerTablesDisplayData = [
                        {
                            table: trainerTable.slice(0, Math.ceil(trainerTable.length / 2)).concat([...Array(1)].map(_ => { return ['', '']; })), // add some buffer for writing in changes by hand,
                            y: targetYForTrainerTable,
                            margin: null,
                            width: autotableDefaultWidth * 0.48
                        },
                        {
                            table: trainerTable.slice(Math.ceil(trainerTable.length / 2)).concat([...Array(1)].map(_ => { return ['', '']; })), // add some buffer for writing in changes by hand,
                            y: targetYForTrainerTable,
                            margin: { left: autotableDefaultWidth * 0.595 },
                            width: autotableDefaultWidth * 0.48
                        },
                    ]
                }
                trainerTablesDisplayData.forEach(({ table, y, width, margin }) => {
                    autoTable(doc, {
                        head: [['QTY', 'NAME']],
                        body: table,
                        styles: tableStyles,
                        startY: y,
                        margin,
                        tableWidth: width,
                        columnStyles,
                        headStyles,
                        didParseCell,
                        didDrawCell: function (data) {
                            try {
                                if (data.column.index === 1 && data.row.section === 'body') {
                                    const spriteUrl = 'trainer-symbols/' + table[data.row.index][1].replaceAll(' ', '-').toLowerCase().replaceAll(/(\'|\.|:)/g, '') + '.png';
                                    const dim = data.cell.height - data.cell.padding('vertical');
                                    const textPos = data.cell.textPos;
                                    const img = new Image();
                                    const imgProps = doc.getImageProperties(spriteUrl);
                                    const height = dim * 0.9;
                                    const width = (imgProps.width * height) / imgProps.height;
                                    img.src = spriteUrl;
                                    doc.addImage(img, 'png', data.cell.x - 7.5, data.cell.y + dim * 0.1, width, height);
                                }
                            } catch (e) {
                                // do nothing
                            }
                        }
                    });
                });

                doc.text(`Energy: ${numEnergies}`, 14.5, doc.lastAutoTable.finalY + 8);
                autoTable(doc, {
                    head: [['QTY', 'NAME']],
                    body: energyTable,
                    styles: tableStyles,
                    startY: doc.lastAutoTable.finalY + 10,
                    columnStyles,
                    headStyles,
                    tableWidth: autotableDefaultWidth,
                    didParseCell,
                    didDrawCell: function (data) {
                        try {
                            if (data.column.index === 1 && data.row.section === 'body') {
                                let spriteUrl = TYPE_TO_ENERGY_SYMBOL_URL[energyTable[data.row.index][1].replace(' Energy', '')];
                                if (spriteUrl == null) {
                                    // special energy
                                    spriteUrl = 'special-energy-symbols/' + energyTable[data.row.index][1].replaceAll(' ', '-').toLowerCase().replaceAll(/(\'|\.|:)/g, '') + '.png';
                                }
                                const dim = data.cell.height - data.cell.padding('vertical');
                                const textPos = data.cell.textPos;
                                const img = new Image();
                                const imgProps = doc.getImageProperties(spriteUrl);
                                const height = dim;
                                const width = (imgProps.width * height) / imgProps.height;
                                img.src = spriteUrl;
                                doc.addImage(img, 'png', data.cell.x - 6, data.cell.y, width, height);
                            }
                        } catch (e) {
                            // do nothing
                        }
                    }
                });

                doc.setFont(undefined, 'normal').text(`Total Cards:  ${totalCount}`, 14.5, doc.lastAutoTable.finalY + 6)

                if (coverPokemon.length > 0) {
                    const coverPokemonImg = new Image();
                    const coverPokemonUrl = pokemonNameToSpriteUrl[coverPokemon];
                    if (coverPokemonUrl && coverPokemonUrl.length > 0) {
                        const imgProps = doc.getImageProperties(coverPokemonUrl);
                        const height = 6;
                        const width = (imgProps.width * height) / imgProps.height;
                        coverPokemonImg.src = coverPokemonUrl;
                        doc.setFontSize(16);
                        doc.setFont(undefined, 'bold')
                        doc.addImage(coverPokemonUrl, 'png', 17 + doc.getTextWidth(deckName), 5, width, height);

                        // Watermark the page
                        doc.setGState(new doc.GState({ opacity: 0.10 }));
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
            }
            await makeAndDownloadPDF();
        }, 30);
    }

    const [showQRCode, setShowQRCode] = useState(false);

    if (showQRCode) {
        return <div>
            <div className='modal-header-row'>
                <div>
                    <h2>List QR Code</h2>&nbsp;
                    <div onClick={onClose} className='modal-header-row-button'>
                    </div>
                </div>
            </div>
            <ReactQRCode
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "100%", marginTop: '12px' }}
                value={shareableUrl}
                viewBox={`0 0 256 256`}
            />
        </div>
    }

    return <div>
        <div className='modal-header-row'>
            <div>
                <h2>Export Decklist</h2>&nbsp;
                <div onClick={onClose} className='modal-header-row-button'>
                </div>
            </div>
        </div>
        {
            showAscendedHeroesWarning ?
                <div><b>⚠️ This decklist contains <a href='https://x.com/playpokemon/status/2016587353247404141' target='_blank'>Ascended Heroes</a> cards. Please ensure you follow current tournament rules regarding their use!</b></div>
                : null
        }
        {enableSaving ? <div className='storage-info'>
            When you export a decklist, it is also saved to your browser's local storage
        </div> : null}
        {enableSaving ? <div className='storage-info'>
            <button onClick={onSaveChangesManually}>{saveChangesButtonManuallyText}</button>
        </div> : null}
        <hr style={{ marginTop: 16 }} />
        <div ref={decklistImageRef} >
            <DecklistImage decklist={undeletedCardData.map(card => card.cardInfo)} cardDatabase={cardDatabase}
                onAllCardImagesLoaded={
                    () => {
                        setCanDownloadDecklistImage(true);
                    }
                }
            />
        </div>
        <br />
        {
            totalCountValid ?
                <>
                    <div><b className='warning-text'>Ensure the cards and counts are correct, </b>
                        <b className='error-text'>especially for Pokémon versions</b></div>
                    <br />
                    <b />
                    <div><b className='warning-text'>You are responsible for the correctness of your own decklist!</b></div>
                </> :
                <b>
                    <div><b className='error-text'>WARNING: Your list doesn't have exactly 60 cards</b></div>
                </b>
        }
        <hr />
        <h3>Deck Info</h3>
        <div className='export-pdf-field'>
            Cover Pokemon: <select onChange={e => setCoverPokemonWrapped(e.target.value)} value={coverPokemon}>
                <option value={''} key="unset">(none)</option>
                {Object.keys(pokemonNameToSpriteUrl).map(name =>
                    <option value={name} key={name}>{name}</option>
                )}
            </select>
            {coverPokemon != null && coverPokemon.length > 0 ? <img style={{ marginLeft: 5 }} src={pokemonNameToSpriteUrl[coverPokemon]}></img> : null}
        </div>
        <div className='export-pdf-field'>
            Deck Name: <input type="text" name='deck-name' onChange={e => setDeckName(e.target.value)} value={deckName} />
        </div>
        <hr />
        <h3>Player Info</h3>
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
        <div className='export-pdf-field' style={{
            display: 'flex', 'alignItems': 'center'
        }}>
            Player sprite: &nbsp;{
                playerSpriteFile === '' ? <Select
                    options={playerSpriteFilenames.map(sprite => { return { label: sprite, value: sprite }; })}
                    value={playerSpriteFile}
                    defaultValue={playerSpriteFile}
                    onChange={({ value }) => {
                        setPlayerSpriteFile(value);
                    }}
                    formatOptionLabel={sprite => {
                        if (sprite.value === '') {
                            return '(None)'
                        }
                        return <img src={"customization_sprites/" + sprite.value}></img>;
                    }}
                    placeholder="(none)"
                    className='sprite-selector'
                /> : <div>
                    <img src={"customization_sprites/" + playerSpriteFile}></img>&nbsp;
                    <button onClick={() => setPlayerSpriteFile('')}>✖</button>
                </div>
            }
        </div>
        <hr />
        <div>
            <h3>Export Options</h3>
            <div className='export-pdf-field'>
                Include player info in pdf
                <label className={`toggle-switch ${includePlayerInfoInPDF ? 'checked' : ''}`}>
                    <input
                        className="toggle-input"
                        type="checkbox"
                        checked={includePlayerInfoInPDF}
                        onChange={(e) => setIncludePlayerInfoInPDF((e.target as HTMLInputElement).checked)}
                        aria-label="Include player info in export"
                    />
                    <span className="toggle-track" aria-hidden="true">
                        <span className="toggle-knob" />
                    </span>
                </label>
            </div>
            <div className='share-buttons-row'>
                <button type="button" onClick={onDownloadPDF} disabled={(includePlayerInfoInPDF ? !(playerName && playerID && playerDOB) : false) || isDownloadingPDF}>
                    {isDownloadingPDF ? 'Generating...' : 'Download PDF'}
                </button>
                {canshareUrl ? <>
                    <button type="button" onClick={onShareUrl}>
                        Share Link
                    </button>
                    <button type="button" onClick={async () => {
                        await saveDecklistToStorage();
                        setShowQRCode(true);
                    }}>
                        View QR Code
                    </button>
                </> : null}
                <a href={emailLink} onClick={saveDecklistToStorage} target="_blank"><button type="button" disabled={!(playerName && playerID && playerDOB)}>
                    Email List
                </button></a>
                <button type="button" onClick={onCopyToClipboard}>
                    {clipboardButtonText}
                </button>
                <button type="button" disabled={!canDownloadDecklistImage || isDownloadingDecklistImage}
                    onClick={
                        () => {
                            setIsDownloadingDecklistImage(true);
                            toJpeg(decklistImageRef.current, { cacheBust: true, quality: 0.9 }) // without lowering the quality, the download fails on iOS for some reason
                                .then((dataUrl) => {
                                    const link = document.createElement('a')
                                    link.download = `${(deckName ?? 'decklist').replaceAll(' ', '-').replaceAll('/', '-')}.jpeg`;
                                    link.href = dataUrl;
                                    link.click();
                                    setIsDownloadingDecklistImage(false);
                                })
                                .catch((err) => {
                                    console.log(err);
                                    setIsDownloadingDecklistImage
                                })
                        }
                    }
                >
                    {isDownloadingDecklistImage ? 'Preparing...' : 'Download Image'}
                </button>
            </div>
            <div className='export-pdf-field'>
                Format: <select onChange={e => setFormat(e.target.value)} value={format}>
                    <option>Standard</option>
                    <option>Expanded</option>
                </select>
            </div>
        </div>
    </div >;
}

export default ExportModal;
