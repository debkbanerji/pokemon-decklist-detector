import { useState, useEffect, useMemo, useRef } from 'react'
import CardPreviewIcon from './CardPreviewIcon';
import { pMulligan, pOnlyStartWithTargetBasic, pBasicInStartingHand, pPrizedTargetBasic, pPrizedTargetNonBasic, pTargetBasicsInFirstEight, pTargetBasicsInOpeningHand, pTargetNonBasicsInFirstEight } from './ProbabilityUtils';
import DecklistImage from './DecklistImage';
import OpeningHandSimulator from './OpeningHandSimulator';
import { MdOutlineClose } from 'react-icons/md';

const UNSUPPORTED_PROBABILITY_CARD_IDS = new Set(['me1-28']);

function getProbabilityUnavailableReason(cardList, numCards, numBasics) {
    if (numCards !== 60) {
        return 'Probability analysis is only available for 60-card decks.';
    } else if (numBasics < 1) {
        return 'Probability analysis is only available for decks with at least 1 Basic Pokemon.';
    } else if (cardList.some(card => UNSUPPORTED_PROBABILITY_CARD_IDS.has(card?.id))) {
        return 'Probability analysis is not yet supported for decks containing Cinderace MEG 28';
    } else {
        return null;
    }
}

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

function ProbabilityCardName({ card }) {
    const suffix = card.supertype === 'Pokémon' ? `${card.set_code} ${card.number}` : '';

    return <div className="probability-card-name">
        <span className='probability-card-name-prefix'>
            <span className='probability-card-name-count'>{card.count}</span>
            <span>&times;</span>
            <span className='probability-card-name-icon'>
                <CardPreviewIcon cardInfo={card} />
            </span>
        </span>
        <span className='probability-card-name-title'>{card.name}</span>
        {suffix ? <span className='probability-card-name-suffix'>{suffix}</span> : null}
    </div>;
}

// ProbabilityContent: the main content, no modal wrapper
export function ProbabilityContent({ cardList, cardDatabase }) {
    const modes = ['setup', 'prizing', 'openingHandPlusOne', 'openingHandSimulator'];
    const modeLabels = {
        'setup': 'Setup',
        'openingHandPlusOne': 'Turn 1',
        'prizing': 'Prizing',
        'openingHandSimulator': 'Examples'
    };
    const numCards = cardList.reduce((sum, card) => sum + card.count, 0);
    const basics = cardList.filter(card => card.supertype === 'Pokémon' && card.subtypes.includes('Basic'));
    const numBasics = basics.reduce((sum, card) => sum + card.count, 0);
    const unavailableReason = getProbabilityUnavailableReason(cardList, numCards, numBasics);
    const [mode, setMode] = useState(modes[0]);
    let innerContent = null;
    if (mode === 'setup') {
        innerContent =
            <div className='probability-section'>
            <div className='probability-section-description'>
                What's the probability of seeing a basic when setting up the game?
            </div>
                <h4 style={{ marginTop: '10px' }}>{numBasics} Basic Pokémon</h4>
                <div className='probability-summary-row'>
                    <Probability label="Mulligan" value={pMulligan(numBasics)} />
                </div>
                <div className='probability-card-analysis-list'>
                {basics.map(basic => {
                    return <div className='probability-card-analysis' key={basic.id}>
                        <ProbabilityCardName card={basic} />
                        <div className='probability-card-values'>
                            <Probability label={"In Starting 7"} value={pBasicInStartingHand(basic.count, numBasics)} />
                            <Probability label={"Only Starter"} value={pOnlyStartWithTargetBasic(basic.count, numBasics)} />
                        </div>
                    </div>;
                })}
                </div>
            </div>;
    } else if (mode === 'prizing') {
        innerContent = <div className='probability-section'>
            <div className='probability-section-description'>
                What's the probability of prizing a card?
            </div>
            <div className='probability-card-analysis-list'>
            {cardList.map(card => {
                return <div className='probability-card-analysis' key={card.id}>
                    <ProbabilityCardName card={card} />
                    <div className='probability-card-values'>
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
                                    {card.count > 1 ?
                                        <Probability label="At Least 1 Prized" value={
                                            // 1 - none prized
                                            1 - pPrizedTargetBasic(
                                                card.count,
                                                numBasics,
                                                0
                                            )
                                        } />
                                        : null
                                    }
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
                                    {card.count > 1 ?
                                        <Probability label="At Least 1 Prized" value={
                                            // 1 - none prized
                                            1 - pPrizedTargetNonBasic(
                                                card.count,
                                                numBasics,
                                                0
                                            )
                                        } />
                                        : null
                                    }
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
            </div>
        </div>;
    } else if (mode === 'openingHandPlusOne') {
        innerContent = <div className='probability-section'>
            <div className='probability-section-description'>
                Assuming no mulligans, what's the probability of seeing a card by your turn 1 draw?
            </div>
            <div className='probability-card-analysis-list'>
            {cardList.map(card => {
                return <div className='probability-card-analysis' key={card.id}>
                    <ProbabilityCardName card={card} />
                    <div className='probability-card-values'>
                        {
                            card.supertype === 'Pokémon' && card.subtypes.includes('Basic') ?
                                <div>
                                    <Probability label="None in First 8" value={
                                        pTargetBasicsInFirstEight(
                                            card.count,
                                            numBasics,
                                            0
                                        )
                                    } />
                                    {card.count > 1 ?
                                        <Probability label="At Least 1 in First 8" value={
                                            1 - pTargetBasicsInFirstEight(
                                                card.count,
                                                numBasics,
                                                0
                                            )
                                        } />
                                        : null
                                    }
                                    {
                                        [...Array(Math.min(card.count, 6)).keys()].map(i => i + 1).map(copies =>
                                            <Probability label={`${copies === card.count && copies > 1 ? 'All ' : ''}${copies} in First 8`} key={copies} value={
                                                pTargetBasicsInFirstEight(
                                                    card.count,
                                                    numBasics,
                                                    copies
                                                )
                                            } />
                                        )
                                    }
                                </div> : <div>
                                    <Probability label="None in First 8" value={
                                        pTargetNonBasicsInFirstEight(
                                            card.count,
                                            numBasics,
                                            0
                                        )
                                    } />
                                    {card.count > 1 ?
                                        <Probability label="At Least 1 in First 8" value={
                                            1 - pTargetNonBasicsInFirstEight(
                                                card.count,
                                                numBasics,
                                                0
                                            )
                                        } />
                                        : null
                                    }
                                    {
                                        [...Array(Math.min(card.count, 6)).keys()].map(i => i + 1).map(copies =>
                                            <Probability label={`${copies === card.count && copies > 1 ? 'All ' : ''}${copies} in First 8`} key={copies} value={
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
            </div>
        </div>;
    } else if (mode === 'openingHandSimulator') {
        innerContent = <OpeningHandSimulator cardList={cardList} cardDatabase={cardDatabase} />;
    }

    if (unavailableReason != null) {
        return <div className='probability-content'>
            <p>{unavailableReason}</p>
        </div>;
    }

    return <div className='modal-content'>
        <div className='probability-modal-mode-select-grid'>
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
                <button onClick={onClose} className='modal-header-row-button' aria-label='Close probability analysis'>
                    <MdOutlineClose />
                </button>
            </div>
        </div>
        <DecklistImage decklist={cardList} cardDatabase={cardDatabase} />
        <ProbabilityContent cardList={cardList} cardDatabase={cardDatabase} />
    </div>;
}

export default ProbabilityModal;
export { getProbabilityUnavailableReason };
