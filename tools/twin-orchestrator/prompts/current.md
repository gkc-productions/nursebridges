Paused experiment - do not run through Twin/orchestrator.

Inspect why mobile create-job returns 400.

Current real-device status:
- App opens.
- Login works.
- API base is https://api.nursebridges.com.
- POST /jobs reaches API and returns 400.

Rules:
- Do not change files in inspect mode.
- Compare mobile create-job payload to API validator.
- Identify exact likely invalid field.
- Do not run EAS build.
