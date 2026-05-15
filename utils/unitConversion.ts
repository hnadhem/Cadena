export const lbsToKg = (lbs: number): number => Math.round(lbs * 0.453592 * 100) / 100;
export const kgToLbs = (kg: number): number => Math.round(kg * 2.20462 * 100) / 100;

export const milesToKm = (miles: number): number => Math.round(miles * 1.60934 * 100) / 100;
export const kmToMiles = (km: number): number => Math.round(km * 0.621371 * 100) / 100;

export const cmToIn = (cm: number): number => Math.round(cm * 0.393701 * 100) / 100;
export const inToCm = (inches: number): number => Math.round(inches * 2.54 * 100) / 100;

export function formatWeight(lbs: number, unit: 'lbs' | 'kg'): string {
  if (unit === 'kg') return `${lbsToKg(lbs)} kg`;
  return `${lbs} lbs`;
}

export function formatDistance(miles: number, unit: 'mi' | 'km'): string {
  if (unit === 'km') return `${milesToKm(miles)} km`;
  return `${miles} mi`;
}
