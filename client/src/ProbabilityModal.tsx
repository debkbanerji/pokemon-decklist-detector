import { useState, useEffect, useMemo, useRef } from 'react'
import CardPreviewIcon from './CardPreviewIcon';
import { pMulligan, pOnlyStartWithTargetBasic, pBasicInStartingHand, pPrizedTargetBasic, pPrizedTargetNonBasic, pTargetBasicsInFirstEight, pTargetBasicsInOpeningHand, pTargetNonBasicsInFirstEight } from './ProbabilityUtils';


function formatPercentage(probability) {
    const numDigits = 3;
    if (probability < Math.pow(0.1, 2 + numDigits)) {
        return 'Close to 0';
    }
    return (probability * 100).toFixed(numDigits) + '%'; // TODO: reduce display precision?
}

function Probability({ label, value }) {
    return <div>
        P({label}): {formatPercentage(value)}
    </div>;
}

function ProbabilityModal({ undeletedCardData, onClose }) {
    const modes = ['setup', 'prizing', 'openingHandPlusOne'];
    const modeLabels = {
        'setup': 'Setup',
        'openingHandPlusOne': 'Opening Hand + Draw for Turn',
        'prizing': 'Prizing'
    };
    const cardList = undeletedCardData.map(({ cardInfo }) => cardInfo);
    const numCards = cardList.reduce((sum, card) => sum + card.count, 0);

    const basics = cardList.filter(card => card.supertype === 'Pokémon' && card.subtypes.includes('Basic'));
    const numBasics = basics.reduce((sum, card) => sum + card.count, 0);

    const [mode, setMode] = useState(modes[0]);

    let innerContent = null;
    if (mode === 'setup') {
        // If we're calculating setup probabilites, only do so for each basic pokemon
        innerContent = <div>
            <h3>P(Mulligan): {formatPercentage(pMulligan(numBasics))}</h3>
            <div>
                <h3>Basic Pokémon</h3>
                {basics.map(basic => {
                    return <div key={basic.id}>
                        <h4>{basic.count} &times; <CardPreviewIcon cardInfo={basic} /> {basic.name} {basic.supertype === 'Pokémon' ? `${basic.set_code} ${basic.number}` : ''}</h4>
                        <div>
                            <Probability label={"In Starting 7"} value={pBasicInStartingHand(basic.count, numBasics)} />
                            <Probability label={"Only Starter"} value={pOnlyStartWithTargetBasic(basic.count, numBasics)} />
                        </div>
                    </div>;
                }
                )}
            </div>
        </div>;
    } else if (mode === 'prizing') {
        innerContent = <div>
                {cardList.map(card => {
                return <div key={card.id}>
                    <h4>{card.count} &times; <CardPreviewIcon cardInfo={card} /> {card.name} {card.supertype === 'Pokémon' ? `${card.set_code} ${card.number}` : ''}</h4>
                    <div>
                        {
                            card.supertype === 'Pokémon' && card.subtypes.includes('Basic') ?
                                <div>
                                    {
                                        [...Array(Math.min(card.count, 6) + 1).keys()].map(prizedCopies =>
                                            <Probability label={`${prizedCopies === card.count && prizedCopies > 1 ? 'All ' : ''}${prizedCopies === 0 ? 'None' : prizedCopies} Prized`} key={prizedCopies} value={
                                                pPrizedTargetBasic(
                                                    card.count,
                                                    numBasics,
                                                    prizedCopies
                                                )
                                            } />
                                        )
                                    }
                                </div> : <div>
                                    {
                                        [...Array(Math.min(card.count, 6) + 1).keys()].map(prizedCopies =>
                                            <Probability label={`${prizedCopies === card.count && prizedCopies > 1 ? 'All ' : ''}${prizedCopies === 0 ? 'None' : prizedCopies} Prized`} key={prizedCopies} value={
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
        innerContent = <div>
                {cardList.map(card => {
                return <div key={card.id}>
                    <h4>{card.count} &times; <CardPreviewIcon cardInfo={card} /> {card.name} {card.supertype === 'Pokémon' ? `${card.set_code} ${card.number}` : ''}</h4>
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


    let content = <div className='modal-content'>
        <div>
            {
                modes.map(m =>
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={mode === m ? 'active selected' : ''}
                        aria-pressed={mode === m}
                    >
                        {modeLabels[m]}
                    </button>
                )
            }
        </div>
        {innerContent}
    </div>;



    if (numCards !== 60 || numBasics < 1) {
        content = <div className='modal-content'>
            <p>Probability analysis is only available for standard 60-card decks with at least 1 basic</p>
        </div>;
    }

    return <div>
        <div className='modal-header-row'>
            <div>
                <h2>Probability</h2>&nbsp;
                <div onClick={onClose} className='modal-header-row-button'>
                </div>
            </div>
        </div>
        {content}
    </div>;
}

export default ProbabilityModal;
