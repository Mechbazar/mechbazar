import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

async function api(path: string, method: string = 'GET', body: any = null, token: string | null = null) {
  const headers: any = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const config: any = {
    method,
    headers,
  };
  if (body) {
    config.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, config);
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err: any) {
    return { status: 500, ok: false, data: { error: err.message } };
  }
}

async function runTests() {
  console.log('🚀 STARTING MECHBAZAR API INTEGRATION TEST FLOW 🚀\n');

  // Reset database capacities to ensure clean runs
  try {
    await prisma.timeSlot.updateMany({
      data: { maxBookingsPerSlot: 20 }
    });
    console.log('🧹 DB Cleaned: Set all time slot capacities to 20');
  } catch (err: any) {
    console.error('Warning resetting time slots:', err.message);
  }

  // Generate random phone numbers for uniqueness
  const testId = Math.floor(1000 + Math.random() * 9000);
  const customerPhone = `910000${testId}`;
  const vendorPhone = `920000${testId}`;
  const riderPhone = `930000${testId}`;
  const mechanicPhone = `940000${testId}`;

  let tokens = {
    admin: '',
    customer: '',
    vendor: '',
    rider: '',
    mechanic: '',
  };

  let ids = {
    customer: '',
    vendor: '',
    vendorProfileId: '',
    rider: '',
    riderProfileId: '',
    mechanic: '',
    mechanicProfileId: '',
    addressId: '',
    productId: '',
    orderId: '',
    bookingId: '',
    serviceCategoryId: '',
    servicePackageId: '',
    timeSlotId: '',
  };

  let selectedVehicleType = 'CAR';

  // ==========================================
  // 1. ADMIN LOGIN
  // ==========================================
  console.log('--- TEST 1: Admin Login ---');
  const adminLoginRes = await api('/auth/admin/login', 'POST', {
    email: 'admin@mechbazar.com',
    password: 'password',
  });
  if (adminLoginRes.status === 200 && adminLoginRes.data.token) {
    console.log('✅ Admin login successful');
    tokens.admin = adminLoginRes.data.token;
  } else {
    console.error('❌ Admin login failed:', adminLoginRes.data);
    return;
  }

  // ==========================================
  // 2. CUSTOMER AUTHENTICATION
  // ==========================================
  console.log('\n--- TEST 2: Customer Registration ---');
  const custOtpRes = await api('/auth/send-otp', 'POST', { phone: customerPhone });
  if (custOtpRes.status === 200 && custOtpRes.data.otp) {
    const otp = custOtpRes.data.otp;
    console.log(`✅ Customer OTP received: ${otp}`);
    
    const registerRes = await api('/auth/register', 'POST', {
      phone: customerPhone,
      otp,
      name: 'E2E Test Customer',
    });
    
    if (registerRes.status === 201) {
      console.log('✅ Customer registered successfully');
      tokens.customer = registerRes.data.token;
      ids.customer = registerRes.data.user.id;
    } else {
      console.error('❌ Customer registration failed:', registerRes.data);
      return;
    }
  } else {
    console.error('❌ Failed to request customer OTP:', custOtpRes.data);
    return;
  }

  // ==========================================
  // 3. VENDOR, RIDER, MECHANIC CREATION & APPROVAL
  // ==========================================
  console.log('\n--- TEST 3: Create & Approve Vendor/Rider/Mechanic ---');
  
  // Register Vendor
  const vendorReg = await api('/vendors/register', 'POST', {
    phone: vendorPhone,
    name: 'E2E Test Vendor',
    email: `vendor${testId}@mechbazar.com`,
    password: 'password123',
  });
  if (vendorReg.status === 201 && vendorReg.data.vendor) {
    console.log('✅ Vendor user and profile created');
    tokens.vendor = vendorReg.data.token;
    ids.vendor = vendorReg.data.user.id;
    ids.vendorProfileId = vendorReg.data.vendor.id;

    // Approve Vendor via admin
    const approveRes = await api(`/vendors/${ids.vendorProfileId}/status`, 'PATCH', {
      status: 'APPROVED',
    }, tokens.admin);
    console.log('✅ Admin approved vendor status:', approveRes.status === 200 ? 'SUCCESS' : approveRes.data);
  } else {
    console.error('❌ Vendor creation failed:', vendorReg.data);
  }

  // Register Rider
  const rOtpRes = await api('/auth/send-otp', 'POST', { phone: riderPhone });
  const riderReg = await api('/riders/register', 'POST', {
    phone: riderPhone,
    otp: rOtpRes.data.otp,
    name: 'E2E Test Rider',
    email: `rider${testId}@mechbazar.com`,
  });
  if (riderReg.status === 201 && riderReg.data.deliveryProfile) {
    tokens.rider = riderReg.data.token;
    ids.rider = riderReg.data.user.id;
    ids.riderProfileId = riderReg.data.deliveryProfile.id;
    console.log('✅ Rider user and profile created');

    // Update Rider Details (Aadhaar/DL)
    const rRegUpdate = await api('/riders/me/registration', 'PATCH', {
      vehicleType: 'BIKE',
      licenseNumber: 'DL1234567890',
      aadhaarNumber: '123456789012',
    }, tokens.rider);
    console.log('Rider details update:', rRegUpdate.status === 200 ? 'SUCCESS' : rRegUpdate.data);

    // Approve Rider via Admin
    const approveRider = await api(`/riders/${ids.riderProfileId}/status`, 'PATCH', {
      status: 'APPROVED',
    }, tokens.admin);
    console.log('✅ Admin approved rider status:', approveRider.status === 200 ? 'SUCCESS' : approveRider.data);
  } else {
    console.error('❌ Rider creation failed:', riderReg.data);
  }

  // Register Mechanic (Technician)
  const mOtpRes = await api('/auth/send-otp', 'POST', { phone: mechanicPhone });
  const mechanicReg = await api('/technicians/register', 'POST', {
    phone: mechanicPhone,
    otp: mOtpRes.data.otp,
    name: 'E2E Test Mechanic',
    email: `mech${testId}@mechbazar.com`,
  });
  if (mechanicReg.status === 201 && mechanicReg.data.technicianProfile) {
    tokens.mechanic = mechanicReg.data.token;
    ids.mechanic = mechanicReg.data.user.id;
    ids.mechanicProfileId = mechanicReg.data.technicianProfile.id;
    console.log('✅ Mechanic user and profile created');

    // Update Technician Details
    const mRegUpdate = await api('/technicians/me/registration', 'PATCH', {
      experienceYears: 5,
      skills: ['Engine Repair', 'Brake Service'],
      specializations: ['CAR', 'BIKE'],
    }, tokens.mechanic);
    console.log('Mechanic details update:', mRegUpdate.status === 200 ? 'SUCCESS' : mRegUpdate.data);

    // Approve Mechanic via Admin
    const approveMech = await api(`/technicians/${ids.mechanicProfileId}/status`, 'PATCH', {
      status: 'APPROVED',
    }, tokens.admin);
    console.log('✅ Admin approved mechanic status:', approveMech.status === 200 ? 'SUCCESS' : approveMech.data);
  } else {
    console.error('❌ Mechanic creation failed:', mechanicReg.data);
  }

  // ==========================================
  // 4. CATALOG SEARCH & RETRIEVAL
  // ==========================================
  console.log('\n--- TEST 4: Products Catalog ---');
  const catRes = await api('/categories');
  console.log(`Categories count: ${catRes.data?.length || 0}`);

  const prodRes = await api('/products');
  console.log(`Products count: ${prodRes.data?.length || 0}`);
  if (prodRes.data && prodRes.data.length > 0) {
    // Select the first product and force reset its stock in the DB to 10 for E2E consistency
    const firstProduct = prodRes.data[0];
    ids.productId = firstProduct.id;
    
    try {
      await prisma.product.update({
        where: { id: ids.productId },
        data: { stock: 10 }
      });
      console.log(`🧹 DB Cleaned: Set stock for product "${firstProduct.name}" to 10`);
    } catch (err: any) {
      console.error('Warning setting product stock:', err.message);
    }

    console.log(`✅ Selected Product: "${firstProduct.name}" (ID: ${ids.productId})`);
  } else {
    console.error('❌ No products found in database!');
    return;
  }

  // ==========================================
  // 5. CUSTOMER ADDRESS CREATION
  // ==========================================
  console.log('\n--- TEST 5: Create Address ---');
  const addrRes = await api('/customers/me/addresses', 'POST', {
    title: 'Home',
    line1: '123 Main St',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    isDefault: true,
  }, tokens.customer);
  
  if (addrRes.status === 201 && addrRes.data.id) {
    ids.addressId = addrRes.data.id;
    console.log('✅ Customer address created:', ids.addressId);
  } else {
    console.error('❌ Address creation failed:', addrRes.data);
    return;
  }

  // ==========================================
  // 6. E2E COD ORDER FLOW
  // ==========================================
  console.log('\n--- TEST 6: E2E Order Flow (COD) ---');
  
  // Read initial stock
  const checkInitialStock = await api(`/products/${ids.productId}`);
  const initialStock = checkInitialStock.data.stock;
  console.log(`Initial stock for product: ${initialStock}`);

  // Place order using correct id and qty keys
  const orderRes = await api('/orders', 'POST', {
    addressId: ids.addressId,
    items: [
      {
        id: ids.productId,
        qty: 2,
      }
    ],
    paymentMethod: 'COD',
  }, tokens.customer);

  if (orderRes.status === 201 && orderRes.data.order && orderRes.data.order.id) {
    ids.orderId = orderRes.data.order.id;
    console.log('✅ Order placed successfully:', ids.orderId);

    // Verify stock is reduced in database
    const checkStockAfter = await api(`/products/${ids.productId}`);
    const stockAfter = checkStockAfter.data.stock;
    console.log(`Stock after order: ${stockAfter}`);
    if (stockAfter === initialStock - 2) {
      console.log('✅ Inventory update verified (Correctly reduced by 2)');
    } else {
      console.error(`❌ Inventory mismatch: Expected ${initialStock - 2}, got ${stockAfter}`);
    }

    // Set Rider online
    const setRiderOnline = await api('/riders/me/availability', 'PATCH', { isOnline: true }, tokens.rider);
    console.log('Rider online status toggle:', setRiderOnline.status === 200 ? 'SUCCESS' : setRiderOnline.data);

    // Assign Rider via Admin API (PUT /orders/:id/assign-rider)
    const assignRider = await api(`/orders/${ids.orderId}/assign-rider`, 'PUT', {
      riderId: ids.riderProfileId,
    }, tokens.admin);
    console.log('Rider assignment status:', assignRider.status === 200 ? 'SUCCESS' : assignRider.data);

    // Rider updates status to ON_THE_WAY
    const wayDelivery = await api(`/riders/me/deliveries/${ids.orderId}/status`, 'PATCH', {
      status: 'ON_THE_WAY',
    }, tokens.rider);
    console.log('Rider on the way:', wayDelivery.status === 200 ? 'SUCCESS' : wayDelivery.data);

    // Rider completes delivery (COD collected + proofImageUrl)
    const completeDelivery = await api(`/riders/me/deliveries/${ids.orderId}/status`, 'PATCH', {
      status: 'DELIVERED',
      proofImageUrl: 'http://example.com/delivery_proof.jpg',
      codCollected: true,
    }, tokens.rider);
    console.log('Rider completed delivery:', completeDelivery.status === 200 ? 'SUCCESS' : completeDelivery.data);

    // Check order final status
    const finalOrderCheck = await api(`/orders/${ids.orderId}`, 'GET', null, tokens.customer);
    console.log(`Order final status: ${finalOrderCheck.data?.status}`);
    if (finalOrderCheck.data?.status === 'DELIVERED') {
      console.log('✅ COD Order delivery lifecycle verified successfully!');
    } else {
      console.error('❌ Order delivery lifecycle failed to reach DELIVERED status');
    }
  } else {
    console.error('❌ Failed to place order:', orderRes.data);
  }

  // ==========================================
  // 7. E2E SERVICE BOOKING FLOW
  // ==========================================
  console.log('\n--- TEST 7: E2E Service Booking Flow ---');

  // Get service categories
  const sCats = await api('/services/categories');
  if (sCats.status === 200 && sCats.data.length > 0) {
    const chosenCat = sCats.data[0];
    ids.serviceCategoryId = chosenCat.id;
    selectedVehicleType = chosenCat.vehicleType;
    console.log(`Using Category: "${chosenCat.name}", Vehicle Type: ${selectedVehicleType}`);
    
    // Get service packages for this category
    const sPkgs = await api(`/services/packages?categoryId=${ids.serviceCategoryId}`);
    if (sPkgs.status === 200 && sPkgs.data.length > 0) {
      ids.servicePackageId = sPkgs.data[0].id;
      console.log(`✅ Selected Package: "${sPkgs.data[0].name}"`);
    }
  }

  // Get time slots and select an active/available one dynamically
  const tSlots = await api('/services/time-slots');
  if (tSlots.status === 200 && tSlots.data.length > 0) {
    const availableSlot = tSlots.data.find((s: any) => s.available);
    if (availableSlot) {
      ids.timeSlotId = availableSlot.id;
      console.log(`✅ Selected Available TimeSlot: "${availableSlot.label}" (ID: ${ids.timeSlotId})`);
    } else {
      ids.timeSlotId = tSlots.data[0].id;
      console.log(`⚠️ No available slot flagged, defaulting to ID: ${ids.timeSlotId}`);
    }
  }

  if (ids.serviceCategoryId && ids.servicePackageId && ids.timeSlotId) {
    // Book Service using category's matching vehicleType
    const bookRes = await api('/services/bookings', 'POST', {
      addressId: ids.addressId,
      vehicleType: selectedVehicleType,
      vehicleBrand: selectedVehicleType === 'BIKE' ? 'Royal Enfield' : 'Maruti Suzuki',
      vehicleModel: selectedVehicleType === 'BIKE' ? 'Classic 350' : 'Swift',
      categoryId: ids.serviceCategoryId,
      packageId: ids.servicePackageId,
      scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
      timeSlotId: ids.timeSlotId,
      issueDescription: 'Vehicle needs general service checks',
    }, tokens.customer);

    if (bookRes.status === 201 && bookRes.data.booking && bookRes.data.booking.id) {
      ids.bookingId = bookRes.data.booking.id;
      console.log('✅ Service Booking created:', ids.bookingId);

      // Mechanic goes online
      const setMechOnline = await api('/technicians/me/availability', 'PATCH', { isOnline: true }, tokens.mechanic);
      console.log('Mechanic online status toggle:', setMechOnline.status === 200 ? 'SUCCESS' : setMechOnline.data);

      // Admin assigns mechanic to booking (POST /services/bookings/:id/assign)
      const assignMech = await api(`/services/bookings/${ids.bookingId}/assign`, 'POST', {
        technicianId: ids.mechanicProfileId,
      }, tokens.admin);
      console.log('Admin assigned mechanic:', assignMech.status === 200 ? 'SUCCESS' : assignMech.data);

      // Mechanic accepts booking via POST /me/bookings/:id/accept
      const acceptBooking = await api(`/technicians/me/bookings/${ids.bookingId}/accept`, 'POST', null, tokens.mechanic);
      console.log('Mechanic accepted booking:', acceptBooking.status === 200 ? 'SUCCESS' : acceptBooking.data);

      // Mechanic status updates
      await api(`/technicians/me/bookings/${ids.bookingId}/status`, 'PATCH', { status: 'MECHANIC_ON_THE_WAY' }, tokens.mechanic);
      await api(`/technicians/me/bookings/${ids.bookingId}/status`, 'PATCH', { status: 'ARRIVED' }, tokens.mechanic);
      await api(`/technicians/me/bookings/${ids.bookingId}/status`, 'PATCH', { status: 'WORK_STARTED' }, tokens.mechanic);

      // Mechanic generates completion OTP
      const genOtp = await api(`/technicians/me/bookings/${ids.bookingId}/generate-otp`, 'POST', null, tokens.mechanic);
      if (genOtp.status === 200) {
        console.log('✅ Completion OTP generated successfully');
        
        // Fetch booking from customer side to see the completionOtp
        const custBookingCheck = await api(`/services/bookings/${ids.bookingId}`, 'GET', null, tokens.customer);
        const completionOtp = custBookingCheck.data.completionOtp;
        console.log(`Generated Completion OTP read from customer: ${completionOtp}`);

        // Mechanic completes service using PATCH status and OTP
        const completeService = await api(`/technicians/me/bookings/${ids.bookingId}/status`, 'PATCH', {
          status: 'COMPLETED',
          otp: completionOtp,
        }, tokens.mechanic);
        console.log('Mechanic completed service:', completeService.status === 200 ? 'SUCCESS' : completeService.data);

        // Verify booking status is COMPLETED
        const finalBookingCheck = await api(`/services/bookings/${ids.bookingId}`, 'GET', null, tokens.customer);
        console.log(`Booking final status: ${finalBookingCheck.data?.status}`);
        if (finalBookingCheck.data?.status === 'COMPLETED') {
          console.log('✅ Service Booking lifecycle verified successfully!');
        } else {
          console.error('❌ Service Booking lifecycle failed to reach COMPLETED status');
        }
      } else {
        console.error('❌ Failed to generate completion OTP:', genOtp.data);
      }
    } else {
      console.error('❌ Failed to create service booking:', bookRes.data);
    }
  } else {
    console.error('❌ Booking parameters are missing! Seeding might be incomplete.');
  }

  // ==========================================
  // 8. SECURITY & BOUNDS TESTING
  // ==========================================
  console.log('\n--- TEST 8: Security & Validation Bounds ---');
  
  // Try accessing orders/my-orders without token (Expect 401)
  const unauthRes = await api('/orders/my-orders', 'GET');
  console.log(`Access without token (Expect 401): status ${unauthRes.status} -> ${unauthRes.status === 401 ? 'CORRECT (401)' : 'INCORRECT'}`);

  // Try accessing admin panel without admin token (Expect 403)
  const unauthAdmin = await api('/services/bookings/all', 'GET', null, tokens.customer);
  console.log(`Customer accessing Admin endpoint (Expect 403): status ${unauthAdmin.status} -> ${unauthAdmin.status === 403 || unauthAdmin.status === 401 ? 'CORRECT' : 'INCORRECT'}`);

  console.log('\n🏁 ALL TESTS COMPLETED! 🏁');
}

runTests().finally(() => prisma.$disconnect());
