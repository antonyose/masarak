import type { ReactNode } from "react";
import { ToolExperience } from "@/components/tool-experience";

export function ToolPage({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <section id="prediction-tool" className="tool-stage" style={{ paddingTop: "1.2rem" }}>
        <div className="shell">
          <ToolExperience />
        </div>
      </section>
    </>
  );
}
