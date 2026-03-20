/**
 * Client-side Scheduler for WhatsApp Automation
 * In a production environment, this should be replaced by:
 * 1. Supabase Edge Functions (scheduled via pg_cron)
 * 2. External Cron Service (cron-job.org calling an API endpoint)
 * 
 * This file provides the logic to trigger the backend generation functions.
 */

import { generateFollowUpQueue, getFollowUpQueue, sendFollowUpWhatsApp } from '@/lib/api';

/**
 * Trigger daily generation jobs
 * Should be called once per day (e.g., when Admin logs in)
 */
export const runDailyWhatsAppAutomation = async () => {
  console.log("🔄 Running Daily WhatsApp Automation...");
  
  try {
    // 1. Generate Appointment Reminders (H-1)
    await generateFollowUpQueue('reminder');
    
    // 2. Generate Expiry Warnings (H-7, H-3, H-1)
    await generateFollowUpQueue('expiry');
    
    // 3. Generate Birthday Greetings
    await generateFollowUpQueue('birthday');

    // 4. Generate Recap Queue (H+1)
    await generateFollowUpQueue('recap');
    
    console.log("✅ Daily Automation Finished");
    return { success: true };
  } catch (error) {
    console.error("❌ Daily Automation Failed:", error);
    return { success: false, error };
  }
};

/**
 * Process Pending Queue
 * Finds pending messages scheduled for now or past, and sends them.
 * Note: Browser must be open for this to work in client-side mode.
 */
export const processPendingQueue = async () => {
  console.log("📨 Processing Pending WhatsApp Queue...");
  
  try {
    // Fetch pending items
    const { data: queue } = await getFollowUpQueue('pending');
    
    if (!queue || queue.length === 0) {
      console.log("📭 No pending messages to send.");
      return;
    }

    const now = new Date();
    
    // Filter items that are due
    const dueItems = queue.filter(item => {
        const scheduled = new Date(`${item.scheduled_date}T${item.scheduled_time || '00:00:00'}`);
        return scheduled <= now;
    });

    console.log(`🚀 Sending ${dueItems.length} due messages...`);

    for (const item of dueItems) {
        await sendFollowUpWhatsApp(item.id);
    }
    
    console.log("✅ Queue Processing Complete");

  } catch (error) {
    console.error("❌ Queue Processing Failed:", error);
  }
};