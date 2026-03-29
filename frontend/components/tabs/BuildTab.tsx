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

const STARTER_PROMPTS = [
  {
    title: "Build a Wildfire Safety Quiz",
    subtitle: "Zero code, 5 minutes",
    prompt: `Here is the complete data from Fire Shield, a wildfire prevention app for Southern Oregon.

[paste the content from /api/llms-full here]

Using this data, build me an interactive wildfire safety quiz as a React app. The quiz should:
- Have 10 questions testing whether someone knows which Home Ignition Zone actions go in which zone.
- Use real actions and real fire science evidence from the data.
- Show the correct answer and a brief explanation (with the evidence citation) after each question.
- Keep score and show a result at the end with a grade and personalized recommendations.
- Look clean and modern with a fire/safety color scheme.`,
  },
  {
    title: "Spanish-Language Plant Guide",
    subtitle: "MCP or llms-full.txt",
    prompt: `Using the search_plants tool, find all native, low-water, deer-resistant plants suitable for the 5-30 foot zone. Then:
1. Organize them by sun requirement (full sun, partial shade, shade).
2. For each plant, include: the common name, scientific name, fire behavior notes, and placement guidance.
3. Translate everything into Spanish.
4. Format as a printable two-column guide (English on the left, Spanish on the right).
5. Add a header: "Plantas Resistentes al Fuego para tu Hogar / Fire-Resistant Plants for Your Home"`,
  },
  {
    title: "Social Media Campaign from Fire Science",
    subtitle: "llms-full.txt, 10 minutes",
    prompt: `I'm a high school student in Ashland, Oregon. I want to create a social media campaign to get my community to take wildfire prevention seriously before fire season starts in June.

Create a 5-post Instagram/TikTok campaign that:
1. Each post focuses on ONE high-impact action.
2. Each post includes: a punchy headline, 2-3 sentences using effectiveness framing, the specific fire science stat, and a call-to-action.
3. Use language that sounds like a teenager talking to their neighbors.
4. Include suggested visual descriptions for each post.
5. Include relevant hashtags for the Rogue Valley community.`,
  },
];

export default function BuildTab() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
  const llmsFullUrl = `${apiUrl}/api/llms-full`;

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div>
        <h2 className="font-headline font-bold text-on-surface text-lg mb-1">Build with Fire Shield</h2>
        <p className="text-sm text-on-surface-variant font-body">
          Use Fire Shield's data to build wildfire prevention tools for your community.
        </p>
      </div>

      {/* LLMs full URL */}
      <div className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-2">
        <code className="text-xs text-on-surface flex-1 truncate">{llmsFullUrl}</code>
        <CopyButton text={llmsFullUrl} label="Copy URL" />
      </div>

      {/* Starter Prompts */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-headline">
          Starter Prompts
        </p>
        {STARTER_PROMPTS.map((p) => (
          <details
            key={p.title}
            className="group border border-outline-variant/15 rounded-lg overflow-hidden"
          >
            <summary className="flex items-center justify-between px-3 py-2 cursor-pointer bg-surface-container-low hover:bg-surface-container-high transition-colors">
              <div>
                <span className="font-medium text-on-surface text-sm">{p.title}</span>
                <span className="ml-2 text-xs text-on-surface-variant">{p.subtitle}</span>
              </div>
              <span className="text-outline text-sm group-open:rotate-90 transition-transform">&rsaquo;</span>
            </summary>
            <div className="px-3 py-2 border-t border-outline-variant/15">
              <div className="flex justify-end mb-1">
                <CopyButton text={p.prompt} label="Copy prompt" />
              </div>
              <pre className="bg-inverse-surface text-inverse-on-surface rounded-lg p-3 overflow-x-auto text-xs leading-relaxed whitespace-pre-wrap">
                {p.prompt}
              </pre>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
