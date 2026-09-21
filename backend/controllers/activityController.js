// ==============================================================================
// Student Micro-Credential Verification Engine - Activity Controller
// ==============================================================================

const pool = require('../config/database');
const { mapSkillsForActivity } = require('../services/activitySkillMapper');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that an activity payload has all mandatory fields.
 */
function validateActivityPayload(body) {
  const { title, activity_type, description } = body;
  const errors = [];

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Activity title is required.');
  }
  if (!activity_type || typeof activity_type !== 'string' || !activity_type.trim()) {
    errors.push('Activity type is required.');
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    errors.push('Activity description is required.');
  }

  return errors;
}

/**
 * POST /api/activities
 * Create a new co-curricular activity and map to canonical taxonomy skills.
 */
async function createActivity(req, res) {
  const errors = validateActivityPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(' ')
    });
  }

  const studentId = req.user.id;
  const {
    title,
    activity_type,
    organizer = null,
    description,
    activity_date = null,
    evidence_url = null
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert activity log record
    const insertQuery = `
      INSERT INTO activity_logs (student_id, title, activity_type, organizer, description, activity_date, evidence_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, student_id, title, activity_type, organizer, description, activity_date, evidence_url, created_at, updated_at;
    `;
    const activityResult = await client.query(insertQuery, [
      studentId,
      title.trim(),
      activity_type.trim(),
      organizer && organizer.trim() ? organizer.trim() : null,
      description.trim(),
      activity_date || null,
      evidence_url && evidence_url.trim() ? evidence_url.trim() : null
    ]);
    const activity = activityResult.rows[0];

    // 2. Map skills strictly against PostgreSQL canonical taxonomy
    const mappedSkills = await mapSkillsForActivity(
      {
        title: activity.title,
        activity_type: activity.activity_type,
        organizer: activity.organizer,
        description: activity.description
      },
      client
    );

    // 3. Insert mapped skills into activity_skills junction table
    const insertedSkills = [];
    for (const skill of mappedSkills) {
      const skillInsertQuery = `
        INSERT INTO activity_skills (activity_id, skill_id, confidence_score, evidence_text)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (activity_id, skill_id) DO UPDATE
        SET confidence_score = EXCLUDED.confidence_score, evidence_text = EXCLUDED.evidence_text
        RETURNING id, activity_id, skill_id, confidence_score, evidence_text, created_at;
      `;
      const skillRes = await client.query(skillInsertQuery, [
        activity.id,
        skill.skill_id,
        skill.confidence_score,
        skill.evidence_text
      ]);

      insertedSkills.push({
        id: skillRes.rows[0].id,
        skill_id: skill.skill_id,
        skill_name: skill.skill_name,
        category: skill.category,
        confidence_score: skill.confidence_score,
        evidence_text: skill.evidence_text
      });
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Activity recorded and skills mapped successfully',
      activity: {
        ...activity,
        skills: insertedSkills
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating activity log:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to record activity log: ' + err.message
    });
  } finally {
    client.release();
  }
}

/**
 * GET /api/activities
 * Retrieve all activities for the logged-in student with mapped skills.
 */
async function getMyActivities(req, res) {
  try {
    const studentId = req.user.id;

    const activitiesRes = await pool.query(
      `SELECT id, student_id, title, activity_type, organizer, description, activity_date, evidence_url, created_at, updated_at
       FROM activity_logs
       WHERE student_id = $1
       ORDER BY activity_date DESC NULLS LAST, created_at DESC;`,
      [studentId]
    );

    const activities = activitiesRes.rows || [];
    if (activities.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        activities: []
      });
    }

    const activityIds = activities.map((a) => a.id);
    const skillsRes = await pool.query(
      `SELECT ask.id, ask.activity_id, ask.skill_id, s.name AS skill_name, s.category, ask.confidence_score, ask.evidence_text
       FROM activity_skills ask
       JOIN skills s ON ask.skill_id = s.id
       WHERE ask.activity_id = ANY($1::uuid[])
       ORDER BY ask.confidence_score DESC;`,
      [activityIds]
    );

    const skillsByActivity = {};
    for (const row of skillsRes.rows || []) {
      if (!skillsByActivity[row.activity_id]) {
        skillsByActivity[row.activity_id] = [];
      }
      skillsByActivity[row.activity_id].push({
        id: row.id,
        skill_id: row.skill_id,
        skill_name: row.skill_name,
        category: row.category,
        confidence_score: row.confidence_score,
        evidence_text: row.evidence_text
      });
    }

    const result = activities.map((act) => ({
      ...act,
      skills: skillsByActivity[act.id] || []
    }));

    return res.status(200).json({
      success: true,
      count: result.length,
      activities: result
    });
  } catch (err) {
    console.error('Error fetching activities:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch activity logs: ' + err.message
    });
  }
}

/**
 * GET /api/activities/:id
 * Retrieve a specific activity log. Strictly enforces ownership.
 */
async function getActivityById(req, res) {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid activity ID format'
    });
  }

  try {
    const actRes = await pool.query(
      `SELECT id, student_id, title, activity_type, organizer, description, activity_date, evidence_url, created_at, updated_at
       FROM activity_logs
       WHERE id = $1;`,
      [id]
    );

    if (actRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity log not found'
      });
    }

    const activity = actRes.rows[0];

    // Ownership isolation: Student A cannot view Student B's activity
    if (activity.student_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not have permission to view this activity log.'
      });
    }

    const skillsRes = await pool.query(
      `SELECT ask.id, ask.activity_id, ask.skill_id, s.name AS skill_name, s.category, ask.confidence_score, ask.evidence_text
       FROM activity_skills ask
       JOIN skills s ON ask.skill_id = s.id
       WHERE ask.activity_id = $1
       ORDER BY ask.confidence_score DESC;`,
      [id]
    );

    return res.status(200).json({
      success: true,
      activity: {
        ...activity,
        skills: skillsRes.rows.map((row) => ({
          id: row.id,
          skill_id: row.skill_id,
          skill_name: row.skill_name,
          category: row.category,
          confidence_score: row.confidence_score,
          evidence_text: row.evidence_text
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching activity by ID:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch activity log: ' + err.message
    });
  }
}

/**
 * PUT /api/activities/:id
 * Update an existing activity log and recalculate mapped skills.
 */
async function updateActivity(req, res) {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid activity ID format'
    });
  }

  const errors = validateActivityPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(' ')
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check existing record and ownership
    const checkRes = await client.query(
      'SELECT id, student_id FROM activity_logs WHERE id = $1 FOR UPDATE;',
      [id]
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Activity log not found'
      });
    }

    const existingActivity = checkRes.rows[0];
    if (existingActivity.student_id !== req.user.id && req.user.role !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not have permission to modify this activity log.'
      });
    }

    const {
      title,
      activity_type,
      organizer = null,
      description,
      activity_date = null,
      evidence_url = null
    } = req.body;

    // 2. Update activity log
    const updateRes = await client.query(
      `UPDATE activity_logs
       SET title = $1, activity_type = $2, organizer = $3, description = $4, activity_date = $5, evidence_url = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, student_id, title, activity_type, organizer, description, activity_date, evidence_url, created_at, updated_at;`,
      [
        title.trim(),
        activity_type.trim(),
        organizer && organizer.trim() ? organizer.trim() : null,
        description.trim(),
        activity_date || null,
        evidence_url && evidence_url.trim() ? evidence_url.trim() : null,
        id
      ]
    );
    const updatedActivity = updateRes.rows[0];

    // 3. Clear old skills for this activity
    await client.query('DELETE FROM activity_skills WHERE activity_id = $1;', [id]);

    // 4. Recalculate mapped skills
    const mappedSkills = await mapSkillsForActivity(
      {
        title: updatedActivity.title,
        activity_type: updatedActivity.activity_type,
        organizer: updatedActivity.organizer,
        description: updatedActivity.description
      },
      client
    );

    const insertedSkills = [];
    for (const skill of mappedSkills) {
      const skillInsertQuery = `
        INSERT INTO activity_skills (activity_id, skill_id, confidence_score, evidence_text)
        VALUES ($1, $2, $3, $4)
        RETURNING id, activity_id, skill_id, confidence_score, evidence_text, created_at;
      `;
      const skillRes = await client.query(skillInsertQuery, [
        id,
        skill.skill_id,
        skill.confidence_score,
        skill.evidence_text
      ]);

      insertedSkills.push({
        id: skillRes.rows[0].id,
        skill_id: skill.skill_id,
        skill_name: skill.skill_name,
        category: skill.category,
        confidence_score: skill.confidence_score,
        evidence_text: skill.evidence_text
      });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Activity updated and skills recalculated successfully',
      activity: {
        ...updatedActivity,
        skills: insertedSkills
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating activity log:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update activity log: ' + err.message
    });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/activities/:id
 * Delete an activity log. Cascades to activity_skills; preserves canonical skills table.
 */
async function deleteActivity(req, res) {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid activity ID format'
    });
  }

  try {
    // 1. Check existing record and ownership
    const checkRes = await pool.query(
      'SELECT id, student_id FROM activity_logs WHERE id = $1;',
      [id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity log not found'
      });
    }

    const activity = checkRes.rows[0];
    if (activity.student_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not have permission to delete this activity log.'
      });
    }

    // 2. Delete record (ON DELETE CASCADE removes activity_skills; skills table is untouched)
    await pool.query('DELETE FROM activity_logs WHERE id = $1;', [id]);

    return res.status(200).json({
      success: true,
      message: 'Activity log deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting activity log:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete activity log: ' + err.message
    });
  }
}

module.exports = {
  createActivity,
  getMyActivities,
  getActivityById,
  updateActivity,
  deleteActivity
};
