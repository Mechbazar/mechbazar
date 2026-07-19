import { useState } from 'react';
import { Button, Card, Dialog, Input } from '@mechbazar/shared/web';

// Mock Data for UI demonstration
const mockVehicles = [
  { id: 1, make: 'Honda', model: 'City', variant: 'VX', year: 2018, fuel: 'Petrol' },
  { id: 2, make: 'Hyundai', model: 'Creta', variant: 'SX', year: 2022, fuel: 'Diesel' },
];

export default function Vehicles() {
  const [vehicles] = useState(mockVehicles);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Vehicle Master Management</h2>
        <Button onClick={() => setIsModalOpen(true)}>
          + Add New Vehicle
        </Button>
      </div>

      <Card variant="dark" className="!p-0 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
              <th className="p-4 font-semibold">Make</th>
              <th className="p-4 font-semibold">Model</th>
              <th className="p-4 font-semibold">Variant</th>
              <th className="p-4 font-semibold">Year</th>
              <th className="p-4 font-semibold">Fuel</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-neutral-950/70">
                <td className="p-4 text-neutral-100">{v.make}</td>
                <td className="p-4 text-neutral-100">{v.model}</td>
                <td className="p-4 text-neutral-100">{v.variant}</td>
                <td className="p-4 text-neutral-100">{v.year}</td>
                <td className="p-4 text-neutral-100">{v.fuel}</td>
                <td className="p-4 text-primary-500 cursor-pointer font-medium hover:underline">Edit</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Vehicle">
            <div className="space-y-4">
              <Input type="text" placeholder="Make (e.g., Honda)" />
              <Input type="text" placeholder="Model (e.g., City)" />
              <Input type="text" placeholder="Variant (e.g., VX)" />
              <Input type="number" placeholder="Year" />
              <div className="flex justify-end space-x-2 mt-4">
                <button className="px-4 py-2 text-neutral-400 hover:text-white" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <Button onClick={() => setIsModalOpen(false)}>Save</Button>
              </div>
            </div>
      </Dialog>
    </div>
  );
}
