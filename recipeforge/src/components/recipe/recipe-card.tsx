"use client";

import { useState, useMemo } from "react";
import type { Recipe } from "@/types/recipe";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface RecipeCardProps {
  recipe: Recipe;
  onToggleVersion?: () => void;
  alternateVersion?: Recipe | null;
}

function scaleAmount(amount: number, originalServings: number, targetServings: number): number {
  return Math.round((amount / originalServings) * targetServings * 10) / 10;
}

export function RecipeCard({ recipe, onToggleVersion, alternateVersion }: RecipeCardProps) {
  const [servings, setServings] = useState(recipe.servings);
  const [showAlternate, setShowAlternate] = useState(false);
  const active = showAlternate && alternateVersion ? alternateVersion : recipe;

  const scaledIngredients = useMemo(
    () =>
      active.ingredients.map((ing) => ({
        ...ing,
        amount: scaleAmount(ing.amount, recipe.servings, servings),
      })),
    [active.ingredients, recipe.servings, servings]
  );

  return (
    <article
      data-testid="recipe-card"
      className="w-full max-w-5xl mx-auto rounded-2xl shadow-lg animate-page-enter"
      style={
        {
          "--primary": active.theme.primary,
          "--secondary": active.theme.secondary,
          "--accent": active.theme.accent,
          "--bg": active.theme.background,
          "--text": active.theme.text,
          "--muted": active.theme.muted,
          fontFamily: "var(--font-recipe)",
          backgroundColor: active.theme.background,
          color: active.theme.text,
        } as React.CSSProperties
      }
    >
      {/* Header — full bleed */}
      <div
        className="px-6 pt-6 pb-5 md:px-8 md:pt-8"
        style={{ backgroundColor: active.theme.primary }}
      >
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <Badge
            variant="secondary"
            className="font-medium text-xs"
            style={{ backgroundColor: active.theme.accent, color: "#fff" }}
          >
            {active.cuisine}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs font-medium"
            style={{ borderColor: "rgba(255,255,255,0.5)", color: "rgba(255,255,255,0.9)" }}
          >
            {active.difficulty}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs font-medium"
            style={{ borderColor: "rgba(255,255,255,0.5)", color: "rgba(255,255,255,0.9)" }}
          >
            {active.version === "home" ? "Home Cook" : "Restaurant"}
          </Badge>
        </div>

        <h1
          className="text-3xl md:text-4xl font-bold mt-2 mb-1 leading-tight"
          style={{ color: "#fff", fontFamily: "var(--font-heading)" }}
        >
          {active.title}
        </h1>
        {active.originalTitle && (
          <p className="text-base opacity-80 mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
            {active.originalTitle}
          </p>
        )}
        <p className="text-base md:text-lg mt-2 leading-relaxed opacity-90" style={{ color: "rgba(255,255,255,0.9)" }}>
          {active.description}
        </p>

        <div className="flex gap-4 mt-4 text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
          <span>Prep {active.prepTime}m</span>
          <span>Cook {active.cookTime}m</span>
          <span>Total {active.totalTime}m</span>
        </div>
      </div>

      {/* Hero illustration */}
      {active.svgIllustrations.length > 0 && (
        <div
          className="w-full flex justify-center py-6 px-4 md:py-8"
          style={{ backgroundColor: active.theme.muted }}
        >
          <div
            className="rounded-xl overflow-hidden w-full max-w-2xl"
            style={{ boxShadow: `0 4px 20px ${active.theme.primary}20` }}
          >
            <div
              className="[&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: active.svgIllustrations[0].svg }}
            />
          </div>
        </div>
      )}

      {/* Servings */}
      <div
        className="flex items-center justify-between px-6 py-4 md:px-8"
        style={{ backgroundColor: active.theme.muted }}
      >
        <span className="text-base font-semibold">
          {servings} {servings === 1 ? "serving" : "servings"}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setServings(Math.max(1, servings - 1))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-transform active:scale-90"
            style={{
              backgroundColor: active.theme.primary,
              color: "#fff",
              boxShadow: `0 2px 8px ${active.theme.primary}40`,
            }}
            aria-label="Decrease servings"
          >
            -
          </button>
          <button
            onClick={() => setServings(Math.min(20, servings + 1))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-transform active:scale-90"
            style={{
              backgroundColor: active.theme.primary,
              color: "#fff",
              boxShadow: `0 2px 8px ${active.theme.primary}40`,
            }}
            aria-label="Increase servings"
          >
            +
          </button>
        </div>
      </div>

      {/* Version toggle */}
      {alternateVersion && (
        <div className="flex px-6 py-3 md:px-8" style={{ backgroundColor: active.theme.muted }}>
          <button
            onClick={() => {
              setShowAlternate(!showAlternate);
              onToggleVersion?.();
            }}
            className="flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-200"
            style={{
              backgroundColor: showAlternate ? active.theme.primary : "transparent",
              color: showAlternate ? "#fff" : active.theme.text,
              border: showAlternate ? "none" : `2px solid ${active.theme.primary}`,
            }}
          >
            {showAlternate
              ? `Viewing: ${active.version === "home" ? "Home Cook" : "Restaurant"}`
              : "Tap for other version"}
          </button>
        </div>
      )}

      <div className="px-6 py-5 md:px-8 md:py-6 space-y-6">

          {/* Cultural context */}
          {active.culturalContext && (
            <p className="text-base md:text-lg leading-relaxed italic opacity-80">
              {active.culturalContext}
            </p>
          )}

          {/* Mobile: stacked; Desktop: ingredients left, instructions right */}
          <div className="md:grid md:grid-cols-5 md:gap-8 md:space-y-0 space-y-6">

            {/* Left column */}
            <div className="md:col-span-2 space-y-6">
              <section>
                <h2
                  className="text-xl font-bold mb-3"
                  style={{ color: active.theme.primary, fontFamily: "var(--font-heading)" }}
                >
                  Ingredients
                </h2>
                <ul className="space-y-2">
                  {scaledIngredients.map((ing, i) => (
                    <li
                      key={i}
                      className="text-base py-1.5 border-b border-dashed"
                      style={{ borderColor: active.theme.muted }}
                    >
                      <div className="flex justify-between items-baseline">
                        <span className="font-medium">{ing.name}</span>
                        <span className="font-semibold tabular-nums ml-4 shrink-0">
                          {ing.amount}
                          {ing.unit}
                        </span>
                      </div>
                      {ing.notes && (
                        <span className="text-xs italic opacity-60 mt-0.5 block">{ing.notes}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Equipment */}
              {active.equipment.length > 0 && (
                <section>
                  <h2
                    className="text-xl font-bold mb-3"
                    style={{ color: active.theme.primary, fontFamily: "var(--font-heading)" }}
                  >
                    Equipment
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {active.equipment.map((item) => (
                      <Badge
                        key={item}
                        variant="outline"
                        className="text-sm font-medium"
                        style={{ borderColor: active.theme.secondary, color: active.theme.text }}
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                  {active.equipmentNotes && (
                    <p className="text-sm italic opacity-70 leading-relaxed">{active.equipmentNotes}</p>
                  )}
                </section>
              )}

              <section>
                <h2
                  className="text-xl font-bold mb-3"
                  style={{ color: active.theme.primary, fontFamily: "var(--font-heading)" }}
                >
                  Nutrition
                </h2>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    ["cal", active.nutrition.calories],
                    ["protein", `${active.nutrition.protein}g`],
                    ["carbs", `${active.nutrition.carbs}g`],
                    ["fat", `${active.nutrition.fat}g`],
                  ].map(([label, val]) => (
                    <div key={label} className="p-3 rounded-xl" style={{ backgroundColor: active.theme.muted }}>
                      <div className="text-lg font-bold">{val}</div>
                      <div className="text-xs font-medium opacity-70">{label}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right column: instructions */}
            <div className="md:col-span-3">
              <section>
                <h2
                  className="text-xl font-bold mb-4"
                  style={{ color: active.theme.primary, fontFamily: "var(--font-heading)" }}
                >
                  Instructions
                </h2>
                <ol className="space-y-6">
                  {active.steps.map((step) => (
                    <li key={step.order} className="flex gap-4">
                      <span
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: active.theme.primary,
                          color: "#fff",
                          boxShadow: `0 2px 6px ${active.theme.primary}30`,
                        }}
                      >
                        {step.order}
                      </span>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-base leading-relaxed">{step.instruction}</p>

                        {step.why && (
                          <p className="text-sm italic opacity-70 leading-relaxed">{step.why}</p>
                        )}

                        {step.sensoryCue && (
                          <p className="text-sm leading-relaxed flex gap-1.5 items-start">
                            <span style={{ color: active.theme.accent }}>Look for:</span>
                            <span className="opacity-80">{step.sensoryCue}</span>
                          </p>
                        )}

                        {step.callout && (
                          <div
                            className="text-sm leading-relaxed rounded-lg p-3"
                            style={{
                              backgroundColor: `${active.theme.primary}10`,
                              borderLeft: `3px solid ${active.theme.primary}`,
                            }}
                          >
                            {step.callout}
                          </div>
                        )}

                        {step.duration && (
                          <span
                            className="inline-block text-sm font-medium"
                            style={{ color: active.theme.accent }}
                          >
                            ~{step.duration} min
                          </span>
                        )}

                        {step.svg && (
                          <div
                            className="rounded-xl overflow-hidden w-full"
                            style={{
                              boxShadow: `0 2px 12px ${active.theme.primary}15`,
                              border: `1px solid ${active.theme.muted}`,
                            }}
                          >
                            <div
                              className="[&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                              dangerouslySetInnerHTML={{ __html: step.svg }}
                            />
                            {step.svgCaption && (
                              <p
                                className="text-xs italic p-3 pt-0 opacity-70 text-center"
                                style={{ color: active.theme.accent }}
                              >
                                {step.svgCaption}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>

          {/* Alternative methods */}
          {active.alternativeMethods && active.alternativeMethods.length > 0 && (
            <>
              <Separator style={{ backgroundColor: active.theme.muted }} />
              <section>
                <h2
                  className="text-xl font-bold mb-4"
                  style={{ color: active.theme.primary, fontFamily: "var(--font-heading)" }}
                >
                  Alternative Methods
                </h2>
                <div className="space-y-4">
                  {active.alternativeMethods.map((m, i) => (
                    <div key={i}>
                      <h3 className="text-base font-semibold mb-1">{m.name}</h3>
                      <p className="text-sm opacity-70 mb-2">{m.description}</p>
                      <ul className="space-y-2">
                        {m.steps.map((s, j) => (
                          <li key={j} className="text-sm flex gap-2">
                            <span style={{ color: active.theme.accent }}>{j + 1}.</span>
                            <span className="opacity-80">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Pro tips */}
          {active.proTips && active.proTips.length > 0 && (
            <>
              <Separator style={{ backgroundColor: active.theme.muted }} />
              <section>
                <h2
                  className="text-xl font-bold mb-3"
                  style={{ color: active.theme.primary, fontFamily: "var(--font-heading)" }}
                >
                  Pro Tips
                </h2>
                <div className="space-y-2">
                  {active.proTips.map((tip, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span style={{ color: active.theme.accent }}>&middot;</span>
                      <span className="opacity-80 leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Storage */}
          {active.storage && (
            <>
              <Separator style={{ backgroundColor: active.theme.muted }} />
              <section>
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ color: active.theme.primary, fontFamily: "var(--font-heading)" }}
                >
                  Storage
                </h2>
                <p className="text-sm opacity-80 leading-relaxed">{active.storage}</p>
              </section>
            </>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {active.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs font-medium">
                {tag}
              </Badge>
            ))}
          </div>

          {active.sourceNotes && (
            <p className="text-sm italic leading-relaxed opacity-60">
              {active.sourceNotes}
            </p>
          )}
        </div>
    </article>
  );
}
