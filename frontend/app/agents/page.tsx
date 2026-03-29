export default function AgentsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 space-y-12">
      <header className="space-y-3">
        <h1 className="text-4xl font-headline font-extrabold text-on-surface">
          How Fire Shield is an AI Agent-Ready Platform
        </h1>
        <p className="text-lg text-on-surface-variant font-body leading-relaxed">
          This page is for humans who want to know how their agents interact
          with this site. If your agent arrives on this site, they&apos;d already
          be oriented to it. Here&apos;s how:
        </p>
      </header>

      {/* Cloudflare compatibility badge */}
      <div className="flex items-center gap-3 px-5 py-4 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(27,28,26,0.06)]">
        <svg className="w-8 h-8 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-on-surface font-headline font-semibold">
          Compatible with{" "}
          <a
            href="https://blog.cloudflare.com/markdown-for-agents/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            Cloudflare&apos;s Agent-First Websites
          </a>
        </p>
      </div>

      {/* Discovery */}
      <section className="space-y-4">
        <h2 className="text-2xl font-headline font-bold text-on-surface">
          Discovery
        </h2>
        <p className="text-on-surface-variant font-body leading-relaxed">
          Agents can discover Fire Shield capabilities through standard
          well-known files and content negotiation.
        </p>
        <div className="space-y-3">
          <EntryRow
            label="llms.txt"
            href="/llms.txt"
            description="Static site index — lists every content page, API endpoint, and MCP tool"
          />
          <EntryRow
            label="llms-full.txt"
            href="/api/llms-full"
            description="Full content dump — complete plant database + zone actions as Markdown"
          />
          <EntryRow
            label="OpenAPI spec"
            href="/api/openapi.json"
            description="Machine-readable API schema auto-generated from the FastAPI backend"
          />
          <EntryRow
            label="Content negotiation"
            href="#content-negotiation"
            description={
              <>
                Send <code className="text-sm bg-surface-container-low px-1.5 py-0.5 rounded font-mono">Accept: text/markdown</code> on
                any content page to get Markdown instead of HTML
              </>
            }
          />
        </div>
      </section>

      {/* Integration */}
      <section className="space-y-4">
        <h2 className="text-2xl font-headline font-bold text-on-surface">
          Integration
        </h2>
        <p className="text-on-surface-variant font-body leading-relaxed">
          Two primary integration paths, depending on your agent framework.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <IntegrationCard
            title="MCP Server"
            port="3101"
            transport="SSE"
            tools={[
              "search_plants — fire-resistant plant search by zone, water, native status",
              "get_zone_actions — prioritized HIZ actions for a property address",
              "nursery_lookup — find plants available at Nature Hills Nursery",
            ]}
            example={`// Claude Desktop config\n"fire-shield": {\n  "url": "https://YOUR_RAILWAY_URL/sse"\n}`}
          />
          <div className="sm:col-span-2 bg-surface-container-low rounded-xl p-5 space-y-3">
            <h3 className="font-headline font-bold text-on-surface">Connect Claude Desktop</h3>
            <p className="text-sm text-on-surface-variant font-body">
              Add this to your Claude Desktop config file
              (<code className="text-xs bg-surface-container-lowest px-1.5 py-0.5 rounded font-mono">claude_desktop_config.json</code>):
            </p>
            <pre className="text-xs bg-surface-container-lowest rounded-lg p-4 overflow-x-auto text-on-surface font-mono leading-relaxed">
{`{
  "mcpServers": {
    "fire-shield": {
      "url": "https://YOUR_RAILWAY_URL/sse"
    }
  }
}`}
            </pre>
            <p className="text-xs text-on-surface-variant font-body">
              Config file location — macOS: <code className="font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code> · Windows: <code className="font-mono">%APPDATA%\Claude\claude_desktop_config.json</code>
            </p>
          </div>
          <IntegrationCard
            title="REST API"
            port="8100"
            transport="HTTP/JSON"
            tools={[
              "POST /api/query — RAG chat with intent classification",
              "GET /api/plants/search — filterable plant database",
              "GET /api/zones/ — HIZ zone actions with priority scores",
              "POST /api/jurisdiction/resolve — geocode + jurisdiction chain",
            ]}
            example={`curl http://localhost:8100/api/plants/search?zone_0_5ft=true&water_need=low`}
          />
        </div>
      </section>

      {/* Contributing */}
      <section className="space-y-4">
        <h2 className="text-2xl font-headline font-bold text-on-surface">
          Contributing &amp; Building
        </h2>
        <p className="text-on-surface-variant font-body leading-relaxed">
          Fire Shield is designed to be extended by both humans and agents.
        </p>
        <div className="space-y-3">
          <EntryRow
            label="AGENTS.md"
            href="https://github.com/fire-shield/fire-shield/blob/main/AGENTS.md"
            description="Instructions for coding agents — architecture, conventions, env vars, test commands"
          />
          <EntryRow
            label="BUILDERS.md"
            href="https://github.com/fire-shield/fire-shield/blob/main/BUILDERS.md"
            description="Guide for humans building with Fire Shield data — API examples, starter prompts"
          />
        </div>
      </section>

      {/* Permissions */}
      <section className="space-y-4" id="content-negotiation">
        <h2 className="text-2xl font-headline font-bold text-on-surface">
          Permissions &amp; Content-Signal
        </h2>
        <p className="text-on-surface-variant font-body leading-relaxed">
          All agent-facing endpoints include a{" "}
          <code className="text-sm bg-surface-container-low px-1.5 py-0.5 rounded font-mono">
            Content-Signal
          </code>{" "}
          header that declares usage rights:
        </p>
        <div className="bg-surface-container-low rounded-xl p-5 font-mono text-sm text-on-surface leading-relaxed">
          Content-Signal: ai-train=no, search=yes, ai-input=yes
        </div>
        <ul className="space-y-1.5 text-on-surface-variant font-body text-sm">
          <li>
            <strong className="text-on-surface">ai-train=no</strong> — Do not
            use this content to train models
          </li>
          <li>
            <strong className="text-on-surface">search=yes</strong> — Content
            may appear in search indexes
          </li>
          <li>
            <strong className="text-on-surface">ai-input=yes</strong> — Agents
            may use this content as context for answering questions
          </li>
        </ul>
      </section>

      {/* Summary table */}
      <section className="space-y-4">
        <h2 className="text-2xl font-headline font-bold text-on-surface">
          Quick Reference
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="pb-3 pr-4 font-semibold">Endpoint</th>
                <th className="pb-3 pr-4 font-semibold">Format</th>
                <th className="pb-3 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              <SummaryRow endpoint="/llms.txt" format="text" purpose="Site index for agents" />
              <SummaryRow endpoint="/api/llms-full" format="markdown" purpose="Full content dump" />
              <SummaryRow endpoint="/api/openapi.json" format="JSON" purpose="OpenAPI spec" />
              <SummaryRow endpoint="/api/query" format="JSON" purpose="RAG chat + intent" />
              <SummaryRow endpoint="/api/plants/search" format="JSON" purpose="Plant database" />
              <SummaryRow endpoint="/api/zones/" format="JSON" purpose="Zone actions" />
              <SummaryRow endpoint=":3101/sse" format="SSE" purpose="MCP server" />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function EntryRow({
  label,
  href,
  description,
}: {
  label: string;
  href: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
      <a
        href={href}
        className="text-primary font-headline font-semibold text-sm shrink-0 hover:underline"
      >
        {label}
      </a>
      <p className="text-sm text-on-surface-variant font-body">{description}</p>
    </div>
  );
}

function IntegrationCard({
  title,
  port,
  transport,
  tools,
  example,
}: {
  title: string;
  port: string;
  transport: string;
  tools: string[];
  example: string;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-5 space-y-3 shadow-[0_4px_24px_rgba(27,28,26,0.06)]">
      <div className="flex items-baseline justify-between">
        <h3 className="font-headline font-bold text-on-surface">{title}</h3>
        <span className="text-xs font-body text-on-surface-variant">
          :{port} · {transport}
        </span>
      </div>
      <ul className="space-y-1 text-sm text-on-surface-variant font-body">
        {tools.map((t) => (
          <li key={t}>
            <span className="text-secondary mr-1.5">&bull;</span>
            {t}
          </li>
        ))}
      </ul>
      <pre className="text-xs bg-surface-container-low rounded-lg p-3 overflow-x-auto text-on-surface font-mono leading-relaxed">
        {example}
      </pre>
    </div>
  );
}

function SummaryRow({
  endpoint,
  format,
  purpose,
}: {
  endpoint: string;
  format: string;
  purpose: string;
}) {
  return (
    <tr className="border-t border-outline-variant/15">
      <td className="py-2.5 pr-4 font-mono text-xs">{endpoint}</td>
      <td className="py-2.5 pr-4 text-on-surface-variant">{format}</td>
      <td className="py-2.5">{purpose}</td>
    </tr>
  );
}
