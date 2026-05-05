export type Difficulty = "easy" | "medium" | "hard";
export type RecipeVersion = "home" | "restaurant";
export type CuisineCategory =
  | "thai"
  | "italian"
  | "japanese"
  | "mexican"
  | "indian"
  | "chinese"
  | "french"
  | "korean"
  | "mediterranean"
  | "american"
  | "middle-eastern"
  | "other";

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  notes?: string;
}

export interface Step {
  order: number;
  instruction: string;
  why?: string;
  sensoryCue?: string;
  svg?: string;
  svgCaption?: string;
  duration?: number;
  needsIllustration?: boolean;
  callout?: string;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface RecipeTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
  fontFamily: string;
}

export interface SvgIllustration {
  id: string;
  label: string;
  svg: string;
}

export interface AlternativeMethod {
  name: string;
  description: string;
  steps: string[];
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  cuisine: string;
  category: string;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  difficulty: Difficulty;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  equipment: string[];
  nutrition: Nutrition;
  tags: string[];
  version: RecipeVersion;
  theme: RecipeTheme;
  svgIllustrations: SvgIllustration[];
  culturalContext?: string;
  proTips?: string[];
  storage?: string;
  alternativeMethods?: AlternativeMethod[];
  equipmentNotes?: string;
  originalTitle?: string;
  html?: string;
  sourceUrl?: string;
  sourceNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  recipeId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface RecipeWithChat {
  recipe: Recipe;
  chatHistory: ChatMessage[];
}
