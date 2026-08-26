import React, { useState, useMemo } from 'react';
import CardImageForID from './CardImageForID';
import { motion, AnimatePresence } from 'motion/react';
import { sortDecklistCards } from './DecklistSort';


const MAX_HANDS = 10;

function OpeningHandSimulator({ cardList, cardDatabase }) {
    function isBasicPokemon(card) {
        return card.supertype === 'Pokémon' && card.subtypes.includes('Basic');
    }

    // Helper to flatten deck
    const deck = useMemo(() => {
        const d = [];
        cardList.forEach(card => {
            for (let i = 0; i < card.count; i++) {
                d.push(card);
            }
        });
        return d;
    }, [cardList]);

    function getNewHand() {
        // Check if deck has at least one basic pokemon
        const hasBasicInDeck = deck.some(isBasicPokemon);

        if (!hasBasicInDeck) {
            throw new Error('Deck must contain at least one Basic Pokémon');
        }

        let hand;
        let drawForTurn;
        let prizes;
        let hasBasic = false;

        // Keep drawing until we get a hand with at least one basic
        while (!hasBasic) {
            // Shuffle deck
            const shuffled = [...deck];
            for (let j = shuffled.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            // Draw 7 cards
            hand = shuffled.slice(0, 7);
            prizes = shuffled.slice(7, 13);
            drawForTurn = shuffled[13];

            // Check if hand has at least one basic pokemon
            hasBasic = hand.some(isBasicPokemon);
        }

        return {
            openingHand: sortDecklistCards(hand, cardDatabase),
            drawForTurn,
            prizes,
        };
    }

    const [hands, setHands] = useState(() => [
        ...Array.from({ length: MAX_HANDS }, (_, i) => ({
            id: i + 1,
            example: getNewHand(),
        }))
    ]);
    const [showPrizes, setShowPrizes] = useState(true);
    const [showDraw, setShowDraw] = useState(true);

    function drawNewHand() {
        const newHand = getNewHand();
        const newHandId = (hands.length > 0 ? hands[hands.length - 1].id : 0) + 1;

        // Add new hand to the end of the list
        let updatedHands = [...hands, { id: newHandId, example: newHand }];

        // If we exceed MAX_HANDS, remove the first one
        if (updatedHands.length > MAX_HANDS) {
            updatedHands = updatedHands.slice(1);
        }

        setHands(updatedHands);
    }

    return (
        <div className="opening-hand-simulator-section">
            <h4>Opening Examples</h4>
            <div className="opening-hand-simulator-note">Excludes Mulligans</div>
            <div className="opening-hand-simulator-controls">
                <div className="opening-hand-simulator-toggle-row">
                    <span className="opening-hand-simulator-toggle-label">Prizes</span>
                    <label className={`toggle-switch ${showPrizes ? 'checked' : ''}`}>
                        <input
                            className="toggle-input"
                            type="checkbox"
                            checked={showPrizes}
                            onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setShowPrizes(checked);
                            }}
                            aria-label="Show prizes in opening examples"
                        />
                        <span className="toggle-track" aria-hidden="true">
                            <span className="toggle-knob" />
                        </span>
                    </label>
                </div>
                <div className="opening-hand-simulator-toggle-row">
                    <span className="opening-hand-simulator-toggle-label">Draw</span>
                    <label className={`toggle-switch ${showDraw ? 'checked' : ''}`}>
                        <input
                            className="toggle-input"
                            type="checkbox"
                            checked={showDraw}
                            onChange={(e) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                setShowDraw(checked);
                            }}
                            aria-label="Show turn draw in opening examples"
                        />
                        <span className="toggle-track" aria-hidden="true">
                            <span className="toggle-knob" />
                        </span>
                    </label>
                </div>
            </div>
            <button onClick={drawNewHand} style={{ width: '100%' }}>Generate New Example</button>
            <div className="opening-hand-simulator-list">
                <AnimatePresence>
                    {hands.map((handObj, handIndex) => {
                        const reversedIndex = hands.length - 1 - handIndex;
                        const exampleClassName = [
                            'opening-hand-example',
                            showPrizes ? 'opening-hand-example-show-prizes' : 'opening-hand-example-hide-prizes',
                            showDraw ? 'opening-hand-example-show-draw' : 'opening-hand-example-hide-draw',
                        ].join(' ');

                        return (
                            <motion.div
                                layout="position"
                                key={handObj.id}
                                initial={{ opacity: 0, x: -400, scale: 0.5 }}
                                animate={{ opacity: reversedIndex === 0 ? 1 : 0.4, x: 0, scale: 1 }}
                                transition={{ duration: 0.6, type: "spring" }}
                                exit={{ opacity: 0, x: 400, scale: 0.5 }}
                                className="opening-hand-example-entry"
                                style={{ borderBottom: reversedIndex < hands.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                                <div className={exampleClassName}>
                                    <div className="opening-hand-example-section opening-hand-main-section">
                                        <div className="opening-hand-example-label">Opening Hand</div>
                                        <div className="opening-hand-example-panel">
                                            <div className="opening-hand-card-row">
                                                {handObj.example.openingHand.map((card, cardIndex) => (
                                                    <div
                                                        key={cardIndex}
                                                        className={`opening-hand-card-slot ${isBasicPokemon(card) ? 'opening-hand-card-slot-basic' : ''}`}
                                                    >
                                                        <CardImageForID id={card.id} cardDatabase={cardDatabase} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="opening-hand-example-sidebar">
                                        {showPrizes ? (
                                            <div className="opening-hand-example-section opening-hand-prizes-section">
                                                <div className="opening-hand-example-label">Prizes</div>
                                                <div className="opening-hand-example-panel">
                                                    <div className="opening-hand-prize-grid">
                                                        {handObj.example.prizes.map((card, cardIndex) => (
                                                            <div key={cardIndex} className="opening-hand-prize-slot">
                                                                <CardImageForID id={card.id} cardDatabase={cardDatabase} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                        {showDraw ? (
                                            <div className="opening-hand-example-section opening-hand-draw-section">
                                                <div className="opening-hand-example-label">Draw</div>
                                                <div className="opening-hand-example-panel">
                                                    <div className="opening-hand-draw-slot">
                                                        <CardImageForID id={handObj.example.drawForTurn.id} cardDatabase={cardDatabase} />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

        </div >
    );
}

export default OpeningHandSimulator;
