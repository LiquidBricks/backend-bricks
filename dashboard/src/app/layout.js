import Link from 'next/link';
import './globals.css'

export const metadata = {
  title: 'backend-bricks',
  description: 'Backend bricks admin dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #1e293b', background: '#0b1220' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>backend-bricks</div>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/" style={{ fontWeight: 500 }}>Home</Link>
            <Link href="/component-specs" style={{ fontWeight: 500 }}>Component Specs</Link>
            <Link href="/component-instances" style={{ fontWeight: 500 }}>Component Instances</Link>
            <Link href="/domain" style={{ fontWeight: 500 }}>Domain</Link>
            <Link href="/schema" style={{ fontWeight: 500 }}>Schema</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
