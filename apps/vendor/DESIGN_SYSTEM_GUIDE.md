# Web Apps Implementation Guide (Admin & Vendor)

This guide explains how to update Admin and Vendor web applications to use the MechBazar Design System.

## Quick Start

### 1. Install Dependencies (if not already installed)
```bash
cd apps/vendor
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
  <h1 className="text-blinkit-dark">Inventory</h1>
  <button className="bg-blinkit-green text-white">Action</button>
</div>
```

#### New Layout
```tsx
<div className="bg-neutral-50 p-8">
  <h1 className="text-neutral-900 text-4xl font-bold">Inventory</h1>
  <button className="bg-primary-500 text-white hover:bg-primary-600 px-4 py-2.5 rounded-lg font-semibold">
    Action
  </button>
</div>
```

### Step 2: Import & Use Components

```tsx
// pages/Inventory.tsx
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

export default function Inventory() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  return (
    <div className="p-8 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">Inventory</h1>
        <p className="text-neutral-600">Manage your products and stock</p>
      </div>

      {/* Alert */}
      <Alert 
        type="success"
        title="Success!"
        message="Inventory updated successfully"
        dismissible
        className="mb-6"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card variant="elevated">
          <div>
            <p className="text-neutral-600 text-sm">Total Products</p>
            <p className="text-2xl font-bold text-neutral-900">456</p>
          </div>
        </Card>

        <Card variant="elevated">
          <div>
            <p className="text-neutral-600 text-sm">Low Stock</p>
            <p className="text-2xl font-bold text-neutral-900">23</p>
            <Badge variant="warning" className="mt-2">Alert</Badge>
          </div>
        </Card>

        <Card variant="elevated">
          <div>
            <p className="text-neutral-600 text-sm">Total Value</p>
            <p className="text-2xl font-bold text-neutral-900">$125,450</p>
          </div>
        </Card>

        <Card variant="elevated">
          <div>
            <p className="text-neutral-600 text-sm">Variants</p>
            <p className="text-2xl font-bold text-neutral-900">1,234</p>
          </div>
        </Card>
      </div>

      {/* Product Form */}
      <Card variant="outlined" className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Add Product</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="Product Name"
            placeholder="Enter product name"
          />
          
          <Input 
            label="SKU"
            placeholder="Enter SKU"
          />

          <Input 
            label="Category"
            placeholder="Select category"
          />

          <Input 
            label="Price"
            type="number"
            placeholder="Enter price"
          />

          <Input 
            label="Stock Quantity"
            type="number"
            placeholder="Enter quantity"
          />

          <Input 
            label="Reorder Level"
            type="number"
            placeholder="Low stock threshold"
          />

          <div className="md:col-span-2 flex gap-4 pt-4">
            <Button 
              variant="primary"
              onClick={() => setIsDialogOpen(true)}
            >
              Add Product
            </Button>
            <Button variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </Card>

      {/* Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Confirm Product Addition"
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
        <p className="text-neutral-700">Are you sure you want to add this product?</p>
      </Dialog>

      {/* Tabs */}
      <Tabs 
        tabs={[
          {
            id: 'in-stock',
            label: 'In Stock',
            content: <div className="text-neutral-700">Products in stock...</div>
          },
          {
            id: 'low-stock',
            label: 'Low Stock',
            content: <div className="text-neutral-700">Low stock products...</div>
          },
          {
            id: 'out-of-stock',
            label: 'Out of Stock',
            content: <div className="text-neutral-700">Out of stock products...</div>
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
import { Store, Package, Settings } from 'lucide-react';
import { Button } from '@shared/components/web';

export default function Navigation() {
  return (
    <nav className="bg-navy-500 text-white">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store size={24} />
            <span className="text-xl font-bold">MechBazar Vendor</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-primary-200">Dashboard</a>
            <a href="#" className="hover:text-primary-200">Products</a>
            <a href="#" className="hover:text-primary-200">Orders</a>
            <a href="#" className="hover:text-primary-200">Analytics</a>
            <a href="#" className="hover:text-primary-200">Settings</a>
          </div>

          <Button variant="outline">Logout</Button>
        </div>
      </div>
    </nav>
  );
}
```

### Step 4: Update Product Tables

```tsx
// components/ProductTable.tsx
import { Button, Badge } from '@shared/components/web';

export default function ProductTable({ products }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full">
        <thead className="bg-neutral-50 border-b border-neutral-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
              Product Name
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
              SKU
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
              Price
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
              Stock
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
          {products.map((product, idx) => (
            <tr 
              key={idx} 
              className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors"
            >
              <td className="px-6 py-4 text-sm font-semibold text-neutral-900">
                {product.name}
              </td>
              <td className="px-6 py-4 text-sm text-neutral-700">{product.sku}</td>
              <td className="px-6 py-4 text-sm font-semibold text-neutral-900">
                ${product.price}
              </td>
              <td className="px-6 py-4 text-sm text-neutral-900">{product.stock}</td>
              <td className="px-6 py-4 text-sm">
                <Badge 
                  variant={
                    product.stock > 50 ? 'success' : 
                    product.stock > 10 ? 'warning' : 
                    'danger'
                  }
                >
                  {product.stock > 50 ? 'In Stock' : 
                   product.stock > 10 ? 'Low Stock' : 
                   'Out of Stock'}
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

### Step 5: Error Handling

```tsx
// Common error state
<Alert 
  type="error"
  title="Error!"
  message="Failed to update product. Please try again."
  dismissible
/>

// Validation errors
<Input
  label="Email"
  error="Invalid email format"
  placeholder="vendor@mechbazar.com"
/>
```

---

## Common Vendor-Specific Patterns

### Stock Status Indicator
```tsx
const getStockBadge = (quantity) => {
  if (quantity > 100) return <Badge variant="success">Well Stocked</Badge>;
  if (quantity > 20) return <Badge variant="warning">Low Stock</Badge>;
  return <Badge variant="danger">Critical</Badge>;
};
```

### Price Display
```tsx
<Card>
  <div className="flex items-center justify-between">
    <span className="text-neutral-600">Selling Price</span>
    <span className="text-2xl font-bold text-primary-500">$99.99</span>
  </div>
</Card>
```

### Order Status Timeline
```tsx
<div className="space-y-3">
  {[
    { status: 'Pending', completed: true },
    { status: 'Confirmed', completed: true },
    { status: 'Shipped', completed: false },
    { status: 'Delivered', completed: false },
  ].map((step, idx) => (
    <div key={idx} className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
        step.completed ? 'bg-success-500' : 'bg-neutral-300'
      }`}>
        {step.completed ? '✓' : idx + 1}
      </div>
      <span className={step.completed ? 'text-neutral-900' : 'text-neutral-600'}>
        {step.status}
      </span>
    </div>
  ))}
</div>
```

---

## Responsive Design Examples

### Mobile-Optimized Form
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  <Input label="Field 1" />
  <Input label="Field 2" />
  <Input label="Field 3" />
</div>
```

### Collapsible Sections
```tsx
<div className="space-y-4">
  <Card className="cursor-pointer hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold">Section 1</h3>
      <span>▼</span>
    </div>
  </Card>
</div>
```

---

## Next Steps

1. ✅ Tailwind config updated
2. → Review page layouts and update colors
3. → Import and replace components
4. → Test all pages on mobile (320px+)
5. → Test on tablet (768px+)  
6. → Test on desktop (1024px+)
7. → Verify all links and forms work
8. → Deploy to staging

---

**Last Updated**: July 14, 2026
