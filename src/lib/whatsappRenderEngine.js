/**
 * WhatsApp Message Rendering Engine
 * Handles client-side preview rendering and validation
 */

import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Constants
export const AVAILABLE_VARIABLES = [
  '{patient_name}', 
  '{therapist_name}', 
  '{date}', 
  '{time}', 
  '{days}', 
  '{package_name}',
  '{age}'
];

/**
 * Replace variables in template with actual data
 * @param {string} template 
 * @param {object} variables 
 * @returns {string} rendered message
 */
export const renderTemplate = (template, variables = {}) => {
  if (!template) return '';
  
  let rendered = template;
  
  // Replace standard variables
  Object.keys(variables).forEach(key => {
    const placeholder = `{${key}}`;
    const value = variables[key] !== undefined && variables[key] !== null ? variables[key] : '-';
    rendered = rendered.replaceAll(placeholder, value);
  });

  return rendered;
};

/**
 * Extract all variables used in a template
 * @param {string} template 
 * @returns {string[]} array of variable names including brackets
 */
export const extractVariables = (template) => {
  if (!template) return [];
  const regex = /{[a-zA-Z0-9_]+}/g;
  return template.match(regex) || [];
};

/**
 * Generate dummy data for preview based on category
 * @param {string} category 
 * @returns {object} dummy variables
 */
export const getDummyDataForCategory = (category) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseData = {
    patient_name: 'Budi Santoso',
    therapist_name: 'Dr. Siti Aminah',
    date: format(tomorrow, 'dd MMMM yyyy', { locale: idLocale }),
    time: '14:00',
    package_name: 'Paket Recovery 10 Sesi',
    days: '3',
    age: '35'
  };

  return baseData;
};

/**
 * Validate message content constraints
 * @param {string} content 
 * @returns {object} { valid: boolean, error: string }
 */
export const validateRenderedMessage = (content) => {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Pesan tidak boleh kosong' };
  }

  if (content.length > 1000) {
    return { valid: false, error: 'Pesan terlalu panjang (maks 1000 karakter)' };
  }

  // Check for lingering variables
  const lingeringVars = extractVariables(content);
  if (lingeringVars.length > 0) {
    return { 
      valid: false, 
      error: `Masih ada variabel yang belum terganti: ${lingeringVars.join(', ')}` 
    };
  }

  return { valid: true, error: null };
};