import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const companyEdits=sqliteTable('company_edits',{
 id:text('id').primaryKey(),
 payload:text('payload').notNull(),
 version:integer('version').notNull().default(1),
});
