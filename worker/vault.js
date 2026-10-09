async function ensureVault(database) {
  await database
    .prepare(
      'CREATE TABLE IF NOT EXISTS credential_vault (user_email text NOT NULL,provider text NOT NULL,encrypted_value text NOT NULL,updated_at text NOT NULL,PRIMARY KEY(user_email,provider))',
    )
    .run();
}
async function vaultCrypto(env, email, provider, value) {
  if (!env.CREDENTIAL_VAULT_KEY)
    throw Object.assign(Error('Secure vault storage is not configured.'), {
      status: 503,
    });
  const raw = Uint8Array.from(atob(env.CREDENTIAL_VAULT_KEY), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  const aad = new TextEncoder().encode(email + '|' + provider);
  if (typeof value === 'string') {
    const data = JSON.parse(value);
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: Uint8Array.from(atob(data.iv), (c) => c.charCodeAt(0)),
        additionalData: aad,
      },
      key,
      Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0)),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  });
}
