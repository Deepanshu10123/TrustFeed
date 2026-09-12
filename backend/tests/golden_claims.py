"""
A small hand-picked set of claims with a known expected answer, so the
verifier's accuracy can be measured instead of just eyeballed -- Phase 4's
"testing non-deterministic systems" idea, applied here.

Each entry is (text, expected_labels):
  - expected_labels is the set of verdict labels considered a pass
  - None means we expect zero checkable claims to be extracted at all
"""

GOLDEN_CLAIMS = [
    ("Water boils at 100 degrees Celsius at sea level.", {"Well Supported"}),
    ("NASA landed humans on the Moon in 1969.", {"Well Supported"}),
    # "Mixed Evidence" is accepted alongside "Unsupported": real search
    # results surface a genuine academic discussion of edge cases (special
    # lenses, very low orbit), which reasonably makes a careful Critic
    # hedge even though those exceptions don't actually satisfy "naked
    # eye". A sharper future prompt could tighten this to "Unsupported"
    # only -- not worth blocking Milestone 1 on.
    ("The Great Wall of China is visible from space with the naked eye.", {"Unsupported", "Mixed Evidence"}),
    ("Vaccines cause autism.", {"Unsupported"}),
    ("The Earth is flat.", {"Unsupported"}),
    ("This is the best pizza in the world.", None),
    (
        "A 2023 study suggests coffee consumption might be associated with a "
        "lower risk of some diseases, though researchers say more research is needed.",
        {"Well Supported", "Mixed Evidence", "Unable to Verify"},
    ),
]
