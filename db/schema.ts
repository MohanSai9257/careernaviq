import {index,integer,sqliteTable,text,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const companyEdits=sqliteTable('company_edits',{
 id:text('id').primaryKey(),
 payload:text('payload').notNull(),
 version:integer('version').notNull().default(1),
});
export const addedCompanies=sqliteTable('added_companies',{
 sequence:integer('sequence').primaryKey({autoIncrement:true}),
 id:text('id').notNull().unique(),
 normalizedName:text('normalized_name').notNull().unique(),
 name:text('name').notNull(),
 linkedin:text('linkedin').notNull().default(''),
 careers:text('careers').notNull().default(''),
 category:text('category').notNull(),
});
export const accessUsers=sqliteTable('access_users',{
 email:text('email').primaryKey(),
 status:text('status').notNull().default('pending'),
 requestedAt:text('requested_at').notNull(),
 updatedAt:text('updated_at').notNull(),
});
export const accessSessions=sqliteTable('access_sessions',{
 token:text('token').primaryKey(),
 email:text('email').notNull(),
 role:text('role').notNull(),
 createdAt:text('created_at').notNull(),
});
export const coadmins=sqliteTable('coadmins',{
 email:text('email').primaryKey(),
 grantedAt:text('granted_at').notNull(),
});
export const changeRequests=sqliteTable('change_requests',{
 id:text('id').primaryKey(),
 actorEmail:text('actor_email').notNull(),
 companyId:text('company_id').notNull(),
 companyName:text('company_name').notNull(),
 kind:text('kind').notNull(),
 beforePayload:text('before_payload').notNull(),
 afterPayload:text('after_payload').notNull(),
 baseVersion:integer('base_version').notNull(),
 status:text('status').notNull().default('pending'),
 createdAt:text('created_at').notNull(),
 reviewedAt:text('reviewed_at'),
 reviewedBy:text('reviewed_by'),
});
export const sectionItems=sqliteTable('section_items',{
 id:text('id').primaryKey(),
 version:integer('version').notNull().default(1),
 section:text('section').notNull(),
 category:text('category').notNull(),
 title:text('title').notNull(),
 organization:text('organization').notNull().default(''),
 url:text('url').notNull().default(''),
 details:text('details').notNull().default(''),
 email:text('email').notNull().default(''),
 phone:text('phone').notNull().default(''),
 extension:text('extension').notNull().default(''),
 fileKey:text('file_key').notNull().default(''),
 fileName:text('file_name').notNull().default(''),
 fileType:text('file_type').notNull().default(''),
 postedAt:text('posted_at').notNull().default(''),
 actorEmail:text('actor_email').notNull(),
 status:text('status').notNull().default('pending'),
 createdAt:text('created_at').notNull(),
 reviewedAt:text('reviewed_at'),
 reviewedBy:text('reviewed_by'),
});
export const sectionChangeRequests=sqliteTable('section_change_requests',{
 id:text('id').primaryKey(),
 itemId:text('item_id').notNull(),
 actorEmail:text('actor_email').notNull(),
 kind:text('kind').notNull(),
 beforePayload:text('before_payload').notNull(),
 afterPayload:text('after_payload').notNull(),
 baseVersion:integer('base_version').notNull(),
 pendingFileKey:text('pending_file_key').notNull().default(''),
 status:text('status').notNull().default('pending'),
 createdAt:text('created_at').notNull(),
 reviewedAt:text('reviewed_at'),
 reviewedBy:text('reviewed_by'),
});
export const deletedUsers=sqliteTable('deleted_users',{
 email:text('email').primaryKey(),
 deletedAt:text('deleted_at').notNull(),
 deletedBy:text('deleted_by').notNull(),
});
export const userProfiles=sqliteTable('user_profiles',{
 email:text('email').primaryKey(),
 firstName:text('first_name').notNull(),
 lastName:text('last_name').notNull(),
 mobile:text('mobile').notNull(),
 visaStatus:text('visa_status').notNull(),
 updatedAt:text('updated_at').notNull(),
});
export const tabAccess=sqliteTable('tab_access',{
 tab:text('tab').primaryKey(),
 allowed:integer('allowed').notNull().default(1),
 updatedAt:text('updated_at').notNull(),
 updatedBy:text('updated_by').notNull(),
});
export const importedJobs=sqliteTable('imported_jobs',{
 id:text('id').primaryKey(),
 companyId:text('company_id').notNull(),
 companyName:text('company_name').notNull(),
 category:text('category').notNull(),
 title:text('title').notNull(),
 applyUrl:text('apply_url').notNull(),
 sourceId:text('source_id').notNull(),
 postedAt:text('posted_at').notNull().default(''),
 discoveredAt:text('discovered_at').notNull(),
 lastSeenAt:text('last_seen_at').notNull(),
 isOpen:integer('is_open').notNull().default(1),
 minYears:integer('min_years'),
 maxYears:integer('max_years'),
},table=>({source:uniqueIndex('imported_jobs_company_source').on(table.companyId,table.sourceId),listing:index('imported_jobs_company_category_open_date').on(table.companyId,table.category,table.isOpen,table.postedAt)}));
export const jobSourceChecks=sqliteTable('job_source_checks',{
 companyId:text('company_id').primaryKey(),
 checkedAt:text('checked_at').notNull(),
 status:text('status').notNull(),
 message:text('message').notNull().default(''),
 jobsFound:integer('jobs_found').notNull().default(0),
});


export const autoResumes=sqliteTable('auto_resumes',{id:text('id').primaryKey(),userEmail:text('user_email').notNull(),name:text('name').notNull(),fileKey:text('file_key').notNull(),fileName:text('file_name').notNull(),fileType:text('file_type').notNull(),fileSize:integer('file_size').notNull(),extractedText:text('extracted_text').notNull().default(''),extractionStatus:text('extraction_status').notNull().default('pending_worker'),isDefault:integer('is_default').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()});
export const autoConnectedAccounts=sqliteTable('auto_connected_accounts',{id:text('id').primaryKey(),userEmail:text('user_email').notNull(),provider:text('provider').notNull(),status:text('status').notNull(),authType:text('auth_type').notNull().default('interactive_browser'),lastVerifiedAt:text('last_verified_at'),metadata:text('metadata').notNull().default('{}'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},table=>({userProvider:uniqueIndex('auto_connected_accounts_user_provider').on(table.userEmail,table.provider)}));
export const autoAgentSettings=sqliteTable('auto_agent_settings',{userEmail:text('user_email').primaryKey(),dailyLimit:integer('daily_limit').notNull().default(10),minimumScore:integer('minimum_score').notNull().default(70),requireReview:integer('require_review').notNull().default(1),updatedAt:text('updated_at').notNull()});
export const autoApplications=sqliteTable('auto_applications',{id:text('id').primaryKey(),userEmail:text('user_email').notNull(),importedJobId:text('imported_job_id'),companyName:text('company_name').notNull(),jobTitle:text('job_title').notNull(),jobUrl:text('job_url').notNull(),resumeId:text('resume_id'),matchScore:integer('match_score'),matchReasons:text('match_reasons').notNull().default('[]'),status:text('status').notNull().default('MATCHED'),blockerStatus:text('blocker_status').notNull().default(''),workerTaskId:text('worker_task_id').notNull().default(''),lastActivityAt:text('last_activity_at').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},table=>({userJob:uniqueIndex('auto_applications_user_job').on(table.userEmail,table.jobUrl)}));
export const autoBlockers=sqliteTable('auto_blockers',{id:text('id').primaryKey(),userEmail:text('user_email').notNull(),applicationId:text('application_id').notNull(),companyName:text('company_name').notNull(),jobTitle:text('job_title').notNull(),question:text('question').notNull().default(''),reason:text('reason').notNull(),status:text('status').notNull().default('OPEN'),answer:text('answer').notNull().default(''),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()});
export const autoSavedAnswers=sqliteTable('auto_saved_answers',{id:text('id').primaryKey(),userEmail:text('user_email').notNull(),normalizedQuestion:text('normalized_question').notNull(),question:text('question').notNull(),answer:text('answer').notNull(),answerType:text('answer_type').notNull().default('general'),source:text('source').notNull().default('user'),approvedAt:text('approved_at').notNull(),expiresAt:text('expires_at'),updatedAt:text('updated_at').notNull()},table=>({userQuestion:uniqueIndex('auto_saved_answers_user_question').on(table.userEmail,table.normalizedQuestion)}));
export const autoActivityLogs=sqliteTable('auto_activity_logs',{id:text('id').primaryKey(),userEmail:text('user_email').notNull(),applicationId:text('application_id'),eventType:text('event_type').notNull(),message:text('message').notNull(),metadata:text('metadata').notNull().default('{}'),createdAt:text('created_at').notNull()});
