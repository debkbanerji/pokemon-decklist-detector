const SERIALIZED_COUNT_SEPERATOR = '__';
const SERIALIZED_ENTRY_SEPARATOR = '___';

function seralizeDecklist(cardData) {
    return cardData.map(({ cardInfo }) => `${cardInfo['id']}${SERIALIZED_COUNT_SEPERATOR}${cardInfo['count']}`).join(SERIALIZED_ENTRY_SEPARATOR);
}

function deserializeDecklist(serializedDecklist, cardDatabase) {
    return serializedDecklist.split(SERIALIZED_ENTRY_SEPARATOR).map(entry => {
        const pair = entry.split(SERIALIZED_COUNT_SEPERATOR);
        const id = pair[0];
        const count = pair[1];
        const name = cardDatabase[id]['name'];
        return { cardInfo: { id, count, name } };
    });
}

export { seralizeDecklist, deserializeDecklist };