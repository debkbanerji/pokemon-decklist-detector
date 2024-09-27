import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import './Scanner.css';
import CardImageForID from './CardImageForID.tsx';
import ExportModal from './ExportModal.tsx';
import Select, { components, OptionProps } from 'react-select';
import { createWorker, PSM } from 'tesseract.js';

const DETECTION_REPLACE_REGEX = /(é|')/i;

const BASIC_ENERGY_NAMES = [
    'Grass Energy',
    'Fire Energy',
    'Water Energy',
    'Lightning Energy',
    'Psychic Energy',
    'Fighting Energy',
    'Darkness Energy',
    'Metal Energy',
    'Fairy Energy',
]

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

const tesseractWorker = await createWorker('eng', 1, {
    // logger: m => console.log(m),
});
await tesseractWorker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT
});

const VIDEO_WIDTH_PX = 512;
const VIDEO_HEIGHT_PX = 512;

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

function Scanner({ cardDatabase }) {
    const videoRef = useRef(null);
    const tesseractCanvasRef = useRef(null);
    const exportModalRef = useRef(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const [cardInfoList, setCardInfoList] = useState([]); // the result
    const cardInfoListNonNull = cardInfoList.filter(item => item != null);
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
            const name = cardDatabase[id].name_without_prefix_and_postfix;
            result[name] = (result[name] ?? []).concat([id]);
        });
        return result;
    }, [cardDatabase]);
    const candidateCardIDs = cardNameToIDs[currentDetectedCardName];

    const cardNames = Object.keys(cardNameToIDs);
    const cardNameOptions = useMemo(() => cardNames.map(name => { return { label: name, value: name } }), [cardNameToIDs]);

    function setCardNameWrapped(cardName) {
        setCurrentDetectedCardName(cardName);
        const cardSample = cardDatabase[cardNameToIDs[cardName][0]];
        if (cardSample?.supertype !== 'Pokémon') {
            // not a Pokemon - directly set card ID since art doesn't matter
            setCurrentDetectedCardID(cardSample.id);
        }
    }

    useEffect(() => {
        window.onclick = function (event) {
            // close modal contents if background is clicked
            if (event.target === exportModalRef.current) {
                setIsExportModalOpen(false);
            }
        }
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
                        height: { exact: VIDEO_HEIGHT_PX },
                        width: { exact: VIDEO_WIDTH_PX },
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
                                        height: { exact: VIDEO_WIDTH_PX },
                                        width: { exact: VIDEO_HEIGHT_PX },
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
        if (currentDetectedCardName == null) {
            // trying to detect the card name
            let validCardNames = [];
            cardNames.forEach(cardName => {
                if (lowercaseText.includes(
                    cardName.toLocaleLowerCase().replace(DETECTION_REPLACE_REGEX, '')
                )) {
                    validCardNames.push(cardName);
                }
            });
            validCardNames.sort((a, b) => b.length - a.length); // longest first
            validCardNames = validCardNames.filter(name => name.toLocaleLowerCase() !== 'eri'); // Sorry Eri, you're just a frequent false positive :(
            // users will just have to enter this manually
            if (validCardNames.length > 0) {
                const latestCard = cardInfoListNonNull.length > 0 ? cardInfoListNonNull[cardInfoListNonNull.length - 1] : null;
                // test against the latest scanned card
                // if the latest scanned card is not a pokemon, and its name matches this one, don't scan again
                // this protects against accident duplicate scans of trainer cards
                if (latestCard == null || (latestCard.supertype === 'Pokémon' || latestCard.name !== validCardNames[0])) {
                    setCardNameWrapped(validCardNames[0]);
                }
            }
        } else if (currentDetectedCardID == null) {
            // trying to detect the set number
            candidateCardIDs.forEach(id => {
                const card = cardDatabase[id];
                const { number, set_printed_total, set_code } = card;
                const includeSetNameInString = /[a-zA-Z]+/.test(number) || ['PR', 'SVP'].includes(set_code);
                const setInfoRegex = new RegExp('.*' + (includeSetNameInString ? `${number}` : `${number}.*${set_printed_total}`) + '.*', 'gi');
                if (lowercaseText.match(setInfoRegex)) {
                    setCurrentDetectedCardID(id);
                }
            });
        }
    }, [tesseractOutput, currentDetectedCardID, setCurrentDetectedCardID,
        currentDetectedCardName, setCurrentDetectedCardName, cardNames, cardNameToIDs]);

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

        setTimeout(async () => {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = contrastImage(imageData, 100);
            context.putImageData(pixels, 0, 0);

            setTimeout(async () => {
                const imageUrl = canvas.toDataURL("image/png");

                const { data: { text } } = await tesseractWorker.recognize(imageUrl);
                setTesseractOutput(text);

                requestAnimationFrame(tesseractTick);
            }, 100);
        }, 100);
    }

    const addCard = (cardInfo, count) => {
        const augmentedCardInfo = {
            count,
            ...cardInfo,
            originalIndex: cardInfoList.length, // track this for easier deletions
        };
        setCardInfoList(cardInfoList.concat([augmentedCardInfo]));
        setCurrentDetectedCardID(null);
        setCurrentDetectedCardName(null);
    }

    const cancelScan = () => {
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
        <h3>Deb's Dubious Decklist Detector</h3>
        <div>{errorMessage}</div>
        <div className="video-feed-container">
            <video className="video-feed" ref={videoRef}>Video stream not available.</video>
            {
                currentDetectedCardName != null && currentDetectedCardID == null ?
                    <div className='detected-card-name'>
                        <button onClick={cancelScan} className='cancel-scan-button'>&#10006;</button>
                        {currentDetectedCardName}
                    </div> :
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
                currentDetectedCardName == null ? 'Scan the card name' : (
                    currentDetectedCardID == null ? 'Scan the card set number' : null
                )
            }</div>
            <div className='video-feed-sub-instructions'>{
                currentDetectedCardID == null ? 'Hold the text within the frame' : null
            }</div>
            {currentDetectedCardID != null ? <div className='detected-card-in-feed'>
                <CardImageForID id={currentDetectedCardID} />
            </div> : null
            }
            {currentDetectedCardID != null ? <div className='card-count-selector'>
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
            </div> : null
            }
        </div>
        {candidateCardIDs != null && currentDetectedCardID == null ? <div>
            <h3> Or, select the art directly:</h3>
            <div className='candidate-card-ids'>
                {candidateCardIDs.map(id => {
                    return <div onClick={() => {
                        setCurrentDetectedCardID(id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} key={id}><CardImageForID id={id} /></div>
                })}
            </div>
        </div> : null}
        {
            currentDetectedCardName == null ? <div>
                <Select
                    options={cardNameOptions}
                    defaultValue={null}
                    onChange={({ value }) => {
                        setCardNameWrapped(value);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    name={'manual-name-selector'}
                    className="name-selector"
                    placeholder="Card name not scanning? Select it manually"
                />
                <div className='select-name-manually-instructions'>
                    Certain cards don't scan reliably:
                    <ul>
                        <li>Basic energies</li>
                        <li>Eri</li>
                        <li>Some reverse holos</li>
                        <li>Some full arts</li>
                    </ul>
                </div>
            </div> : null
        }
        <div className='scans-feed-header'>
            <div>
                <button onClick={() => setIsExportModalOpen(true)} className={'export-modal-open-button' + (totalCards === 60 ? ' success-text' : '')} disabled={totalCards != 60 && false}>Export</button>
            </div>
            <h3>Scanned Cards: {totalCards}</h3>
        </div>
        <div className='scans-feed'>
            {cardInfoListNonNull.map((cardInfo, index) => {
                const { id, name, number, set_code, set_id, set_name, name_without_prefix_and_postfix, supertype, count, originalIndex } = cardInfo;

                const deleteCard = () => {
                    setCardInfoList(cardInfoList.map((item, index) => {
                        return index === originalIndex ? null : item
                    }));
                }

                return <div className="scan-row" key={index}>
                    <>
                        <div className='scan-row-image'>
                            <CardImageForID id={id} />
                        </div>
                        <div className='scan-row-input'>
                            <div>{name}</div>
                            {supertype === 'Pokémon' ?
                                <div>
                                    <div className='set-info'><b>{set_code}</b> {number}</div>
                                </div> : null}
                            <div className='delete-and-count-button'>
                                <button onClick={deleteCard} className='delete-button'>&#128465;</button>
                                <div><b>{count}&times;</b></div>
                            </div>
                        </div>
                    </>

                </div>
            })}</div>
        <canvas ref={tesseractCanvasRef} hidden></canvas>
        {
            isExportModalOpen ? <div ref={exportModalRef} className="export-modal">
                <div className="export-modal-content">
                    <ExportModal cardDatabase={cardDatabase}
                        undeletedCardData={cardInfoListNonNull.map(cardInfo => { return { cardInfo } })} />
                </div>
            </div> : null
        }
    </div >;
}

export default Scanner
