// The real root layout (with <html lang>) is app/[locale]/layout.tsx; this one only passes through.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
