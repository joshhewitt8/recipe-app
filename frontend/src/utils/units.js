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
  'curry powder', 'five spice', 'za\'atar', 'sumac',
]

export function suggestUnit(ingredientName) {
  const name = ingredientName.toLowerCase()
  if (TSP_KEYWORDS.some((k) => name.includes(k))) return 'tsp'
  if (TBSP_KEYWORDS.some((k) => name.includes(k))) return 'tbsp'
  if (ML_KEYWORDS.some((k) => name.includes(k))) return 'ml'
  return 'g'
}
