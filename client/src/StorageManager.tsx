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

async function addDecklistToDB(modalOpenedTimestamp, deckName, serializedDecklist, coverPokemonSpriteUrl) {
    const nonEmptyDeckName = deckName || 'Unnamed Deck';
    // TODO: Prevent adding of duplicates
    await db.decklists.add(
        {
            serializedDecklist,
            name: nonEmptyDeckName,
            createdTimestamp: modalOpenedTimestamp,
            coverPokemonSpriteUrl
        }
    );
}

function getDecklists() {
    return db.decklists.toArray();
}

function storageEnabled() {
    return false;
}

export { seralizeDecklist, deserializeDecklist, addDecklistToDB, getDecklists, storageEnabled };