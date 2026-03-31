"use client";

import { useState } from "react";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="px-2 py-1 text-xs font-medium rounded-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-container transition-colors"
    >
      {copied ? "Copied!" : label ?? "Copy"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-inverse-surface text-inverse-on-surface rounded-xl p-4 overflow-x-auto text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function PromptCard({
  title,
  subtitle,
  time,
  instructions,
  prompt,
  makeItYourOwn,
  learned,
}: {
  title: string;
  subtitle: string;
  time: string;
  instructions: string;
  prompt: string;
  makeItYourOwn: string;
  learned: string;
}) {
  return (
    <details className="group border border-outline-variant/15 rounded-xl overflow-hidden">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-surface-container-low hover:bg-surface-container-high transition-colors">
        <div>
          <span className="font-headline font-semibold text-on-surface text-sm">{title}</span>
          <span className="ml-2 text-xs text-on-surface-variant">{subtitle} &middot; {time}</span>
        </div>
        <span className="text-outline text-sm group-open:rotate-90 transition-transform">&rsaquo;</span>
      </summary>
      <div className="px-4 py-3 border-t border-outline-variant/15 space-y-3">
        <p className="text-sm text-on-surface-variant font-body leading-relaxed whitespace-pre-line">{instructions}</p>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline">Prompt</p>
            <CopyButton text={prompt} label="Copy prompt" />
          </div>
          <pre className="bg-inverse-surface text-inverse-on-surface rounded-lg p-3 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap">{prompt}</pre>
        </div>
        <div className="bg-secondary-container/10 rounded-lg p-3 space-y-1">
          <p className="text-xs font-bold text-secondary uppercase tracking-widest font-headline">Make it your own</p>
          <p className="text-xs text-on-surface-variant font-body leading-relaxed">{makeItYourOwn}</p>
        </div>
        <div className="bg-primary-container/10 rounded-lg p-3 space-y-1">
          <p className="text-xs font-bold text-primary uppercase tracking-widest font-headline">What you learned</p>
          <p className="text-xs text-on-surface-variant font-body leading-relaxed">{learned}</p>
        </div>
      </div>
    </details>
  );
}

export default function BuildTab() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
  const llmsFullUrl = `${apiUrl}/api/llms-full`;

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h2 className="font-headline font-bold text-on-surface text-xl mb-2">
          Build with Fire Shield
        </h2>
        <p className="text-sm text-on-surface-variant font-body leading-relaxed">
          A guide for students and teachers. Build AI-powered projects using real
          wildfire prevention data. No prior AI experience required.
        </p>
      </div>

      {/* Step 1: What is an agent */}
      <section className="space-y-3">
        <h3 className="font-headline font-bold text-on-surface text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center">1</span>
          Understand What an AI Agent Is
        </h3>
        <div className="bg-surface-container-lowest rounded-xl p-4 space-y-3 shadow-[0_2px_12px_rgba(27,28,26,0.04)]">
          <p className="text-sm text-on-surface font-body leading-relaxed">
            An AI agent is just an AI that can <strong>use tools</strong> and <strong>follow instructions.</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-surface-container-low rounded-lg p-3">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline mb-1">Chatbot</p>
              <p className="text-xs text-on-surface-variant font-body leading-relaxed">
                &ldquo;What plants are fire-resistant?&rdquo; &mdash; answers from training data (might be outdated).
              </p>
            </div>
            <div className="bg-secondary-container/15 rounded-lg p-3">
              <p className="text-xs font-bold text-secondary uppercase tracking-widest font-headline mb-1">Agent</p>
              <p className="text-xs text-on-surface-variant font-body leading-relaxed">
                &ldquo;What plants are fire-resistant for my yard in Jacksonville?&rdquo; &mdash; calls Fire Shield&apos;s plant database, gets real data for your zone.
              </p>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant font-body leading-relaxed">
            Building an agent means two things: giving the AI access to tools (like Fire Shield&apos;s data) and writing clear instructions. You don&apos;t need to write code to build your first agent.
          </p>
          <a
            href="https://docs.anthropic.com/en/docs/agents"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-primary font-medium hover:underline"
          >
            Read Anthropic&apos;s guide to AI agents &rarr;
          </a>
        </div>
      </section>

      {/* Step 2: Connection paths */}
      <section className="space-y-3">
        <h3 className="font-headline font-bold text-on-surface text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center">2</span>
          Give an AI Access to Fire Shield&apos;s Data
        </h3>
        <p className="text-sm text-on-surface-variant font-body leading-relaxed">
          Pick <strong>one</strong> of these three options. Each gives an AI the same Fire Shield knowledge &mdash; they differ in setup time and what the AI can do.
        </p>

        {/* Path A */}
        <details className="group border border-outline-variant/15 rounded-xl overflow-hidden" open>
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-surface-container-low hover:bg-surface-container-high transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold flex items-center justify-center">A</span>
              <span className="font-headline font-semibold text-on-surface text-sm">Copy &amp; Paste</span>
              <span className="text-xs text-on-surface-variant">Easiest &middot; No tools, no code &middot; 2 minutes</span>
            </div>
            <span className="text-outline text-sm group-open:rotate-90 transition-transform">&rsaquo;</span>
          </summary>
          <div className="px-4 py-3 border-t border-outline-variant/15 space-y-3">
            <p className="text-sm text-on-surface-variant font-body leading-relaxed">
              Dump Fire Shield&apos;s entire knowledge base into any AI chat. The AI instantly knows everything about fire-resistant plants, zone actions, and local codes.
            </p>
            <ol className="text-sm text-on-surface-variant font-body leading-relaxed space-y-1.5 list-decimal list-inside">
              <li>Open <a href="/api/llms-full" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Fire Shield&apos;s full knowledge base</a> and copy all the content.</li>
              <li>Open <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">claude.ai</a> (or ChatGPT, or any AI chat).</li>
              <li>Paste the content into a new conversation.</li>
              <li>Ask a question or tell the AI what to build &mdash; it now has all of Fire Shield&apos;s data.</li>
            </ol>
            <div className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-2">
              <code className="text-xs text-on-surface flex-1 truncate">{llmsFullUrl}</code>
              <CopyButton text={llmsFullUrl} label="Copy URL" />
            </div>
            <p className="text-xs text-on-surface-variant font-body">
              <strong>Limitation:</strong> The AI has a snapshot &mdash; it can&apos;t look up new plants or check live data. For most classroom projects, this is more than enough.
            </p>
          </div>
        </details>

        {/* Path B */}
        <details className="group border border-outline-variant/15 rounded-xl overflow-hidden">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-surface-container-low hover:bg-surface-container-high transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold flex items-center justify-center">B</span>
              <span className="font-headline font-semibold text-on-surface text-sm">Connect via MCP</span>
              <span className="text-xs text-on-surface-variant">Live tools, no code &middot; 10 minutes</span>
            </div>
            <span className="text-outline text-sm group-open:rotate-90 transition-transform">&rsaquo;</span>
          </summary>
          <div className="px-4 py-3 border-t border-outline-variant/15 space-y-3">
            <p className="text-sm text-on-surface-variant font-body leading-relaxed">
              Connect Claude Desktop to Fire Shield&apos;s live tools. Unlike copy &amp; paste, the AI can search for plants and get zone recommendations in real time.
            </p>
            <ol className="text-sm text-on-surface-variant font-body leading-relaxed space-y-1.5 list-decimal list-inside">
              <li>Download <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Claude Desktop</a>.</li>
              <li>Open settings and find MCP server configuration.</li>
              <li>Add Fire Shield&apos;s MCP server (SSE transport on port 3101).</li>
              <li>Restart Claude Desktop. You&apos;ll see <code className="text-xs bg-surface-container-low px-1 rounded">search_plants</code> and <code className="text-xs bg-surface-container-low px-1 rounded">get_zone_actions</code> as available tools.</li>
              <li>Ask anything &mdash; Claude calls Fire Shield automatically.</li>
            </ol>
            <p className="text-xs text-on-surface-variant font-body">
              <strong>This is an agent.</strong> You didn&apos;t write code, but you gave an AI real tools and it uses them autonomously.
            </p>
          </div>
        </details>

        {/* Path C */}
        <details className="group border border-outline-variant/15 rounded-xl overflow-hidden">
          <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-surface-container-low hover:bg-surface-container-high transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold flex items-center justify-center">C</span>
              <span className="font-headline font-semibold text-on-surface text-sm">Call the REST API</span>
              <span className="text-xs text-on-surface-variant">Most powerful &middot; Code required &middot; For app builders</span>
            </div>
            <span className="text-outline text-sm group-open:rotate-90 transition-transform">&rsaquo;</span>
          </summary>
          <div className="px-4 py-3 border-t border-outline-variant/15 space-y-3">
            <p className="text-sm text-on-surface-variant font-body leading-relaxed">
              For students comfortable with code. Call Fire Shield&apos;s API directly from any language to build your own app or integration.
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-on-surface-variant mb-1">Search fire-resistant plants</p>
                <CodeBlock code={`fetch("${apiUrl}/api/plants/search?zone_0_5ft=true&native=true&limit=5")\n  .then(r => r.json())\n  .then(data => console.log(data.plants))`} />
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant mb-1">Get zone actions</p>
                <CodeBlock code={`fetch("${apiUrl}/api/zones/")\n  .then(r => r.json())\n  .then(data => console.log(data.layers))`} />
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant mb-1">Ask a question (RAG with citations)</p>
                <CodeBlock code={`fetch("${apiUrl}/api/query/", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    question: "Top 3 things before fire season?",\n    profile: "simple"\n  })\n}).then(r => r.json())\n  .then(data => console.log(data.answer, data.citations))`} />
              </div>
            </div>
            <p className="text-xs text-on-surface-variant font-body">
              Full API spec: <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">/api/openapi.json</a>
            </p>
          </div>
        </details>
      </section>

      {/* Step 3: Projects */}
      <section className="space-y-3">
        <h3 className="font-headline font-bold text-on-surface text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center">3</span>
          Try It Out
        </h3>
        <p className="text-sm text-on-surface-variant font-body">
          Three ready-to-go projects. Start with the prompts exactly as written, then customize.
        </p>

        <PromptCard
          title="Build a Wildfire Safety Quiz"
          subtitle="Path A"
          time="20 minutes"
          instructions={"1. Go to /api/llms-full and copy all the content.\n2. Open claude.ai and start a new conversation.\n3. Paste the content, then add the prompt below."}
          prompt={`Using this Fire Shield data, build me an interactive wildfire safety quiz as a web app. The quiz should have 10 questions testing whether someone knows which Home Ignition Zone actions go in which zone. Use real actions and real fire science evidence from the data. Show the correct answer and a brief explanation with the evidence citation after each question. Keep score and show a result at the end with a grade and personalized recommendations. Make it look clean and modern with a warm, fire-safety color scheme.`}
          makeItYourOwn="Change the number of questions. Add a timer. Make it multiplayer. Translate it into Spanish. Add images."
          learned="How to give an AI structured data and prompt it to build an interactive application. This is prompt engineering — arguably the most important AI skill in 2026."
        />

        <PromptCard
          title="Spanish-Language Plant Guide"
          subtitle="Path B (MCP)"
          time="30 minutes"
          instructions={"1. Connect Claude Desktop to Fire Shield's MCP server (see Path B above).\n2. Start a new conversation and use the prompt below."}
          prompt={`Using the search_plants tool, find all native, low-water, deer-resistant plants suitable for the 5–30 foot zone. Then organize them by sun requirement (full sun, partial shade, shade). For each plant, include the common name, scientific name, fire behavior notes, and placement guidance. Translate everything into Spanish. Format as a printable two-column guide with English on the left and Spanish on the right. Add a header that says "Plantas Resistentes al Fuego para tu Hogar / Fire-Resistant Plants for Your Home" and include a footer with the Fire Shield website URL.`}
          makeItYourOwn="Add Vietnamese, Russian, or any language your community needs. Include care instructions. Add a seasonal planting calendar. Turn it into a poster."
          learned="How an AI agent uses tools to get live data and transforms it for a specific audience. You also built something your community genuinely needs — the intersection of AI skills and civic engagement."
        />

        <PromptCard
          title="Social Media Campaign"
          subtitle="Path A"
          time="30 minutes"
          instructions={"1. Go to /api/llms-full and copy all the content.\n2. Open claude.ai and paste it in.\n3. Add the prompt below."}
          prompt={`I'm a high school student in Southern Oregon. Using this Fire Shield data, create a 5-post Instagram/TikTok campaign to get my community to take wildfire prevention seriously before fire season in June. Each post should focus on one high-impact action from the 80/20 list. Each post needs a punchy headline under 10 words, 2–3 sentences using effectiveness framing not fear (the research says fear backfires), the specific fire science stat that supports it, and a call-to-action. Use language that sounds like a teenager talking to their neighbors, not a government pamphlet. Include suggested visual descriptions for each post and relevant hashtags. Also create a 30-second TikTok script for the most important single action, a one-page printable flyer for a community bulletin board, and an email template a student could send to their family saying "here's the one thing we should do this weekend."`}
          makeItYourOwn="Actually post it. Tag your friends. Challenge another school. Film the TikTok. Print the flyer and put it up at the library. This is real community impact, not a class exercise."
          learned="How to use AI + data to create persuasive, evidence-based communication. The research says fear messaging backfires — effectiveness framing drives more action."
        />
      </section>

      {/* Step 4: Go Deeper */}
      <section className="space-y-3">
        <h3 className="font-headline font-bold text-on-surface text-base flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center">4</span>
          Go Deeper
        </h3>

        {/* Advanced agent ideas */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline">Advanced Agent Ideas</p>
          {[
            {
              name: "The Neighborhood Knock Agent",
              desc: "Takes a street address, calls get_zone_actions for priorities, calls search_plants for recommendations, and composes a personalized letter to that household. Print and deliver them.",
              skill: "Tool chaining",
            },
            {
              name: "The Fire Season Coach",
              desc: "Checks NWS weather alerts (api.weather.gov) and combines with Fire Shield zone actions to generate timely, property-aware recommendations. Shifts to urgent mode during red flag warnings.",
              skill: "Scheduled agents + conditional logic",
            },
            {
              name: "The Block Party Planner",
              desc: "Multiple agents each represent a house on a block. Each calls Fire Shield to assess its property. A coordinator identifies which unfinished actions put the most neighbors at risk (73% of Camp Fire losses had a burning structure within 59 feet).",
              skill: "Multi-agent coordination",
            },
          ].map((idea) => (
            <div key={idea.name} className="bg-surface-container-lowest rounded-lg p-3 shadow-[0_1px_4px_rgba(27,28,26,0.04)]">
              <p className="text-sm font-headline font-semibold text-on-surface">{idea.name}</p>
              <p className="text-xs text-on-surface-variant font-body leading-relaxed mt-0.5">{idea.desc}</p>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Teaches: {idea.skill}</p>
            </div>
          ))}
        </div>

        {/* Resources table */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline">Resources</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-body">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="pb-2 pr-3 font-semibold">Resource</th>
                  <th className="pb-2 font-semibold">What It Is</th>
                </tr>
              </thead>
              <tbody className="text-on-surface">
                {[
                  ["/api/llms-full", "Everything Fire Shield knows in one file"],
                  ["/llms.txt", "Site index / table of contents for agents"],
                  ["/api/openapi.json", "Machine-readable API spec"],
                  ["/agents", "Agent integration guide"],
                ].map(([url, desc]) => (
                  <tr key={url} className="border-t border-outline-variant/15">
                    <td className="py-2 pr-3">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">{url}</a>
                    </td>
                    <td className="py-2 text-on-surface-variant">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* For teachers */}
        <div className="bg-primary-container/10 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-primary uppercase tracking-widest font-headline">For Teachers</p>
          <p className="text-sm text-on-surface-variant font-body leading-relaxed">
            Fire Shield works as a cross-curricular project:
            <strong> Science</strong> provides fire science understanding.
            <strong> English</strong> crafts the messaging.
            <strong> Tech/CS</strong> handles the AI tooling.
            <strong> Civics</strong> explores community impact and equity gaps from the Almeda Fire.
            Students don&apos;t have to pick one lane.
          </p>
        </div>

        {/* Learn more links */}
        <div className="flex flex-wrap gap-2 text-xs">
          <a href="https://docs.anthropic.com/en/docs/agents" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Anthropic Agents Guide &rarr;
          </a>
          <a href="https://modelcontextprotocol.io/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors">
            MCP Documentation &rarr;
          </a>
          <a href="https://agents.md/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high transition-colors">
            AGENTS.md Convention &rarr;
          </a>
        </div>
      </section>

      {/* Footer */}
      <div className="pt-4 border-t border-outline-variant/15 text-center">
        <p className="text-xs text-on-surface-variant font-body">
          Everything your students build from Fire Shield&apos;s data is theirs. The app is open source, the data is open, and the platform is designed for people to build on.
        </p>
      </div>
    </div>
  );
}
