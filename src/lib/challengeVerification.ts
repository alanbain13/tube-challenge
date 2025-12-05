/**
 * Challenge verification utilities
 * Validates if station visits meet challenge verification requirements
 */

export type VerificationStatus = 'location_verified' | 'photo_verified' | 'remote_verified' | 'failed';

export type RequiredVerification = 'location_verified' | 'photo_verified' | 'remote_verified';

/**
 * Maps verification levels to their acceptable statuses
 * Higher verification levels accept their own level plus all higher levels
 */
const ACCEPTABLE_STATUSES: Record<RequiredVerification, VerificationStatus[]> = {
  'location_verified': ['location_verified'],
  'photo_verified': ['location_verified', 'photo_verified'],
  'remote_verified': ['location_verified', 'photo_verified', 'remote_verified'],
};

/**
 * Verification level display configuration
 * Uses LOCATION, PHOTO, REMOTE labels with consistent color theming
 */
export const VERIFICATION_LEVEL_CONFIG: Record<RequiredVerification, {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: 'MapPinCheck' | 'Camera' | 'Globe';
}> = {
  'location_verified': {
    label: 'Location Verified',
    shortLabel: 'LOCATION',
    description: 'All stations must be verified by GPS location',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: 'MapPinCheck',
  },
  'photo_verified': {
    label: 'Photo Verified',
    shortLabel: 'PHOTO',
    description: 'Stations can be verified by photo or GPS',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: 'Camera',
  },
  'remote_verified': {
    label: 'Remote Verified',
    shortLabel: 'REMOTE',
    description: 'Any verification method accepted',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    icon: 'Globe',
  },
};

/**
 * Challenge type configuration for display
 */
export const CHALLENGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  sequenced_route: { label: "Sequenced Route", color: "bg-blue-500" },
  unsequenced_route: { label: "Any Order", color: "bg-green-500" },
  timed: { label: "Timed", color: "bg-orange-500" },
  station_count: { label: "Station Count", color: "bg-purple-500" },
  point_to_point: { label: "Point to Point", color: "bg-red-500" },
  // Legacy types
  "Single Line": { label: "Single Line", color: "bg-cyan-500" },
  "Multi-Line": { label: "Multi-Line", color: "bg-indigo-500" },
  "Zone Challenge": { label: "Zone Challenge", color: "bg-teal-500" },
  "line": { label: "Line Challenge", color: "bg-cyan-500" },
  "zone": { label: "Zone Challenge", color: "bg-teal-500" },
};

/**
 * Validates if all station visits meet the challenge's verification requirements
 * @param visits Array of station visit objects with verification_status
 * @param requiredVerification The minimum verification level required by the challenge
 * @returns Object with isValid boolean and details about any failures
 */
export function validateChallengeCompletion(
  visits: Array<{ station_tfl_id: string; verification_status: VerificationStatus | null }>,
  requiredVerification: RequiredVerification = 'remote_verified'
): { isValid: boolean; failedStations: string[]; message: string } {
  const acceptableStatuses = ACCEPTABLE_STATUSES[requiredVerification];
  const failedStations: string[] = [];

  for (const visit of visits) {
    const status = visit.verification_status || 'remote_verified';
    if (!acceptableStatuses.includes(status)) {
      failedStations.push(visit.station_tfl_id);
    }
  }

  const isValid = failedStations.length === 0;
  const message = isValid
    ? 'All stations meet verification requirements'
    : `${failedStations.length} station(s) do not meet the ${VERIFICATION_LEVEL_CONFIG[requiredVerification].label} requirement`;

  return { isValid, failedStations, message };
}

/**
 * Gets the highest verification status achieved across all visits
 * @param visits Array of station visit objects with verification_status
 * @returns The highest (most strict) verification status achieved, or null if none
 */
export function getHighestVerificationLevel(
  visits: Array<{ verification_status: VerificationStatus | null }>
): RequiredVerification | null {
  if (visits.length === 0) return null;

  const hasLocationVerified = visits.every(v => v.verification_status === 'location_verified');
  if (hasLocationVerified) return 'location_verified';

  const hasPhotoOrHigher = visits.every(v => 
    v.verification_status === 'location_verified' || v.verification_status === 'photo_verified'
  );
  if (hasPhotoOrHigher) return 'photo_verified';

  const hasAnyValid = visits.every(v => 
    v.verification_status && v.verification_status !== 'failed'
  );
  if (hasAnyValid) return 'remote_verified';

  return null;
}

/**
 * Gets the lowest (weakest) verification status among all visits
 * This represents the activity's overall verification level
 * @param visits Array of station visit objects with verification_status
 * @returns The lowest verification status, following "weakest link" model
 */
export function getActivityVerificationLevel(
  visits: Array<{ verification_status: VerificationStatus | null }>
): RequiredVerification | null {
  if (visits.length === 0) return null;

  // Check in order from weakest to strongest
  const hasRemote = visits.some(v => v.verification_status === 'remote_verified');
  if (hasRemote) return 'remote_verified';

  const hasPhoto = visits.some(v => v.verification_status === 'photo_verified');
  if (hasPhoto) return 'photo_verified';

  const allLocation = visits.every(v => v.verification_status === 'location_verified');
  if (allLocation) return 'location_verified';

  return null;
}
