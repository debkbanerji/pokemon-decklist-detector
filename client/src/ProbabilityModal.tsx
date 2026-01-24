import { useState, useEffect, useMemo, useRef } from 'react'
import { pMulligan, pOnlyStartWithTargetBasic, pBasicInStartingHand } from './ProbabilityUtils';


function formatPercentage(probability) {
    return (probability * 100).toFixed(2) + '%';
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
    console.log(cardList)

    let innerContent = null;
    if (mode === 'setup') {
        // If we're calculating setup probabilites, only do so for each basic pokemon
        innerContent = <div>
            <h3>P(Mulligan): {formatPercentage(pMulligan(numBasics))}</h3>
            <div>
                <h3>Basic Pokémon</h3>
                {basics.map(basic => {
                    return <div key={basic.id}>
                        <h4>{basic.count} &times; {basic.name} {basic.set_code} {basic.number}</h4>
                        <div>
                            P(In starting 7): {formatPercentage(pBasicInStartingHand(basic.count, numBasics))}
                            <br/>
                            P(Only starter): {formatPercentage(pOnlyStartWithTargetBasic(basic.count, numBasics))}
                        </div>
                    </div>;
                }
                )}
            </div>
        </div>;
    } else if (mode === 'prizing') {
        innerContent = <div>
            TODO: Implement
        </div>;
    } else if (mode === 'openingHandPlusOne') {
        innerContent = <div>
            TODO: Implement
        </div>;
    }


    let content = <div className='modal-content'>
        <div>
            {
                modes.map(m =>
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={mode === m ? 'active' : ''}
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
