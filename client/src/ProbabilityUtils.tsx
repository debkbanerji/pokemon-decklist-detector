import { combination } from 'js-combinatorics';

// Calculates probabilities for certain situations using combinatorics
// Cross checked with monte carlo simulations in 'simulations' directory
// at the root of the codebase

const DECK_SIZE = 60;
const OPENING_HAND_SIZE = 7;
const OPENING_HAND_PLUS_ONE_SIZE = 8;
const NUM_PRIZES = 6;

// Divide two bigints with enough precision for our purposes
function divideBigInt(numerator: bigint, denominator: bigint): number {
    const scale = 100000;
    const scaledNumerator = numerator * BigInt(scale);
    return Number(scaledNumerator / denominator) / scale;
}

// Probability of mulliganing based on number of basic pokemon in deck
function pMulligan(numBasicsInDeck): number {
    const totalMulliganHands = combination(DECK_SIZE - numBasicsInDeck, OPENING_HAND_SIZE);
    const totalPossibleHands = combination(DECK_SIZE, OPENING_HAND_SIZE);
    return divideBigInt(totalMulliganHands, totalPossibleHands);
}

// Probability of starting hand with only the target basic pokemon and no others
function pOnlyStartWithTargetBasic(numTargetBasic, numBasicsInDeck): number {
    const numOtherBasics = numBasicsInDeck - numTargetBasic; // 'bad' basics

    const totalMulliganHands = combination(DECK_SIZE - numBasicsInDeck, OPENING_HAND_SIZE);
    const totalPossibleHands = combination(DECK_SIZE, OPENING_HAND_SIZE);
    const totalNonMulliganHands = totalPossibleHands - totalMulliganHands;

    const handsWithoutNonTargetBasics = combination(DECK_SIZE - numOtherBasics, OPENING_HAND_SIZE);
    const validHandsWithTargetBasicOnly = handsWithoutNonTargetBasics - totalMulliganHands;
    return divideBigInt(
        validHandsWithTargetBasicOnly, totalNonMulliganHands
    )
}

// Probability of starting hand containing the target basic
function pBasicInStartingHand(numTargetBasic, numBasicsInDeck): number {
    const numOtherBasics = numBasicsInDeck - numTargetBasic; // 'bad' basics

    const totalMulliganHands = combination(DECK_SIZE - numBasicsInDeck, OPENING_HAND_SIZE);
    const totalPossibleHands = combination(DECK_SIZE, OPENING_HAND_SIZE);
    const totalNonMulliganHands = totalPossibleHands - totalMulliganHands;

    const handsWithNoTargetBasics = combination(DECK_SIZE - numTargetBasic, OPENING_HAND_SIZE);
    const handsWithAtLeastOneTargetBasic = totalPossibleHands - handsWithNoTargetBasics;

    return divideBigInt(
        handsWithAtLeastOneTargetBasic,
        totalNonMulliganHands
    )
}


function pPrizedTargetBasic(
    targetBasicCopies,
    totalBasicCount,
    prizedCopies
) {
    if (prizedCopies > NUM_PRIZES) {
        return 0;
    }
    const REMAINING_AFTER_HAND = DECK_SIZE - OPENING_HAND_SIZE; // 53

    // Total valid opening hands (must contain at least one Basic)
    const validOpeningHands =
        combination(DECK_SIZE, OPENING_HAND_SIZE) -
        combination(DECK_SIZE - totalBasicCount, OPENING_HAND_SIZE);

    let probability = 0;

    // h = number of target Basic Pokémon in opening hand
    const maxInHand = Math.min(OPENING_HAND_SIZE, targetBasicCopies);

    for (let inHand = 0; inHand <= maxInHand; inHand++) {
        let openingHandWays;

        if (inHand === 0) {
            // No target Basic, but must contain at least one *other* Basic
            openingHandWays =
                combination(DECK_SIZE - targetBasicCopies, OPENING_HAND_SIZE) -
                combination(DECK_SIZE - totalBasicCount, OPENING_HAND_SIZE);
        } else {
            // Hands with inHand copies of the target Basic
            openingHandWays =
                combination(targetBasicCopies, inHand) *
                combination(DECK_SIZE - targetBasicCopies, OPENING_HAND_SIZE - inHand);
        }

        const probabilityInHand = divideBigInt(openingHandWays, validOpeningHands);

        const remainingTargetBasics = targetBasicCopies - inHand;
        if (remainingTargetBasics < prizedCopies) continue;

        // Prize card distribution
        const prizeWays =
            combination(remainingTargetBasics, prizedCopies) *
            combination(
                REMAINING_AFTER_HAND - remainingTargetBasics,
                NUM_PRIZES - prizedCopies
            );

        const totalPrizeWays = combination(
            REMAINING_AFTER_HAND,
            NUM_PRIZES
        );

        const probabilityPrizedGivenHand =
            divideBigInt(prizeWays, totalPrizeWays);

        probability +=
            probabilityInHand * probabilityPrizedGivenHand;
    }

    return probability;
}


// TODO: Verify correctness!
function pPrizedTargetNonBasic(
    targetCopies,
    totalBasics,
    prizedCopies
) {
    const validHands =
        combination(DECK_SIZE, OPENING_HAND_SIZE) -
        combination(DECK_SIZE - totalBasics, OPENING_HAND_SIZE);

    let probability = 0;

    const maxInHand = Math.min(
        targetCopies,
        OPENING_HAND_SIZE
    );

    for (let h = 0; h <= maxInHand; h++) {
        const validHandsWithH =
            combination(targetCopies, h) *
            (
                combination(
                    DECK_SIZE - targetCopies,
                    OPENING_HAND_SIZE - h
                ) -
                combination(
                    DECK_SIZE - totalBasics - targetCopies,
                    OPENING_HAND_SIZE - h
                )
            );

        if (validHandsWithH > 0n) {
            const pHand = divideBigInt(
                validHandsWithH,
                validHands
            );

            const remainingTargets = targetCopies - h;
            const remainingCards = DECK_SIZE - OPENING_HAND_SIZE;

            const pPrizes = divideBigInt(
                combination(remainingTargets, prizedCopies) *
                combination(
                    remainingCards - remainingTargets,
                    NUM_PRIZES - prizedCopies
                ),
                combination(remainingCards, NUM_PRIZES)
            );

            probability += pHand * pPrizes;
        }
    }

    return probability;
}


export { pMulligan, pOnlyStartWithTargetBasic, pBasicInStartingHand, pPrizedTargetBasic, pPrizedTargetNonBasic };