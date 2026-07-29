import type { ReactNode } from "react";

export function ContentPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <section className="content-page">
        <div className="shell prose">{children}</div>
      </section>
    </>
  );
}
