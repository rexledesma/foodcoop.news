const SPECIALTY_PRODUCE_MAP: Record<string, string | undefined> = {
  'Apple- Ludacrisp ipm': 'https://specialtyproduce.com/produce/ludacrisp_apples_23100.php',
  'Cabbage-napa red organic': 'https://specialtyproduce.com/produce/red_napa_cabbage_14225.php',
  'Jicama.': 'https://specialtyproduce.com/produce/jicama_917.php',
  'Limes- key loose': 'https://specialtyproduce.com/produce/mexican_key_limes_875.php',
  'Mangos- ataulfo organic': 'https://specialtyproduce.com/produce/ataulfo_mangoes_5634.php',
  'Mint- organic': 'https://specialtyproduce.com/produce/mint_308.php',
  'Mustards- bunch various organic': 'https://specialtyproduce.com/produce/Mustard_Greens_6451.php',
  'Nopales- cactus leaves organic':
    'https://specialtyproduce.com/produce/nopales_cactus_leaf_2010.php',
  'Onion.-conventional sweet':
    'https://specialtyproduce.com/produce/california_sweet_onions_1015_2237.php',
  'Oranges- navel heirloom organic': 'https://specialtyproduce.com/produce/navel_oranges_8521.php',
  'Oro blanco.': 'https://specialtyproduce.com/produce/oro_blanco_grapefruit_60.php',
  'Pears- anjou red/green organic': 'https://specialtyproduce.com/produce/red_anjou_pears_829.php',
  'Pears- Asian Autumn Moon star sticker':
    'https://specialtyproduce.com/produce/asian_pears_922.php',
  'Pears- Asian Evergreen Orchard star sticker':
    'https://specialtyproduce.com/produce/asian_pears_922.php',
  'Persimmons- kaki': 'https://specialtyproduce.com/produce/fuyu_persimmons_9071.php',
  'Pineberries- 10oz box': 'https://specialtyproduce.com/produce/pineberries_8441.php',
  'Plants- bulbs crocus 4.5"': undefined,
  'Plants- bulbs mini Iris 4.5"': undefined,
  'Salad loose- mache organic': 'https://specialtyproduce.com/produce/mache_518.php',
  "Squash-robin's koginut organic": 'https://specialtyproduce.com/produce/koginut_squash_18560.php',
  'Strawberries- 1 lb box organic': 'https://specialtyproduce.com/produce/strawberries_87943.php',
  "Strawberries- harry's organic 1 lb":
    'https://specialtyproduce.com/produce/harrys_berries_gaviota_strawberries_4210.php',
  'Tangerine- murcott': 'https://specialtyproduce.com/produce/murcott_tangerines_2200.php',
  'Tangerine- organic murcott': 'https://specialtyproduce.com/produce/murcott_tangerines_2200.php',
  'Tangerine- tde organic':
    'https://specialtyproduce.com/produce/triple_cross_tangerines_15655.php',
  'Tomato grape - Sunripe': 'https://specialtyproduce.com/produce/grape_tomatoes_6329.php',
};

export function getSpecialtyProduceUrl(itemName: string): string | null {
  return SPECIALTY_PRODUCE_MAP[itemName] ?? null;
}
