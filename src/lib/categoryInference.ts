/**
 * Keyword-based category inference for free-text project descriptions, so a
 * client can describe their project in their own words instead of picking
 * from a category list up front. Shared by the client onboarding wizard and
 * the dashboard Post Project wizard.
 */

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  architecture: ["architect", "design", "drawing", "blueprint", "floor plan", "floorplan"],
  "civil-structural-engineering": ["structural", "foundation", "beam", "column", "civil engineer", "structure"],
  "general-contracting": ["build", "construction", "renovate", "renovation", "contractor", "house", "building", "bungalow", "duplex"],
  "mep-engineering": ["mep", "mechanical", "hvac design", "ventilation"],
  electrical: ["electrical", "wiring", "wire", "socket", "generator", "inverter", "power"],
  plumbing: ["plumbing", "pipe", "pipes", "water system", "hvac", "air condition", "ac unit"],
  "quantity-surveying": ["bill of quantities", "boq", "cost estimate", "quantity surveyor", "budget estimate"],
  "project-management": ["project manager", "supervise", "oversee", "coordinate", "site manager"],
  "interior-design": ["interior", "furniture", "decor", "paint", "finishing", "tiles", "tiling"],
  "land-surveying": ["land survey", "gis", "mapping", "plot", "boundary", "survey"],
  "hse-safety": ["safety", "hse", "health and safety"],
  "masonry-carpentry": ["masonry", "carpentry", "welding", "woodwork", "block work", "brick", "mason", "carpenter"],
};

export function inferCategoryId(text: string): string {
  const lower = text.toLowerCase();
  let bestId = "general-contracting";
  let bestScore = 0;
  for (const [id, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}
