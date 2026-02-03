import random

def format_percentage(probability):
    return f"{probability * 100:.5f}%"


def monte_carlo_non_basic_in_first_8(
    target_non_basic_copies,
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
            ["TARGET"] * target_non_basic_copies
            + ["BASIC"] * total_basic_count
            + ["OTHER"] * (DECK_SIZE - target_non_basic_copies - total_basic_count)
        )

        # Mulligan until opening hand has at least one Basic
        while True:
            random.shuffle(deck)
            opening_hand = deck[:HAND_SIZE]
            if "BASIC" in opening_hand:
                break

        remaining_deck = deck[HAND_SIZE:]
        first_draw = remaining_deck[0]

        first_8 = opening_hand + [first_draw]

        # Count occurrences of target in first 8 cards
        if first_8.count("TARGET") == target_in_first_8:
            successes += 1

        # Optional progress output
        if trial_num % (trials // 100) == 0 and trial_num > 0:
            print(
                f"Progress: {trial_num // (trials // 100)}% — "
                f"{format_percentage(successes / trial_num)} so far"
            )

    return format_percentage(successes / trials)


if __name__ == "__main__":
    X = 3   # target non-basic copies
    Y = 11  # total basic Pokémon
    Z = 3   # desired copies in first 8 cards
    trials = 10_000_000

    prob = monte_carlo_non_basic_in_first_8(X, Y, Z, trials)

    print(
        f"Estimated probability that {Z} copies of target non-basic appear in first 8 cards "
        f"(given mulligans): {prob}"
    )
