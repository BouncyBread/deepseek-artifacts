import type { Recipe } from "@/types/recipe";

export const thaiGreenCurrySeed: Recipe = {
  id: "seed-thai-green-curry",
  title: "Thai Green Curry (Gaeng Keow Wan)",
  description:
    "A fragrant, creamy Thai green curry with tender chicken, bamboo shoots, and Thai basil — balanced between spicy, sweet, and savory.",
  cuisine: "thai",
  category: "curry",
  prepTime: 20,
  cookTime: 30,
  totalTime: 50,
  difficulty: "medium",
  servings: 4,
  ingredients: [
    { name: "boneless chicken thighs", amount: 500, unit: "g", notes: "sliced" },
    { name: "coconut milk", amount: 400, unit: "ml", notes: "full-fat, 1 can" },
    { name: "green curry paste", amount: 3, unit: "tbsp" },
    { name: "bamboo shoots", amount: 200, unit: "g", notes: "drained" },
    { name: "Thai eggplant", amount: 100, unit: "g", notes: "quartered" },
    { name: "fish sauce", amount: 2, unit: "tbsp" },
    { name: "palm sugar", amount: 1, unit: "tbsp", notes: "or brown sugar" },
    { name: "kaffir lime leaves", amount: 4, unit: "leaves", notes: "torn" },
    { name: "Thai basil leaves", amount: 1, unit: "cup" },
    { name: "green chili", amount: 2, unit: "chilies", notes: "sliced" },
    { name: "bamboo shoots", amount: 100, unit: "g" },
  ],
  steps: [
    {
      order: 1,
      instruction:
        "Scoop the thick cream from the top of the coconut milk can into a wok over medium-high heat. Stir until the oil separates — this is the crucial 'cracking' step.",
      svg: "curry-crack",
      duration: 5,
    },
    {
      order: 2,
      instruction:
        "Add green curry paste to the hot coconut oil and fry for 1-2 minutes until intensely fragrant. This blooms the spices.",
      svg: "curry-paste",
      duration: 2,
    },
    {
      order: 3,
      instruction:
        "Add chicken slices and stir-fry in the paste until sealed on the outside, about 3 minutes.",
    },
    {
      order: 4,
      instruction:
        "Pour in remaining coconut milk, add bamboo shoots, eggplant, torn kaffir lime leaves. Simmer for 15-20 minutes until chicken is cooked through.",
      duration: 20,
    },
    {
      order: 5,
      instruction:
        "Season with fish sauce and palm sugar. Stir in Thai basil and sliced green chili. Remove from heat immediately.",
      svg: "final-season",
      duration: 1,
    },
  ],
  equipment: ["Wok or large skillet", "Wooden spoon", "Chef's knife", "Cutting board"],
  nutrition: {
    calories: 420,
    protein: 28,
    carbs: 12,
    fat: 30,
    fiber: 2,
  },
  tags: ["thai", "curry", "spicy", "weeknight", "gluten-free"],
  version: "home",
  theme: {
    primary: "#C84B31",
    secondary: "#F4A261",
    accent: "#E76F51",
    background: "#FFF8F0",
    text: "#2D1810",
    muted: "#F5E6D8",
    fontFamily: "Georgia, serif",
  },
  svgIllustrations: [],
  sourceUrl: "",
  sourceNotes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const thaiGreenCurryRestaurant: Recipe = {
  ...thaiGreenCurrySeed,
  id: "seed-thai-green-curry-restaurant",
  version: "restaurant",
  title: "Thai Green Curry (Gaeng Keow Wan) — Restaurant Style",
  description:
    "An elevated version using house-made curry paste, prawn addition, and garnished with coconut cream drizzle and crispy shallots.",
  ingredients: [
    { name: "boneless chicken thighs", amount: 400, unit: "g", notes: "sliced thin" },
    { name: "large prawns", amount: 200, unit: "g", notes: "peeled, deveined" },
    { name: "coconut milk", amount: 600, unit: "ml", notes: "full-fat, 1.5 cans" },
    { name: "house-made green curry paste", amount: 4, unit: "tbsp" },
    { name: "Thai eggplant", amount: 100, unit: "g", notes: "quartered" },
    { name: "bamboo shoots", amount: 150, unit: "g", notes: "drained" },
    { name: "pea eggplants", amount: 50, unit: "g" },
    { name: "kaffir lime leaves", amount: 6, unit: "leaves", notes: "shredded" },
    { name: "galangal", amount: 3, unit: "slices" },
    { name: "fish sauce", amount: 3, unit: "tbsp" },
    { name: "palm sugar", amount: 1.5, unit: "tbsp" },
    { name: "Thai basil", amount: 1.5, unit: "cups" },
    { name: "coconut cream", amount: 3, unit: "tbsp", notes: "for drizzling" },
    { name: "crispy shallots", amount: 2, unit: "tbsp", notes: "garnish" },
    { name: "red spur chili", amount: 2, unit: "chilies", notes: "finely sliced, garnish" },
  ],
  steps: [
    {
      order: 1,
      instruction:
        "Make the house curry paste: pound green chilies, lemongrass, galangal, kaffir lime zest, shallots, garlic, coriander root, cumin, white peppercorns, and shrimp paste in a mortar until silky smooth.",
      svg: "mortar-paste",
      duration: 15,
    },
    {
      order: 2,
      instruction:
        "Reduce 200ml coconut milk in the wok until thick, then add the house paste. Fry over medium heat, stirring constantly, until the paste darkens slightly and the aroma fills the kitchen — about 5 minutes.",
      svg: "paste-bloom",
      duration: 5,
    },
    {
      order: 3,
      instruction:
        "Add chicken and stir-fry in the paste for 2 minutes. Add remaining coconut milk, galangal slices, and torn kaffir lime. Bring to a gentle simmer.",
    },
    {
      order: 4,
      instruction:
        "Add Thai eggplant, pea eggplants, and bamboo shoots. Simmer 10 minutes. Then add prawns and cook for 3 minutes until just pink.",
      duration: 13,
    },
    {
      order: 5,
      instruction:
        "Season with fish sauce and palm sugar, tasting for the balance of salty-sweet-spicy. Remove from heat. Stir in Thai basil.",
    },
    {
      order: 6,
      instruction:
        "Ladle into warmed bowls. Drizzle with coconut cream, scatter crispy shallots and sliced red chili. Serve immediately with steaming jasmine rice.",
      svg: "plating",
    },
  ],
  nutrition: {
    calories: 520,
    protein: 35,
    carbs: 14,
    fat: 36,
    fiber: 3,
  },
  tags: ["thai", "curry", "spicy", "restaurant-quality", "special-occasion", "gluten-free"],
};
