import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import './Scanner.css';
import CardImageForID from './CardImageForID.tsx';
import ExportModal from './ExportModal.tsx';
import Select, { components, OptionProps } from 'react-select';
import { createWorker, PSM } from 'tesseract.js';
import { motion, AnimatePresence } from "motion/react"
import DecklistImage from './DecklistImage.tsx';

const DETECTION_REPLACE_REGEX = /(é|')/i;
const TESSERACT_TICK_TIME = 70;

const EDGE_CASE_REGEXES = [
    [/(professor.*research)/i, 'Professor\'s Research'],
    [/(boss.*order)/i, 'Boss\'s Orders'],
    [/(professor turo)/i, 'Professor Turo\'s Scenario'],
    [/(professor sada)/i, 'Professor Sada\'s Vitality'],
    [/(ancient booster)/i, 'Ancient Booster Energy Capsule'],
    [/(future booster)/i, 'Future Booster Energy Capsule'],
    [/(ciphermaniac)/i, 'Ciphermaniac\'s Codebreaking'],
    [/(lono)/i, 'Iono']
]

function getCardTypeSortWeight(card) {
    if (card.supertype === 'Pokémon') {
        return 0;
    } else if (card.supertype === 'Trainer') {
        return 1;
    } else {
        return 2;
    }
}

function isCardSecretRare(card) {
    const number = parseInt(card.number) || 0;
    const setTotal = parseInt(card.set_printed_total) || 0;
    return setTotal > 1 && number > setTotal;
}

function doesCaseSensitiveTextContainEri(text) {
    // Hack to detect Eri
    // Eri is a common substring when the check is case sensitive
    // An uppercase 'E', however, is rare enough that we can use it to help us find Eri
    // while reducing the odds of false positives

    return text.includes('Eri');
}

const BASIC_ENERGY_INFO = [
    {
        name: 'Grass Energy',
        idSample: 'sve-9',
        iconUri: 'grass-energy-symbol.png'
    },
    {
        name: 'Fire Energy',
        idSample: 'sve-10',
        iconUri: 'fire-energy-symbol.png'
    },
    {
        name: 'Water Energy',
        idSample: 'sve-11',
        iconUri: 'water-energy-symbol.png'
    },
    {
        name: 'Lightning Energy',
        idSample: 'sve-12',
        iconUri: 'lightning-energy-symbol.png'
    },
    {
        name: 'Psychic Energy',
        idSample: 'sve-13',
        iconUri: 'psychic-energy-symbol.png'
    },
    {
        name: 'Fighting Energy',
        idSample: 'sve-14',
        iconUri: 'fighting-energy-symbol.png'
    },
    {
        name: 'Darkness Energy',
        idSample: 'sve-15',
        iconUri: 'darkness-energy-symbol.png'
    },
    {
        name: 'Metal Energy',
        idSample: 'sve-16',
        iconUri: 'metal-energy-symbol.png'
    },
]

const BASIC_ENERGY_NAMES = BASIC_ENERGY_INFO.map(energy => energy.name);


function contrastImage(imgData, contrast) {  //input range [-100..100]
    let d = imgData.data;
    contrast = (contrast / 100) + 1;  //convert to decimal & shift range: [0..2]
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < d.length; i += 4) {   //r,g,b,a
        d[i] = d[i] * contrast + intercept;
        d[i + 1] = d[i + 1] * contrast + intercept;
        d[i + 2] = d[i + 2] * contrast + intercept;
    }
    return imgData;
}

function adjustImageBrightness(imgData, brightnessFactor) {  //input range [-1..1]
    let d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {   //r,g,b,a
        d[i] = Math.min(Math.round(d[i] * brightnessFactor), 255);
        d[i + 1] = Math.min(Math.round(d[i + 1] * brightnessFactor), 255);
        d[i + 2] = Math.min(Math.round(d[i + 2] * brightnessFactor), 255);
    }
    return imgData;
}

function getThresholdedBlack(imgData, threshold) {
    let d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {   //r,g,b,a
        let avg = d[i] + d[i + 1] + d[i + 2];
        if (avg > threshold) {
            avg = 255; // blow out anything that's not super dark
        }
        d[i] = avg;
        d[i + 1] = avg;
        d[i + 2] = avg;
    }
    return imgData;
}

function greyscaleImage(imgData, contrast) {
    let d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {   //r,g,b,a
        const avg = d[i] + d[i + 1] + d[i + 2];
        d[i] = avg;
        d[i + 1] = avg;
        d[i + 2] = avg;
    }
    return imgData;
}

function normalizeImage(imgData, contrast) {
    let d = imgData.data;
    let min1 = 255;
    let min2 = 255;
    let min3 = 255;
    let max1 = 0;
    let max2 = 0;
    let max3 = 0;
    for (let i = 0; i < d.length; i += 4) {   //r,g,b,a
        const avg = d[i] + d[i + 1] + d[i + 2];
        min1 = Math.min(min1, d[i]);
        min2 = Math.min(min2, d[i + 1]);
        min3 = Math.min(min3, d[i + 2]);
        max1 = Math.max(max1, d[i]);
        max2 = Math.max(max2, d[i + 1]);
        max3 = Math.max(max3, d[i + 2]);
    }
    for (let i = 0; i < d.length; i += 4) {   //r,g,b,a
        d[i] = Math.floor((d[i] - min1) * 255 / (max1 - min1));
        d[i + 1] = Math.floor((d[i + 1] - min2) * 255 / (max2 - min2));;
        d[i + 2] = Math.floor((d[i + 1] - min3) * 255 / (max3 - min3));;
    }
    return imgData;
}

const tesseractWorker = await createWorker('eng', 1, {
    // logger: m => console.log(m),
});
await tesseractWorker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT
});

function getViewportOffsets(currentDetectedCardName, currentDetectedCardID) {
    if (currentDetectedCardName == null && currentDetectedCardID == null) {
        // Detecting title
        return {
            top: 0.43,
            height: 0.14,
            left: 0.1,
            width: 0.8
        }
    } else if (currentDetectedCardID == null) {
        // Detecting set info
        // return { // was using earlier, but let's try keeping it consistent instead
        //     top: 0.4,
        //     height: 0.2,
        //     left: 0.2,
        //     width: 0.6
        // }
        return {
            top: 0.43,
            height: 0.14,
            left: 0.1,
            width: 0.8
        }
    } else {
        return {
            top: 0,
            height: 1,
            left: 0,
            width: 1
        }
    }
}

function Scanner({ cardDatabase, startingDecklist, startingDeckName, startingCoverPokemon, startingDecklistTimestamp }) {
    const videoRef = useRef(null);
    const tesseractCanvasRef = useRef(null);
    // const tesseractDebugCanvasRef = useRef(null);
    const tesseractPreProcessingTypeNum = useRef(0);
    const exportModalRef = useRef(null);
    const [errorMessage, setErrorMessage] = useState(null);

    const [coverPokemon, setCoverPokemon] = useState(startingCoverPokemon);
    const [deckName, setDeckName] = useState(startingDeckName);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [showBasicEnergySelector, setShowBasicEnergySelector] = useState(false);

    const [cardInfoList, setCardInfoList] = useState(startingDecklist); // the result
    const latestCard = cardInfoList.length > 0 ? cardInfoList[cardInfoList.length - 1] : null;
    const cardInfoListNonNull = cardInfoList.filter(item => item != null).sort((a, b) => {
        let result = getCardTypeSortWeight(a) - getCardTypeSortWeight(b);
        if (result === 0) {
            result = b.count - a.count;
        }
        if (result === 0) {
            result = a.name.localeCompare(b.name);
        }
        return result;
    });
    const totalCards = cardInfoListNonNull.reduce((a, b) => a + (b.count), 0);

    const [currentDetectedCardName, setCurrentDetectedCardName] = useState(null);
    const [currentDetectedCardID, setCurrentDetectedCardID] = useState(null);
    const isRunningTesseractDetection = currentDetectedCardName == null && currentDetectedCardID == null;

    const [tesseractOutput, setTesseractOutput] = useState('');

    const {
        top: viewportTop,
        height: viewportHeight,
        left: viewportLeft,
        width: viewportWidth
    } = getViewportOffsets(currentDetectedCardName, currentDetectedCardID);

    const cardNameToIDs = useMemo(() => {
        const result = {};
        Object.keys(cardDatabase).forEach(id => {
            if (['A', 'B', 'C', 'D', 'E', 'F'].includes(cardDatabase[id].regulation_mark)) {
                // Don't allow for scanning of old regulation marks
                return;
            }
            const name = cardDatabase[id].name_without_prefix_and_postfix;
            result[name] = (result[name] ?? []).concat([id]);
        });
        for (const key of Object.keys(result)) {
            result[key].sort((a, b) => isCardSecretRare(cardDatabase[a]) - isCardSecretRare(cardDatabase[b]));
        }
        return result;
    }, [cardDatabase]);

    // keywordsToCardNames is a detection optimization
    // We try to detect unique keyword substrings that tell us if we've detected a certain card
    // ex: 'Research' within 'Professor\'s Reasearch'
    // This is designed to improve detection speed
    const keywordsToCardNames = useMemo(() => {
        const result = {};
        const cardNames = Object.keys(cardNameToIDs);
        cardNames.forEach(cardName => {
            result[cardName] = cardName; // each full card name should also map to itself
            // Assume that detection_keywords are the same given the same name
            cardDatabase[cardNameToIDs[cardName][0]].detection_keywords.forEach(keyword => {
                result[keyword] = cardName;
            });
        });
        return result;
    }, [cardNameToIDs, cardDatabase]);

    const candidateCardIDs = cardNameToIDs[currentDetectedCardName];

    const cardNames = Object.keys(cardNameToIDs);
    const detectionKeywords = Object.keys(keywordsToCardNames);
    const cardNameOptions = useMemo(() => cardNames.map(name => { return { label: name, value: name } }), [cardNameToIDs]);

    function setCardNameWrapped(cardName) {
        setShowBasicEnergySelector(false); // clear this
        setCurrentDetectedCardName(cardName);
        const cardSample = cardDatabase[cardNameToIDs[cardName][0]];
        if (cardSample?.supertype !== 'Pokémon') {
            // not a Pokemon - directly set card ID since art doesn't matter
            let cardID = cardSample.id;
            BASIC_ENERGY_INFO.forEach(energyInfo => {
                // if it's an energy card, replace it with an SCR sample
                if (energyInfo.name === cardName) {
                    cardID = energyInfo.idSample;
                }
            });
            setCurrentDetectedCardID(cardID);
        }
    }

    useEffect(() => {
        window.addEventListener("click", function (event) {
            // close modal contents if background is clicked
            if (event.target === exportModalRef.current) {
                setIsExportModalOpen(false);
            }
        });
    },
        [exportModalRef, setIsExportModalOpen]);


    useEffect(() => {
        if (videoRef != null) {
            const video = videoRef.current;
            video.setAttribute('autoplay', '');
            video.setAttribute('muted', '');
            video.setAttribute('playsinline', '');

            navigator.mediaDevices
                .getUserMedia({
                    'audio': false,
                    'video': {
                        facingMode: 'environment',
                    },
                })
                .then((stream) => {
                    video.srcObject = stream;
                    video.onloadedmetadata = function (e) {
                        const isLandscape = video.videoHeight < video.videoWidth;
                        if (isLandscape) { // because some mobile devices are dumb, we need to reverse stuff
                            navigator.mediaDevices
                                .getUserMedia({
                                    'audio': false,
                                    'video': {
                                        facingMode: 'environment',
                                        // reverse height/width because the OS was not kind the first time
                                    },
                                })
                                .then((stream) => {
                                    video.srcObject = stream;
                                    video.onloadedmetadata = function (e) {
                                        video.play();
                                        requestAnimationFrame(tesseractTick);
                                    };
                                })
                                .catch((err) => {
                                    setErrorMessage(`An error occurred: ${err}`);
                                    console.error(`An error occurred: ${err}`);
                                });
                        } else {
                            video.play();
                            requestAnimationFrame(tesseractTick);
                        }
                    };
                })
                .catch((err) => {
                    setErrorMessage(`An error occurred: ${err}`);
                    console.error(`An error occurred: ${err}`);
                });
        }
    }, [videoRef]);

    // listen to changes to the tesseract output
    useEffect(() => {
        const lowercaseText = tesseractOutput.toLocaleLowerCase().replace(DETECTION_REPLACE_REGEX, '');

        if (lowercaseText.includes('energy') && currentDetectedCardName == null) {
            setShowBasicEnergySelector(true);
        }

        if (currentDetectedCardName == null) {
            // trying to detect the card name
            let validCardNames = [];

            detectionKeywords.forEach(keyword => {
                if (lowercaseText.includes(
                    keyword.toLocaleLowerCase().replace(DETECTION_REPLACE_REGEX, '')
                )) {
                    validCardNames.push(keywordsToCardNames[keyword]);
                }
            });
            EDGE_CASE_REGEXES.forEach(edgeCase => {
                if (edgeCase[0].test(lowercaseText)) {
                    validCardNames.push(edgeCase[1]);
                }
            })
            validCardNames.sort((a, b) => b.length - a.length); // longest first
            validCardNames = validCardNames.filter(name => name.toLocaleLowerCase() !== 'eri'); // Sorry Eri, you're just a frequent false positive :(

            // Manually add back Eri through a case sensitive check
            // It's the only card of name length 3 we recognize
            if (doesCaseSensitiveTextContainEri(tesseractOutput)) {
                validCardNames.push('Eri')
            }
            if (validCardNames.length > 0) {
                // test against the latest scanned card
                // if the latest scanned card is not a pokemon, and its name matches this one, don't scan again
                // this protects against accident duplicate scans of trainer cards
                if (latestCard == null || (latestCard.supertype === 'Pokémon' || latestCard.name !== validCardNames[0])) {
                    // We also clear the energy selector within the function below
                    setCardNameWrapped(validCardNames[0]);
                }
            }
        } else if (currentDetectedCardID == null) {
            // trying to detect the set number
            candidateCardIDs.forEach(id => {
                const card = cardDatabase[id];
                const { number, set_printed_total, set_code, hp } = card;
                const includeSetNameInString = /[a-zA-Z]+/.test(number) || ['PR', 'SVP'].includes(set_code);
                if (includeSetNameInString && hp === number) {
                    // Weird edge case - for a promo Squawkabilly, the card's hp is exactly equal to it's promo number
                    // Return immediately to prevent a false detection - the user will have to select it manually :(includeSetNameInString
                    return;
                }
                const setInfoRegex = new RegExp('.*' + (includeSetNameInString ? `${number}` : `${number}.*${set_printed_total}`) + '.*', 'gi');
                if (lowercaseText.match(setInfoRegex)) {
                    setShowBasicEnergySelector(false); // clear this
                    setCurrentDetectedCardID(id);
                }
            });
        }
    }, [
        tesseractOutput,
        currentDetectedCardID,
        setCurrentDetectedCardID,
        currentDetectedCardName,
        setCurrentDetectedCardName,
        detectionKeywords,
        keywordsToCardNames,
        cardNames,
        cardNameToIDs,
        latestCard
    ]);

    async function tesseractTick() {
        const canvas = tesseractCanvasRef.current;
        const video = videoRef.current;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const targetWidth = video.videoWidth * viewportWidth;
        const targetHeight = video.videoHeight * viewportHeight;
        canvas.width = 512;
        canvas.height = canvas.width * targetHeight / targetWidth;
        context.drawImage(video,
            video.videoWidth * viewportLeft, video.videoHeight * viewportTop,
            targetWidth, targetHeight,
            0, 0,
            canvas.width, canvas.height);

        // const debugCanvas = tesseractDebugCanvasRef.current;
        // const debugContext = debugCanvas.getContext("2d", { willReadFrequently: true });
        // debugCanvas.width = canvas.width;
        // debugCanvas.height = canvas.height;


        setTimeout(async () => {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            let pixels = normalizeImage(imageData, 100);

            // depending on the value of tesseractPreProcessingTypeNum, apply a different type of preprocessing
            // This lets us hedge our bets and increase the chance of detecting something
            if (tesseractPreProcessingTypeNum.current === 1) {
                pixels = contrastImage(pixels, 100);
            } else if (tesseractPreProcessingTypeNum.current === 2) {
                pixels = getThresholdedBlack(pixels,200);
            } else {
                // tesseractPreProcessingTypeNum.current = 0
                // Do nothing
            }
            tesseractPreProcessingTypeNum.current = (tesseractPreProcessingTypeNum.current + 1) % 3
            context.putImageData(pixels, 0, 0);
            // debugContext.putImageData(pixels, 0, 0);

            setTimeout(async () => {
                const imageUrl = canvas.toDataURL("image/png");

                const { data: { text } } = await tesseractWorker.recognize(imageUrl);
                setTesseractOutput(text);

                requestAnimationFrame(tesseractTick);
            }, TESSERACT_TICK_TIME);
        }, TESSERACT_TICK_TIME);
    }

    const addCard = (cardInfo, count) => {
        setShowBasicEnergySelector(false); // clear this

        const existingCardInfoIndex = cardInfoList.findIndex(existingCard => existingCard?.id === cardInfo.id);

        if (existingCardInfoIndex < 0) { // add a new card
            const augmentedCardInfo = {
                count,
                ...cardInfo,
                originalIndex: cardInfoList.length, // track this for easier deletions
            };
            setCardInfoList(cardInfoList.concat([augmentedCardInfo]));
        } else {
            setCardInfoList(cardInfoList.map((info, index) => {
                if (index === existingCardInfoIndex) {
                    info.count = info.count + count;
                }
                return info;
            }))
        }
        setCurrentDetectedCardID(null);
        setCurrentDetectedCardName(null);
    }

    const cancelScan = () => {
        setShowBasicEnergySelector(false); // clear this
        if (currentDetectedCardID != null) {
            if (cardDatabase[currentDetectedCardID].supertype !== 'Pokémon') {
                // not a Pokemon - clear out the name too
                setCurrentDetectedCardName(null);
            }
            setCurrentDetectedCardID(null);
        } else if (currentDetectedCardName != null) {
            setCurrentDetectedCardName(null);
        }
    }

    return <div>
        <div className="subtitle">
            <small>
                <span>Made with ♥</span>&nbsp;&nbsp;&bull;&nbsp;&nbsp;
                <a href="https://github.com/debkbanerji/pokemon-decklist-detector" target="_blank">Source Code</a>&nbsp;&nbsp;&bull;&nbsp;&nbsp;
                <a href="https://github.com/debkbanerji#contact-me" target="_blank">Contact</a>
            </small>
        </div>
        <div>{errorMessage} </div>
        <canvas ref={tesseractCanvasRef} hidden></canvas>

        <motion.div className="video-feed-container" >
            <video className="video-feed" ref={videoRef}>Video stream not available.</video>
            {
                currentDetectedCardName != null && currentDetectedCardID == null ?
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className='detected-card-name'>
                        <button onClick={cancelScan} className='cancel-scan-button'>&#10006;</button>
                        {currentDetectedCardName}
                    </motion.div> :
                    null
            }
            <div className="video-feed-viewport" style={{
                top: (viewportTop * 100) + '%',
                height: (viewportHeight * 100) + '%',
                left: (viewportLeft * 100) + '%',
                width: (viewportWidth * 100) + '%',
            }
            }></div>
            <div className='video-feed-instructions'>{
                currentDetectedCardName == null ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key="card-name-scan-instruction" >Scan the card name</motion.div> : (
                    currentDetectedCardID == null ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key="set-number-scan-instruction" >Scan the set number</motion.div> : null
                )
            }</div>
            <div className='video-feed-sub-instructions'>{
                currentDetectedCardID == null ? 'Hold the text within the box' : null
            }</div>
            <div className='video-feed-lighting-instructions'>{
                currentDetectedCardID == null ? <div>
                    Avoid shadows if possible!
                    <br />Well lit cards lead to easier scanning
                </div> : null
            }</div>
            {
                currentDetectedCardID == null && showBasicEnergySelector ? <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className='video-feed-basic-energy-selector'>
                    <button onClick={() => setShowBasicEnergySelector(false)} className='cancel-scan-button'>&#10006;</button>
                    &nbsp;
                    Is this basic energy?
                    <br />
                    {BASIC_ENERGY_INFO.map(energyInfo => {
                        const onClick = () => {
                            setCurrentDetectedCardName(energyInfo.name);
                            setCurrentDetectedCardID(energyInfo.idSample);
                        }
                        return <img key={energyInfo.name} onClick={onClick} src={energyInfo.iconUri} width={30} height={30}></img>
                    })}
                </motion.div> : null
            }
            {currentDetectedCardID != null ? <div className='detected-card-in-feed filter-blur'>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    {cardDatabase[currentDetectedCardID].supertype === 'Pokémon' ?
                        <>
                            {cardDatabase[currentDetectedCardID].set_code}&nbsp;
                            {cardDatabase[currentDetectedCardID].number}
                        </> : null}
                    <br />
                    <CardImageForID id={currentDetectedCardID} />
                </motion.div>
            </div> : null
            }
            {currentDetectedCardID != null ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className='card-count-selector'>
                <div className='card-count-selector-instructions'>
                    <button onClick={cancelScan} className='cancel-scan-button'>&#10006;</button>
                    &nbsp;
                    <div>How many?</div>
                </div>
                <div className={BASIC_ENERGY_NAMES.includes(currentDetectedCardName)
                    ? 'card-count-selector-buttons-energy' : 'card-count-selector-buttons-4'}>
                    {
                        Array.from(Array(
                            BASIC_ENERGY_NAMES.includes(currentDetectedCardName) ? 30 : 4
                        ).keys()).map(countMinusOne => {
                            const count = countMinusOne + 1;
                            const onClick = () => {
                                addCard(cardDatabase[currentDetectedCardID], count);
                            }
                            return <button key={count} onClick={onClick}>{count}</button>
                        })
                    }
                </div>
            </motion.div> : null
            }
        </motion.div>
        <div className="progress-bar">
            <motion.div layout className={totalCards === 60 ? 'progress-bar-green' : 'progress-bar-blue'}
                style={{ 'width': `${100 * Math.min(totalCards, 60) / 60}%` }}
            >
            </motion.div>
        </div>
        {/* <canvas ref={tesseractDebugCanvasRef}></canvas> */}

        {candidateCardIDs != null && currentDetectedCardID == null ? <div>
            <h3> Or, select the art directly:</h3>
            <div className='candidate-card-ids'>
                {candidateCardIDs.map((id, index) => {
                    return <div onClick={() => {
                        setCurrentDetectedCardID(id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} key={id}>
                        <motion.div
                            initial={{ opacity: 0, x: -400, scale: 0.5 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 200, scale: 1.2 }}
                            transition={{ duration: 0.6, type: "spring", delay: 0.03 * index }}
                        >
                            <CardImageForID id={id} />
                        </motion.div>
                    </div>
                })}
            </div>
        </div> : null}
        {
            currentDetectedCardName == null ? <div className='card-name-selector-container'>
                <div className='select-name-manually-instructions'>
                    Scanning can be imperfect! Please make sure you have the right card before proceeding
                </div>
                <Select
                    options={cardNameOptions}
                    defaultValue={null}
                    onChange={({ value }) => {
                        setCardNameWrapped(value);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    name={'manual-name-selector'}
                    className="name-selector"
                    placeholder="Name not scanning? Select it manually"
                />
            </div> : null
        }
        <hr />
        <button onClick={() => {
            setIsExportModalOpen(true);
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        }} className={'export-modal-open-button' + (totalCards === 60 ? ' export-modal-open-button-success' : '')} disabled={totalCards != 60 && false}>Export / Save</button>
        <h3>Scanned Cards: {totalCards}</h3>
        {totalCards > 0 ?
            <div>
                <DecklistImage decklist={cardInfoListNonNull} cardDatabase={cardDatabase} />
                <h4 style={{ marginBottom: 7, marginTop: 14 }}>Edit</h4>
            </div> : null
        }
        <div className='scans-feed'>
            <motion.div>
                {cardInfoListNonNull.map((cardInfo, index) => {
                    const { id, name, number, set_code, set_id, set_name, name_without_prefix_and_postfix, supertype, count, originalIndex } = cardInfo;

                    const deleteCard = () => {
                        setCardInfoList(cardInfoList.map((item, index) => {
                            return index === originalIndex ? null : item
                        }));
                    }

                    const increaseCardCount = () => {
                        setCardInfoList(cardInfoList.map((item, index) => {
                            if (index === originalIndex) {
                                item.count = item.count + 1;
                            }
                            return item;
                        }));
                    }

                    const decreaseCardCount = () => {
                        setCardInfoList(cardInfoList.map((item, index) => {
                            if (index === originalIndex) {
                                item.count = item.count - 1;
                                if (item.count === 0) {
                                    item = null;
                                }
                            }
                            return item;
                        }));
                    }


                    return <motion.div
                        layout="position"
                        key={id} // uhhh... hope for no duplicate ids - that will mess up animations, but logic should still be fine
                        className="scan-row"
                        initial={{ opacity: 0, x: -400, scale: 0.5 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 200, scale: 1.2 }}
                        transition={{ duration: 0.6, type: "spring" }}>
                        <div className='scan-row-image'>
                            <CardImageForID id={id} />
                        </div>
                        <div className='scan-row-input'>
                            <div>{name}</div>
                            {supertype === 'Pokémon' ?
                                <div>
                                    <div className='set-info'><b>{set_code}</b> {number}</div>
                                </div> : null}
                            <div className='update-count-row'>
                                <span>
                                    <button onClick={deleteCard} className='update-count-button'>&#128465;</button>
                                    <button onClick={decreaseCardCount} disabled={count <= 1} className='update-count-button'>-</button>
                                    <button onClick={increaseCardCount} disabled={count >= 4 && !BASIC_ENERGY_NAMES.includes(name)} className='update-count-button'>+</button>
                                </span>
                                <div><b>{count}&times;</b></div>
                            </div>
                        </div>
                    </motion.div>
                })}
            </motion.div></div>

        {
            isExportModalOpen ?
                <div ref={exportModalRef} className="export-modal">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <div className="export-modal-content">
                            <ExportModal cardDatabase={cardDatabase}
                                undeletedCardData={cardInfoListNonNull.map(cardInfo => { return { cardInfo } })}
                                coverPokemon={coverPokemon}
                                setCoverPokemon={setCoverPokemon}
                                deckName={deckName}
                                setDeckName={setDeckName}
                                enableSaving={true}
                                previousDecklistTimestamp={startingDecklistTimestamp}
                                onClose={() => setIsExportModalOpen(false)}
                            />
                        </div>
                    </motion.div>
                </div> : null
        }
    </div >;
}

export default Scanner
