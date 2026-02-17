import React, { useState, useMemo } from 'react';
import CardImageForID from './CardImageForID';
import { motion, AnimatePresence } from 'motion/react';


const MAX_HANDS = 4;

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
        let prizes
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
            drawForTurn = shuffled[7];
            prizes = shuffled.slice(8, 13);

            // Check if hand has at least one basic pokemon
            hasBasic = hand.some(card =>
                card.supertype === 'Pokémon' && card.subtypes.includes('Basic')
            );
        }

        return hand;
    }

    const [hands, setHands] = useState(() =>
        Array.from({ length: MAX_HANDS }, (_, index) => ({
            id: MAX_HANDS - index,
            cards: getNewHand(),
        }))
    );

    function drawNewHand() {
        const newHand = getNewHand();
        const newHandId = hands[0].id + 1;

        // Add new hand to the beginning of the list
        let updatedHands = [{ id: newHandId, cards: newHand }, ...hands];

        // If we exceed MAX_HANDS, remove the last one
        if (updatedHands.length > MAX_HANDS) {
            updatedHands = updatedHands.slice(0, MAX_HANDS);
        }

        setHands(updatedHands);
    }

    return (
        <div className="opening-hand-simulator-section" style={{ padding: '10px' }}>
            <h4>Opening Examples</h4>
            <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '8px' }}>Excludes Mulligans</div>
            <button onClick={drawNewHand} style={{width: '100%'}}>Generate New Example</button>
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column' }}>
                <AnimatePresence>
                    {hands.map((handObj, handIndex) => (
                        <motion.div
                            layout="position"
                            key={handObj.id}
                            initial={{ opacity: 0, x: -400, scale: 0.5 }}
                            animate={{ opacity: handIndex === 0 ? 1 : 0.4, x: 0, scale: 1 }}
                            transition={{ duration: 0.6, type: "spring" }}
                            exit={{ opacity: 0, x: 400, scale: 0.5 }}
                            style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: handIndex < hands.length - 1 ? '1px solid #ccc' : 'none' }}>
                            <div style={{ display: 'flex', gap: '6px', maxWidth: '600px', flexDirection: 'row' }}>
                                {handObj.cards.map((card, cardIndex) => (
                                    <div key={cardIndex} style={{
                                        flex: 1,
                                        minWidth: 0
                                    }}>
                                        <CardImageForID id={card.id} cardDatabase={cardDatabase} />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

        </div >
    );
}

export default OpeningHandSimulator;
