import { combination } from 'js-combinatorics';

const DECK_SIZE = 60;
const OPENING_HAND_SIZE = 7;
const OPENING_HAND_PLUS_ONE_SIZE = 8;
const NUM_PRIZES = 6;

// Divide two bigints with enough precision for our purposes
function divideBigInt(numerator: bigint, denominator: bigint): number {
    const scale = 10000000;
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


export { pMulligan, pOnlyStartWithTargetBasic, pBasicInStartingHand };