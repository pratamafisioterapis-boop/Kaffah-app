import { format } from 'date-fns';

/**
 * Shared logic to calculate patient income with correct session numbering
 * @param {Array} recaps - Raw daily_recaps data
 * @param {Array} trackings - Package tracking data
 * @returns {Array} Processed recaps with nominal and session info
 */
export const processPatientIncomeData = (recaps, trackings) => {
    // Need to find the "purchase" transaction for each package to know the total price
    const packagePrices = {};
    
    // First pass: find prices from purchase records
    recaps.forEach(recap => {
        if (recap.amount > 0 && recap.package_type) {
            const key = `${recap.patient_id}_${recap.package_type}`;
            // Store the most recent positive amount as the price for this package type
            if (!packagePrices[key]) {
                packagePrices[key] = parseFloat(recap.amount);
            }
        }
    });

    const sessionCounters = {};

    // Sort recaps chronologically to ensure correct session counting
    const sortedRecaps = [...recaps].sort((a, b) => new Date(a.recap_date) - new Date(b.recap_date));

    return sortedRecaps.map((recap) => {
      const key = `${recap.patient_id}_${recap.package_type}`;
      
      const matchedTracking = trackings.find(t => 
        t.patient_id === recap.patient_id && 
        (t.package_name || '').toLowerCase() === (recap.package_type || '').toLowerCase()
      );

      const totalSessions = matchedTracking?.total_sessions || 1;
      
      let totalPackagePrice = packagePrices[key];
      if (!totalPackagePrice && recap.amount > 0) {
          totalPackagePrice = parseFloat(recap.amount);
      }
      if (!totalPackagePrice) {
          totalPackagePrice = 0;
      }

      let nominalPerSession = 0;
      if (totalSessions > 1 && totalPackagePrice > 0) {
           nominalPerSession = Math.floor(totalPackagePrice / totalSessions);
      } else if (totalSessions === 1) {
           nominalPerSession = parseFloat(recap.amount || 0);
      } else {
           nominalPerSession = parseFloat(recap.amount || 0);
      }

      let sessionInfo = '';
      if (totalSessions > 1) {
          if (!sessionCounters[key]) sessionCounters[key] = 0;
          sessionCounters[key]++;
          
          let currentSession = sessionCounters[key] % totalSessions;
          if (currentSession === 0) currentSession = totalSessions;

          sessionInfo = `(${currentSession}/${totalSessions})`;
      }

      return {
        id: recap.id,
        date: recap.recap_date,
        patientName: recap.patient?.full_name || 'Unknown',
        patientType: recap.patient_type || '-',
        packageType: recap.package_type || '-',
        nominal: nominalPerSession,
        originalAmount: parseFloat(recap.amount || 0),
        totalSessions: totalSessions,
        sessionInfo: sessionInfo,
        totalPackagePrice: totalPackagePrice,
        // Standardized fields for reporting
        source: 'Patient',
        category: 'Services',
        description: `${recap.patient?.full_name || 'Patient'} - ${recap.package_type || 'Visit'} ${sessionInfo}`
      };
    });
};