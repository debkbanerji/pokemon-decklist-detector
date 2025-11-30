import { db } from './db';

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
    return rows.map(row => {
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

        const cardName = TCG_LIVE_ENERGY_ABBREVIATION_OVERRIDE[row] ?? row;

        const result = allCards.find((card) => {
            if (card.name !== cardName) {
                return false;
            }

            return card.supertype !== 'Pokémon' || (card.set_code === setCode && card.number === setNumber);
        });

        if (result != null) {
            result.count = count;
        }

        return result;
    }).filter(card => card != null).map(card => { return { cardInfo: card } });
}

export { seralizeDecklist, deserializeDecklist, deleteDecklist, addDecklistToDB, getDecklists, getLatestPlayer, overWriteLatestPlayer, parseFormattedDecklist };