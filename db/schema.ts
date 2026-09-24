import {integer,sqliteTable,text,uniqueIndex} from 'drizzle-orm/sqlite-core';
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
 section:text('section').notNull(),
 category:text('category').notNull(),
 title:text('title').notNull(),
 organization:text('organization').notNull().default(''),
 url:text('url').notNull().default(''),
 details:text('details').notNull().default(''),
 postedAt:text('posted_at').notNull().default(''),
 actorEmail:text('actor_email').notNull(),
 status:text('status').notNull().default('pending'),
 createdAt:text('created_at').notNull(),
 reviewedAt:text('reviewed_at'),
 reviewedBy:text('reviewed_by'),
});
