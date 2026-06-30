import { db } from './db';
import type { CardInfo, CardDatabase } from './DecklistSort';

const SERIALIZED_COUNT_SEPERATOR = '__';
const SERIALIZED_ENTRY_SEPARATOR = '___';

const TCG_LIVE_REVERSE_SET_OVERRIDE = {
    'PR-SV': 'SVP',
    'PR-SW': 'PR',
    'Energy': 'sve'
}

const TCG_LIVE_ENERGY_ABBREVIATION_OVERRIDE = {
    'Basic {P} Energy': 'Psychic Energy',
    'Basic {F} Energy': 'Fighting Energy',
    'Basic {W} Energy': 'Water Energy',
    'Basic {L} Energy': 'Lightning Energy',
    'Basic {G} Energy': 'Grass Energy',
    'Basic {D} Energy': 'Darkness Energy',
    'Basic {M} Energy': 'Metal Energy',
    'Basic {R} Energy': 'Fire Energy',
}

// Regex for TCG Live special typed energy import
// ex: Telepathic {P} Energy
const TCG_LIVE_SPECIAL_ENERGY_REGEX = /^(?!Basic )([a-zA-Z]+) \{[a-zA-Z]\} Energy$/;
const ENERGY_SYMBOL_TO_FULL_NAME = {
    '{P}': 'Psychic',
    '{F}': 'Fighting',
    '{W}': 'Water',
    '{L}': 'Lightning',
    '{G}': 'Grass',
    '{D}': 'Darkness',
    '{M}': 'Metal',
    '{R}': 'Fire',
};

const EXCLUDED_ATTACKER_CANDIDATE_REFERENCE_IDS = [
    'sv6pt5-38', // Fezandipiti ex
    'me3-62', // Meowth ex
];

const INCLUDED_SINGLE_PRIZE_ATTACKER_CANDIDATE_REFERENCE_IDS = [
    'sv10-12', // Crustle
    'sv7-58', // Slowking
    'me1-56', // Alakazam
    'sv6-18', // Dipplin
    'me2pt5-96', // Hop's Trevenant
    'sv10-34', // Ethan's Typhlosion
    'sv5-114', // Metang
    'sv8pt5-40', // Sylveon
    'me2pt5-127', // Team Rocket's Honchkrow
    'me2-68', // Toxtricity
    'sv6-111', // Okidogi
    'sv7-50', // Joltik
];

function getCardMechanicsHashSet(cardDatabase: CardDatabase, exampleIDs: string[]) {
    return new Set(exampleIDs.map(id => cardDatabase[id]?.cardMechanicsHash).filter(hash => hash != null));
}

function seralizeDecklist(cardData) {
    return cardData.map(({ cardInfo }) => `${cardInfo['id']}${SERIALIZED_COUNT_SEPERATOR}${cardInfo['count']}`).join(SERIALIZED_ENTRY_SEPARATOR);
}

function deserializeDecklist(serializedDecklist, cardDatabase) {
    return serializedDecklist.split(SERIALIZED_ENTRY_SEPARATOR).map(entry => {
        const pair = entry.split(SERIALIZED_COUNT_SEPERATOR);
        const id = pair[0];
        const count = Number(pair[1]);
        const name = cardDatabase[id]['name'];
        return { cardInfo: { id, count, name } };
    });
}

function getAutoCoverPokemonName(cards: CardInfo[], cardDatabase: CardDatabase) {
    const excludedAttackerCandidateHashes = getCardMechanicsHashSet(cardDatabase, EXCLUDED_ATTACKER_CANDIDATE_REFERENCE_IDS);
    const includedSinglePrizeAttackerCandidateHashes = getCardMechanicsHashSet(cardDatabase, INCLUDED_SINGLE_PRIZE_ATTACKER_CANDIDATE_REFERENCE_IDS);
    const candidateStatsByMechanicsKey = new Map<string, {
        totalCount: number;
        firstSeenIndex: number;
        coverPokemonName: string;
    }>();

    cards.forEach((card, index) => {
        if (card.supertype !== 'Pokémon') {
            return;
        }

        if (
            !includedSinglePrizeAttackerCandidateHashes.has(card.cardMechanicsHash)
            && (
                !/ ex$/i.test(card.name ?? '')
                || excludedAttackerCandidateHashes.has(card.cardMechanicsHash)
            )
        ) {
            return;
        }

        const coverPokemonName = card.name_without_prefix_and_postfix ?? card.name ?? '';
        if (coverPokemonName.length === 0) {
            return;
        }

        const mechanicsKey = card.cardMechanicsHash ?? card.id;
        const existingStats = candidateStatsByMechanicsKey.get(mechanicsKey);
        if (existingStats == null) {
            candidateStatsByMechanicsKey.set(mechanicsKey, {
                totalCount: card.count ?? 0,
                firstSeenIndex: index,
                coverPokemonName,
            });
            return;
        }

        existingStats.totalCount += card.count ?? 0;
    });

    let bestCandidate: null | {
        totalCount: number;
        firstSeenIndex: number;
        coverPokemonName: string;
    } = null;

    candidateStatsByMechanicsKey.forEach(candidateStats => {
        if (
            bestCandidate == null
            || candidateStats.totalCount > bestCandidate.totalCount
            || (
                candidateStats.totalCount === bestCandidate.totalCount
                && candidateStats.firstSeenIndex < bestCandidate.firstSeenIndex
            )
        ) {
            bestCandidate = candidateStats;
        }
    });

    return bestCandidate?.coverPokemonName ?? null;
}

// The created timestamp is the source of truth
async function addDecklistToDB(modalOpenedTimestamp, deckName, serializedDecklist, coverPokemonSpriteUrl, coverPokemon, previousDecklistTimestamp) {
    const nonEmptyDeckName = deckName || 'Unnamed Deck';

    if (previousDecklistTimestamp != null) {
        // each decklist points to its latest 'successor'

        // if a previous decklist timestamp is provided, we update every decklist
        // that points to that decklist to point to its newly added 'successor' instead
        const previousDecklists = await db.decklists.where({ 'successorCreatedTimestamp': previousDecklistTimestamp }).toArray();
        await db.decklists.bulkUpdate(
            previousDecklists.map(({ createdTimestamp }) => {
                return {
                    key: createdTimestamp,
                    changes: {
                        successorCreatedTimestamp: modalOpenedTimestamp
                    }
                };
            }).concat([
                // Also update the current 'successor'
                {
                    key: previousDecklistTimestamp,
                    changes: {
                        successorCreatedTimestamp: modalOpenedTimestamp
                    }
                }
            ])
        );

        // if the newest previous decklist is exactly the same as the current one, delete it
        const newestPreviousDecklist = await db.decklists.get(previousDecklistTimestamp);
        if (newestPreviousDecklist != null && newestPreviousDecklist.serializedDecklist === serializedDecklist) {
            await db.decklists.delete(previousDecklistTimestamp);
        }
    }

    // Prevent adding of duplicates
    // manually delete *just* this one decklist to prevent adding of duplicates
    // Don't use the deleteDecklist to avoid cascading deletes during add
    await db.decklists.delete(modalOpenedTimestamp)

    await db.decklists.add(
        {
            serializedDecklist,
            name: nonEmptyDeckName,
            createdTimestamp: modalOpenedTimestamp,
            coverPokemonSpriteUrl,
            coverPokemon,
            previousDecklistTimestamp
        }
    );
}

async function deleteDecklist(createdTimestamp) {
    const previousDecklists = await db.decklists.where({ 'successorCreatedTimestamp': createdTimestamp }).toArray();
    // Delete this decklist, and all previous versions
    await db.decklists.bulkDelete(
        [createdTimestamp].concat(previousDecklists.map(decklist => decklist.createdTimestamp))
    );
}

function getDecklists() {
    return db.decklists.toArray();
}

async function getLatestPlayer() {
    return await db.players.orderBy('lastUsedTimestamp').last();
}

async function overWriteLatestPlayer(newPlayer) {
    const latestPlayer = await getLatestPlayer();
    if (latestPlayer != null) {
        await db.players.delete(latestPlayer.playerName);
    }
    return await db.players.add(newPlayer);
}

// Attempts to parse decklist from TCGLive, RK9, etc.
function parseFormattedDecklist(formattedDecklist, cardDatabase) {
    const allCards = Object.values(cardDatabase);
    const rows = formattedDecklist.split(/[\r\n]/);
    const unDedupedRows = rows.map(row => {
        const countMatch = row.match(/^\d+/);
        if (!countMatch) {
            return null;
        }
        const count = parseInt(countMatch[0], 10);
        row = row.replace(/^\d+ /, '');
        // remove ' PH' suffix if it exists - tcg live sometimes adds this for certain holo patterns
        row = row.replace(/ PH$/, '');

        const setNumberMatch = row.match(/[a-zA-Z0-9]+$/);
        if (!setNumberMatch) {
            return null;
        }
        const setNumber = setNumberMatch[0]
        row = row.replace(/ [a-zA-Z0-9]+$/, '');

        const setCodeMatch = row.match(/[A-Za-z-]+$/);
        if (!setCodeMatch) {
            return null;
        }
        const setCode = TCG_LIVE_REVERSE_SET_OVERRIDE[setCodeMatch[0]] ?? setCodeMatch[0];
        row = row.replace(/ [A-Za-z-]+$/, '');

        let cardName = TCG_LIVE_ENERGY_ABBREVIATION_OVERRIDE[row] ?? row;
        // if the card is a typed special energy
        const specialEnergyMatch = TCG_LIVE_SPECIAL_ENERGY_REGEX.exec(cardName);
      
        if (specialEnergyMatch) {
             // for each entry in ENERGY_SYMBOL_TO_FULL_NAME, run replacement
            for (const [symbol, fullName] of Object.entries(ENERGY_SYMBOL_TO_FULL_NAME)) {
                cardName = cardName.replace(new RegExp(`\\${symbol}`, 'g'), fullName);
            }
        }

        const result = allCards.find((card) => {
            if (card.name !== cardName) {
                return false;
            }

            return card.supertype !== 'Pokémon' || (card.set_code === setCode && card.number === setNumber);
        });

        if (result != null) {
            return { cardInfo: { ...result, count } };
        }

        return null;
    }).filter(item => item != null);
    const dedupedRows = [];
    unDedupedRows.forEach(({ cardInfo }) => {
        const existingCard = dedupedRows.find(({ cardInfo: dedupedCard }) => dedupedCard.id === cardInfo.id);
        if (existingCard) {
            existingCard.cardInfo.count = existingCard.cardInfo.count + cardInfo.count;
        } else {
            dedupedRows.push({ cardInfo: { ...cardInfo } });
        }
    });
    return dedupedRows;
}

export { seralizeDecklist, deserializeDecklist, deleteDecklist, addDecklistToDB, getDecklists, getLatestPlayer, overWriteLatestPlayer, parseFormattedDecklist, getAutoCoverPokemonName };
