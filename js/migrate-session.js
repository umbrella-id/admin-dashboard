/**
 * migrate-session.js — TEMPORARY (hapus setelah 7 hari)
 * 
 * Tujuan: migrasi session dari format lama (passkey plaintext)
 * ke token server-side. Berjalan sekali per admin, di background.
 */

window.attemptSessionMigration = async function() {
  const raw = localStorage.getItem('umbrella_admin_session');
  if (!raw) return { success: false, reason: 'no_session' };

  let session;
  try {
    session = JSON.parse(raw);
  } catch (e) {
    return { success: false, reason: 'parse_error' };
  }

  // Sudah format baru
  if (session.sessionToken) {
    return { success: true, alreadyMigrated: true, sessionToken: session.sessionToken };
  }

  // Format lama harus punya adminPasskey
  if (!session.adminPasskey || !session.admin || !session.admin.id) {
    return { success: false, reason: 'invalid_legacy_format' };
  }

  try {
    const res = await fetch(window.GAS_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'migrateSession',
        adminId: session.admin.id,
        adminPasskey: session.adminPasskey
      })
    });
    const data = await res.json();

    if (data.status === 'success' && data.sessionToken) {
      // Simpan format BARU — passkey TIDAK ikut (otomatis hilang)
      localStorage.setItem('umbrella_admin_session', JSON.stringify({
        admin: data.admin,
        sessionToken: data.sessionToken,
        loggedInAt: Date.now()
      }));
      console.log('✅ Migration sukses. Passkey dihapus dari localStorage.');
      return { success: true, sessionToken: data.sessionToken, admin: data.admin };
    }

    console.warn('⚠️ Migration rejected:', data.message || 'unknown');
    return { success: false, reason: data.message || 'server_rejected' };
  } catch (e) {
    console.error('❌ Migration fetch error:', e);
    return { success: false, reason: 'network_error' };
  }
};

console.log('✅ migrate-session.js loaded (TEMPORARY)');
