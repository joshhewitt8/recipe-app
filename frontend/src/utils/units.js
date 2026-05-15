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
  const base = UNIT_TO_GRAMS[unit?.toLowerCase()?.trim()] ?? 1
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
