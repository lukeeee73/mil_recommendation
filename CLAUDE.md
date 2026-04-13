# CLAUDE.md — Military Packing Recommendation System

This file provides guidance for AI assistants working on the `mil_recommendation` codebase.

---

## Project Overview

A **Korean military enlistment packing checklist recommender** — a web app that generates personalized product recommendations for new military recruits based on body measurements, health conditions, budget, and enlistment season.

**Key characteristics:**
- Runs entirely in the browser (static site, no server required)
- Knowledge base + rule-based inference engine (not ML)
- Korean-language UI; English-friendly code identifiers
- Optional Express server for Naver Shopping API integration

---

## Architecture

```
mil_recommendation/
├── index.html          # UI form and results template
├── style.css           # Army-themed design system
├── ontology.js         # Knowledge base: classes, products, rules (64 KB)
├── reasoner.js         # Forward-chaining inference engine
├── app.js              # Client-side controller (form → reasoner → render)
├── package.json        # Node.js config (express, dotenv)
├── .env.example        # Naver API credentials template
└── server/
    ├── server.js       # Express server, POST /api/recommend
    ├── naverApi.js     # Naver Shopping Search API v1 wrapper
    ├── productMapper.js# Bridges ontology products ↔ Naver API results
    └── cache.js        # TTL in-memory cache (1hr default, API rate limit guard)
```

### Data Flow

**Client-only mode (default):**
```
index.html form → app.js → reasoner.js → ontology.js rules → render results
```

**Server mode (optional, with Naver API):**
```
POST /api/recommend → server.js → reasoner.js → productMapper.js → naverApi.js
                                                                  ↓
                                                             ontology fallback
```

---

## Key Files Deep-Dive

### ontology.js
The core knowledge base. **Do not break its structure.**

Contains five sections (delimited by `####` comments):
1. **Classes** — 40+ RDFS-style class hierarchy (Thing → Person → MilitaryRecruit; Product → BasicLiving, Hygiene, Medicine, etc.)
2. **Object Properties** — 8 relationships (hasHealthCondition, hasPriority, isRecommendedTo, etc.)
3. **Data Properties** — 9 scalar properties (height, weight, bmi, price, etc.)
4. **Named Individuals** — 96 product entries with fields: `name`, `classes`, `price`, `priceRange`, `description`, `tip`, `tags`, `quantity`
5. **Rules** — 14 inference rules as objects with `conditions[]` and `conclusions[]`

Adding a new product: add an entry to `ONTOLOGY.individuals`. Adding a new rule: add an object to `ONTOLOGY.rules`.

### reasoner.js
Forward-chaining rule engine. Key classes:
- `KnowledgeBase` — stores user input facts; `addFact(fact)`, `hasFact(fact)`, `addRecommendation(product, priority)`
- `Reasoner` — `reason(userInput)` runs all rules and returns `{ affordable, overBudget, metadata }`

`CATEGORY_META`, `CONDITION_LABEL`, `SITUATION_LABEL`, `BODY_LABEL` are exported constants used by `app.js` for display.

### app.js
Handles:
1. Form submission (`submit` event on `#profileForm`)
2. Calls `window.Reasoner.reason(userInput)`
3. Renders profile summary, budget bar, and categorized product checklist

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| JS classes / ontology types | PascalCase | `KnowledgeBase`, `FlatFoot`, `BasicLiving` |
| JS functions / variables | camelCase | `enrichWithNaverData`, `userInput` |
| Global constants | SCREAMING_SNAKE_CASE | `ONTOLOGY`, `CATEGORY_META` |
| CSS custom properties | lowercase-hyphenated | `--army-green`, `--card-bg` |
| CSS classes | lowercase-hyphenated | `.result-card`, `.priority-badge` |

---

## Development Workflows

### Run locally (static, no server)
```bash
# Just open in a browser — no build step needed
open index.html
```

### Run with Express server
```bash
cp .env.example .env
# Fill in NAVER_CLIENT_ID and NAVER_CLIENT_SECRET if you have them
npm install
npm start          # http://localhost:3000
npm run dev        # watch mode
```

### Environment variables
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NAVER_CLIENT_ID` | No | — | Naver Shopping API auth |
| `NAVER_CLIENT_SECRET` | No | — | Naver Shopping API auth |
| `PORT` | No | 3000 | Express listen port |

If Naver credentials are absent, the server falls back to ontology static data gracefully.

---

## Ontology Design Conventions

When adding products or rules, follow these patterns:

**Product individual:**
```js
{
  id: 'UniqueProductId',           // PascalCase, no spaces
  classes: ['CategoryClass'],       // e.g., ['FootCare']
  name: '제품명 (Korean display name)',
  price: 15000,                    // integer KRW, mid-range estimate
  priceRange: '10,000~20,000원',
  description: 'Short Korean description.',
  tip: 'Usage tip for the recruit.',
  tags: ['tag1', 'tag2'],          // lowercase English tags
  quantity: '1개'
}
```

**Inference rule:**
```js
{
  id: 'RuleDescriptiveName',
  conditions: [
    { type: 'hasFact', value: 'SomeCondition' }
  ],
  conclusions: [
    { type: 'addRecommendation', individual: 'ProductId', priority: 'Essential' }
    // priority: 'Essential' | 'Recommended' | 'Optional'
  ]
}
```

---

## Design System (style.css)

CSS custom properties defined at `:root`:
- `--army-green: #3d5a23` — headers, borders, primary accents
- `--army-tan: #b8a07a` — secondary accents
- `--bg: #f5f3ee` — warm page background
- `--card-bg: #ffffff` — card surfaces
- `--text: #2c2c2c` — body text

Priority colors: `--essential` (red), `--recommended` (blue), `--optional` (gray).

The layout is a single-column container (max 800px), responsive below that breakpoint.

---

## Server API

`POST /api/recommend`

Request body:
```json
{
  "height": 175,
  "weight": 70,
  "budget": 200000,
  "conditions": ["FlatFoot", "KneeIssue"],
  "situations": ["WinterEnlistment", "HasGirlfriend"]
}
```

Response:
```json
{
  "affordable": [...],
  "overBudget": [...],
  "metadata": { "labels": {}, "bmi": 22.9 }
}
```

---

## Key Constraints & Gotchas

1. **No build step.** `ontology.js`, `reasoner.js`, and `app.js` are plain ES5/ES6 scripts loaded via `<script>` tags. Do not use ES modules (`import/export`) in client files — use browser globals instead.
2. **Naver API rate limit.** 25,000 requests/day. `cache.js` guards against repeated calls. Do not bypass the cache.
3. **Korean text.** Product names, descriptions, and UI strings are in Korean. Don't replace them with English equivalents.
4. **CommonJS vs browser globals.** Server files (`server/`) use `require/module.exports`. Client files (`app.js`, `reasoner.js`, `ontology.js`) expose globals (`window.Ontology`, `window.Reasoner`). Don't mix the module systems.
5. **No test suite.** Test inference logic manually via the browser or `POST /api/recommend`. When modifying rules, verify by running through representative user profiles.

---

## Supported Conditions & Situations

**Health conditions (13):** FlatFoot, KneeIssue, BackIssue, Snoring, Hyperhidrosis (sweaty feet), SensitiveSkin, AcneSkin, DryEye, Glasses, Asthma, Digestive, Cold, Insomnia

**Enlistment seasons (4):** SpringEnlistment, SummerEnlistment, FallEnlistment, WinterEnlistment

**Situations (1):** HasGirlfriend

**BMI categories (4):** Underweight, NormalWeight, Overweight, Obese
