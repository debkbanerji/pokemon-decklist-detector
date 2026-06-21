import React, { useState, useMemo } from 'react';
import CardImageForID from './CardImageForID';
import { motion, AnimatePresence } from 'motion/react';


const MAX_HANDS = 10;

function OpeningHandSimulator({ cardList, cardDatabase }) {
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
        const hasBasicInDeck = deck.some(card =>
            card.supertype === 'Pokémon' && card.subtypes.includes('Basic')
        );

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
            hasBasic = hand.some(card =>
                card.supertype === 'Pokémon' && card.subtypes.includes('Basic')
            );
        }

        return {
            openingHand: hand,
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
        <div className="opening-hand-simulator-section" style={{ padding: '10px' }}>
            <h4>Opening Examples</h4>
            <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '8px' }}>Excludes Mulligans</div>
            <button onClick={drawNewHand} style={{ width: '100%' }}>Generate New Example</button>
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column-reverse' }}>
                <AnimatePresence>
                    {hands.map((handObj, handIndex) => {
                        const reversedIndex = hands.length - 1 - handIndex;
                        return (
                            <motion.div
                                layout="position"
                                key={handObj.id}
                                initial={{ opacity: 0, x: -400, scale: 0.5 }}
                                animate={{ opacity: reversedIndex === 0 ? 1 : 0.4, x: 0, scale: 1 }}
                                transition={{ duration: 0.6, type: "spring" }}
                                exit={{ opacity: 0, x: 400, scale: 0.5 }}
                                style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: reversedIndex < hands.length - 1 ? '1px solid #ccc' : 'none' }}>
                                <div className="opening-hand-example">
                                    <div className="opening-hand-example-section opening-hand-main-section">
                                        <div className="opening-hand-example-label">Opening Hand</div>
                                        <div className="opening-hand-example-panel">
                                            <div className="opening-hand-card-row">
                                                {handObj.example.openingHand.map((card, cardIndex) => (
                                                    <div key={cardIndex} className="opening-hand-card-slot">
                                                        <CardImageForID id={card.id} cardDatabase={cardDatabase} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="opening-hand-example-sidebar">
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
                                        <div className="opening-hand-example-section opening-hand-draw-section">
                                            <div className="opening-hand-example-label">Draw</div>
                                            <div className="opening-hand-example-panel">
                                                <div className="opening-hand-draw-slot">
                                                    <CardImageForID id={handObj.example.drawForTurn.id} cardDatabase={cardDatabase} />
                                                </div>
                                            </div>
                                        </div>
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
