export default function LoginLayout({ children }) {
  return (
    // fixed inset-0 memaksa div ini menutupi seluruh layar
    // z-[99999] memastikan div ini berada di atas Sidebar dan Topbar
    <div className="fixed inset-0 z-[99999] bg-slate-100 overflow-y-auto">
      {children}
    </div>
  );
}