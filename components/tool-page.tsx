import type { ReactNode } from "react";
import { ToolExperience } from "@/components/tool-experience";

export function ToolPage({
  title,
  description,
  initialTool,
}: {
  title: string;
  description: ReactNode;
  initialTool: "predict" | "search";
}) {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <section className="tool-stage" style={{ paddingTop: "1.2rem" }}>
        <div className="shell">
          <ToolExperience initialTool={initialTool} />
        </div>
      </section>
    </>
  );
}
