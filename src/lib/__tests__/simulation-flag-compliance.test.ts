import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A3.6.1 - Simulation & flag handling tests
 * Tests for simulation override, AI-disabled pending, and metadata suppression
 */

// Mock status decision logic (mirrors edge function)
interface StatusDecisionInputs {
  ocrResult?: {
    success: boolean;
    confidence: number;
    station_text_raw?: string;
  };
  geofenceResult?: {
    withinGeofence: boolean;
    distance: number | null;
    gpsSource: string;
  };
  simulationMode: boolean;
  aiEnabled: boolean;
  hasConnectivity: boolean;
}

interface StatusDecision {
  status: 'verified' | 'pending';
  pending_reason: string | null;
  verification_method: string;
}

function deriveVisitStatus(inputs: StatusDecisionInputs): StatusDecision {
  const { ocrResult, geofenceResult, simulationMode, aiEnabled, hasConnectivity } = inputs;
  
  // Simulation mode always verified (A3.6.2 requirement)
  if (simulationMode) {
    return {
      status: 'verified',
      pending_reason: null,
      verification_method: 'simulation'
    };
  }
  
  // No connectivity - mark as pending
  if (!hasConnectivity) {
    return {
      status: 'pending',
      pending_reason: 'no_connectivity',
      verification_method: 'offline'
    };
  }
  
  // AI disabled - force pending status (A3.6.2 requirement)
  if (!aiEnabled) {
    return {
      status: 'pending',
      pending_reason: 'ai_disabled',
      verification_method: 'manual'
    };
  }
  
  // Check geofence first
  if (geofenceResult && !geofenceResult.withinGeofence) {
    if (geofenceResult.gpsSource === 'none') {
      return {
        status: 'pending',
        pending_reason: 'no_gps_data',
        verification_method: 'ai_image'
      };
    } else {
      return {
        status: 'pending',
        pending_reason: 'geofence_failed',
        verification_method: 'ai_image'
      };
    }
  }
  
  // Check OCR result
  if (ocrResult && !ocrResult.success) {
    return {
      status: 'pending',
      pending_reason: 'ocr_failed',
      verification_method: 'ai_image'
    };
  }
  
  // Low confidence OCR
  if (ocrResult && ocrResult.confidence < 0.7) {
    return {
      status: 'pending',
      pending_reason: 'low_confidence',
      verification_method: 'ai_image'
    };
  }
  
  // All checks passed
  return {
    status: 'verified',
    pending_reason: null,
    verification_method: ocrResult ? 'ai_image' : 'gps'
  };
}

// Mock visit record creation (mirrors edge function logic)
function createVisitRecord(visitData: any, statusDecision: StatusDecision) {
  const simulationMode = visitData.simulation_mode || false;
  
  return {
    id: 'mock-visit-id',
    activity_id: visitData.activity_id,
    station_tfl_id: visitData.station_tfl_id,
    user_id: visitData.user_id,
    
    // Status fields
    status: statusDecision.status,
    pending_reason: statusDecision.pending_reason,
    verification_method: statusDecision.verification_method,
    
    // Location data - suppress GPS coordinates in simulation mode (A3.6.2)
    latitude: simulationMode ? null : visitData.latitude,
    longitude: simulationMode ? null : visitData.longitude,
    visit_lat: simulationMode ? null : visitData.visit_lat,
    visit_lon: simulationMode ? null : visitData.visit_lon,
    
    // GPS metadata - handle simulation mode
    gps_source: simulationMode ? 'none' : (visitData.gps_source || 'none'),
    geofence_distance_m: simulationMode ? null : visitData.geofence_distance_m,
    
    // EXIF metadata (still preserved in simulation)
    exif_time_present: visitData.exif_time_present || false,
    exif_gps_present: visitData.exif_gps_present || false,
    
    // Context
    is_simulation: simulationMode
  };
}

describe('A3.6.1 - Simulation & Flag Handling Tests', () => {
  
  describe('Simulation Override Test', () => {
    it('should mark visit as verified when simulation mode is active, even with geofence failure', () => {
      // Simulate geofence failure but OCR success in simulation mode
      const inputs: StatusDecisionInputs = {
        simulationMode: true,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: {
          withinGeofence: false, // Geofence fails
          distance: 1200,
          gpsSource: 'device'
        },
        ocrResult: {
          success: true, // OCR succeeds
          confidence: 0.95,
          station_text_raw: 'CANNON STREET'
        }
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('verified');
      expect(decision.pending_reason).toBeNull();
      expect(decision.verification_method).toBe('simulation');
    });

    it('should mark visit as verified when simulation mode is active, even with OCR failure', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: true,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: {
          withinGeofence: true,
          distance: 50,
          gpsSource: 'device'
        },
        ocrResult: {
          success: false, // OCR fails
          confidence: 0.2,
          station_text_raw: 'UNKNOWN'
        }
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('verified');
      expect(decision.pending_reason).toBeNull();
      expect(decision.verification_method).toBe('simulation');
    });

    it('should mark visit as verified when simulation mode is active, even without connectivity', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: true,
        aiEnabled: true,
        hasConnectivity: false, // No connectivity
        geofenceResult: {
          withinGeofence: true,
          distance: 50,
          gpsSource: 'device'
        }
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('verified');
      expect(decision.pending_reason).toBeNull();
      expect(decision.verification_method).toBe('simulation');
    });
  });

  describe('AI-Disabled Pending Test', () => {
    it('should force status pending with ai_disabled reason when AI is disabled', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: false,
        aiEnabled: false, // AI disabled
        hasConnectivity: true,
        geofenceResult: {
          withinGeofence: true, // Geofence passes
          distance: 50,
          gpsSource: 'device'
        },
        ocrResult: {
          success: true, // OCR would succeed
          confidence: 0.95,
          station_text_raw: 'CANNON STREET'
        }
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('pending');
      expect(decision.pending_reason).toBe('ai_disabled');
      expect(decision.verification_method).toBe('manual');
    });

    it('should force pending even with perfect conditions when AI is disabled', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: false,
        aiEnabled: false,
        hasConnectivity: true,
        geofenceResult: {
          withinGeofence: true,
          distance: 10, // Very close
          gpsSource: 'exif'
        },
        ocrResult: {
          success: true,
          confidence: 1.0, // Perfect confidence
          station_text_raw: 'BAKER STREET'
        }
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('pending');
      expect(decision.pending_reason).toBe('ai_disabled');
      expect(decision.verification_method).toBe('manual');
    });
  });

  describe('Metadata Suppression Test', () => {
    it('should not persist GPS coordinates when simulation mode is active', () => {
      const visitData = {
        activity_id: 'test-activity',
        station_tfl_id: '940GZZLUCST',
        user_id: 'test-user',
        simulation_mode: true,
        latitude: 51.5074,
        longitude: -0.1278,
        visit_lat: 51.5075,
        visit_lon: -0.1279,
        gps_source: 'device',
        geofence_distance_m: 45,
        exif_time_present: true,
        exif_gps_present: true
      };

      const statusDecision = deriveVisitStatus({
        simulationMode: true,
        aiEnabled: true,
        hasConnectivity: true
      });

      const visitRecord = createVisitRecord(visitData, statusDecision);

      // GPS coordinates should be null in simulation
      expect(visitRecord.latitude).toBeNull();
      expect(visitRecord.longitude).toBeNull();
      expect(visitRecord.visit_lat).toBeNull();
      expect(visitRecord.visit_lon).toBeNull();
      
      // GPS metadata should indicate no GPS source
      expect(visitRecord.gps_source).toBe('none');
      expect(visitRecord.geofence_distance_m).toBeNull();
      
      // But EXIF metadata should still be preserved
      expect(visitRecord.exif_time_present).toBe(true);
      expect(visitRecord.exif_gps_present).toBe(true);
      
      // Simulation flag should be set
      expect(visitRecord.is_simulation).toBe(true);
    });

    it('should preserve GPS coordinates when simulation mode is not active', () => {
      const visitData = {
        activity_id: 'test-activity',
        station_tfl_id: '940GZZLUCST',
        user_id: 'test-user',
        simulation_mode: false,
        latitude: 51.5074,
        longitude: -0.1278,
        visit_lat: 51.5075,
        visit_lon: -0.1279,
        gps_source: 'device',
        geofence_distance_m: 45,
        exif_time_present: true,
        exif_gps_present: true
      };

      const statusDecision = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: {
          withinGeofence: true,
          distance: 45,
          gpsSource: 'device'
        },
        ocrResult: {
          success: true,
          confidence: 0.9
        }
      });

      const visitRecord = createVisitRecord(visitData, statusDecision);

      // GPS coordinates should be preserved in normal mode
      expect(visitRecord.latitude).toBe(51.5074);
      expect(visitRecord.longitude).toBe(-0.1278);
      expect(visitRecord.visit_lat).toBe(51.5075);
      expect(visitRecord.visit_lon).toBe(-0.1279);
      
      // GPS metadata should be preserved
      expect(visitRecord.gps_source).toBe('device');
      expect(visitRecord.geofence_distance_m).toBe(45);
      
      // Simulation flag should be false
      expect(visitRecord.is_simulation).toBe(false);
    });
  });

  describe('Priority Order Tests', () => {
    it('should prioritize simulation mode over AI disabled flag', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: true,  // Simulation should win
        aiEnabled: false,      // AI disabled should be ignored
        hasConnectivity: true
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('verified');
      expect(decision.verification_method).toBe('simulation');
      expect(decision.pending_reason).toBeNull();
    });

    it('should prioritize simulation mode over connectivity issues', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: true,   // Simulation should win
        aiEnabled: true,
        hasConnectivity: false  // No connectivity should be ignored
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('verified');
      expect(decision.verification_method).toBe('simulation');
      expect(decision.pending_reason).toBeNull();
    });

    it('should apply AI disabled flag when simulation is not active', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: false,  // No simulation
        aiEnabled: false,       // AI disabled should apply
        hasConnectivity: true,
        geofenceResult: {
          withinGeofence: true,
          distance: 30,
          gpsSource: 'device'
        }
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('pending');
      expect(decision.pending_reason).toBe('ai_disabled');
      expect(decision.verification_method).toBe('manual');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined geofence and OCR results in simulation mode', () => {
      const inputs: StatusDecisionInputs = {
        simulationMode: true,
        aiEnabled: true,
        hasConnectivity: true
        // No geofenceResult or ocrResult provided
      };
      
      const decision = deriveVisitStatus(inputs);
      
      expect(decision.status).toBe('verified');
      expect(decision.verification_method).toBe('simulation');
    });

    it('should handle EXIF-only GPS data in simulation mode', () => {
      const visitData = {
        activity_id: 'test-activity',
        station_tfl_id: '940GZZLUCST',
        user_id: 'test-user',
        simulation_mode: true,
        gps_source: 'exif',
        exif_time_present: true,
        exif_gps_present: true,
        // No device GPS coordinates
      };

      const statusDecision = deriveVisitStatus({
        simulationMode: true,
        aiEnabled: true,
        hasConnectivity: true
      });

      const visitRecord = createVisitRecord(visitData, statusDecision);

      // Should still suppress GPS coordinates
      expect(visitRecord.latitude).toBeNull();
      expect(visitRecord.longitude).toBeNull();
      expect(visitRecord.gps_source).toBe('none');
      
      // But preserve EXIF flags
      expect(visitRecord.exif_time_present).toBe(true);
      expect(visitRecord.exif_gps_present).toBe(true);
    });
  });
});