// Vercel serverless function entry point.
// If you deploy on Vercel instead of the standalone server/ Express app,
// this file (at /api/coach) is picked up automatically as the
// POST /api/coach endpoint — no server/index.js needed in that path.
const { handleCoachRequest } = require("../server/coachHandler");

module.exports = handleCoachRequest;
