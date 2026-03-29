import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-12">
      <header className="text-center space-y-3">
        <h1 className="text-4xl font-headline font-extrabold text-on-surface">
          About Fire Shield
        </h1>
        <p className="text-lg text-on-surface-variant font-body max-w-2xl mx-auto leading-relaxed">
          Protect. Plant. Prepare.
        </p>
      </header>

      <div className="rounded-xl overflow-hidden shadow-[0_4px_24px_rgba(27,28,26,0.06)]">
        <Image
          src="/about-fire-shield.png"
          alt="Fire Shield — Shared Knowledge, Sustainable Funding, and Community Engagement"
          width={1200}
          height={600}
          className="w-full h-auto"
          priority
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-3">
        <div className="space-y-2">
          <h2 className="text-lg font-headline font-bold text-on-surface">Shared Knowledge</h2>
          <p className="text-sm text-on-surface-variant font-body leading-relaxed">
            Fire Shield combines peer-reviewed fire science, local building codes, and community expertise
            into one open-source platform. Every recommendation is cited back to its source so you can
            trust what you read.
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-headline font-bold text-on-surface">Sustainable Funding</h2>
          <p className="text-sm text-on-surface-variant font-body leading-relaxed">
            By connecting homeowners directly to fire-resistant plant nurseries and local suppliers,
            Fire Shield creates a sustainable funding model that keeps the platform free for the community
            while supporting the native plant economy.
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-headline font-bold text-on-surface">Community Engagement</h2>
          <p className="text-sm text-on-surface-variant font-body leading-relaxed">
            From classroom lessons to neighborhood action plans, Fire Shield is designed to be used by
            teachers, students, firefighters, and families. Our MCP server lets any AI agent access
            the same data, turning one app into open infrastructure.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline font-bold text-on-surface">Why Fire Shield Exists</h2>
        <p className="text-on-surface-variant font-body leading-relaxed">
          The 2020 Almeda Fire destroyed over 2,500 homes in Southern Oregon&apos;s Rogue Valley.
          Research shows that homes with basic defensible space are up to 90% more likely to survive
          a wildfire &mdash; yet only about 15% of at-risk homes have it. Fire Shield exists to close that gap.
        </p>
        <p className="text-on-surface-variant font-body leading-relaxed">
          We use the Home Ignition Zone (HIZ) framework to break the problem into manageable layers:
          from the structure itself out to 100+ feet. Enter your address, and Fire Shield generates a
          prioritized action plan scoped to your exact jurisdiction, with cited sources from IBHS, NFPA,
          CAL FIRE, and local Oregon codes.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline font-bold text-on-surface">Built for the Rogue Valley</h2>
        <p className="text-on-surface-variant font-body leading-relaxed">
          Fire Shield covers 13 jurisdictions across Jackson and Josephine counties: Ashland, Jacksonville,
          Medford, Talent, Phoenix, Central Point, Eagle Point, and more. Each jurisdiction has its own
          rules, and Fire Shield resolves your address to the right city &rarr; county &rarr; state chain
          automatically.
        </p>
      </section>

      <footer className="text-center text-sm text-on-surface-variant font-body pt-8 border-t border-outline-variant/15">
        <p>
          Fire Shield is open source.{" "}
          <a
            href="https://github.com/rbrindley/fire_shield"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
