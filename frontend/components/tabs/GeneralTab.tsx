"use client";

export default function GeneralTab() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="font-headline font-bold text-on-surface text-lg">Resources</h2>
      <p className="text-sm text-on-surface-variant font-body leading-relaxed">
        Ask the Digital Arborist a question to see personalized resources here.
        You can ask about grants, insurance, defensible space requirements, local
        ordinances, and more.
      </p>
      <div className="grid gap-3">
        <div className="bg-surface-container-low rounded-xl p-4">
          <p className="text-xs font-bold text-secondary uppercase tracking-widest font-headline mb-1">Quick links</p>
          <ul className="space-y-2 text-sm text-on-surface-variant font-body">
            <li>Ask about grants and financial assistance</li>
            <li>Learn about your local fire code requirements</li>
            <li>Get a personalized defensible space plan</li>
            <li>Find fire-resistant plants for your property</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
