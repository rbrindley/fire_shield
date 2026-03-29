# Build with Fire Shield

Fire Shield is an open-source wildfire prevention assistant for the Rogue Valley in Southern Oregon. It combines fire science research, local building codes, and a database of 100+ fire-resistant plants to help homeowners protect their properties using the Home Ignition Zone (HIZ) framework. The 2020 Almeda Fire destroyed 2,500+ homes in this region -- and research shows that homes with basic defensible space are up to 90% more likely to survive a wildfire. Yet only ~15% of at-risk homes have it. Fire Shield exists to close that gap.

This document is for **students, teachers, developers, and anyone** who wants to build on top of Fire Shield's data and APIs. You don't need to understand the full codebase. Pick the access path that matches your skill level and start building.

---

## What Data Is Available

| Category | What's In It | Example Use |
|----------|-------------|-------------|
| **Fire-resistant plants** | 100+ plants with zone eligibility, water needs, native status, deer resistance, fire behavior notes | Build a plant recommendation quiz |
| **Zone actions** | 17 evidence-based actions across 5 HIZ layers (0-100+ ft), each with citations, cost/effort/time estimates | Create a prioritized checklist app |
| **Fire science evidence** | Key findings from peer-reviewed research on what saves homes (ember exposure, defensible space, building materials) | Make data visualizations of survival rates |
| **Jurisdiction codes** | 13 Southern Oregon jurisdictions with city-county-state-federal hierarchy chains | Build location-aware tools |
| **Live conditions** | NWS weather alerts and fire weather data via the chat API | Create alert dashboards |

---

## Three Ways to Access the Data

### Path 1: No Code Needed (5 minutes)

Go to your Fire Shield instance's `/api/llms-full` endpoint. Copy the entire content. Paste it into Claude, ChatGPT, or any LLM. Ask it to build something.

You now have all of Fire Shield's knowledge in your AI assistant and can create anything from it -- quizzes, guides, social media campaigns, data visualizations, lesson plans.

**Try it now:**
```
1. Open https://your-fire-shield-url/api/llms-full
2. Select all, copy
3. Open claude.ai (or any LLM)
4. Paste the content and add your prompt
```

### Path 2: REST API (Beginner-Intermediate)

Call Fire Shield's API endpoints from any programming language, curl, or browser.

**Search for plants:**
```bash
curl "http://localhost:8100/api/plants/search?zone=5-30ft&native=true&limit=5"
```

**Get zone actions:**
```bash
curl "http://localhost:8100/api/zones/"
```

**Resolve a jurisdiction:**
```bash
curl -X POST "http://localhost:8100/api/jurisdiction/resolve" \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main St, Ashland, OR"}'
```

**Ask a question (RAG):**
```bash
curl -X POST "http://localhost:8100/api/query/" \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the top 3 things I should do before fire season?", "profile": "simple"}'
```

### Path 3: MCP Server (Advanced)

Connect any MCP-compatible AI tool (Claude Desktop, Cursor, custom agents) to Fire Shield's MCP server. The AI can call `search_plants` and `get_zone_actions` tools directly, combining Fire Shield's data with its own reasoning.

**MCP Connection:** Configure your MCP client to connect to the Fire Shield MCP server's SSE endpoint. Two tools are available:

- `search_plants` -- Search the fire-resistant plant database with filters (zone, native, deer-resistant, water need, sun)
- `get_zone_actions` -- Get prioritized HIZ zone actions with seasonal boosting for any address

---

## Project Ideas

| Project | Difficulty | Time | Tools Needed | Description |
|---------|-----------|------|-------------|-------------|
| Wildfire Safety Quiz | Beginner | 1-2 hours | LLM + llms-full.txt | Paste Fire Shield data into an LLM, prompt it to build an interactive quiz testing HIZ zone knowledge |
| Spanish Plant Guide | Beginner | 1-2 hours | LLM + MCP or llms-full.txt | Generate a bilingual plant recommendation guide for Spanish-speaking community members |
| Social Media Campaign | Beginner-Intermediate | 2-3 hours | LLM + llms-full.txt | Create a series of social media posts, infographics, and short scripts using fire science data |
| Neighborhood Flyer Generator | Intermediate | 2-4 hours | REST API + HTML/CSS | Build a web page that generates a printable flyer with top actions for a specific address |
| Plant Comparison Tool | Intermediate | 3-5 hours | REST API + JS | Build an interactive tool that compares fire-resistant plants side-by-side with trait visualizations |
| Gamified Challenge App | Intermediate-Advanced | 4-8 hours | REST API + JS/React | Build a point-based system where households earn points for completing zone actions, with a leaderboard |
| Voice-Based Fire Shield | Advanced | 4-8 hours | MCP + speech API | Build a voice interface so elderly residents can ask Fire Shield questions by speaking |
| Multi-Language Agent | Advanced | 4-8 hours | MCP + LLM | Build an agent that detects the user's language and responds in that language using Fire Shield data |
| Notification Bot | Advanced | 4-8 hours | REST API + Twilio/Resend | Build a bot that sends seasonal text or email reminders based on a user's address and zone actions |
| Custom Data Visualization | Advanced | 4-8 hours | REST API + D3/Chart.js | Visualize fire science data -- survival rates by building code era, HIZ zone effectiveness, cost-benefit ratios |

---

## Starter Prompts

Copy-paste these into any LLM to get started immediately.

### Example A: "Build a Wildfire Safety Quiz" (Zero Code, 5 Minutes)

```
Here is the complete data from Fire Shield, a wildfire prevention app for Southern Oregon.

[paste the content from /api/llms-full here]

Using this data, build me an interactive wildfire safety quiz as a React app. The quiz should:
- Have 10 questions testing whether someone knows which Home Ignition Zone actions go in which zone.
- Use real actions and real fire science evidence from the data.
- Show the correct answer and a brief explanation (with the evidence citation) after each question.
- Keep score and show a result at the end with a grade and personalized recommendations.
- Look clean and modern with a fire/safety color scheme.
```

### Example B: "Build a Spanish-Language Plant Guide" (MCP)

```
Using the search_plants tool, find all native, low-water, deer-resistant plants suitable
for the 5-30 foot zone. Then:
1. Organize them by sun requirement (full sun, partial shade, shade).
2. For each plant, include: the common name, scientific name, fire behavior notes, and placement guidance.
3. Translate everything into Spanish.
4. Format as a printable two-column guide (English on the left, Spanish on the right).
5. Add a header: "Plantas Resistentes al Fuego para tu Hogar / Fire-Resistant Plants for Your Home"
```

### Example C: "Create a Social Media Campaign from Fire Science"

```
Here is the complete data from Fire Shield, a wildfire prevention app for Southern Oregon.
It includes fire science evidence, Home Ignition Zone actions, plant data, and local context
including the 2020 Almeda Fire.

[paste the content from /api/llms-full here]

I'm a high school student in Ashland, Oregon. I want to create a social media campaign to
get my community to take wildfire prevention seriously before fire season starts in June.

Create a 5-post Instagram/TikTok campaign that:
1. Each post focuses on ONE high-impact action from the data (use the 80/20 actions).
2. Each post includes: a punchy headline (under 10 words), 2-3 sentences using effectiveness
   framing (not fear), the specific fire science stat that supports it, and a call-to-action.
3. Use language that sounds like a teenager talking to their neighbors, not a government pamphlet.
4. Include suggested visual descriptions for each post.
5. Include relevant hashtags for the Rogue Valley community.
6. Create one "challenge" post that asks people to do one action and tag a neighbor.

Also create:
- A 30-second TikTok script for the most important single action.
- A one-page printable flyer version of the campaign.
- A parent-friendly email template a student could send to their family.
```

---

## About Fire Shield

Fire Shield is open source and built for the Rogue Valley wildfire prevention community. The core app provides address-specific zone actions, evidence-cited chat, and a fire-resistant plant database -- all grounded in peer-reviewed fire science and local building codes.

**Repository:** [github.com/rbrindley/fire_shield](https://github.com/rbrindley/fire_shield)
**License:** Open source
