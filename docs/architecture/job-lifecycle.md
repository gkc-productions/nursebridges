# Job Lifecycle

## Statuses

- `open`: Patient-created job that can receive nurse applications.
- `assigned`: A nurse has been selected and the job is no longer open for applications.
- `completed`: Finished job. It cannot be cancelled, assigned, or receive applications.
- `cancelled`: Cancelled job. It cannot be assigned or receive applications.

## Allowed Transitions

| From | To | Actor | Endpoint | Notes |
| --- | --- | --- | --- | --- |
| none | `open` | patient | `POST /jobs` | The API always sets `patient_user_id` to the authenticated patient. |
| `open` | `cancelled` | owning patient | `PATCH /jobs/:jobId` | Other patients receive `403`. |
| `assigned` | `cancelled` | owning patient | `PATCH /jobs/:jobId` | Completed and cancelled jobs receive `400`. |
| `open` | `assigned` | admin | `POST /api/admin/jobs/assign` or `POST /admin/jobs/assign` | Selected nurse must be approved and must have applied. |
| `open` | `assigned` | owning patient | `POST /v1/applications/:applicationId/decide` | Existing API path; accepting an application assigns consistently. |

## Application Rules

- Nurses can apply only to `open` jobs.
- Nurses must be approved before applying.
- A nurse can have only one application per job.
- Duplicate applications return `409`.
- Applying to `assigned`, `completed`, or `cancelled` jobs returns `400`.
- Assigning a nurse accepts the selected application and rejects other applications for the job.

## Error Codes

- Missing or invalid bearer token: `401`
- Valid token with wrong role or wrong owner: `403`
- Invalid lifecycle transition: `400`
- Duplicate application/conflict: `409`
- Successful create/update/action: `200`
