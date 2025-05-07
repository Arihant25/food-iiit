import SwitchButton from "@/components/navigation/SwitchButton";

export default function MessPage() {
    return (
        <div className="relative p-6">
            <div className="mx-9">
                <h1 className="text-2xl font-bold mb-4">Mess</h1>
                {/* Content for mess page goes here */}
                <div className="p-4 bg-white rounded-lg shadow">
                    <p>Mess information and meal options will be displayed here.</p>
                </div>
            </div>

            <SwitchButton />
        </div>
    );
}