import random

def format_percentage(probability):
    return f"{probability * 100:.5f}%"

def monte_carlo_prized_target_basic(
    target_basic_copies, total_basic_count, prized_copies, trials
):
    DECK_SIZE = 60
    HAND_SIZE = 7
    PRIZE_SIZE = 6

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

        # Draw prize cards
        prize_cards = random.sample(remaining_deck, PRIZE_SIZE)

        # Check prized target basics
        if prize_cards.count("TARGET") == prized_copies:
            successes += 1

        if trial_num % (trials // 100) == 0 and trial_num > 0:
            print(f"Progress: {trial_num // (trials // 100)}%: {format_percentage(successes / trial_num)}")

    return format_percentage(successes / trials)


# We only use this to sanity check some math - not part of main codebase
if __name__ == "__main__":
    X = 3  # Num of basics in deck we're interested in
    prized_copies = 2
    Y = 11  # total Basics
    trials = 30_000_000

    prob = monte_carlo_prized_target_basic(X, Y, prized_copies, trials)
    print(
        f"Calculated for {X} target basics in deck, {Y} total basics, {prized_copies} prized copies:"
    )
    print(f"Estimated probability: {prob}")
