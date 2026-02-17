import { useState, useEffect, useMemo, useRef } from 'react'
import CardPreviewIcon from './CardPreviewIcon';
import { pMulligan, pOnlyStartWithTargetBasic, pBasicInStartingHand, pPrizedTargetBasic, pPrizedTargetNonBasic, pTargetBasicsInFirstEight, pTargetBasicsInOpeningHand, pTargetNonBasicsInFirstEight } from './ProbabilityUtils';
import DecklistImage from './DecklistImage';

function formatPercentage(probability) {
    const numDigits = 2;
    if (probability < Math.pow(0.1, 2 + numDigits)) {
        return '<' + formatPercentage(Math.pow(0.1, 2 + numDigits));
    }
    return (probability * 100).toFixed(numDigits) + '%';
}

function Probability({ label, value }) {
    return <div className="probability-row">
        <span className="probability-label"><i>P(</i>&thinsp;{label}&thinsp;<i>)</i>:</span>
        <span className="probability-value">{formatPercentage(value)}</span>
    </div>;
}

// ProbabilityContent: the main content, no modal wrapper
export function ProbabilityContent({ cardList, cardDatabase }) {
    const modes = ['setup', 'prizing', 'openingHandPlusOne'];
    const modeLabels = {
        'setup': 'Setup',
        'openingHandPlusOne': 'Opening Hand + Draw for Turn',
        'prizing': 'Prizing'
    };
    const numCards = cardList.reduce((sum, card) => sum + card.count, 0);
    const basics = cardList.filter(card => card.supertype === 'Pokémon' && card.subtypes.includes('Basic'));
    const numBasics = basics.reduce((sum, card) => sum + card.count, 0);
    const [mode, setMode] = useState(modes[0]);
    let innerContent = null;
    if (mode === 'setup') {
        innerContent =
            <div className='probability-section'>
                <h4 style={{ marginTop: '10px' }}>{numBasics} Basic Pokémon</h4>
                <Probability label="Mulligan" value={pMulligan(numBasics)} />
                {basics.map(basic => {
                    return <div key={basic.id}>
                        <div className="probability-card-name"><div className='probability-card-name-count'>{basic.count}</div> &times; <CardPreviewIcon cardInfo={basic} /> {basic.name} {basic.supertype === 'Pokémon' ? `${basic.set_code} ${basic.number}` : ''}</div>
                        <div>
                            <Probability label={"In Starting 7"} value={pBasicInStartingHand(basic.count, numBasics)} />
                            <Probability label={"Only Starter"} value={pOnlyStartWithTargetBasic(basic.count, numBasics)} />
                        </div>
                    </div>;
                })}
            </div>;
    } else if (mode === 'prizing') {
        innerContent = <div className='probability-section'>
            {cardList.map(card => {
                return <div key={card.id}>
                    <div className="probability-card-name"><div className='probability-card-name-count'>{card.count}</div> &times; <CardPreviewIcon cardInfo={card} /> {card.name} {card.supertype === 'Pokémon' ? `${card.set_code} ${card.number}` : ''}</div>
                    <div>
                        {
                            card.supertype === 'Pokémon' && card.subtypes.includes('Basic') ?
                                <div>
                                    <Probability label="None Prized" value={
                                        pPrizedTargetBasic(
                                            card.count,
                                            numBasics,
                                            0
                                        )
                                    } />
                                    {
                                        [...Array(Math.min(card.count, 6)).keys()].map(i => i + 1).map(prizedCopies =>
                                            <Probability label={`${prizedCopies === card.count && prizedCopies > 1 ? 'All ' : ''}${prizedCopies} Prized`} key={prizedCopies} value={
                                                pPrizedTargetBasic(
                                                    card.count,
                                                    numBasics,
                                                    prizedCopies
                                                )
                                            } />
                                        )
                                    }
                                </div> : <div>
                                       <Probability label="None Prized" value={
                                        pPrizedTargetNonBasic(
                                            card.count,
                                            numBasics,
                                            0
                                        )
                                    } />
                                    {
                                        [...Array(Math.min(card.count, 6)).keys()].map(i => i + 1).map(prizedCopies =>
                                            <Probability label={`${prizedCopies === card.count && prizedCopies > 1 ? 'All ' : ''}${prizedCopies} Prized`} key={prizedCopies} value={
                                                pPrizedTargetNonBasic(
                                                    card.count,
                                                    numBasics,
                                                    prizedCopies
                                                )
                                            } />
                                        )
                                    }
                                </div>
                        }
                    </div>
                </div>;
            })}
        </div>;
    } else if (mode === 'openingHandPlusOne') {
        innerContent = <div className='probability-section'>
            {cardList.map(card => {
                return <div key={card.id}>
                    <div className="probability-card-name"><div className='probability-card-name-count'>{card.count}</div> &times; <CardPreviewIcon cardInfo={card} /> {card.name} {card.supertype === 'Pokémon' ? `${card.set_code} ${card.number}` : ''}</div>
                    <div>
                        {
                            card.supertype === 'Pokémon' && card.subtypes.includes('Basic') ?
                                <div>
                                    {
                                        [...Array(Math.min(card.count, 6) + 1).keys()].map(copies =>
                                            <Probability label={`${copies === card.count && copies > 1 ? 'All ' : ''}${copies === 0 ? 'None' : copies} in First 8`} key={copies} value={
                                                pTargetBasicsInFirstEight(
                                                    card.count,
                                                    numBasics,
                                                    copies
                                                )
                                            } />
                                        )
                                    }
                                </div> : <div>
                                    {
                                        [...Array(Math.min(card.count, 6) + 1).keys()].map(copies =>
                                            <Probability label={`${copies === card.count && copies > 1 ? 'All ' : ''}${copies === 0 ? 'None' : copies} in First 8`} key={copies} value={
                                                pTargetNonBasicsInFirstEight(
                                                    card.count,
                                                    numBasics,
                                                    copies
                                                )
                                            } />
                                        )
                                    }
                                </div>
                        }
                    </div>
                </div>;
            })}
        </div>;
    }

    if (numCards !== 60 || numBasics < 1) {
        return <div className='probability-content'>
            <p>Probability analysis is only available for standard 60-card decks with at least 1 basic</p>
        </div>;
    }

    return <div className='modal-content'>
        <div style={{ width: "100%", marginTop: '10px', borderBottom: '1px solid #ccc', paddingBottom: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
            {modes.map(m =>
                <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={'probability-modal-mode-select-button ' + (mode === m ? 'selected active' : '')}
                    aria-pressed={mode === m}
                >
                    {modeLabels[m]}
                </button>
            )}
        </div>
        {innerContent}
    </div>;
}

// ProbabilityModal: wrapper with modal header and close
function ProbabilityModal({ undeletedCardData, onClose, cardDatabase }) {
    const cardList = undeletedCardData.map(({ cardInfo }) => cardInfo);
    return <div>
        <div className='modal-header-row'>
            <div>
                <h3>Probability Analysis</h3>&nbsp;
                <div onClick={onClose} className='modal-header-row-button'>
                </div>
            </div>
        </div>
        <DecklistImage decklist={cardList} cardDatabase={cardDatabase}
            onAllCardImagesLoaded={() => { }}
        />
        <ProbabilityContent cardList={cardList} cardDatabase={cardDatabase} />
    </div>;
}

export default ProbabilityModal;
