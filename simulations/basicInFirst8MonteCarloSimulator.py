import random


def format_percentage(probability):
    return f"{probability * 100:.5f}%"


def monte_carlo_target_basic_in_first_8(
    target_basic_copies,
    total_basic_count,
    target_in_first_8,
    trials
):
    DECK_SIZE = 60
    HAND_SIZE = 7

    successes = 0

    for trial_num in range(trials):
        # Build deck
        deck = (
            ["TARGET"] * target_basic_copies
            + ["OTHER_BASIC"] * (total_basic_count - target_basic_copies)
            + ["OTHER"] * (DECK_SIZE - total_basic_count)
        )

        # Mulligan until opening hand has ≥1 Basic
        while True:
            random.shuffle(deck)
            opening_hand = deck[:HAND_SIZE]
            if any(card in ("TARGET", "OTHER_BASIC") for card in opening_hand):
                break

        remaining_deck = deck[HAND_SIZE:]

        # Draw for turn
        first_draw = remaining_deck[0]

        first_8_cards = opening_hand + [first_draw]

        # Count target basics in first 8 cards
        if first_8_cards.count("TARGET") == target_in_first_8:
            successes += 1

        if trial_num % (trials // 100) == 0 and trial_num > 0:
            print(
                f"Progress: {trial_num // (trials // 100)}%: "
                f"{format_percentage(successes / trial_num)}"
            )

    return format_percentage(successes / trials)


# We only use this to sanity check some math - not part of main codebase
if __name__ == "__main__":
    X = 2   # copies of target basic
    Y = 11  # total basic Pokémon in deck
    Z = 2   # desired copies in first 8 cards
    trials = 10_000_000

    prob = monte_carlo_target_basic_in_first_8(X, Y, Z, trials)

    print(
        f"Calculated for {X} target basics in deck, "
        f"{Y} total basics, {Z} copies in first 8 cards:"
    )
    print(f"Estimated probability: {prob}")
