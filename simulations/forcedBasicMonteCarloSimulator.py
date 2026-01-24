import random

def simulate_forced_target_start(
    X,              # number of 'bad' basics
    Y,              # total number of Basic Pokémon
    trials=1_000_000
):
    assert 0 <= X <= Y <= 60, "Must have 0 ≤ X ≤ Y ≤ 60"

    # Build the deck
    # C = basic we're interested in
    # B = other Basic
    # N = non-Basic
    deck = (
        ["C"] * X +
        ["B"] * (Y - X) +
        ["N"] * (60 - Y)
    )

    valid_hands = 0
    forced_target_only_hands = 0

    for _ in range(trials):
        while True:
            hand = random.sample(deck, 7)

            basics = [card for card in hand if card in ("C", "B")]

            # Mulligan if no Basic Pokémon
            if not basics:
                continue

            valid_hands += 1

            # Check if all basics are 'bad' basics
            if all(card == "C" for card in basics):
                forced_target_only_hands += 1

            break

    probability = forced_target_only_hands / valid_hands
    return probability


# We only use this to sanity check some math
if __name__ == "__main__":
    X = 1   # Num of basics we're interested in
    Y = 11   # total Basics

    prob = simulate_forced_target_start(X, Y, trials=500_000)
    print(f"Estimated probability: {prob:.6f}")
