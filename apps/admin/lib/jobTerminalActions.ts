import { writeAdminAuditLog } from "./auditLog";
import { createAdminJobTerminalActions } from "./jobTerminalActionsCore";
import { createNotifications } from "./notifications";
import { supabaseAdmin } from "./supabaseAdmin";

const actions = createAdminJobTerminalActions({
  supabaseAdmin,
  createNotifications,
  writeAdminAuditLog
});

export const { cancelJobAsAdmin, completeJobAsAdmin } = actions;
