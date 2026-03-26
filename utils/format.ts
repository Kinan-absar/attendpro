/**
 * Formats total minutes into a decimal-like string where the decimal part represents minutes.
 * Example: 526 minutes -> 8.46 (8 hours and 46 minutes)
 */
export const formatMinutesToHHMM = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "0.00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}.${minutes.toString().padStart(2, '0')}`;
};

/**
 * Formats decimal hours into the same HH.MM format.
 * Example: 8.7666 hours -> 8.46
 */
export const formatHoursToHHMM = (decimalHours: number): string => {
  return formatMinutesToHHMM(decimalHours * 60);
};
