import SellerHelpBot from './SellerHelpBot'; // Import the bot we just made

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section className="relative">
      {/* The Dashboard Content */}
      {children}
      
      {/* The Floating Bot (Always on top) */}
      <SellerHelpBot />
    </section>
  );
}