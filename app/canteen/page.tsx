import SwitchButton from "@/components/navigation/SwitchButton";

export default function CanteenPage() {
    return (
        <div className="relative p-6">
            <div className="mx-9">
                <h1 className="text-2xl font-bold mb-4">Canteen</h1>
                <div className="p-4 bg-white rounded-lg shadow">
                    <p>Canteen information and options will be displayed here.</p>
                </div>
            </div>

            <SwitchButton />
        </div>
    );
}