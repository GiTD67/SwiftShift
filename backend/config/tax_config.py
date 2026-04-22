"""Federal tax constants for 2024 (single filer). Update annually."""

TAX_YEAR = 2024

STANDARD_DEDUCTION_SINGLE = 14600

# (bracket_size, rate) — None means "rest of income"
ORDINARY_TAX_BRACKETS_SINGLE = [
    (11600, 0.10),
    (47150 - 11600, 0.12),
    (100525 - 47150, 0.22),
    (191950 - 100525, 0.24),
    (243725 - 191950, 0.32),
    (609350 - 243725, 0.35),
    (None, 0.37),
]

CAPITAL_GAINS_BRACKETS_SINGLE = [
    (47025, 0.0),
    (518900 - 47025, 0.15),
    (None, 0.20),
]
