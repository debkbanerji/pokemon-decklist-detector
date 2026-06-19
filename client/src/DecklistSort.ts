type CardInfo = {
    id: string;
    name: string;
    name_without_prefix_and_postfix?: string;
    supertype: string;
    subtypes?: string[];
    count: number;
    set_code?: string;
    number?: string;
    evolves_from?: string | null;
    cardMechanicsHash?: string;
    rarity_order?: number;
};

type CardDatabase = Record<string, CardInfo>;

function getCardTypeSortWeight(card: CardInfo) {
    if (card.supertype === 'Pokémon') {
        return 0;
    } else if (card.supertype === 'Trainer') {
        return 1;
    } else {
        return 2;
    }
}

function getPokemonEvolutionName(cardOrName: CardInfo | string | null | undefined) {
    return typeof cardOrName === 'string'
        ? cardOrName
        : cardOrName?.name ?? '';
}

function getPokemonEvolutionNameKey(cardOrName: CardInfo | string | null | undefined) {
    return getPokemonEvolutionName(cardOrName).toLocaleLowerCase();
}

function getPokemonStageSortWeight(card: CardInfo) {
    const subtypes = card.subtypes ?? [];
    if (subtypes.includes('Basic')) {
        return 0;
    } else if (subtypes.includes('Stage 1')) {
        return 1;
    } else if (subtypes.includes('Stage 2')) {
        return 2;
    } else if (card.evolves_from) {
        return 1;
    } else {
        return 0;
    }
}

function buildEvolutionLineRootByName(cardDatabase: CardDatabase) {
    const evolvesFromByNameKey = new Map<string, string>();

    Object.values(cardDatabase).forEach(card => {
        if (card.supertype !== 'Pokémon' || !card.evolves_from) {
            return;
        }

        evolvesFromByNameKey.set(
            getPokemonEvolutionNameKey(card),
            getPokemonEvolutionNameKey(card.evolves_from)
        );
    });

    const rootByNameKey = new Map<string, string>();
    const getRootNameKey = (nameKey: string) => {
        if (rootByNameKey.has(nameKey)) {
            return rootByNameKey.get(nameKey)!;
        }

        const seen = new Set<string>();
        let currentNameKey = nameKey;
        while (evolvesFromByNameKey.has(currentNameKey) && !seen.has(currentNameKey)) {
            seen.add(currentNameKey);
            currentNameKey = evolvesFromByNameKey.get(currentNameKey)!;
        }

        rootByNameKey.set(nameKey, currentNameKey);
        return currentNameKey;
    };

    Array.from(evolvesFromByNameKey.keys()).forEach(getRootNameKey);
    return { getRootNameKey };
}

function comparePokemonWithinLine(a: CardInfo, b: CardInfo) {
    return getPokemonStageSortWeight(a) - getPokemonStageSortWeight(b)
        || b.count - a.count
        || a.name.localeCompare(b.name)
        || (a.set_code ?? '').localeCompare(b.set_code ?? '')
        || (a.number ?? '').localeCompare(b.number ?? '');
}

export function sortDecklistCards(cards: CardInfo[], cardDatabase: CardDatabase = {}) {
    const { getRootNameKey } = buildEvolutionLineRootByName(cardDatabase);
    const pokemonLineStats = new Map<string, { totalCount: number, firstCard: CardInfo }>();

    cards.forEach(card => {
        if (card.supertype !== 'Pokémon') {
            return;
        }

        const lineRootKey = getRootNameKey(getPokemonEvolutionNameKey(card));
        const existingStats = pokemonLineStats.get(lineRootKey);
        if (!existingStats) {
            pokemonLineStats.set(lineRootKey, { totalCount: card.count, firstCard: card });
            return;
        }

        existingStats.totalCount += card.count;
        if (comparePokemonWithinLine(card, existingStats.firstCard) < 0) {
            existingStats.firstCard = card;
        }
    });

    return [...cards].sort((a, b) => {
        let result = getCardTypeSortWeight(a) - getCardTypeSortWeight(b);
        if (result !== 0) {
            return result;
        }

        if (a.supertype === 'Pokémon' && b.supertype === 'Pokémon') {
            const aLineRootKey = getRootNameKey(getPokemonEvolutionNameKey(a));
            const bLineRootKey = getRootNameKey(getPokemonEvolutionNameKey(b));

            if (aLineRootKey !== bLineRootKey) {
                const aLineStats = pokemonLineStats.get(aLineRootKey);
                const bLineStats = pokemonLineStats.get(bLineRootKey);

                result = (bLineStats?.totalCount ?? 0) - (aLineStats?.totalCount ?? 0);
                if (result !== 0) {
                    return result;
                }

                return getPokemonEvolutionName(aLineStats?.firstCard)
                    .localeCompare(getPokemonEvolutionName(bLineStats?.firstCard));
            }

            return comparePokemonWithinLine(a, b);
        }

        return b.count - a.count
            || a.name.localeCompare(b.name);
    });
}
