export default function CanteenAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative min-h-screen bg-main">
            {children}
        </div>
    );
}
