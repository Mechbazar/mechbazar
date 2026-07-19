import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VehicleType, UserVehicle } from '../types/product';

const VEHICLE_TYPE_KEY = '@mechbazar_vehicle_type';

export const loadVehicleType = async (): Promise<VehicleType> => {
  try {
    const saved = await AsyncStorage.getItem(VEHICLE_TYPE_KEY);
    if (saved === 'BIKE') return VehicleType.BIKE;
  } catch (_) {}
  return VehicleType.CAR; // default
};

export const saveVehicleType = async (type: VehicleType) => {
  try {
    await AsyncStorage.setItem(VEHICLE_TYPE_KEY, type);
  } catch (_) {}
};

interface AppState {
  vehicleType: VehicleType;
  myGarage: UserVehicle[];
  activeVehicleId: string | null;
}

const initialState: AppState = {
  vehicleType: VehicleType.CAR, // Default to CAR; will be hydrated from AsyncStorage in App.js
  myGarage: [],
  activeVehicleId: null,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setVehicleType: (state, action: PayloadAction<VehicleType>) => {
      state.vehicleType = action.payload;
      // Fire-and-forget persist to AsyncStorage
      saveVehicleType(action.payload);
    },
    setVehicleTypeHydrated: (state, action: PayloadAction<VehicleType>) => {
      // Used only on app start to hydrate from AsyncStorage without re-persisting
      state.vehicleType = action.payload;
    },
    addVehicleToGarage: (state, action: PayloadAction<UserVehicle>) => {
      // If it's the first vehicle or marked as default, unset other defaults
      if (state.myGarage.length === 0 || action.payload.isDefault) {
        state.myGarage.forEach(v => v.isDefault = false);
        action.payload.isDefault = true;
        state.activeVehicleId = action.payload.id;
        state.vehicleType = action.payload.vehicleType;
      }
      state.myGarage.push(action.payload);
    },
    setActiveVehicle: (state, action: PayloadAction<string>) => {
      const vehicle = state.myGarage.find(v => v.id === action.payload);
      if (vehicle) {
        state.myGarage.forEach(v => v.isDefault = false);
        vehicle.isDefault = true;
        state.activeVehicleId = vehicle.id;
        state.vehicleType = vehicle.vehicleType;
        saveVehicleType(vehicle.vehicleType);
      }
    },
    removeVehicleFromGarage: (state, action: PayloadAction<string>) => {
      state.myGarage = state.myGarage.filter(v => v.id !== action.payload);
      if (state.activeVehicleId === action.payload) {
        if (state.myGarage.length > 0) {
          state.myGarage[0].isDefault = true;
          state.activeVehicleId = state.myGarage[0].id;
          state.vehicleType = state.myGarage[0].vehicleType;
        } else {
          state.activeVehicleId = null;
        }
      }
    },
    updateVehicleInGarage: (state, action: PayloadAction<UserVehicle>) => {
      const idx = state.myGarage.findIndex(v => v.id === action.payload.id);
      if (idx !== -1) {
        state.myGarage[idx] = action.payload;
        if (action.payload.isDefault) {
          state.myGarage.forEach((v, i) => {
            if (i !== idx) v.isDefault = false;
          });
          state.activeVehicleId = action.payload.id;
          state.vehicleType = action.payload.vehicleType;
        }
      }
    },
    hydrateGarage: (state, action: PayloadAction<{ myGarage: UserVehicle[]; activeVehicleId: string | null }>) => {
      state.myGarage = action.payload.myGarage;
      state.activeVehicleId = action.payload.activeVehicleId;
    }
  }
});

export const { 
  setVehicleType, 
  setVehicleTypeHydrated, 
  addVehicleToGarage, 
  setActiveVehicle, 
  hydrateGarage,
  removeVehicleFromGarage,
  updateVehicleInGarage
} = appSlice.actions;
export default appSlice.reducer;
