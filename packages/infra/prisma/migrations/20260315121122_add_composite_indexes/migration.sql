-- CreateIndex
CREATE INDEX "applications_id_organization_id_idx" ON "applications"("id", "organization_id");

-- CreateIndex
CREATE INDEX "cds_rules_application_id_is_active_idx" ON "cds_rules"("application_id", "is_active");

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_id_created_at_idx" ON "workflow_executions"("workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "workflows_application_id_is_active_idx" ON "workflows"("application_id", "is_active");
