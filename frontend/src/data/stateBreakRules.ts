export interface StateBreakRule {
  state: string
  name: string
  /** Minimum meal break duration in minutes (0 = no state law requirement) */
  mealBreakMinutes: number
  /** Hours of net work after which the meal break must have started (0 = no requirement) */
  triggerAfterHours: number
  /** Hours for a required second meal break (0 = none) */
  secondBreakTriggerHours: number
  /** Whether this break is paid */
  isPaid: boolean
  /** Human-readable summary of the law */
  note: string
}

export const STATE_BREAK_RULES: Record<string, StateBreakRule> = {
  AL: {
    state: 'AL', name: 'Alabama',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  AK: {
    state: 'AK', name: 'Alaska',
    mealBreakMinutes: 30, triggerAfterHours: 5, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break after 5 consecutive hours of work. (8 AAC 15.165)',
  },
  AZ: {
    state: 'AZ', name: 'Arizona',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  AR: {
    state: 'AR', name: 'Arkansas',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  CA: {
    state: 'CA', name: 'California',
    mealBreakMinutes: 30, triggerAfterHours: 4, secondBreakTriggerHours: 9, isPaid: false,
    note: '30-min unpaid break must START before the 5th hour of work (after 4 hrs). Second 30-min break required before the 10th hour. Employer owes 1 hr premium pay per missed break. (CA Labor Code §512)',
  },
  CO: {
    state: 'CO', name: 'Colorado',
    mealBreakMinutes: 30, triggerAfterHours: 5, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid meal break when shift exceeds 5 hours. (COMPS Order #38)',
  },
  CT: {
    state: 'CT', name: 'Connecticut',
    mealBreakMinutes: 30, triggerAfterHours: 7.5, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for shifts over 7.5 hours; must occur after first 2 hrs and before last 2 hrs of shift. (CT Gen. Stat. §31-51ii)',
  },
  DE: {
    state: 'DE', name: 'Delaware',
    mealBreakMinutes: 30, triggerAfterHours: 7.5, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for shifts of 7.5+ consecutive hours. (19 Del. C. §707)',
  },
  FL: {
    state: 'FL', name: 'Florida',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  GA: {
    state: 'GA', name: 'Georgia',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  HI: {
    state: 'HI', name: 'Hawaii',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  ID: {
    state: 'ID', name: 'Idaho',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  IL: {
    state: 'IL', name: 'Illinois',
    mealBreakMinutes: 20, triggerAfterHours: 7.5, secondBreakTriggerHours: 0, isPaid: false,
    note: '20-min unpaid break for shifts over 7.5 hours; break must begin no later than 5 hrs after shift start. (820 ILCS 140/3)',
  },
  IN: {
    state: 'IN', name: 'Indiana',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  IA: {
    state: 'IA', name: 'Iowa',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  KS: {
    state: 'KS', name: 'Kansas',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  KY: {
    state: 'KY', name: 'Kentucky',
    mealBreakMinutes: 30, triggerAfterHours: 5, secondBreakTriggerHours: 0, isPaid: false,
    note: 'Reasonable off-duty meal period (≥30 min) required for employees working more than 5 consecutive hours. (KRS 337.365)',
  },
  LA: {
    state: 'LA', name: 'Louisiana',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  ME: {
    state: 'ME', name: 'Maine',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for shifts of more than 6 consecutive hours. (26 M.R.S. §601)',
  },
  MD: {
    state: 'MD', name: 'Maryland',
    mealBreakMinutes: 30, triggerAfterHours: 8, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for each 8-hour consecutive work period. (MD Code, Lab. & Empl. §3-420)',
  },
  MA: {
    state: 'MA', name: 'Massachusetts',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for shifts of more than 6 hours per day. (MGL c.149 §100)',
  },
  MI: {
    state: 'MI', name: 'Michigan',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  MN: {
    state: 'MN', name: 'Minnesota',
    mealBreakMinutes: 30, triggerAfterHours: 8, secondBreakTriggerHours: 0, isPaid: false,
    note: 'Sufficient time to eat (≥30 min) must be provided for 8-hour shifts. (MN Stat. §177.253)',
  },
  MS: {
    state: 'MS', name: 'Mississippi',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  MO: {
    state: 'MO', name: 'Missouri',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  MT: {
    state: 'MT', name: 'Montana',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for most industries. Federal law applies.',
  },
  NE: {
    state: 'NE', name: 'Nebraska',
    mealBreakMinutes: 30, triggerAfterHours: 8, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min off-duty meal break for shifts of 8+ hours. (NE Rev. Stat. §48-212)',
  },
  NV: {
    state: 'NV', name: 'Nevada',
    mealBreakMinutes: 30, triggerAfterHours: 8, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid meal break for shifts of 8+ hours. (NRS 608.019)',
  },
  NH: {
    state: 'NH', name: 'New Hampshire',
    mealBreakMinutes: 30, triggerAfterHours: 5, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min break after 5 consecutive hours of work. (RSA 275:30-a)',
  },
  NJ: {
    state: 'NJ', name: 'New Jersey',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  NM: {
    state: 'NM', name: 'New Mexico',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  NY: {
    state: 'NY', name: 'New York',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid meal break for shifts over 6 hours; timing depends on shift start time. Factory workers get 60 min between 11am–2pm. (NY Labor Law §162)',
  },
  NC: {
    state: 'NC', name: 'North Carolina',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  ND: {
    state: 'ND', name: 'North Dakota',
    mealBreakMinutes: 30, triggerAfterHours: 5, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for shifts over 5 hours. (N.D. Admin. Code §46-02-07-02)',
  },
  OH: {
    state: 'OH', name: 'Ohio',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  OK: {
    state: 'OK', name: 'Oklahoma',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  OR: {
    state: 'OR', name: 'Oregon',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid meal break for shifts of 6+ hours. (ORS 653.261)',
  },
  PA: {
    state: 'PA', name: 'Pennsylvania',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  RI: {
    state: 'RI', name: 'Rhode Island',
    mealBreakMinutes: 20, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '20-min unpaid break for employees working a 6-hour period. (RIGL §28-3-14)',
  },
  SC: {
    state: 'SC', name: 'South Carolina',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  SD: {
    state: 'SD', name: 'South Dakota',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  TN: {
    state: 'TN', name: 'Tennessee',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for employees working 6 consecutive hours. (T.C.A. §50-2-103)',
  },
  TX: {
    state: 'TX', name: 'Texas',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  UT: {
    state: 'UT', name: 'Utah',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  VT: {
    state: 'VT', name: 'Vermont',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: 'Employers must provide a reasonable meal opportunity (typically 30 min) for reasonable shift lengths. (21 VSA §304)',
  },
  VA: {
    state: 'VA', name: 'Virginia',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement for adults. Federal law applies.',
  },
  WA: {
    state: 'WA', name: 'Washington',
    mealBreakMinutes: 30, triggerAfterHours: 5, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid meal period for employees working more than 5 hours. (WAC 296-126-092)',
  },
  WV: {
    state: 'WV', name: 'West Virginia',
    mealBreakMinutes: 20, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '20-min unpaid meal break per 6 hours worked. (W.Va. Code §21-3-10a)',
  },
  WI: {
    state: 'WI', name: 'Wisconsin',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min meal break is recommended (state guidance, not legally mandated). (DWD Wis. Stat. §104.066)',
  },
  WY: {
    state: 'WY', name: 'Wyoming',
    mealBreakMinutes: 0, triggerAfterHours: 0, secondBreakTriggerHours: 0, isPaid: false,
    note: 'No state meal break requirement. Federal law applies.',
  },
  DC: {
    state: 'DC', name: 'Washington D.C.',
    mealBreakMinutes: 30, triggerAfterHours: 6, secondBreakTriggerHours: 0, isPaid: false,
    note: '30-min unpaid break for shifts over 6 consecutive hours. (D.C. Code §32-1001 et seq.)',
  },
}

export const STATE_CODES = Object.keys(STATE_BREAK_RULES).sort()
