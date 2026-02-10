import "./globals.css";

export const metadata = {
  title: "wingai",
  description: "Orders dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="brand">wingai</div>
            <nav className="nav">
              <a href="/">Orders</a>
              <a href="/auth">Auth</a>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}

