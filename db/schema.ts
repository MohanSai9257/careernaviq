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
