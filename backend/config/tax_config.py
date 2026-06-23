"""Federal tax constants for 2026 (single filer). Update annually."""

TAX_YEAR = 2026

STANDARD_DEDUCTION_SINGLE = 15000

# (bracket_size, rate) - None means "rest of income"
ORDINARY_TAX_BRACKETS_SINGLE = [
    (11925, 0.10),
    (48475 - 11925, 0.12),
    (103350 - 48475, 0.22),
    (197300 - 103350, 0.24),
    (250525 - 197300, 0.32),
    (626350 - 250525, 0.35),
    (None, 0.37),
]

CAPITAL_GAINS_BRACKETS_SINGLE = [
    (48350, 0.0),
    (533400 - 48350, 0.15),
    (None, 0.20),
]
