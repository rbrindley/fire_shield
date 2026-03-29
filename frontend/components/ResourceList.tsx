"use client";

interface ResourceLink {
  title: string;
  description: string;
  intent_tag: string;
  url?: string;
}

interface ResourceListProps {
  links: ResourceLink[];
  onLinkClick: (link: ResourceLink) => void;
}

export default function ResourceList({ links, onLinkClick }: ResourceListProps) {
  if (links.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-headline px-1">
        Resources
      </p>
      <div className="space-y-1">
        {links.map((link, i) => (
          <button
            key={`${link.title}-${i}`}
            onClick={() => {
              if (link.url) {
                window.open(link.url, "_blank", "noopener,noreferrer");
              } else {
                onLinkClick(link);
              }
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors group"
          >
            <div className="flex items-start gap-2">
              <span className="text-xs text-outline font-mono mt-0.5">{i + 1}.</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors truncate">
                  {link.title}
                  {link.url && <span className="ml-1 text-outline text-xs">\u2197</span>}
                </p>
                <p className="text-xs text-on-surface-variant truncate">{link.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
