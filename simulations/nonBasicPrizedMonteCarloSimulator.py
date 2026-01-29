import random

def format_percentage(probability):
    return f"{probability * 100:.5f}%"

def monte_carlo_prized_target_non_basic(
    target_non_basic_copies,  
    total_basic_count,        
    prized_copies,            
    trials
):
    DECK_SIZE = 60
    HAND_SIZE = 7
    PRIZE_SIZE = 6

    successes = 0

    for trial_num in range(trials):
        # Build deck
        deck = (
            ["TARGET"] * target_non_basic_copies
            + ["BASIC"] * total_basic_count
            + ["OTHER"] * (
                DECK_SIZE
                - target_non_basic_copies
                - total_basic_count
            )
        )

        # Mulligan until opening hand has ≥1 Basic Pokémon
        while True:
            random.shuffle(deck)
            opening_hand = deck[:HAND_SIZE]
            if "BASIC" in opening_hand:
                break

        remaining_deck = deck[HAND_SIZE:]

        # Draw prize cards
        prize_cards = random.sample(remaining_deck, PRIZE_SIZE)

        # Check prized target non-basics
        if prize_cards.count("TARGET") == prized_copies:
            successes += 1

        if trial_num % (trials // 100) == 0 and trial_num > 0:
            print(
                f"Progress: {trial_num // (trials // 100)}%: "
                f"{format_percentage(successes / trial_num)}"
            )

    return format_percentage(successes / trials)


# We only use this to sanity check some math - not part of main codebase
if __name__ == "__main__":
    Y = 11  # total Basic Pokémon in deck
    X = 7   # number of target non-Basic cards
    Z = 2   # number of prized target copies
    trials = 10_000_000

    prob = monte_carlo_prized_target_non_basic(X, Y, Z, trials)
    print(
        f"Calculated for {X} target non-Basics in deck, "
        f"{Y} total Basics, {Z} prized copies:"
    )
    print(f"Estimated probability: {prob}")
