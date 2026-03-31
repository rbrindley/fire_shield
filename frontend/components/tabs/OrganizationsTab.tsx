"use client";

const ORGANIZATIONS = [
  {
    name: "Rogue Valley Fire Prevention Co-op",
    description:
      "Community-based cooperative that coordinates neighborhood defensible space projects, bulk purchasing of fire-resistant plants, and seasonal work parties across Jackson and Josephine counties.",
    url: "https://roguevalleyfireprevention.org",
    focus: "Community coordination",
  },
  {
    name: "Firewise USA / NFPA",
    description:
      "National program that helps neighborhoods organize wildfire risk reduction. Several Rogue Valley communities (Ashland, Jacksonville foothills, Applegate Valley) are recognized Firewise sites with active volunteer boards.",
    url: "https://www.nfpa.org/education-and-research/wildfire/firewise-usa",
    focus: "Neighborhood recognition",
  },
  {
    name: "Oregon Department of Forestry (ODF)",
    description:
      "Administers Oregon's SB 762 defensible space program, provides free property assessments, and manages cost-share grants for fuel reduction on private land in the Rogue Valley.",
    url: "https://www.oregon.gov/odf/fire/pages/fireprevention.aspx",
    focus: "State programs & grants",
  },
  {
    name: "Southern Oregon Land Conservancy",
    description:
      "Conserves natural lands in the Rogue Valley while promoting fire-adapted landscapes. Partners with landowners on fuel reduction projects that protect both habitat and homes.",
    url: "https://landconserve.org",
    focus: "Land stewardship",
  },
  {
    name: "Jackson County Fire District 5",
    description:
      "Serves the Ashland area and surrounding communities. Offers free home assessments, Community Wildfire Protection Plans, and organizes the annual Ashland Firewise event each spring.",
    url: "https://jcfd5.com",
    focus: "Fire district services",
  },
  {
    name: "Lomakatsi Restoration Project",
    description:
      "Southern Oregon nonprofit specializing in ecological forest restoration and fuels reduction. Employs local crews for defensible space and watershed-scale fire resilience projects.",
    url: "https://lomakatsi.org",
    focus: "Forest restoration",
  },
  {
    name: "Insurance Institute for Business & Home Safety (IBHS)",
    description:
      "Research-backed Wildfire Prepared Home program. Provides the evidence base behind Fire Shield's zone actions and offers a certification path for homeowners who complete hardening.",
    url: "https://ibhs.org/wildfire",
    focus: "Research & certification",
  },
];

export default function OrganizationsTab() {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div>
        <h2 className="font-headline font-bold text-on-surface text-lg">
          Local Organizations
        </h2>
        <p className="text-xs text-on-surface-variant font-body mt-1">
          Organizations working on wildfire prevention in the Rogue Valley and
          Southern Oregon.
        </p>
      </div>

      <div className="space-y-3">
        {ORGANIZATIONS.map((org) => (
          <a
            key={org.name}
            href={org.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl bg-surface-container-lowest p-4 hover:bg-surface-container-low transition-colors group"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-headline font-semibold text-on-surface text-sm group-hover:text-primary transition-colors">
                {org.name}
                <span className="ml-1 text-outline text-xs">{"\u2197"}</span>
              </h3>
              <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-secondary font-headline bg-secondary-container/20 px-2 py-0.5 rounded-full">
                {org.focus}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-body leading-relaxed">
              {org.description}
            </p>
          </a>
        ))}
      </div>

      <div className="bg-primary-container/10 rounded-xl p-4">
        <p className="text-xs text-on-surface-variant font-body leading-relaxed">
          <strong className="text-on-surface">Know an organization we should list?</strong>{" "}
          Ask the Digital Arborist or{" "}
          <a
            href="https://github.com/rbrindley/fire_shield/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            open an issue on GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}
