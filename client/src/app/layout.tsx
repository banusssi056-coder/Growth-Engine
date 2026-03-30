import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AmplifyConfig from '@/components/auth/AmplifyConfig';
import { Sidebar } from '@/components/layout/Sidebar';
import { GlobalSearchProvider } from '@/components/layout/GlobalSearch';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SSSI GrowthEngine",
  description: "Sales Accelerator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AmplifyConfig>
          <GlobalSearchProvider>
            <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
              {/* Sidebar - typically only for authenticated routes, but global for demo */}
              <Sidebar />
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <main className="flex-1 overflow-y-auto custom-scrollbar">
                  {children}
                </main>
              </div>
            </div>
          </GlobalSearchProvider>
        </AmplifyConfig>
      </body>
    </html>
  );
}

