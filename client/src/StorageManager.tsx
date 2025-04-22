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

async function addDecklistToDB(modalOpenedTimestamp, deckName, serializedDecklist, coverPokemonSpriteUrl, coverPokemon) {
    const nonEmptyDeckName = deckName || 'Unnamed Deck';
    // Prevent adding of duplicates
    await deleteDecklist(modalOpenedTimestamp);
    await db.decklists.add(
        {
            serializedDecklist,
            name: nonEmptyDeckName,
            createdTimestamp: modalOpenedTimestamp,
            coverPokemonSpriteUrl,
            coverPokemon
        }
    );
}

async function deleteDecklist(createdTimestamp) {
    await db.decklists.delete(createdTimestamp);
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