import { supabase } from '@/lib/customSupabaseClient';
import { addDays, isBefore, isAfter, parseISO, format, isValid } from 'date-fns';
import { getOperationalOptions } from '@/lib/api';

/**
 * Reconstructs package history from a list of sorted daily recaps.
 */
export const reconstructPackageHistory = (dailyRecaps, operationalOptions) => {
  console.log(`[Service] reconstructPackageHistory: Processing ${dailyRecaps?.length || 0} recaps.`);
  
  if (!dailyRecaps || dailyRecaps.length === 0) {
      console.warn("[Service] reconstructPackageHistory: No recaps provided.");
      return [];
  }

  // Convert array to map for faster lookup if operationalOptions is an array
  let packageDefinitions = {};
  if (Array.isArray(operationalOptions)) {
      operationalOptions.forEach(opt => {
          if (opt.label) {
              packageDefinitions[opt.label.toLowerCase().trim()] = {
                  id: opt.id,
                  session_count: opt.session_count || 0,
                  validity_days: opt.validity_days || 30,
                  label: opt.label
              };
          }
      });
  } else {
      packageDefinitions = operationalOptions || {};
  }

  const history = [];
  let currentPackage = null;
  
  // Task 5: Filter out recaps with missing date to prevent errors
  const validRecaps = dailyRecaps.filter(r => r.recap_date);
  if (validRecaps.length < dailyRecaps.length) {
      console.warn(`[Service] Filtered out ${dailyRecaps.length - validRecaps.length} recaps with NULL recap_date`);
  }

  // Ensure recaps are sorted by date, then by creation time to handle same-day events consistently
  const sortedRecaps = [...validRecaps].sort((a, b) => {
    const dateA = new Date(a.recap_date);
    const dateB = new Date(b.recap_date);
    if (dateA - dateB !== 0) return dateA - dateB;
    // Secondary sort by created_at if available
    if (a.created_at && b.created_at) {
        return new Date(a.created_at) - new Date(b.created_at);
    }
    return 0;
  });

  sortedRecaps.forEach((recap, index) => {
    const packageName = recap.package_type || '';
    const cleanName = packageName.trim().toLowerCase();
    
    // Skip if no package name (regular visit)
    if (!packageName || packageName === '-') return;

    // Detect Package Definition
    let def = null;
    // Try exact match
    if (packageDefinitions[cleanName]) {
        def = packageDefinitions[cleanName];
    } else {
        // Try fuzzy match
        const key = Object.keys(packageDefinitions).find(k => cleanName.includes(k) || k.includes(cleanName));
        if (key) def = packageDefinitions[key];
    }

    // Default definition if not found but looks like a package
    if (!def && (cleanName.includes('paket') || cleanName.includes('session'))) {
        // Try to find a generic "Custom" package type ID if possible, otherwise we might have issues
        // For reconstruction purposes, we might not have the ID, but we need it for DB sync later.
        // We'll handle the ID resolution in the sync step if missing here.
        def = { session_count: 5, validity_days: 30, label: packageName, id: null }; 
        console.warn(`[Service] reconstructPackageHistory: Used default definition for "${cleanName}"`);
    }

    const isPurchase = parseFloat(recap.amount) > 0;
    const sessionCount = def ? def.session_count : 1;
    
    // LOGIC BRANCH 1: NEW PACKAGE PURCHASE
    if (isPurchase && sessionCount > 1) {
       console.log(`[Service] Found Purchase at idx ${index}: ${packageName} (${recap.recap_date})`);
       const startDate = new Date(recap.recap_date);
       const validityDays = def ? def.validity_days : 30;
       const endDate = addDays(startDate, validityDays);

       const newPkg = {
           id: crypto.randomUUID(), // Temporary ID for reconstruction
           patient_id: recap.patient_id,
           package_name: def?.label || recap.package_type,
           package_type_id: def?.id || null,
           total_sessions: sessionCount,
           sessions_used: 1, // Purchase counts as 1st session usually
           start_date: format(startDate, 'yyyy-MM-dd'),
           end_date: format(endDate, 'yyyy-MM-dd'),
           validity_days: validityDays,
           duration_days: validityDays, // Add duration_days
           status: 'aktif',
           sessions: [recap] // Track which recaps belong to this package
       };
       
       history.push(newPkg);
       currentPackage = newPkg;
    } 
    // LOGIC BRANCH 2: USAGE OF EXISTING PACKAGE
    else if (!isPurchase || (isPurchase && sessionCount <= 1)) {
        if (isPurchase && sessionCount <= 1) return;

        // It's a usage (amount 0)
        // Check if we have a current active package that matches
        if (currentPackage) {
            const isSameType = currentPackage.package_name.toLowerCase().includes(cleanName) || 
                               cleanName.includes(currentPackage.package_name.toLowerCase());
            
            // Check validity period
            const recapDate = new Date(recap.recap_date);
            const pkgEndDate = new Date(currentPackage.end_date);
            const isValidDate = isBefore(recapDate, pkgEndDate) || recapDate.getTime() === pkgEndDate.getTime();

            // Check capacity
            const hasCapacity = currentPackage.sessions_used < currentPackage.total_sessions;

            if (isSameType && isValidDate && hasCapacity) {
                currentPackage.sessions_used++;
                currentPackage.sessions.push(recap);
                console.log(`[Service] Assigned usage at idx ${index} to package ${currentPackage.id}. Used: ${currentPackage.sessions_used}/${currentPackage.total_sessions}`);
            } else {
                 console.warn(`[Service] Orphan session at idx ${index}: ${recap.recap_date} (Type: ${cleanName}). No matching active package.`);
            }
        } else {
             console.warn(`[Service] Orphan session at idx ${index}: ${recap.recap_date} (Type: ${cleanName}). No current package.`);
        }
    }
  });

  return history;
};

/**
 * Determines final status for each package based on usage and dates.
 * @param {Array} packageHistory - List of package objects
 * @returns {Array} Updated list with final statuses
 */
export const finalizePackageStatus = (packageHistory) => {
    const today = new Date();
    return packageHistory.map(pkg => {
        let status = 'aktif';
        const endDate = new Date(pkg.end_date);
        
        if (pkg.sessions_used >= pkg.total_sessions) {
            status = 'selesai';
        } else if (isAfter(today, endDate)) {
            status = 'expired';
        }
        
        // Ensure remaining is never negative
        const remaining = Math.max(0, pkg.total_sessions - pkg.sessions_used);
        console.log(`[Service] Finalizing Package ${pkg.id}: Used ${pkg.sessions_used}/${pkg.total_sessions}, Status: ${status}, Remaining: ${remaining}`);

        return { ...pkg, status, sessions_remaining: remaining };
    });
};

/**
 * Full flow: Fetch recaps -> Reconstruct -> Finalize
 */
export const regeneratePackageHistory = async (patientId, dailyRecaps = null, passedOperationalOptions = null) => {
    console.log(`[Service] regeneratePackageHistory called for Patient ID: ${patientId}`);
    
    // 1. Fetch Data if not provided
    let recaps = dailyRecaps;
    if (!recaps) {
        console.log("[Service] Fetching daily recaps from DB...");
        const { data, error } = await supabase
            .from('daily_recaps')
            .select('*')
            .eq('patient_id', patientId);
        if (error) {
            console.error("[Service] Error fetching recaps:", error);
            throw error;
        }
        recaps = data;
        console.log(`[Service] Fetched ${recaps.length} recaps.`);
    }

    let ops = passedOperationalOptions;
    if (!ops) {
        console.log("[Service] Fetching operational options...");
        const { data, error } = await getOperationalOptions(['tipe_paket', 'package_type']);
        if (error) {
             console.error("[Service] Error fetching options:", error);
             throw error;
        }
        ops = data || [];
        console.log(`[Service] Processed ${ops.length} package definitions.`);
    }

    // 2. Reconstruct
    const rawHistory = reconstructPackageHistory(recaps, ops);

    // 3. Finalize
    const finalHistory = finalizePackageStatus(rawHistory);

    return finalHistory;
};

/**
 * Triggers regeneration and UPDATES THE DATABASE to match reconstruction.
 * This is the "Source of Truth" enforcement function.
 */
export const triggerPackageHistoryRegeneration = async (patientId) => {
    try {
        console.log(`[Service] triggerPackageHistoryRegeneration START for patient: ${patientId}`);
        
        if (!patientId) {
             throw new Error("Invalid patient ID provided.");
        }

        // 1. Calculate Ideal State
        const calculatedHistory = await regeneratePackageHistory(patientId);
        
        // 2. Fetch Current DB State
        console.log("[Service] Fetching current DB package state...");
        const { data: currentDbPackages, error: fetchError } = await supabase
            .from('package_tracking')
            .select('*')
            .eq('patient_id', patientId);
            
        if (fetchError) throw fetchError;
        console.log(`[Service] Found ${currentDbPackages.length} existing packages in DB.`);

        // 3. Sync Logic (Simple Strategy: Match by Start Date & Name, else Insert/Delete)
        const ops = [];
        let created = 0;
        let updated = 0;

        // A. Update or Insert
        for (const calcPkg of calculatedHistory) {
            // Find match in DB
            const match = currentDbPackages.find(p => 
                p.start_date === calcPkg.start_date && 
                p.package_name === calcPkg.package_name
            );

            if (match) {
                // Update needed?
                if (match.sessions_used !== calcPkg.sessions_used || 
                    match.status !== calcPkg.status ||
                    match.end_date !== calcPkg.end_date ||
                    match.package_type_id !== calcPkg.package_type_id) { // Check type ID too
                    
                    console.log(`[Service] Updating Package ${match.id}: Used ${match.sessions_used}->${calcPkg.sessions_used}, Status ${match.status}->${calcPkg.status}`);
                    
                    // Ensure package_type_id is valid before update
                    if (!calcPkg.package_type_id) {
                        console.warn(`[Service] Warning: Updating package ${match.id} but new package_type_id is null. Skipping type update.`);
                    }

                    const updatePayload = {
                        sessions_used: calcPkg.sessions_used,
                        sessions_remaining: calcPkg.sessions_remaining,
                        status: calcPkg.status,
                        end_date: calcPkg.end_date,
                        total_sessions: calcPkg.total_sessions,
                        validity_days: calcPkg.validity_days,
                        duration_days: calcPkg.duration_days,
                        updated_at: new Date().toISOString()
                    };

                    if (calcPkg.package_type_id) {
                        updatePayload.package_type_id = calcPkg.package_type_id;
                    }

                    ops.push(
                        supabase.from('package_tracking').update(updatePayload).eq('id', match.id)
                    );
                    updated++;
                }
            } else {
                // Insert new
                console.log(`[Service] Creating new Package: ${calcPkg.package_name} (${calcPkg.start_date})`);
                
                // Ensure package_type_id is present for insert
                if (!calcPkg.package_type_id) {
                    console.error(`[Service] Cannot insert package ${calcPkg.package_name} without package_type_id. Attempting to resolve...`);
                    // Try to resolve one last time
                    const { data: resolved } = await supabase.from('operational_options')
                        .select('id')
                        .ilike('label', calcPkg.package_name)
                        .limit(1)
                        .maybeSingle();
                    
                    if (resolved) {
                        calcPkg.package_type_id = resolved.id;
                    } else {
                        console.error(`[Service] Failed to resolve package_type_id for ${calcPkg.package_name}. Skipping insert.`);
                        continue;
                    }
                }

                // We remove the temp ID and sessions array before insert
                const { id, sessions, ...insertData } = calcPkg;
                ops.push(
                    supabase.from('package_tracking').insert(insertData)
                );
                created++;
            }
        }
        
        // Execute Ops
        if (ops.length > 0) {
            await Promise.all(ops);
        } else {
            console.log("[Service] No changes needed. Database is in sync.");
        }
        
        console.log(`[Service] Regeneration complete. Created: ${created}, Updated: ${updated}.`);
        return { success: true, history: calculatedHistory };

    } catch (error) {
        console.error("[Service] Regeneration failed:", error);
        return { success: false, error: error.message || "Unknown error during regeneration" };
    }
};

// --- Enhanced Test Suite ---

export const runPackageHistoryTests = async () => {
    console.group("Package History Logic Tests (Enhanced)");
    const results = [];
    
    try {
        const mockOps = [
            { id: '1', label: 'Paket 5 Sesi', session_count: 5, validity_days: 30 },
            { id: '2', label: 'Paket 10 Sesi', session_count: 10, validity_days: 60 }
        ];

        // Test 1: Single completed package
        console.log("Running Test 1: Single completed package...");
        const t1_recaps = [
            { recap_date: '2024-01-01', amount: 1000000, package_type: 'Paket 5 Sesi' }, // Buy (1)
            { recap_date: '2024-01-02', amount: 0, package_type: 'Paket 5 Sesi' }, // 2
            { recap_date: '2024-01-03', amount: 0, package_type: 'Paket 5 Sesi' }, // 3
            { recap_date: '2024-01-04', amount: 0, package_type: 'Paket 5 Sesi' }, // 4
            { recap_date: '2024-01-05', amount: 0, package_type: 'Paket 5 Sesi' }  // 5 (Complete)
        ];
        const r1 = reconstructPackageHistory(t1_recaps, mockOps);
        const f1 = finalizePackageStatus(r1);
        
        const t1_pass = f1.length === 1 && f1[0].sessions_used === 5 && f1[0].status === 'selesai';
        results.push({ name: "Test 1: Single Completed Package", passed: t1_pass, details: f1 });
        console.log(`Test 1 Result: ${t1_pass ? 'PASS' : 'FAIL'}`);

        // Test 2: Orphan session
        console.log("Running Test 2: Orphan Session (No Purchase)...");
        const t2_recaps = [
             { recap_date: '2024-01-01', amount: 0, package_type: 'Paket 5 Sesi' }
        ];
        const r2 = reconstructPackageHistory(t2_recaps, mockOps);
        const t2_pass = r2.length === 0;
        results.push({ name: "Test 2: Orphan Session Ignored", passed: t2_pass, details: r2 });
        console.log(`Test 2 Result: ${t2_pass ? 'PASS' : 'FAIL'}`);

        // Test 3: Expiry Logic
        console.log("Running Test 3: Expiry Logic...");
        const t3_recaps = [
            { recap_date: '2020-01-01', amount: 1000000, package_type: 'Paket 5 Sesi' }
        ];
        const r3 = reconstructPackageHistory(t3_recaps, mockOps);
        const f3 = finalizePackageStatus(r3);
        const t3_pass = f3.length === 1 && f3[0].status === 'expired';
        results.push({ name: "Test 3: Expiry Status", passed: t3_pass, details: f3 });
        console.log(`Test 3 Result: ${t3_pass ? 'PASS' : 'FAIL'}`);

    } catch (e) {
        console.error("Test Suite crashed:", e);
        results.push({ name: "Test Suite Error", passed: false, details: e.message });
    }

    console.groupEnd();
    return results;
};