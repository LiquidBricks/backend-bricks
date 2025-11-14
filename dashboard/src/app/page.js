export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem' }}>
      <header style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0 }}>backend-bricks</h1>
        <p style={{ maxWidth: 560, margin: '1rem auto 0', fontSize: '1.1rem', color: '#94a3b8' }}>
          Kickstart the next iteration of the backend-bricks dashboard with a fresh Next.js foundation.
        </p>
      </header>
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
        <div style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', minWidth: 240, background: '#111827' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Get Started</h2>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5f5' }}>
            <li>Install dependencies: <code>npm install</code></li>
            <li>Run the dev server: <code>npm run dev</code></li>
            <li>Build your dashboard features</li>
          </ol>
        </div>
        <div style={{ border: '1px solid #1e293b', borderRadius: 12, padding: '1.5rem', minWidth: 240, background: '#111827' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Project Notes</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5f5' }}>
            <li>App Router ready</li>
            <li>Strict Mode enabled</li>
            <li>Tailwind or design system friendly</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
