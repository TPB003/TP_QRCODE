import type { CSSProperties } from "react";
import { DataCtaSection, HeroSection, StylesSection, TemplatesSection, WorkflowSection } from "@client/features/marketing";
import { generatedAssets } from "@client/lib/assets";
import "@client/features/marketing/marketing.css";

export function Component() {
  return (
    <main
      className="marketing-page"
      style={{ "--paper-texture": `url(${generatedAssets.archivalPaperTexture})` } as CSSProperties}
    >
      <HeroSection />
      <WorkflowSection />
      <StylesSection />
      <TemplatesSection />
      <DataCtaSection />
    </main>
  );
}
