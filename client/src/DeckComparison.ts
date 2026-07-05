import type { CardDatabase, CardInfo } from './DecklistSort';
import { sortDecklistCards } from './DecklistSort';

export type DeckComparisonCard = CardInfo & {
    comparisonKey: string;
    count: number;
};

function getCardComparisonKey(card: CardInfo, fallbackIndex?: number) {
    if (card.cardMechanicsHash != null) {
        return `mechanics:${card.cardMechanicsHash}`;
    }

    if (card.id != null) {
        return `id:${card.id}`;
    }

    return `index:${fallbackIndex ?? 0}`;
}

export function getLowRarityRank(card: Partial<CardInfo>, cardDatabase: CardDatabase) {
    return card?.rarity_order ?? cardDatabase?.[card?.id ?? '']?.rarity_order ?? 999;
}

export function compareCardsForLowRarity(a: Partial<CardInfo>, b: Partial<CardInfo>, cardDatabase: CardDatabase) {
    return getLowRarityRank(a, cardDatabase) - getLowRarityRank(b, cardDatabase)
        || (a.set_code ?? cardDatabase?.[a?.id ?? '']?.set_code ?? '').localeCompare(b.set_code ?? cardDatabase?.[b?.id ?? '']?.set_code ?? '')
        || (a.number ?? cardDatabase?.[a?.id ?? '']?.number ?? '').localeCompare(b.number ?? cardDatabase?.[b?.id ?? '']?.number ?? '')
        || (a.id ?? '').localeCompare(b.id ?? '');
}

export function buildMinRarityDecklist(decklist: CardInfo[], cardDatabase: CardDatabase) {
    const groupedCards = new Map<string, {
        displayKey: string;
        representativeCard: CardInfo;
        count: number;
        mechanicHash: string | null;
    }>();

    decklist.forEach((card, index) => {
        const groupKey = getCardComparisonKey(card, index);
        const existingGroup = groupedCards.get(groupKey);
        if (!existingGroup) {
            groupedCards.set(groupKey, {
                displayKey: groupKey,
                representativeCard: card,
                count: card.count,
                mechanicHash: card.cardMechanicsHash ?? null,
            });
            return;
        }

        existingGroup.count += card.count;
    });

    return Array.from(groupedCards.values()).map(group => {
        if (group.mechanicHash != null) {
            const databaseCandidates = Object.values(cardDatabase).filter(card =>
                card?.cardMechanicsHash === group.mechanicHash && card?.supertype === 'Pokémon'
            );
            if (databaseCandidates.length > 0) {
                const lowRarityRepresentative = [...databaseCandidates].sort((a, b) => compareCardsForLowRarity(a, b, cardDatabase))[0];
                return {
                    ...lowRarityRepresentative,
                    count: group.count,
                    displayKey: group.displayKey,
                };
            }
        }

        return {
            ...group.representativeCard,
            count: group.count,
            displayKey: group.displayKey,
        };
    });
}

export function buildDeckVennSections(deckA: CardInfo[], deckB: CardInfo[], cardDatabase: CardDatabase) {
    const groupsByKey = new Map<string, {
        deckACount: number;
        deckBCount: number;
        candidates: CardInfo[];
    }>();

    const addCardsToGroup = (deck: CardInfo[], countField: 'deckACount' | 'deckBCount') => {
        deck.forEach((card, index) => {
            const comparisonKey = getCardComparisonKey(card, index);
            const existingGroup = groupsByKey.get(comparisonKey);

            if (!existingGroup) {
                groupsByKey.set(comparisonKey, {
                    deckACount: countField === 'deckACount' ? card.count : 0,
                    deckBCount: countField === 'deckBCount' ? card.count : 0,
                    candidates: [card],
                });
                return;
            }

            existingGroup[countField] += card.count;
            if (!existingGroup.candidates.some(candidate => candidate.id === card.id)) {
                existingGroup.candidates.push(card);
            }
        });
    };

    addCardsToGroup(deckA, 'deckACount');
    addCardsToGroup(deckB, 'deckBCount');

    const deckAOnly: DeckComparisonCard[] = [];
    const shared: DeckComparisonCard[] = [];
    const deckBOnly: DeckComparisonCard[] = [];

    groupsByKey.forEach((group, comparisonKey) => {
        const representativeCard = [...group.candidates].sort((a, b) => compareCardsForLowRarity(a, b, cardDatabase))[0];
        const sharedCount = Math.min(group.deckACount, group.deckBCount);
        const deckAOnlyCount = group.deckACount - sharedCount;
        const deckBOnlyCount = group.deckBCount - sharedCount;

        if (deckAOnlyCount > 0) {
            deckAOnly.push({
                ...representativeCard,
                comparisonKey,
                count: deckAOnlyCount,
            });
        }

        if (sharedCount > 0) {
            shared.push({
                ...representativeCard,
                comparisonKey,
                count: sharedCount,
            });
        }

        if (deckBOnlyCount > 0) {
            deckBOnly.push({
                ...representativeCard,
                comparisonKey,
                count: deckBOnlyCount,
            });
        }
    });

    return {
        deckAOnly: sortDecklistCards(deckAOnly, cardDatabase),
        shared: sortDecklistCards(shared, cardDatabase),
        deckBOnly: sortDecklistCards(deckBOnly, cardDatabase),
    };
}
