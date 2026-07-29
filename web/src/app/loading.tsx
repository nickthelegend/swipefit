/**
 * Route-level loading state.
 *
 * A skeleton rather than a spinner: it reserves the shape the content will
 * occupy, so the page does not jump when the real thing arrives. A spinner
 * communicates "waiting" and nothing else, and then shifts everything on
 * arrival.
 *
 * Deliberately no animation. This is a marketing site on a fast connection, so
 * the state is usually visible for well under a second — a pulse that only ever
 * flashes reads as a glitch, not as progress.
 */
export default function Loading() {
  return (
    <section className="grid-paper border-b-2 border-black" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div className="h-6 w-40 rounded-full border-2 border-black/20" />
        <div className="mt-8 h-[68px] w-[min(100%,34rem)] rounded-[13px] border-2 border-black/20" />
        <div className="mt-4 h-[68px] w-[min(100%,26rem)] rounded-[13px] border-2 border-black/20" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 rounded-[23px] border-2 border-black/20" />
          ))}
        </div>
      </div>
    </section>
  );
}
