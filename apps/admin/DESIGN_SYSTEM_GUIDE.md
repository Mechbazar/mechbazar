# Web Apps Implementation Guide (Admin & Vendor)

This guide explains how to update Admin and Vendor web applications to use the MechBazar Design System.

## Quick Start

### 1. Install Dependencies (if not already installed)
```bash
cd apps/admin  # or apps/vendor
npm install
```

### 2. Update Tailwind Config
✅ **Already done!** Tailwind configs have been updated with MechBazar colors.

### 3. Replace Color Classes

#### Old (Blinkit)
```tsx
<button className="bg-blinkit-green text-white">
  Click Me
</button>
```

#### New (MechBazar)
```tsx
<button className="bg-primary-500 text-white hover:bg-primary-600">
  Click Me
</button>
```

### 4. Color Replacement Guide

| Old Style        | New Style      | Use Case              |
|------------------|----------------|----------------------|
| `bg-blinkit-green` | `bg-primary-500` | Primary CTA buttons   |
| `text-blinkit-green` | `text-primary-500` | Primary text links    |
| `border-blinkit-green` | `border-primary-500` | Primary borders       |
| (no equivalent) | `bg-navy-500` | Secondary CTAs        |
| (no equivalent) | `bg-success-500` | Positive actions      |
| (no equivalent) | `bg-danger-500` | Error/delete actions  |
| `bg-blinkit-dark` | `bg-neutral-900` | Dark text/backgrounds |
| `text-blinkit-dark` | `text-neutral-900` | Dark text             |
| `bg-blinkit-light` | `bg-neutral-50` | Light backgrounds     |

---

## Implementation Steps

### Step 1: Update Page Layouts

#### Old Layout
```tsx
<div className="bg-blinkit-light p-8">
  <h1 className="text-blinkit-dark">Dashboard</h1>
  <button className="bg-blinkit-green text-white">Action</button>
</div>
```

#### New Layout
```tsx
<div className="bg-neutral-50 p-8">
  <h1 className="text-neutral-900 text-4xl font-bold">Dashboard</h1>
  <button className="bg-primary-500 text-white hover:bg-primary-600 px-4 py-2.5 rounded-lg font-semibold">
    Action
  </button>
</div>
```

### Step 2: Import & Use Components

```tsx
// pages/Dashboard.tsx
import React from 'react';
import { 
  Button, 
  Card, 
  Input, 
  Badge,
  Dialog,
  Alert,
  Tabs 
} from '@shared/components/web';

export default function Dashboard() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  return (
    <div className="p-8 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">Dashboard</h1>
        <p className="text-neutral-600">Welcome to MechBazar Admin</p>
      </div>

      {/* Alert */}
      <Alert 
        type="success"
        title="Success!"
        message="Dashboard updated successfully"
        dismissible
        className="mb-6"
      />

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card variant="elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-600 text-sm">Total Orders</p>
              <p className="text-2xl font-bold text-neutral-900">1,234</p>
            </div>
            <Badge variant="primary">+12%</Badge>
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-600 text-sm">Revenue</p>
              <p className="text-2xl font-bold text-neutral-900">$45,678</p>
            </div>
            <Badge variant="success">+8%</Badge>
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-600 text-sm">Customers</p>
              <p className="text-2xl font-bold text-neutral-900">892</p>
            </div>
            <Badge variant="info">Active</Badge>
          </div>
        </Card>
      </div>

      {/* Form Section */}
      <Card variant="outlined" className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Add New Vendor</h2>
        
        <div className="space-y-4">
          <Input 
            label="Vendor Name"
            placeholder="Enter vendor name"
            size="md"
          />
          
          <Input 
            label="Email"
            type="email"
            placeholder="vendor@example.com"
            size="md"
          />

          <Input 
            label="Phone"
            type="tel"
            placeholder="+91 XXXXXXXXXX"
            error="Invalid phone number"
            size="md"
          />

          <div className="flex gap-4 pt-4">
            <Button 
              variant="primary"
              onClick={() => setIsDialogOpen(true)}
            >
              Save Vendor
            </Button>
            <Button 
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>

      {/* Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Confirm Action"
        size="md"
        footer={
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="primary"
              onClick={() => setIsDialogOpen(false)}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-neutral-700">Are you sure you want to save this vendor?</p>
      </Dialog>

      {/* Tabs */}
      <Tabs 
        tabs={[
          {
            id: 'active',
            label: 'Active Vendors',
            content: <div className="text-neutral-700">Active vendors list...</div>
          },
          {
            id: 'inactive',
            label: 'Inactive Vendors',
            content: <div className="text-neutral-700">Inactive vendors list...</div>
          },
        ]}
      />
    </div>
  );
}
```

### Step 3: Update Navigation

```tsx
// components/Navigation.tsx
import React from 'react';
import { Navigation, Warehouse, Users, Settings } from 'lucide-react';
import { Button } from '@shared/components/web';

export default function Navigation() {
  return (
    <nav className="bg-navy-500 text-white">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation size={24} />
            <span className="text-xl font-bold">MechBazar Admin</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-primary-200">Dashboard</a>
            <a href="#" className="hover:text-primary-200">Vendors</a>
            <a href="#" className="hover:text-primary-200">Orders</a>
            <a href="#" className="hover:text-primary-200">Settings</a>
          </div>

          <Button variant="outline">Logout</Button>
        </div>
      </div>
    </nav>
  );
}
```

### Step 4: Update Tables

```tsx
// components/Table.tsx
export default function DataTable({ data }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full">
        <thead className="bg-neutral-50 border-b border-neutral-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
              Name
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
              Status
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr 
              key={idx} 
              className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors"
            >
              <td className="px-6 py-4 text-sm text-neutral-900">{row.name}</td>
              <td className="px-6 py-4 text-sm">
                <Badge 
                  variant={row.status === 'active' ? 'success' : 'warning'}
                >
                  {row.status}
                </Badge>
              </td>
              <td className="px-6 py-4 text-sm flex gap-2">
                <Button variant="ghost" size="sm">Edit</Button>
                <Button variant="danger" size="sm">Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 5: Update Forms

```tsx
// components/VendorForm.tsx
import { Button, Card, Input, Alert } from '@shared/components/web';
import React, { useState } from 'react';

export default function VendorForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validation & submission logic
    setSubmitStatus({ type: 'success', message: 'Vendor saved successfully!' });
  };

  return (
    <Card variant="elevated" className="max-w-2xl">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Add Vendor</h2>

      {submitStatus && (
        <Alert 
          type={submitStatus.type}
          message={submitStatus.message}
          className="mb-6"
          dismissible
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Vendor Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter full name"
          error={errors.name}
        />

        <Input
          label="Email Address"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="vendor@mechbazar.com"
          error={errors.email}
        />

        <Input
          label="Phone Number"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+91 9876543210"
          error={errors.phone}
        />

        <div className="flex gap-4 pt-4">
          <Button type="submit" variant="primary">
            Save Vendor
          </Button>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

---

## Color Reference Sheet

```tsx
// Use these exact class names
Primary Colors:
- bg-primary-50 through bg-primary-900
- text-primary-50 through text-primary-900
- border-primary-50 through border-primary-900
- hover:bg-primary-600, hover:text-primary-600

Navy Colors:
- bg-navy-50 through bg-navy-900
- text-navy-50 through text-navy-900

Semantic Colors:
- bg-success-500, text-success-500
- bg-warning-500, text-warning-500
- bg-danger-500, text-danger-500
- bg-info-500, text-info-500

Neutral Colors:
- bg-neutral-50 through bg-neutral-900
- text-neutral-50 through text-neutral-900
```

---

## Common Patterns

### Button Group
```tsx
<div className="flex gap-3">
  <Button variant="primary">Save</Button>
  <Button variant="outline">Cancel</Button>
  <Button variant="danger">Delete</Button>
</div>
```

### Status Badge
```tsx
<Badge variant={status === 'active' ? 'success' : 'warning'}>
  {status}
</Badge>
```

### Empty State
```tsx
<Card variant="outlined" className="text-center py-12">
  <h3 className="text-lg font-semibold text-neutral-900 mb-2">
    No data found
  </h3>
  <p className="text-neutral-600 mb-4">
    Create your first item to get started
  </p>
  <Button variant="primary">Create Item</Button>
</Card>
```

---

## Responsive Design Examples

### Mobile-First Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</div>
```

### Responsive Text
```tsx
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Title
</h1>
```

### Responsive Padding
```tsx
<div className="p-4 md:p-6 lg:p-8">
  Content
</div>
```

---

## Next Steps

1. ✅ Tailwind config updated with MechBazar colors
2. → Review and update page layouts
3. → Replace component colors
4. → Test responsive design on mobile/tablet
5. → Verify accessibility (keyboard nav, screen readers)
6. → Deploy to staging environment

---

**Last Updated**: July 14, 2026
