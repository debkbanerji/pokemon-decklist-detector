import { db } from './db';

const SERIALIZED_COUNT_SEPERATOR = '__';
const SERIALIZED_ENTRY_SEPARATOR = '___';

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

    console.log('deleting');
    console.log( [createdTimestamp].concat(previousDecklists.map(decklist => decklist.createdTimestamp)));

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

export { seralizeDecklist, deserializeDecklist, deleteDecklist, addDecklistToDB, getDecklists, getLatestPlayer, overWriteLatestPlayer };