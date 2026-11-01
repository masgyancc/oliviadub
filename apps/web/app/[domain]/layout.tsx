// BrewCC: pages under a short-link domain carry no upstream marketing nav or footer
export default function ExternalPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-neutral-50/80">
      {children}
    </div>
  );
}
