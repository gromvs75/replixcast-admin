export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section style={{ padding: 24 }}>
      {children}
    </section>
  );
}
