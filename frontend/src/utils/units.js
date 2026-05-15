// Standard volume → grams (assuming water density)
export const UNIT_TO_GRAMS = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  oz: 28.35,
  lb: 453.6,
}

// Count-based units: { unit → { ingredient keyword → grams per unit } }
// 'default' is used when no ingredient keyword matches
const CONTEXT_UNITS = {
  clove:    { garlic: 4,   default: 4 },
  cloves:   { garlic: 4,   default: 4 },
  egg:      { default: 58 },
  eggs:     { default: 58 },
  can:      { tomato: 400, coconut: 400, bean: 400, chickpea: 400, lentil: 400, default: 400 },
  tin:      { tomato: 400, coconut: 400, bean: 400, chickpea: 400, lentil: 400, default: 400 },
  sprig:    { thyme: 1,    rosemary: 2, default: 2 },
  bunch:    { coriander: 30, parsley: 30, 'spring onion': 80, default: 30 },
  handful:  { default: 30 },
  head:     { garlic: 50,  broccoli: 400, cauliflower: 600, default: 200 },
  slice:    { bread: 35,   cheese: 20, default: 25 },
  rasher:   { bacon: 25,   default: 25 },
  sheet:    { gelatin: 2,  default: 2 },
  stick:    { butter: 113, cinnamon: 3, default: 15 },
  knob:     { butter: 15,  ginger: 10, default: 10 },
  thumb:    { ginger: 15,  default: 15 },
  fillet:   { salmon: 150, cod: 150, chicken: 150, default: 150 },
  breast:   { chicken: 180, default: 180 },
  thigh:    { chicken: 120, default: 120 },
}

export function isRecognisedUnit(unit) {
  if (!unit) return false
  const u = unit.toLowerCase().trim()
  return u in UNIT_TO_GRAMS || u in CONTEXT_UNITS
}

// Density corrections (g/ml) for ingredients that differ meaningfully from water.
// Applied on top of standard unit weights.
const DENSITIES = {
  // Soy & fermented sauces
  'soy sauce':        1.15,
  'tamari':           1.15,
  'fish sauce':       1.07,
  'oyster sauce':     1.28,
  'worcestershire':   1.07,
  'hoisin':           1.32,
  'black bean sauce': 1.20,
  'mirin':            1.09,

  // Chilli & spice pastes
  'gochujang':        1.45,
  'harissa':          1.10,
  'sriracha':         1.10,
  'hot sauce':        1.05,
  'chilli sauce':     1.10,
  'sweet chilli':     1.12,
  'sambal':           1.10,

  // Tomato
  'tomato paste':     1.08,
  'tomato puree':     1.06,
  'ketchup':          1.15,

  // Nut & seed pastes
  'tahini':           1.07,
  'peanut butter':    1.08,
  'almond butter':    1.06,
  'miso':             1.18,

  // Mustard & mayo
  'mustard':          1.09,
  'mayonnaise':       0.91,

  // Sweeteners
  'honey':            1.40,
  'maple syrup':      1.32,
  'golden syrup':     1.43,
  'agave':            1.35,
  'molasses':         1.40,
  'treacle':          1.40,

  // Oils (lighter than water)
  'olive oil':        0.91,
  'vegetable oil':    0.92,
  'sunflower oil':    0.92,
  'sesame oil':       0.92,
  'coconut oil':      0.92,
  'groundnut oil':    0.92,

  // Vinegars
  'balsamic':         1.32,
  'rice vinegar':     1.01,
  'cider vinegar':    1.01,
  'wine vinegar':     1.01,

  // Dairy
  'cream':            1.01,
  'double cream':     1.01,
  'single cream':     1.00,
  'sour cream':       1.00,
  'creme fraiche':    0.98,
  'greek yogurt':     1.04,
  'yogurt':           1.04,
  'coconut milk':     1.04,
  'coconut cream':    1.08,

  // Misc
  'sake':             0.97,
}

function getDensity(ingredientName) {
  if (!ingredientName) return 1
  const name = ingredientName.toLowerCase()
  for (const [key, density] of Object.entries(DENSITIES)) {
    if (name.includes(key)) return density
  }
  return 1
}

export function unitToGrams(unit, ingredientName = '') {
  const u = unit?.toLowerCase()?.trim() || ''
  const name = ingredientName.toLowerCase()

  // Count-based units — look up by ingredient keyword first
  if (u in CONTEXT_UNITS) {
    const map = CONTEXT_UNITS[u]
    for (const keyword of Object.keys(map)) {
      if (keyword !== 'default' && name.includes(keyword)) return map[keyword]
    }
    return map.default ?? 5
  }

  // Volume/weight units with density correction
  const base = UNIT_TO_GRAMS[u] ?? 1
  return base * getDensity(ingredientName)
}

// ── Smart unit defaults ──────────────────────────────────────────────────────

const ML_KEYWORDS = [
  'water', 'stock', 'broth', 'milk', 'cream', 'coconut milk', 'juice',
  'wine', 'beer', 'lager', 'ale', 'cider', 'spirits', 'rum', 'vodka',
]

const TBSP_KEYWORDS = [
  'soy sauce', 'fish sauce', 'oyster sauce', 'worcestershire', 'hot sauce',
  'sriracha', 'ketchup', 'mustard', 'honey', 'maple syrup', 'mirin',
  'rice vinegar', 'balsamic', 'vinegar', 'sesame oil', 'vegetable oil',
  'olive oil', 'sunflower oil', 'coconut oil', 'groundnut oil',
  'tahini', 'peanut butter', 'almond butter', 'hoisin', 'black bean sauce',
  'sweet chilli', 'chilli sauce', 'tomato puree', 'tomato paste',
]

const TSP_KEYWORDS = [
  'gochujang', 'miso', 'harissa', 'extract', 'vanilla', 'baking powder',
  'baking soda', 'bicarbonate', 'yeast', 'salt', 'pepper', 'cumin',
  'coriander', 'paprika', 'turmeric', 'cinnamon', 'cardamom', 'cloves',
  'nutmeg', 'allspice', 'chilli flakes', 'chili flakes', 'cayenne',
  'oregano', 'thyme', 'rosemary', 'mixed spice', 'garam masala',
  'curry powder', 'five spice', "za'atar", 'sumac',
]

export function suggestUnit(ingredientName) {
  const name = ingredientName.toLowerCase()
  if (TSP_KEYWORDS.some((k) => name.includes(k))) return 'tsp'
  if (TBSP_KEYWORDS.some((k) => name.includes(k))) return 'tbsp'
  if (ML_KEYWORDS.some((k) => name.includes(k))) return 'ml'
  return 'g'
}
