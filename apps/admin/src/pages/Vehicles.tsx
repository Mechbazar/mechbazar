import { useState } from 'react';
import { Button, Card, Dialog, Input } from '@mechbazar/shared/web';

// Sample rows only -- the backend has no CRUD for vehicle master data yet
// (apps/backend/src/routes/vehicle.routes.ts only exposes GET manufacturers/
// models/variants/fuels), so this page cannot list or save real vehicles
// yet. Previously this looked like a working table with a working Save
// button; it wasn't wired to anything.
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

      <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
        Read-only preview -- adding/editing vehicle master data isn't wired to the backend yet. The rows below are sample data, not your real catalog.
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
              <p className="text-sm text-amber-300">Coming soon -- saving isn't connected to the backend yet, so nothing entered here will be kept.</p>
              <Input type="text" placeholder="Make (e.g., Honda)" disabled />
              <Input type="text" placeholder="Model (e.g., City)" disabled />
              <Input type="text" placeholder="Variant (e.g., VX)" disabled />
              <Input type="number" placeholder="Year" disabled />
              <div className="flex justify-end space-x-2 mt-4">
                <button className="px-4 py-2 text-neutral-400 hover:text-white" onClick={() => setIsModalOpen(false)}>Close</button>
              </div>
            </div>
      </Dialog>
    </div>
  );
}
