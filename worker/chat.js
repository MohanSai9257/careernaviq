async function ensureAskMessages(database) {
  await database.batch([
    database.prepare(
      'CREATE TABLE IF NOT EXISTS ask_attachments (id text PRIMARY KEY,message_id text NOT NULL,user_email text NOT NULL,file_key text NOT NULL,file_name text NOT NULL,file_size integer NOT NULL)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS ask_attachments_message ON ask_attachments(message_id)',
    ),
    database.prepare(
      'CREATE TABLE IF NOT EXISTS ask_threads (user_email text PRIMARY KEY NOT NULL,updated_at text NOT NULL)',
    ),
    database.prepare(
      "CREATE TABLE IF NOT EXISTS ask_messages (id text PRIMARY KEY NOT NULL, user_email text NOT NULL, user_name text DEFAULT '' NOT NULL, body text NOT NULL, sender text NOT NULL, admin_email text DEFAULT '' NOT NULL, created_at text NOT NULL, read_by_admin_at text, read_by_user_at text)",
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS ask_messages_user_created ON ask_messages (user_email,created_at)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS ask_messages_created ON ask_messages (created_at)',
    ),
  ]);
}

async function chatInput(request) {
  if (
    !(request.headers.get('content-type') || '').includes('multipart/form-data')
  )
    return { ...(await jsonInput(request)), files: [] };
  if (Number(request.headers.get('content-length') || 0) > 27 * 1024 * 1024)
    throw Error('Attachments are too large.');
  const form = await request.formData();
  const files = form
    .getAll('files')
    .filter((f) => typeof f !== 'string' && f.size);
  if (
    files.length > 5 ||
    files.some((f) => f.size > 10 * 1024 * 1024) ||
    files.reduce((n, f) => n + f.size, 0) > 25 * 1024 * 1024
  )
    throw Error('Choose up to 5 files, 10 MB each and 25 MB total.');
  return { body: form.get('body'), email: form.get('email'), files };
}
async function saveChatFiles(database, env, input, messageId, email) {
  const saved = [];
  try {
    for (const file of input.files || []) {
      const id = crypto.randomUUID(),
        key = 'chat/' + id,
        name =
          file.name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 180) ||
          'attachment';
      await bucket(env).put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: 'application/octet-stream' },
      });
      saved.push({ id, key, name, size: file.size });
    }
    if (saved.length)
      await database.batch(
        saved.map((f) =>
          database
            .prepare('INSERT INTO ask_attachments VALUES(?,?,?,?,?,?)')
            .bind(f.id, messageId, email, f.key, f.name, f.size),
        ),
      );
  } catch (error) {
    await Promise.all(saved.map((f) => bucket(env).delete(f.key)));
    await database
      .prepare('DELETE FROM ask_attachments WHERE message_id=?')
      .bind(messageId)
      .run();
    throw error;
  }
}
async function chatAttachments(database) {
  const data = await database
    .prepare('SELECT id,message_id,file_name,file_size FROM ask_attachments')
    .all();
  const map = new Map();
  for (const f of data.results || []) {
    if (!map.has(f.message_id)) map.set(f.message_id, []);
    map.get(f.message_id).push({
      id: f.id,
      name: f.file_name,
      size: f.file_size,
      url: '/api/ask/attachments/' + f.id,
    });
  }
  return map;
}
async function removeChatFiles(database, env, email) {
  const data = await database
    .prepare('SELECT file_key FROM ask_attachments WHERE user_email=?')
    .bind(email)
    .all();
  await Promise.all(
    (data.results || []).map((f) => bucket(env).delete(f.file_key)),
  );
  await database
    .prepare('DELETE FROM ask_attachments WHERE user_email=?')
    .bind(email)
    .run();
}
