import { describe, it, expect } from 'vitest';

/**
 * Status decision logic (mirrors the server-side implementation)
 */
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
  
  // Simulation mode always verified
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
  
  // AI disabled - manual verification
  if (!aiEnabled) {
    return {
      status: 'verified', // Manual check-ins are trusted
      pending_reason: null,
      verification_method: 'manual'
    };
  }
  
  // Check geofence first (location-based validation)
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
  
  // Check OCR result (AI-based validation)
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

describe('Status Decision Matrix Tests', () => {
  describe('Simulation Mode', () => {
    it('should always return verified for simulation mode regardless of other inputs', () => {
      const scenarios = [
        {
          ocrResult: { success: false, confidence: 0.1 },
          geofenceResult: { withinGeofence: false, distance: 2000, gpsSource: 'device' },
          simulationMode: true,
          aiEnabled: true,
          hasConnectivity: false
        },
        {
          // No other inputs
          simulationMode: true,
          aiEnabled: false,
          hasConnectivity: false
        }
      ];
      
      scenarios.forEach((inputs, index) => {
        const result = deriveVisitStatus(inputs);
        expect(result.status).toBe('verified');
        expect(result.pending_reason).toBeNull();
        expect(result.verification_method).toBe('simulation');
      });
    });
  });

  describe('Connectivity Issues', () => {
    it('should return pending for no connectivity', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: false,
        ocrResult: { success: true, confidence: 0.9 },
        geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' }
      });
      
      expect(result.status).toBe('pending');
      expect(result.pending_reason).toBe('no_connectivity');
      expect(result.verification_method).toBe('offline');
    });
  });

  describe('Manual Mode (AI Disabled)', () => {
    it('should return verified for manual check-ins when AI disabled', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: false,
        hasConnectivity: true,
        ocrResult: { success: false, confidence: 0.1 }, // Should be ignored
        geofenceResult: { withinGeofence: false, distance: 2000, gpsSource: 'device' } // Should be ignored
      });
      
      expect(result.status).toBe('verified');
      expect(result.pending_reason).toBeNull();
      expect(result.verification_method).toBe('manual');
    });
  });

  describe('Geofence Validation', () => {
    it('should return pending for no GPS data', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: false, distance: null, gpsSource: 'none' }
      });
      
      expect(result.status).toBe('pending');
      expect(result.pending_reason).toBe('no_gps_data');
      expect(result.verification_method).toBe('ai_image');
    });

    it('should return pending for geofence failure with GPS', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: false, distance: 1000, gpsSource: 'device' }
      });
      
      expect(result.status).toBe('pending');
      expect(result.pending_reason).toBe('geofence_failed');
      expect(result.verification_method).toBe('ai_image');
    });

    it('should pass geofence check when within radius', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'exif' },
        ocrResult: { success: true, confidence: 0.9 }
      });
      
      expect(result.status).toBe('verified');
      expect(result.pending_reason).toBeNull();
      expect(result.verification_method).toBe('ai_image');
    });
  });

  describe('OCR Validation', () => {
    it('should return pending for OCR failure', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' },
        ocrResult: { success: false, confidence: 0.5 }
      });
      
      expect(result.status).toBe('pending');
      expect(result.pending_reason).toBe('ocr_failed');
      expect(result.verification_method).toBe('ai_image');
    });

    it('should return pending for low confidence OCR', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' },
        ocrResult: { success: true, confidence: 0.6 } // Below 0.7 threshold
      });
      
      expect(result.status).toBe('pending');
      expect(result.pending_reason).toBe('low_confidence');
      expect(result.verification_method).toBe('ai_image');
    });

    it('should pass for high confidence OCR', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' },
        ocrResult: { success: true, confidence: 0.95 }
      });
      
      expect(result.status).toBe('verified');
      expect(result.pending_reason).toBeNull();
      expect(result.verification_method).toBe('ai_image');
    });
  });

  describe('GPS-only scenarios', () => {
    it('should use GPS verification when OCR not available', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: true, distance: 50, gpsSource: 'device' }
        // No OCR result
      });
      
      expect(result.status).toBe('verified');
      expect(result.pending_reason).toBeNull();
      expect(result.verification_method).toBe('gps');
    });
  });

  describe('Priority Order Tests', () => {
    it('should prioritize simulation mode over everything else', () => {
      const result = deriveVisitStatus({
        simulationMode: true, // This should override everything
        aiEnabled: true,
        hasConnectivity: false, // Would normally cause pending
        geofenceResult: { withinGeofence: false, distance: 2000, gpsSource: 'device' }, // Would normally cause pending
        ocrResult: { success: false, confidence: 0.1 } // Would normally cause pending
      });
      
      expect(result.status).toBe('verified');
      expect(result.verification_method).toBe('simulation');
    });

    it('should prioritize connectivity over geofence/OCR', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: false, // This should cause pending
        geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' }, // Good geofence
        ocrResult: { success: true, confidence: 0.9 } // Good OCR
      });
      
      expect(result.status).toBe('pending');
      expect(result.pending_reason).toBe('no_connectivity');
    });

    it('should prioritize AI disabled over geofence/OCR failures', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: false, // Manual mode
        hasConnectivity: true,
        geofenceResult: { withinGeofence: false, distance: 2000, gpsSource: 'device' }, // Bad geofence
        ocrResult: { success: false, confidence: 0.1 } // Bad OCR
      });
      
      expect(result.status).toBe('verified');
      expect(result.verification_method).toBe('manual');
    });

    it('should prioritize geofence over OCR', () => {
      const result = deriveVisitStatus({
        simulationMode: false,
        aiEnabled: true,
        hasConnectivity: true,
        geofenceResult: { withinGeofence: false, distance: 1000, gpsSource: 'device' }, // Bad geofence
        ocrResult: { success: true, confidence: 0.9 } // Good OCR - should be ignored due to geofence failure
      });
      
      expect(result.status).toBe('pending');
      expect(result.pending_reason).toBe('geofence_failed');
    });
  });

  describe('Comprehensive Status Matrix Table Test', () => {
    // Table-driven test covering all major combinations
    const statusScenarios = [
      // [description, inputs, expected]
      ['Simulation mode overrides everything', 
        { simulationMode: true, aiEnabled: false, hasConnectivity: false }, 
        { status: 'verified', pending_reason: null, verification_method: 'simulation' }],
        
      ['No connectivity with good inputs', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: false, 
          geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' },
          ocrResult: { success: true, confidence: 0.9 } }, 
        { status: 'pending', pending_reason: 'no_connectivity', verification_method: 'offline' }],
        
      ['Manual mode with bad inputs', 
        { simulationMode: false, aiEnabled: false, hasConnectivity: true,
          geofenceResult: { withinGeofence: false, distance: 2000, gpsSource: 'device' },
          ocrResult: { success: false, confidence: 0.1 } }, 
        { status: 'verified', pending_reason: null, verification_method: 'manual' }],
        
      ['No GPS data', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: true,
          geofenceResult: { withinGeofence: false, distance: null, gpsSource: 'none' },
          ocrResult: { success: true, confidence: 0.9 } }, 
        { status: 'pending', pending_reason: 'no_gps_data', verification_method: 'ai_image' }],
        
      ['Geofence failure with GPS', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: true,
          geofenceResult: { withinGeofence: false, distance: 1500, gpsSource: 'exif' },
          ocrResult: { success: true, confidence: 0.9 } }, 
        { status: 'pending', pending_reason: 'geofence_failed', verification_method: 'ai_image' }],
        
      ['OCR failure with good geofence', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: true,
          geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' },
          ocrResult: { success: false, confidence: 0.8 } }, 
        { status: 'pending', pending_reason: 'ocr_failed', verification_method: 'ai_image' }],
        
      ['Low confidence OCR with good geofence', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: true,
          geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' },
          ocrResult: { success: true, confidence: 0.5 } }, 
        { status: 'pending', pending_reason: 'low_confidence', verification_method: 'ai_image' }],
        
      ['Perfect AI scenario', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: true,
          geofenceResult: { withinGeofence: true, distance: 50, gpsSource: 'exif' },
          ocrResult: { success: true, confidence: 0.95 } }, 
        { status: 'verified', pending_reason: null, verification_method: 'ai_image' }],
        
      ['GPS-only verification', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: true,
          geofenceResult: { withinGeofence: true, distance: 200, gpsSource: 'device' } }, 
        { status: 'verified', pending_reason: null, verification_method: 'gps' }],
        
      ['Edge case: exactly at confidence threshold', 
        { simulationMode: false, aiEnabled: true, hasConnectivity: true,
          geofenceResult: { withinGeofence: true, distance: 100, gpsSource: 'device' },
          ocrResult: { success: true, confidence: 0.7 } }, 
        { status: 'verified', pending_reason: null, verification_method: 'ai_image' }]
    ] as const;

    it.each(statusScenarios)(
      'should handle %s correctly',
      (description, inputs, expected) => {
        const result = deriveVisitStatus(inputs);
        expect(result).toEqual(expected);
      }
    );
  });
});