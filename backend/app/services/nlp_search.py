"""Lightweight natural-language search understanding.

Lets clients type things like "my pipes are leaking, I need a plumber" or
"I want a tiler to fix my tiles" and talent type things like "I want tiling
jobs near me" and get relevant results, without calling an external LLM.

This is a deterministic keyword/synonym matcher: a query is compared against
a hand-built dictionary of trade phrases per category. It's not a general
NLP engine, but it covers the vocabulary people actually use for
construction/trade requests, has zero latency and zero cost, and needs no
API key. If a query doesn't hit any trigger phrase, callers fall back to
plain keyword substring matching (see extract_keywords) so the search box
still behaves like a normal search.
"""
import re

_STOPWORDS = {
    "i", "a", "an", "the", "is", "are", "am", "was", "were", "my", "me", "mine",
    "need", "needs", "needed", "want", "wants", "wanted", "looking", "look",
    "for", "to", "with", "please", "help", "someone", "who", "can", "could",
    "would", "should", "find", "get", "hire", "have", "has", "having", "it",
    "its", "this", "that", "and", "or", "of", "in", "on", "at", "be", "do",
    "does", "doing", "pls", "plz", "asap", "urgent", "urgently", "now",
    "today", "some", "any", "you", "your", "we", "us", "our", "one", "im",
    "am", "there", "here", "job", "work", "project", "please", "am",
}

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "architecture": [
        "architect", "architecture", "building design", "house plan",
        "floor plan", "design my house", "design a house", "design a building",
        "landscape architect", "interior architect", "blueprint",
    ],
    "civil-structural-engineering": [
        "civil engineer", "civil engineering", "structural engineer",
        "structural design", "structural assessment", "foundation",
        "concrete work", "site engineer", "geotechnical", "cracked wall",
        "crack in the wall", "cracks in my wall", "column design", "beam design",
        "building collapse", "load bearing",
    ],
    "general-contracting": [
        "general contractor", "general contracting", "builder", "building contractor",
        "construction company", "site supervisor", "build my house",
        "build a house", "construct a building", "renovate", "renovation",
        "extension", "turnkey", "building construction", "full construction",
    ],
    "mep-engineering": [
        "mep", "mechanical electrical plumbing", "hvac design", "mep engineer",
        "building services engineer",
    ],
    "electrical": [
        "electrician", "electrical", "wiring", "rewire", "rewiring",
        "power outage", "solar installation", "solar panel", "inverter",
        "generator installation", "circuit breaker", "socket", "switchboard",
        "fuse box", "electrical fault", "light not working", "power supply",
        "transformer", "cabling", "no light", "no power",
    ],
    "plumbing": [
        "plumber", "plumbing", "pipe", "pipes", "leaking pipe", "leaking",
        "leak", "tap", "faucet", "toilet", "water heater", "drainage",
        "borehole", "water tank", "sewage", "air conditioner", "ac repair",
        "gutter", "blocked drain", "no water", "water pump",
    ],
    "quantity-surveying": [
        "quantity surveyor", "quantity surveying", "boq", "bill of quantities",
        "cost estimate", "cost estimation", "budget for my project",
        "project cost", "contract administration", "material takeoff",
    ],
    "project-management": [
        "project manager", "project management", "site manager",
        "construction manager", "schedule my project", "coordinate contractors",
        "supervise construction", "construction timeline", "manage my build",
        "manage construction",
    ],
    "interior-design": [
        "interior designer", "interior design", "fit out", "fitout",
        "interior decorator", "furniture design", "kitchen cabinet",
        "wardrobe design", "ceiling design", "pop ceiling", "paint my house",
        "painting", "wallpaper", "home decor", "decorate my home",
    ],
    "land-surveying": [
        "land surveyor", "land survey", "surveying", "gis mapping",
        "boundary survey", "topographic survey", "site survey", "geomatics",
        "survey my land", "survey my plot",
    ],
    "hse-safety": [
        "safety officer", "hse", "health and safety", "site safety",
        "construction safety", "risk assessment",
    ],
    "masonry-carpentry": [
        "mason", "masonry", "bricklayer", "brick layer", "carpenter",
        "carpentry", "welder", "welding", "tiler", "tiling", "tile",
        "tiles", "fix my tiles", "painter", "roofer", "roofing",
        "roof leaking", "leaking roof", "fence", "gate fabrication",
        "furniture maker", "woodwork", "scaffolding", "block work",
    ],
}

def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", text.lower())

def _trigger_hits(trigger: str, q: str, q_words: set[str]) -> bool:
    if trigger in q:
        return True

    parts = trigger.split()
    return len(parts) > 1 and all(p in q_words for p in parts)

def match_categories(query: str) -> list[str]:
    """Category ids whose trigger phrases appear in the query, ranked by how
    many distinct triggers matched (most relevant first). Empty if nothing
    in the query resembles a known trade/service."""
    q = _normalize(query)
    q_words = set(q.split())
    scored: dict[str, int] = {}
    for cat_id, triggers in CATEGORY_KEYWORDS.items():
        hits = sum(1 for t in triggers if _trigger_hits(t, q, q_words))
        if hits:
            scored[cat_id] = hits
    return sorted(scored, key=lambda c: -scored[c])

def extract_keywords(query: str) -> list[str]:
    """Meaningful standalone words (3+ letters, filler words stripped) for
    fallback substring matching when no category was recognized."""
    q = _normalize(query)
    return [w for w in q.split() if len(w) >= 3 and w not in _STOPWORDS]
