import React, { useState, useMemo } from 'react';
import CardImageForID from './CardImageForID';


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

    const [hands, setHands] = useState(() => [getNewHand()]);

    function drawNewHand() {
        const newHand = getNewHand();

        // Add new hand to the beginning of the list
        let updatedHands = [newHand, ...hands];

        // If we exceed 6 hands, remove the last one
        if (updatedHands.length > MAX_HANDS) {
            updatedHands = updatedHands.slice(0, MAX_HANDS);
        }

        setHands(updatedHands);
    }

    return (
        <div className="opening-hand-simulator-section" style={{ padding: '10px' }}>
            <h4>Opening Examples</h4>
            <div style={{ fontSize: '0.9em', color: '#888' }}>Excludes Mulligans</div>
            <button onClick={drawNewHand}>Generate New Example</button>
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column' }}>
                {hands.map((hand, handIndex) => (
                    <div key={handIndex} style={{ marginBottom: '10px', opacity: handIndex === 0 ? 1 : 0.4, paddingBottom: '10px', borderBottom: handIndex < hands.length - 1 ? '1px solid #ccc' : 'none' }}>
                        <div style={{ display: 'flex', gap: '6px', maxWidth: '600px', flexDirection: 'row' }}>
                            {hand.map((card, cardIndex) => (
                                <div key={cardIndex} style={{
                                    flex: 1,
                                    minWidth: 0
                                }}>
                                    <CardImageForID id={card.id} cardDatabase={cardDatabase} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
}

export default OpeningHandSimulator;
