/**
 * Debugging utilities for Follow Up Queue
 * Accessible via window.debugFollowUp
 */
import { supabase } from '@/lib/customSupabaseClient';
import { generateFollowUpQueue } from '@/lib/api';

const logTable = async (tableName) => {
    console.log(`--- DEBUG: ${tableName} ---`);
    const { data, error } = await supabase.from(tableName).select('*').limit(20);
    if (error) console.error("Error:", error);
    else console.table(data);
    return data;
};

const triggerGeneration = async (type) => {
    console.log(`--- TRIGGERING: ${type} ---`);
    const result = await generateFollowUpQueue(type);
    console.log("Result:", result);
    return result;
};

const checkTemplates = async () => {
    return logTable('follow_up_templates');
};

const checkQueue = async () => {
    return logTable('follow_up_queue');
};

const checkAppointments = async () => {
    return logTable('appointments');
};

const debugFollowUp = {
    checkQueue,
    checkTemplates,
    checkAppointments,
    triggerGeneration,
    help: () => {
        console.log(`
        Available commands:
        - debugFollowUp.checkQueue()        : Show top 20 queue items
        - debugFollowUp.checkTemplates()    : Show templates
        - debugFollowUp.triggerGeneration(type) : Manually trigger generation
          Types: 'appointment_reminder', 'post_treatment_follow_up', 'expiry_package', 'birthday_greeting'
        `);
    }
};

if (typeof window !== 'undefined') {
    window.debugFollowUp = debugFollowUp;
}

export default debugFollowUp;