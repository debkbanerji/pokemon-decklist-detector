import { sortDecklistCards } from './DecklistSort';
import type { CardDatabase, CardInfo } from './DecklistSort';

export async function renderDecklistPDFImage(
    decklist: CardInfo[],
    cardDatabase: CardDatabase,
    size: { width: number; height: number },
) {
    const cards = sortDecklistCards(decklist, cardDatabase);
    const rows = Math.max(1, Math.ceil(Math.sqrt(cards.length * (734 / 1024) / (size.width / size.height))));
    const columns = Math.max(1, Math.ceil(cards.length / rows));
    const cellWidth = 100;
    const cellHeight = 96 * 1024 / 734 + 4;
    const width = columns * cellWidth;
    const height = Math.max(1, Math.ceil(cards.length / columns)) * cellHeight;

    // Decode the actual assets before drawing; a DOM snapshot can capture
    // loading placeholders, or miss images while rendering its SVG clone.
    const images = await Promise.all(cards.map(async card => {
        const image = new Image();
        image.src = `/cards/${card.id}.png`;
        try {
            await image.decode();
        } catch {
            throw new Error(`Could not load ${card.name} (${card.set_code ?? ''} ${card.number ?? card.id}) for the PDF. Please retry.`);
        }
        return image;
    }));

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * 2);
    canvas.height = Math.ceil(height * 2);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the PDF decklist image.');
    context.scale(2, 2);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
    const positions = cards.map((card, index) => {
        const left = (index % columns) * cellWidth;
        const top = Math.floor(index / columns) * cellHeight;
        context.drawImage(images[index], left + 2, top + 2, cellWidth - 4, cellHeight - 4);
        return { count: card.count, width: cellWidth, x: left + cellWidth / 2, bottom: top + cellHeight };
    });
    return { image: canvas.toDataURL('image/jpeg', 0.92), width, height, cards: positions };
}
