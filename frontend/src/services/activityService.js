// ==============================================================================
// Student Micro-Credential Verification Engine - Activity Service
// ==============================================================================

import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/activities';

/**
 * Returns Authorization header with JWT token if available.
 */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Records a new co-curricular activity and maps it to skills.
 * 
 * @param {object} activityData - { title, activity_type, organizer, description, activity_date, evidence_url }
 * @returns {Promise<object>} - Backend response { success: true, activity: { ..., skills: [...] } }
 */
export const createActivity = async (activityData) => {
  const response = await axios.post(BASE_URL, activityData, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  return response.data;
};

/**
 * Retrieves all activities for the logged-in student with mapped skills.
 * 
 * @returns {Promise<object>} - { success: true, count: number, activities: [...] }
 */
export const getMyActivities = async () => {
  const response = await axios.get(BASE_URL, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Retrieves a specific activity log by ID.
 * 
 * @param {string} id - Activity UUID
 * @returns {Promise<object>} - { success: true, activity: { ... } }
 */
export const getActivityById = async (id) => {
  const response = await axios.get(`${BASE_URL}/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};

/**
 * Updates an existing activity log and recalculates mapped skills.
 * 
 * @param {string} id - Activity UUID
 * @param {object} activityData - { title, activity_type, organizer, description, activity_date, evidence_url }
 * @returns {Promise<object>} - { success: true, message: string, activity: { ... } }
 */
export const updateActivity = async (id, activityData) => {
  const response = await axios.put(`${BASE_URL}/${id}`, activityData, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
  });
  return response.data;
};

/**
 * Deletes an activity log by ID.
 * 
 * @param {string} id - Activity UUID
 * @returns {Promise<object>} - { success: true, message: string }
 */
export const deleteActivity = async (id) => {
  const response = await axios.delete(`${BASE_URL}/${id}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
};
