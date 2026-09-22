export function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-hairline bg-paper-raised px-6 py-4">
        <p className="text-eyebrow font-semibold uppercase tracking-wide text-ink-secondary">
          Similarity and clustering workbench
        </p>
        <h1 className="text-display font-semibold tracking-tight text-ink">Legajo</h1>
      </header>
      <main className="p-6">
        <p className="text-body text-ink-secondary">
          Corpus selection, similarity comparison and hierarchical clustering views load here.
        </p>
      </main>
    </div>
  );
}

export default App;
