import { useState, useRef, useEffect, useMemo } from 'react'
import './DecklistCreator.css';
import CardImageForID from './CardImageForID.tsx';
import ExportModal from './ExportModal.tsx';
import { addDecklistToDB, seralizeDecklist } from './StorageManager';
import Select, { components } from 'react-select';
import { createWorker, PSM, OEM } from 'tesseract.js';
import { motion, AnimatePresence } from "motion/react"
import DecklistImage from './DecklistImage.tsx';
import { getPokemonSpriteUrlForCard } from './ExportModal.tsx';
import { MdCameraAlt, MdIosShare, MdOutlineDelete, MdOutlineSave, MdOutlineSwapHoriz, MdSearch } from "react-icons/md";
import { sortDecklistCards } from './DecklistSort.ts';

const DETECTION_REPLACE_REGEX = /(é|')/i;

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

function SearchDropdownIndicator(props) {
    return <components.DropdownIndicator {...props}>
        <MdSearch />
    </components.DropdownIndicator>
}


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
    tessedit_ocr_engine_mode: OEM.TESSERACT_LSTM_COMBINED
});
await tesseractWorker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
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

function DecklistCreator({ cardDatabase, startingDecklist, startingDeckName, startingCoverPokemon, startingDecklistTimestamp, scrollToTop }) {
    const videoRef = useRef(null);
    const tesseractCanvasRef = useRef(null);
    // const tesseractDebugCanvasRef = useRef(null);
    const tesseractPreProcessingTypeNum = useRef(0);
    const exportModalRef = useRef(null);
    const [errorMessage, setErrorMessage] = useState(null);

    const [coverPokemon, setCoverPokemon] = useState(startingCoverPokemon);
    const [deckName, setDeckName] = useState(startingDeckName);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isArtSwapModalOpen, setIsArtSwapModalOpen] = useState(false);
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [artSwapSourceOriginalIndex, setArtSwapSourceOriginalIndex] = useState(null);
    const [showBasicEnergySelector, setShowBasicEnergySelector] = useState(false);
    const [saveChangesButtonText, setSaveChangesButtonText] = useState('Save Changes');
    const [lastSavedDecklistTimestamp, setLastSavedDecklistTimestamp] = useState(startingDecklistTimestamp);

    const [cardInfoList, setCardInfoList] = useState(startingDecklist); // the result
    const latestCard = cardInfoList.length > 0 ? cardInfoList[cardInfoList.length - 1] : null;
    const cardInfoListNonNull = sortDecklistCards(cardInfoList.filter(item => item != null), cardDatabase);
    const totalCards = cardInfoListNonNull.reduce((a, b) => a + (b.count), 0);

    const [currentDetectedCardName, setCurrentDetectedCardName] = useState(null);
    const [currentDetectedCardID, setCurrentDetectedCardID] = useState(null);
    const isRunningTesseractDetection = currentDetectedCardName == null && currentDetectedCardID == null;
    const numSimilarCards = ((cardDatabase[currentDetectedCardID] ?? {}).similar_card_ids ?? []).length;

    const isCurrentlyDetectedCardPokemon = currentDetectedCardID != null && cardDatabase[currentDetectedCardID]?.supertype === 'Pokémon';
    const currentDetectedCardIDCount = currentDetectedCardID != null ? cardInfoListNonNull.filter(
        cardInfo => isCurrentlyDetectedCardPokemon ?
            cardInfo.id === currentDetectedCardID : cardInfo.name === currentDetectedCardName)
        .reduce((a, b) => a + b.count, 0) : 0;

    const [successfullyAddedCardText, setSuccessfullyAddedCardText] = useState(null);

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
            if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(cardDatabase[id].regulation_mark)) {
                // Don't allow for scanning of old regulation marks
                return;
            }
            const name = cardDatabase[id].name_without_prefix_and_postfix;
            result[name] = (result[name] ?? []).concat([id]);
        });
        for (const key of Object.keys(result)) {
            // first, put longer IDs at the end so we check against this last when scanning and overwrite
            // i.e. prefer the longer match
            result[key].sort((a, b) => a.length - b.length);

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
    const mechanicallyIdenticalCardIDsByHash = useMemo(() => {
        const result = {};
        Object.values(cardDatabase).forEach(card => {
            if (card?.supertype !== 'Pokémon') {
                return;
            }

            const mechanicsKey = card.cardMechanicsHash;
            if (mechanicsKey == null) {
                return;
            }

            result[mechanicsKey] = (result[mechanicsKey] ?? []).concat(card.id);
        });

        Object.keys(result).forEach(key => {
            result[key].sort((a, b) => {
                const cardA = cardDatabase[a];
                const cardB = cardDatabase[b];
                return (cardA.set_code ?? '').localeCompare(cardB.set_code ?? '')
                    || (cardA.number ?? '').localeCompare(cardB.number ?? '')
                    || a.localeCompare(b);
            });
        });

        return result;
    }, [cardDatabase]);

    function getCoverPokemonSpriteUrl() {
        if (!coverPokemon) {
            return '';
        }

        const coverPokemonCard = Object.values(cardDatabase).find(card => card.name_without_prefix_and_postfix === coverPokemon);
        return coverPokemonCard != null ? getPokemonSpriteUrlForCard(coverPokemonCard) : '';
    }

    async function saveChanges() {
        setSaveChangesButtonText('Saving...');
        const saveTimestamp = Date.now();
        await addDecklistToDB(
            saveTimestamp,
            deckName,
            seralizeDecklist(cardInfoListNonNull.map(cardInfo => ({ cardInfo }))),
            getCoverPokemonSpriteUrl(),
            coverPokemon,
            lastSavedDecklistTimestamp
        );
        setLastSavedDecklistTimestamp(saveTimestamp);
        setSaveChangesButtonText('Saved!');
        setTimeout(() => {
            setSaveChangesButtonText('Save Changes');
        }, 1000);
    }

    function setCardNameWrapped(cardName) {
        setShowBasicEnergySelector(false); // clear this
        setCurrentDetectedCardName(cardName);
        scrollToTop();
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
            scrollToTop();
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
        if (totalCards <= 0) {
            return;
        }

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = 'Changes you made may not be saved.';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [totalCards]);


    useEffect(() => {
        if (!isScannerActive) {
            return;
        }

        setErrorMessage(null);

        const video = videoRef.current;
        if (video == null) {
            return;
        }

        let cancelled = false;
        let activeStream = null;

        const attachStream = (stream) => {
            if (cancelled) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            activeStream = stream;
            video.srcObject = stream;
            video.onloadedmetadata = function () {
                if (cancelled) {
                    return;
                }

                const isLandscape = video.videoHeight < video.videoWidth;
                if (isLandscape) {
                    navigator.mediaDevices
                        .getUserMedia({
                            audio: false,
                            video: {
                                facingMode: 'environment',
                            },
                        })
                        .then((replacementStream) => {
                            if (cancelled) {
                                replacementStream.getTracks().forEach(track => track.stop());
                                return;
                            }

                            if (activeStream != null) {
                                activeStream.getTracks().forEach(track => track.stop());
                            }
                            activeStream = replacementStream;
                            video.srcObject = replacementStream;
                            video.onloadedmetadata = function () {
                                if (cancelled) {
                                    return;
                                }
                                video.play();
                                requestAnimationFrame(() => tesseractTick(() => !cancelled));
                            };
                        })
                        .catch((err) => {
                            setErrorMessage('Could not access device camera');
                            setIsScannerActive(false);
                            console.error(`An error occurred: ${err}`);
                        });
                } else {
                    video.play();
                    requestAnimationFrame(() => tesseractTick(() => !cancelled));
                }
            };
        };

        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');

        navigator.mediaDevices
            .getUserMedia({
                audio: false,
                video: {
                    facingMode: 'environment',
                },
            })
            .then(attachStream)
            .catch((err) => {
                setErrorMessage('Could not access device camera');
                setIsScannerActive(false);
                console.error(`An error occurred: ${err}`);
            });

        return () => {
            cancelled = true;
            video.pause();
            video.srcObject = null;
            if (activeStream != null) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isScannerActive]);

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
                    scrollToTop();
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


    const [pressureData, setPressureData] = useState(null);

    useEffect(() => {
        if ('PressureObserver' in window) {
            const observer = new PressureObserver((records) => {
                for (const record of records) {
                    if (record.source === 'cpu') {
                        setPressureData(record);
                    }
                }
            });

            observer.observe('cpu', {
                sampleInterval: 3000, // ms
            }).catch((err) => {
                console.error('Failed to observe CPU pressure:', err);
            });

            return () => {
                observer.disconnect();
            };
        } else {
            console.warn('PressureObserver is not supported in this browser.');
        }
    }, []);

    const tesseractTickrateRef = useRef(70); // in ms - this is the default

    useEffect(() => {
        // dynamically reduce tesseract tick rate to save CPU if we're not actively searching for something
        // if we have cpu pressure data, and the system is behaving normally, go with a higher tick rate
        if (!isScannerActive || currentDetectedCardID != null || totalCards >= 60) {
            // scan not required
            tesseractTickrateRef.current = 500;
        } else if (pressureData?.state === 'nominal' || pressureData?.state === 'fair') {
            // we have access to pressure data, and the CPU is behaving fine
            // go with a higher tick rate
            tesseractTickrateRef.current = 7;
        } else {
            tesseractTickrateRef.current = 70;
        }
    }, [isScannerActive, currentDetectedCardID, totalCards, tesseractTickrateRef, pressureData]);

    async function tesseractTick(shouldContinue = () => true) {
        if (!shouldContinue()) {
            return;
        }

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
                pixels = getThresholdedBlack(pixels, 200);
            } else {
                // tesseractPreProcessingTypeNum.current = 0
                // Do nothing
            }
            tesseractPreProcessingTypeNum.current = (tesseractPreProcessingTypeNum.current + 1) % 3
            context.putImageData(pixels, 0, 0);
            // debugContext.putImageData(pixels, 0, 0);

            setTimeout(async () => {
                if (!shouldContinue()) {
                    return;
                }
                const imageUrl = canvas.toDataURL("image/png");

                const { data: { text } } = await tesseractWorker.recognize(imageUrl, { rotateAuto: true });
                setTesseractOutput(text);

                if (shouldContinue()) {
                    requestAnimationFrame(() => tesseractTick(shouldContinue));
                }
            }, tesseractTickrateRef.current);
        }, tesseractTickrateRef.current);
    }

    const addCard = (cardInfo, count) => {
        setShowBasicEnergySelector(false); // clear this
        scrollToTop();

        // if the card is a pokemon, match by id
        // else, match by card name
        const existingCardInfoIndex = cardInfoList.findIndex(existingCard =>
            cardInfo?.supertype === 'Pokémon' ?
                existingCard?.id === cardInfo.id
                : existingCard?.name === cardInfo.name
        );

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
        if (cardInfo.supertype === 'Pokémon') {
            setSuccessfullyAddedCardText(`Added ${count}x ${cardInfo.name} ${cardInfo.set_code} ${cardInfo.number}`);
        } else {
            setSuccessfullyAddedCardText(`Added ${count}x ${cardInfo.name}`);
        }
        setTimeout(() => {
            setSuccessfullyAddedCardText(null);
        }, 1300);
    }

    const swapCardArt = (sourceOriginalIndex, targetCardID) => {
        const targetCard = cardDatabase[targetCardID];
        if (targetCard == null || targetCard.supertype !== 'Pokémon') {
            return;
        }

        setCardInfoList(previousCardInfoList => {
            const nextCardInfoList = [...previousCardInfoList];
            const sourceCardInfo = nextCardInfoList[sourceOriginalIndex];
            if (sourceCardInfo == null || sourceCardInfo.id === targetCardID) {
                return previousCardInfoList;
            }

            const existingTargetIndex = nextCardInfoList.findIndex((item, index) => index !== sourceOriginalIndex && item != null && item.id === targetCardID);
            if (existingTargetIndex >= 0) {
                nextCardInfoList[existingTargetIndex] = {
                    ...nextCardInfoList[existingTargetIndex],
                    count: nextCardInfoList[existingTargetIndex].count + sourceCardInfo.count,
                };
                nextCardInfoList[sourceOriginalIndex] = null;
            } else {
                nextCardInfoList[sourceOriginalIndex] = {
                    ...sourceCardInfo,
                    ...targetCard,
                    count: sourceCardInfo.count,
                    originalIndex: sourceCardInfo.originalIndex,
                };
            }

            return nextCardInfoList;
        });

        setIsArtSwapModalOpen(false);
        setArtSwapSourceOriginalIndex(null);
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

    const creatorStageClass = 'video-feed-container-active';
    const countButtons = currentDetectedCardID != null ? Array.from(Array(
        BASIC_ENERGY_NAMES.includes(currentDetectedCardName) ? 30 : 4
    ).keys()).map(countMinusOne => countMinusOne + 1) : [];

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

        {!isScannerActive && currentDetectedCardID == null ? <button onClick={() => setIsScannerActive(true)} className='scanner-activate-button scanner-activate-button-top'>
            <MdCameraAlt className='scanner-activate-button-icon' /> Use Scanner
        </button> : null}

        {isScannerActive ? <motion.div className={`video-feed-container ${creatorStageClass}${numSimilarCards > 0 ? ' video-feed-container-has-similar' : ''}`} >
            <video className="video-feed" ref={videoRef}>Video stream not available.</video>
            {
                isScannerActive && currentDetectedCardName != null && currentDetectedCardID == null ?
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className='detected-card-name'>
                        <button onClick={cancelScan} className='cancel-scan-button' style={{ paddingTop: 2 }}>&#10006;&#xFE0E;</button>
                        {currentDetectedCardName}
                    </motion.div> :
                    null
            }
            {isScannerActive ? <>
                <div className={`video-feed-viewport ${currentDetectedCardID == null ? 'video-feed-viewport-scanning' : ''}`} style={{
                    top: (viewportTop * 100) + '%',
                    height: (viewportHeight * 100) + '%',
                    left: (viewportLeft * 100) + '%',
                    width: (viewportWidth * 100) + '%',
                }
                }></div>
                {currentDetectedCardID == null ? <div className="video-feed-viewport-line" style={{
                    top: ((viewportTop + viewportHeight * 0.8) * 100) + '%',
                    left: ((viewportLeft + viewportWidth * 0.1) * 100) + '%',
                    width: (viewportWidth * 80) + '%',
                }
                }></div> : null}
            </> : null}
            <div className='video-feed-instructions'>{
                isScannerActive && currentDetectedCardID == null ? (
                    currentDetectedCardName == null ? <div key="card-name-scan-instruction" >Scan the card name</div> : (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key="set-number-scan-instruction" >Scan the set number</motion.div>
                    )
                ) : null
            }</div>
            <div className='video-feed-sub-instructions'>{
                isScannerActive && currentDetectedCardID == null ? 'Hold the text within the box' : null
            }</div>
            <div className='video-feed-lighting-instructions'>{
                isScannerActive && currentDetectedCardID == null ? <div>
                    Avoid shadows if possible!
                    <br />Well lit cards lead to easier scanning
                </div> : null
            }</div>
            {
                currentDetectedCardID == null && showBasicEnergySelector ? <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className='video-feed-basic-energy-selector'>
                    <button onClick={() => setShowBasicEnergySelector(false)} className='cancel-scan-button'>&#10006;&#xFE0E;</button>
                    &nbsp;
                    Is this basic energy?
                    <br />
                    {BASIC_ENERGY_INFO.map(energyInfo => {
                        const onClick = () => {
                            setCurrentDetectedCardName(energyInfo.name);
                            setCurrentDetectedCardID(energyInfo.idSample);
                            scrollToTop();
                        }
                        return <img key={energyInfo.name} onClick={onClick} src={energyInfo.iconUri} width={30} height={30}></img>
                    })}
                </motion.div> : null
            }
            {
                numSimilarCards > 0 ?
                    <div className='similar-card-ids-notice'>
                        <div>
                            ⚠️ at least {numSimilarCards} {numSimilarCards === 1 ? 'card looks' : 'cards look'} similar to {cardDatabase[currentDetectedCardID].set_code}&nbsp;
                            {cardDatabase[currentDetectedCardID].number}:
                        </div>
                        <div>{cardDatabase[currentDetectedCardID].similar_card_ids
                            .map((similarID) => {
                                const similarCard = cardDatabase[similarID];
                                return <button key={similarID} onClick={() => {
                                    setCurrentDetectedCardID(similarID);
                                    scrollToTop();
                                }} > {similarCard.set_code} {similarCard.number}</button>;
                            }
                            )}
                        </div>
                    </div> : null
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
            {isScannerActive && currentDetectedCardID != null ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className='card-count-selector'>
                <div className='card-count-selector-instructions'>
                    <button onClick={cancelScan} className='cancel-scan-button'>&#10006;&#xFE0E;</button>
                    &nbsp;
                    <div style={{ marginTop: 2 }}>{currentDetectedCardIDCount === 0 ? 'How many?' : `${currentDetectedCardIDCount} already scanned`}</div>
                </div>
                <div className={BASIC_ENERGY_NAMES.includes(currentDetectedCardName)
                    ? 'card-count-selector-buttons-energy' : 'card-count-selector-buttons-4'}>
                    {
                        countButtons.map(count => {
                            const onClick = () => {
                                addCard(cardDatabase[currentDetectedCardID], count);
                            }
                            return <button key={count} onClick={onClick}>{currentDetectedCardIDCount > 0 ? '+' : ''}{count}</button>
                        })
                    }
                </div>
            </motion.div> : null
            }
            <AnimatePresence>
                {
                    successfullyAddedCardText != null ?
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }} key="successfully-added-card-text" className='successfully-added-card-text'>&#10004;&#xFE0E; {successfullyAddedCardText}</motion.div>
                        : null
                }
            </AnimatePresence>
        </motion.div> : null}
        {/* <canvas ref={tesseractDebugCanvasRef}></canvas> */}

        {!isScannerActive && currentDetectedCardID != null ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className='manual-count-selector'>
            <div className='manual-count-card'>
                {cardDatabase[currentDetectedCardID].supertype === 'Pokémon' ?
                    <div className='manual-count-set-info'>
                        {cardDatabase[currentDetectedCardID].set_code}&nbsp;
                        {cardDatabase[currentDetectedCardID].number}
                    </div> : null}
                <CardImageForID id={currentDetectedCardID} />
            </div>
            <div className='manual-count-controls'>
                <div className='manual-count-instructions'>
                    <button onClick={cancelScan} className='cancel-scan-button'>&#10006;&#xFE0E;</button>
                    <span>{currentDetectedCardIDCount === 0 ? 'How many?' : `${currentDetectedCardIDCount} already scanned`}</span>
                </div>
                <div className={BASIC_ENERGY_NAMES.includes(currentDetectedCardName)
                    ? 'manual-count-buttons manual-count-buttons-energy' : 'manual-count-buttons'}>
                    {countButtons.map(count => {
                        const onClick = () => {
                            addCard(cardDatabase[currentDetectedCardID], count);
                        }
                        return <button key={count} onClick={onClick}>{currentDetectedCardIDCount > 0 ? '+' : ''}{count}</button>
                    })}
                </div>
            </div>
        </motion.div> : null}

        {candidateCardIDs != null && currentDetectedCardID == null ? <div className='manual-art-selector-container'>
            <h3>{isScannerActive ? 'Or, select the art directly:' : <><button onClick={cancelScan} className='cancel-scan-button'>&#10006;&#xFE0E;</button>{currentDetectedCardName}</>}</h3>
            <div className='candidate-card-ids'>
                {candidateCardIDs.map((id, index) => {
                    return <motion.div onClick={() => {
                        setCurrentDetectedCardID(id);
                        scrollToTop();
                    }} whileTap={{ y: 4 }} key={id}>
                        <motion.div
                            initial={{ opacity: 0, x: -400, scale: 0.5 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 200, scale: 1.2 }}
                            transition={{ duration: 0.6, type: "spring", delay: 0.03 * index }}
                        >
                            <CardImageForID id={id} showSetInfo={true} cardDatabase={cardDatabase} />
                        </motion.div>
                    </motion.div>
                })}
            </div>
        </div> : null}
        {
            currentDetectedCardName == null ? <div className='card-name-selector-container'>
                {isScannerActive ? <div className='select-name-manually-instructions'>
                    Scanning can be imperfect! Please make sure you have the right card before proceeding
                </div> : null}
                <Select
                    options={cardNameOptions}
                    components={{ DropdownIndicator: SearchDropdownIndicator }}
                    defaultValue={null}
                    onChange={({ value }) => {
                        setCardNameWrapped(value);
                    }}
                    name={'manual-name-selector'}
                    className="name-selector"
                    classNamePrefix="name-selector"
                    placeholder={isScannerActive ? "Not scanning? Search for it" : "Find card"}
                />
            </div> : null
        }
        <h3 className='scanned-cards-heading'>Scanned Cards: {totalCards}</h3>
        <div className="progress-bar">
            <motion.div className={totalCards === 60 ? 'progress-bar-green' : 'progress-bar-blue'}
                style={{ 'width': `${100 * Math.min(totalCards, 60) / 60}%` }}
            >
            </motion.div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button onClick={() => {
                setIsExportModalOpen(true);
                setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 100);
            }} className={'export-modal-open-button' + (totalCards === 60 ? ' export-modal-open-button-success' : '')} disabled={cardInfoListNonNull.length === 0}>
                <MdIosShare className='export-modal-open-button-icon' /> Export
            </button>
            <button
                onClick={saveChanges}
                className='scanner-save-changes-button'
                disabled={cardInfoListNonNull.length === 0 || saveChangesButtonText === 'Saving...'}
            >
                <MdOutlineSave className='scanner-save-changes-button-icon' /> {saveChangesButtonText}
            </button>
        </div>
        {totalCards > 0 ?
            <div>
                <DecklistImage
                    decklist={cardInfoListNonNull}
                    cardDatabase={cardDatabase}
                />
                <h4 style={{ marginBottom: 7, marginTop: 14 }}>Edit List</h4>
            </div> : null
        }
        <div className='scans-feed'>
            <motion.div>
                {cardInfoListNonNull.map((cardInfo, index) => {
                    const { id, name, number, set_code, supertype, count, originalIndex } = cardInfo;
                    const mechanicsKey = cardInfo.cardMechanicsHash;
                    const artSwapCandidateIDs = supertype === 'Pokémon' && mechanicsKey != null ? (mechanicallyIdenticalCardIDsByHash[mechanicsKey] ?? []) : [];
                    const canSwapArt = artSwapCandidateIDs.length > 1;

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
                                <div>
                                    <button onClick={deleteCard} className='update-count-button'><MdOutlineDelete /></button>
                                    <button onClick={decreaseCardCount} disabled={count <= 1} className='update-count-button'>-</button>
                                    <button onClick={increaseCardCount} disabled={count >= 4 && !BASIC_ENERGY_NAMES.includes(name)} className='update-count-button'>+</button>
                                    {canSwapArt ?
                                        <button onClick={() => {
                                            setArtSwapSourceOriginalIndex(originalIndex);
                                            setIsArtSwapModalOpen(true);
                                        }} className='update-count-button'><MdOutlineSwapHoriz /></button> : null}
                                </div>
                                <div>
                                    <b>{count}&times;</b>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                })}
            </motion.div></div>

        {
            isExportModalOpen ?
                <div ref={exportModalRef} className="modal">
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
        {
            isArtSwapModalOpen && artSwapSourceOriginalIndex != null && cardInfoList[artSwapSourceOriginalIndex] != null ?
                <div className="modal" onClick={(event) => {
                    if (event.target === event.currentTarget) {
                        setIsArtSwapModalOpen(false);
                        setArtSwapSourceOriginalIndex(null);
                    }
                }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <div className="art-swap-modal-content">
                            <div className='art-swap-modal-header'>
                                <b>Swap Art</b>
                                <div onClick={() => {
                                    setIsArtSwapModalOpen(false);
                                    setArtSwapSourceOriginalIndex(null);
                                }} className='modal-header-row-button'>
                                </div>
                            </div>
                            <div className='candidate-card-ids art-swap-options-grid'>
                                {(mechanicallyIdenticalCardIDsByHash[cardInfoList[artSwapSourceOriginalIndex].cardMechanicsHash] ?? []).map(cardID => {
                                    const isCurrentArt = cardInfoList[artSwapSourceOriginalIndex].id === cardID;
                                    return <div
                                        key={cardID}
                                        className={'art-swap-option-tile' + (isCurrentArt ? ' art-swap-option-tile-selected' : '')}
                                        onClick={() => swapCardArt(artSwapSourceOriginalIndex, cardID)}>
                                        <motion.div
                                            initial={{ opacity: 0, x: -400, scale: 0.5 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            exit={{ opacity: 0, x: 200, scale: 1.2 }}
                                            transition={{ duration: 0.6, type: "spring" }}
                                            whileTap={{ y: 4 }}
                                        >
                                            <CardImageForID id={cardID} showSetInfo={true} cardDatabase={cardDatabase} />
                                        </motion.div>
                                    </div>;
                                })}
                            </div>
                        </div>
                    </motion.div>
                </div> : null
        }
    </div >;
}

export default DecklistCreator
